from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

from backend.database.session import get_db
from backend.models.metric_def import MetricDef
from backend.schemas.metric_def import (
    MetricDefCreate,
    MetricDefOut,
    MetricDefUpdate,
)

router = APIRouter(prefix="/metric-defs", tags=["Metric Defs"])


# ✅ LIST ALL
@router.get("/", response_model=list[MetricDefOut])
def list_metric_defs(db: Session = Depends(get_db)):
    return db.query(MetricDef).order_by(MetricDef.metric_id).all()


# ✅ GET BY ID
@router.get("/{metric_id}", response_model=MetricDefOut)
def get_metric_def(metric_id: int, db: Session = Depends(get_db)):
    obj = db.query(MetricDef).filter(MetricDef.metric_id == metric_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="MetricDef not found")
    return obj


# ✅ CREATE (Oracle 11g compatible - Sequence côté API)
@router.post("/", response_model=MetricDefOut, status_code=status.HTTP_201_CREATED)
def create_metric_def(payload: MetricDefCreate, db: Session = Depends(get_db)):
    try:
        next_id = db.execute(
            text("SELECT METRIC_DEFS_SEQ.NEXTVAL FROM DUAL")
        ).scalar()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cannot get NEXTVAL from sequence METRIC_DEFS_SEQ: {str(e)}",
        )

    obj = MetricDef(
        metric_id=next_id,
        metric_code=payload.metric_code,
        db_type_id=payload.db_type_id,
        unit=payload.unit,
        frequency_sec=payload.frequency_sec,
        warn_threshold=payload.warn_threshold,
        crit_threshold=payload.crit_threshold,
        is_active=payload.is_active,
        sql_query=payload.sql_query,
        category=payload.category,
        created_at=datetime.now(),
    )

    db.add(obj)

    try:
        db.commit()
        db.refresh(obj)
        return obj
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig)

        if "ORA-00001" in msg:
            raise HTTPException(status_code=409, detail="metric_code already exists.")
        if "ORA-02291" in msg:
            raise HTTPException(status_code=409, detail="Invalid db_type_id (FK).")
        if "ORA-01400" in msg:
            raise HTTPException(status_code=409, detail="Missing required field (NOT NULL).")

        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")


# ✅ UPDATE
@router.put("/{metric_id}", response_model=MetricDefOut)
def update_metric_def(metric_id: int, payload: MetricDefUpdate, db: Session = Depends(get_db)):
    obj = db.query(MetricDef).filter(MetricDef.metric_id == metric_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="MetricDef not found")

    data = payload.model_dump(exclude_unset=True)
    data.pop("created_at", None)

    for key, value in data.items():
        setattr(obj, key, value)

    try:
        db.commit()
        db.refresh(obj)
        return obj
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig)

        if "ORA-00001" in msg:
            raise HTTPException(status_code=409, detail="metric_code already exists.")
        if "ORA-02291" in msg:
            raise HTTPException(status_code=409, detail="Invalid db_type_id (FK).")

        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")


# ✅ DELETE
@router.delete("/{metric_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_metric_def(metric_id: int, db: Session = Depends(get_db)):
    obj = db.query(MetricDef).filter(MetricDef.metric_id == metric_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="MetricDef not found")

    try:
        db.execute(
            text("DELETE FROM ALERTS WHERE METRIC_ID = :metric_id"),
            {"metric_id": metric_id},
        )

        db.execute(
            text("DELETE FROM METRIC_RUNS WHERE METRIC_ID = :metric_id"),
            {"metric_id": metric_id},
        )

        db.execute(
            text("DELETE FROM METRIC_VALUES WHERE METRIC_ID = :metric_id"),
            {"metric_id": metric_id},
        )

        db.execute(
            text("DELETE FROM METRIC_DEFS WHERE METRIC_ID = :metric_id"),
            {"metric_id": metric_id},
        )

        db.commit()

    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig)

        if "ORA-02292" in msg:
            raise HTTPException(
                status_code=409,
                detail="Cannot delete: child records still exist (FK constraint).",
            )

        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")