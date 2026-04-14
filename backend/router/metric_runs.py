from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

from backend.database.session import get_db
from backend.models.metric_run import MetricRun
from backend.models.metric_def import MetricDef
from backend.models.metric_value import MetricValue
from backend.schemas.metric_run import (
    MetricRunCreate,
    MetricRunOut,
    MetricRunUpdate,
    MetricRunHistoryOut,
)

router = APIRouter(prefix="/metric-runs", tags=["Metric Runs"])


@router.get("/", response_model=list[MetricRunOut])
def list_metric_runs(db: Session = Depends(get_db)):
    return db.query(MetricRun).order_by(MetricRun.run_id.desc()).all()


@router.get("/{run_id}", response_model=MetricRunOut)
def get_metric_run(run_id: int, db: Session = Depends(get_db)):
    obj = db.query(MetricRun).filter(MetricRun.run_id == run_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="MetricRun not found")
    return obj


@router.get("/history/by-db/{db_id}", response_model=list[MetricRunHistoryOut])
def get_metric_runs_history_by_db(db_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(
            MetricRun.run_id.label("run_id"),
            MetricRun.metric_id.label("metric_id"),
            MetricRun.db_id.label("db_id"),
            MetricDef.metric_code.label("metric_code"),
            MetricRun.status.label("status"),
            MetricRun.duration_ms.label("duration_ms"),
            MetricRun.started_at.label("started_at"),
            MetricRun.ended_at.label("ended_at"),
            MetricRun.error_message.label("error_message"),
            MetricRun.value_id.label("value_id"),
            MetricDef.sql_query.label("sql_query"),
            MetricValue.value_number.label("value_number"),
            MetricValue.value_text.label("value_text"),
            MetricValue.severity.label("severity"),
            MetricValue.collected_at.label("collected_at"),
        )
        .join(MetricDef, MetricDef.metric_id == MetricRun.metric_id)
        .outerjoin(MetricValue, MetricValue.value_id == MetricRun.value_id)
        .filter(MetricRun.db_id == db_id)
        .order_by(MetricRun.started_at.asc(), MetricRun.run_id.asc())
        .all()
    )

    return rows


@router.get("/history/by-db/{db_id}/by-metric/{metric_code}", response_model=list[MetricRunHistoryOut])
def get_metric_runs_history_by_db_and_metric(
    db_id: int,
    metric_code: str,
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            MetricRun.run_id.label("run_id"),
            MetricRun.metric_id.label("metric_id"),
            MetricRun.db_id.label("db_id"),
            MetricDef.metric_code.label("metric_code"),
            MetricRun.status.label("status"),
            MetricRun.duration_ms.label("duration_ms"),
            MetricRun.started_at.label("started_at"),
            MetricRun.ended_at.label("ended_at"),
            MetricRun.error_message.label("error_message"),
            MetricRun.value_id.label("value_id"),
            MetricDef.sql_query.label("sql_query"),
            MetricValue.value_number.label("value_number"),
            MetricValue.value_text.label("value_text"),
            MetricValue.severity.label("severity"),
            MetricValue.collected_at.label("collected_at"),
        )
        .join(MetricDef, MetricDef.metric_id == MetricRun.metric_id)
        .outerjoin(MetricValue, MetricValue.value_id == MetricRun.value_id)
        .filter(
            MetricRun.db_id == db_id,
            MetricDef.metric_code == metric_code,
        )
        .order_by(MetricRun.started_at.asc(), MetricRun.run_id.asc())
        .all()
    )

    return rows


@router.post("/", response_model=MetricRunOut, status_code=status.HTTP_201_CREATED)
def create_metric_run(payload: MetricRunCreate, db: Session = Depends(get_db)):
    try:
        next_id = db.execute(text("SELECT DBMON.METRIC_RUNS_SEQ.NEXTVAL FROM DUAL")).scalar()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cannot get NEXTVAL from DBMON.METRIC_RUNS_SEQ. Error: {str(e)}",
        )

    obj = MetricRun(
        run_id=next_id,
        metric_id=payload.metric_id,
        db_id=payload.db_id,
        status=payload.status,
        duration_ms=payload.duration_ms,
        error_message=payload.error_message,
        value_id=payload.value_id,
        started_at=payload.started_at or datetime.now(),
        ended_at=payload.ended_at,
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
            raise HTTPException(status_code=409, detail=f"Duplicate key (PK/UNIQUE). {msg}")
        if "ORA-02291" in msg:
            raise HTTPException(status_code=409, detail=f"Invalid FK (db_id/metric_id/value_id). {msg}")
        if "ORA-01400" in msg:
            raise HTTPException(status_code=409, detail=f"Missing required field (NOT NULL). {msg}")
        if "ORA-02290" in msg:
            raise HTTPException(status_code=409, detail=f"Check constraint failed (STATUS). {msg}")

        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")


@router.put("/{run_id}", response_model=MetricRunOut)
def update_metric_run(run_id: int, payload: MetricRunUpdate, db: Session = Depends(get_db)):
    obj = db.query(MetricRun).filter(MetricRun.run_id == run_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="MetricRun not found")

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

        if "ORA-02291" in msg:
            raise HTTPException(status_code=409, detail=f"Invalid FK (value_id). {msg}")
        if "ORA-02290" in msg:
            raise HTTPException(status_code=409, detail=f"Check constraint failed (STATUS). {msg}")

        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_metric_run(run_id: int, db: Session = Depends(get_db)):
    obj = db.query(MetricRun).filter(MetricRun.run_id == run_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="MetricRun not found")

    try:
        db.delete(obj)
        db.commit()
        return
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig)
        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")