from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

from backend.database.session import get_db
from backend.models.metric_value import MetricValue
from backend.models.metric_def import MetricDef
from backend.models.target_db import TargetDB
from backend.schemas.metric_value import (
    MetricValueCreate,
    MetricValueOut,
    MetricValueUpdate,
    MetricDetailOut,
    MetricHistoryPoint,
)

router = APIRouter(prefix="/metric-values", tags=["Metric Values"])


@router.get("/", response_model=list[MetricValueOut])
def list_metric_values(db: Session = Depends(get_db)):
    return db.query(MetricValue).order_by(MetricValue.value_id.desc()).all()


@router.post("/", response_model=MetricValueOut, status_code=status.HTTP_201_CREATED)
def create_metric_value(payload: MetricValueCreate, db: Session = Depends(get_db)):

    try:
        who = db.execute(text("SELECT USER FROM DUAL")).scalar()
        print("CONNECTED AS:", who)
    except Exception:
        pass

    try:
        next_id = db.execute(
            text("SELECT DBMON.METRIC_VALUES_SEQ.NEXTVAL FROM DUAL")
        ).scalar()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                "Cannot get NEXTVAL from DBMON.METRIC_VALUES_SEQ. "
                "Ask DBMON/DBA to grant access: GRANT SELECT ON DBMON.METRIC_VALUES_SEQ TO <your_user>. "
                f"Error: {str(e)}"
            ),
        )

    obj = MetricValue(
        value_id=next_id,
        db_id=payload.db_id,
        metric_id=payload.metric_id,
        value_number=payload.value_number,
        value_text=payload.value_text,
        severity=payload.severity,
        collected_at=payload.collected_at or datetime.now(),
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
            raise HTTPException(status_code=409, detail=f"Duplicate key (UNIQUE/PK). {msg}")

        if "ORA-02291" in msg:
            raise HTTPException(status_code=409, detail=f"Invalid FK (db_id/metric_id). {msg}")

        if "ORA-01400" in msg:
            raise HTTPException(status_code=409, detail=f"Missing required field (NOT NULL). {msg}")

        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")


@router.get("/details/{metric_id}/{db_id}", response_model=MetricDetailOut)
def get_metric_detail(metric_id: int, db_id: int, db: Session = Depends(get_db)):
    metric = db.query(MetricDef).filter(MetricDef.metric_id == metric_id).first()
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    target_db = db.query(TargetDB).filter(TargetDB.db_id == db_id).first()
    if not target_db:
        raise HTTPException(status_code=404, detail="Target DB not found")

    latest_value = (
        db.query(MetricValue)
        .filter(
            MetricValue.metric_id == metric_id,
            MetricValue.db_id == db_id
        )
        .order_by(MetricValue.collected_at.desc(), MetricValue.value_id.desc())
        .first()
    )

    if not latest_value:
        raise HTTPException(
            status_code=404,
            detail="No values found for this metric and database"
        )

    history_rows = (
        db.query(MetricValue)
        .filter(
            MetricValue.metric_id == metric_id,
            MetricValue.db_id == db_id
        )
        .order_by(MetricValue.collected_at.desc(), MetricValue.value_id.desc())
        .limit(20)
        .all()
    )

    history_rows = list(reversed(history_rows))

    history = [
        MetricHistoryPoint(
            value_id=row.value_id,
            value_number=row.value_number,
            value_text=row.value_text,
            severity=row.severity,
            collected_at=row.collected_at,
        )
        for row in history_rows
    ]

    return MetricDetailOut(
        metric_id=metric.metric_id,
        metric_code=metric.metric_code,
        metric_name=getattr(metric, "metric_name", None),
        db_id=target_db.db_id,
        db_name=target_db.db_name,
        current_value_number=latest_value.value_number,
        current_value_text=latest_value.value_text,
        severity=latest_value.severity,
        collected_at=latest_value.collected_at,
        warn_threshold=getattr(metric, "warn_threshold", None),
        crit_threshold=getattr(metric, "crit_threshold", None),
        frequency_sec=getattr(metric, "frequency_sec", None),
        sql_query=getattr(metric, "sql_query", None),
        history=history
    )


@router.get("/history/{metric_id}/{db_id}", response_model=list[MetricHistoryPoint])
def get_metric_history(metric_id: int, db_id: int, limit: int = 50, db: Session = Depends(get_db)):
    rows = (
        db.query(MetricValue)
        .filter(
            MetricValue.metric_id == metric_id,
            MetricValue.db_id == db_id
        )
        .order_by(MetricValue.collected_at.desc(), MetricValue.value_id.desc())
        .limit(limit)
        .all()
    )

    rows = list(reversed(rows))

    return [
        MetricHistoryPoint(
            value_id=row.value_id,
            value_number=row.value_number,
            value_text=row.value_text,
            severity=row.severity,
            collected_at=row.collected_at,
        )
        for row in rows
    ]


@router.get("/latest")
def get_latest_metric_values(db: Session = Depends(get_db)):
    rows = (
        db.query(MetricValue, MetricDef, TargetDB)
        .join(MetricDef, MetricDef.metric_id == MetricValue.metric_id)
        .join(TargetDB, TargetDB.db_id == MetricValue.db_id)
        .order_by(MetricValue.collected_at.desc(), MetricValue.value_id.desc())
        .all()
    )

    latest_map = {}
    for mv, metric, target_db in rows:
        key = (mv.metric_id, mv.db_id)
        if key not in latest_map:
            latest_map[key] = {
                "value_id": mv.value_id,
                "metric_id": mv.metric_id,
                "metric_code": metric.metric_code,
                "metric_name": getattr(metric, "metric_name", None),
                "db_id": mv.db_id,
                "db_name": target_db.db_name,
                "value_number": mv.value_number,
                "value_text": mv.value_text,
                "severity": mv.severity,
                "collected_at": mv.collected_at,
            }

    return list(latest_map.values())


@router.get("/{value_id}", response_model=MetricValueOut)
def get_metric_value(value_id: int, db: Session = Depends(get_db)):
    obj = db.query(MetricValue).filter(MetricValue.value_id == value_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="MetricValue not found")
    return obj


@router.put("/{value_id}", response_model=MetricValueOut)
def update_metric_value(value_id: int, payload: MetricValueUpdate, db: Session = Depends(get_db)):
    obj = db.query(MetricValue).filter(MetricValue.value_id == value_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="MetricValue not found")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)

    try:
        db.commit()
        db.refresh(obj)
        return obj
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig)

        if "ORA-00001" in msg:
            raise HTTPException(status_code=409, detail=f"Duplicate key (UNIQUE/PK). {msg}")

        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")


@router.delete("/{value_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_metric_value(value_id: int, db: Session = Depends(get_db)):
    obj = db.query(MetricValue).filter(MetricValue.value_id == value_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="MetricValue not found")

    try:
        db.delete(obj)
        db.commit()
        return
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig)
        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")