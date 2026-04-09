from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from backend.database.session import get_db
from backend.models.target_db import TargetDB
from backend.models.metric_value import MetricValue
from backend.models.metric_run import MetricRun
from backend.models.metric_def import MetricDef

from backend.schemas.target_db import (
    TargetDBCreate,
    TargetDBUpdate,
    TargetDBOut,
    TargetDBOverviewOut,
    TargetDBLatestMetricOut,
)

router = APIRouter(prefix="/target-dbs", tags=["Target DBs"])


@router.get("/", response_model=list[TargetDBOut])
def list_target_dbs(
    only_active: bool = Query(True, description="Si true, retourne seulement les bases actives"),
    db: Session = Depends(get_db),
):
    q = db.query(TargetDB)
    if only_active:
        q = q.filter(TargetDB.is_active == 1)
    return q.order_by(TargetDB.db_id).all()


@router.get("/{db_id}/overview", response_model=TargetDBOverviewOut)
def get_target_db_overview(db_id: int, db: Session = Depends(get_db)):
    obj = db.query(TargetDB).filter(TargetDB.db_id == db_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Target DB not found")

    total_metric_values = db.query(MetricValue).filter(MetricValue.db_id == db_id).count()

    total_runs = db.query(MetricRun).filter(MetricRun.db_id == db_id).count()

    success_runs = (
        db.query(MetricRun)
        .filter(
            MetricRun.db_id == db_id,
            MetricRun.status == "SUCCESS"
        )
        .count()
    )

    failed_runs = total_runs - success_runs
    success_rate = round((success_runs / total_runs) * 100, 2) if total_runs > 0 else 0.0

    latest_rows = (
        db.query(MetricValue, MetricDef)
        .join(MetricDef, MetricDef.metric_id == MetricValue.metric_id)
        .filter(MetricValue.db_id == db_id)
        .order_by(MetricValue.collected_at.desc(), MetricValue.value_id.desc())
        .all()
    )

    latest_map = {}
    for mv, metric in latest_rows:
        key = int(mv.metric_id)
        if key not in latest_map:
            latest_map[key] = TargetDBLatestMetricOut(
                metric_id=int(mv.metric_id),
                metric_code=metric.metric_code,
                value_number=float(mv.value_number) if mv.value_number is not None else None,
                value_text=mv.value_text,
                severity=mv.severity,
                collected_at=mv.collected_at,
                sql_query=metric.sql_query,
                warn_threshold=float(metric.warn_threshold) if metric.warn_threshold is not None else None,
                crit_threshold=float(metric.crit_threshold) if metric.crit_threshold is not None else None,
                frequency_sec=int(metric.frequency_sec) if metric.frequency_sec is not None else None,
                unit=metric.unit,
            )

    db_type_name = None
    if obj.db_type is not None:
        db_type_name = obj.db_type.name

    archive_mode = None

    if obj.db_type is not None and obj.db_type.name and obj.db_type.name.upper() == "ORACLE":
        try:
            import oracledb

            connect_kwargs = {
                "user": str(obj.username),
                "password": str(obj.password_enc),
                "host": str(obj.host),
                "port": int(obj.port),
            }

            if obj.service_name:
                connect_kwargs["service_name"] = str(obj.service_name)
            elif obj.sid:
                connect_kwargs["sid"] = str(obj.sid)

            conn = oracledb.connect(**connect_kwargs)
            cursor = conn.cursor()
            cursor.execute("SELECT LOG_MODE FROM V$DATABASE")
            row = cursor.fetchone()

            if row:
                archive_mode = row[0]
                print("ARCHIVE_MODE =", archive_mode)

            cursor.close()
            conn.close()

        except Exception as e:
            print(f"ERREUR récupération archive_mode pour DB {db_id}: {e}")
            archive_mode = None

    return TargetDBOverviewOut(
        db_id=int(obj.db_id),
        db_name=obj.db_name,
        db_type_id=int(obj.db_type_id),
        db_type_name=db_type_name,
        host=obj.host,
        port=int(obj.port),
        service_name=obj.service_name,
        sid=obj.sid,
        is_active=int(obj.is_active),
        last_collect_at=obj.last_collect_at,
        total_metric_values=total_metric_values,
        total_runs=total_runs,
        success_runs=success_runs,
        failed_runs=failed_runs,
        success_rate=success_rate,
        archive_mode=archive_mode,
        latest_metrics=list(latest_map.values()),
    )


@router.get("/{db_id}/metrics-history")
def get_target_db_metrics_history(
    db_id: int,
    metric_code: str | None = Query(None, description="Filtrer par code métrique"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    obj = db.query(TargetDB).filter(TargetDB.db_id == db_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Target DB not found")

    q = (
        db.query(MetricValue, MetricDef)
        .join(MetricDef, MetricDef.metric_id == MetricValue.metric_id)
        .filter(MetricValue.db_id == db_id)
    )

    if metric_code:
        q = q.filter(MetricDef.metric_code == metric_code)

    rows = (
        q.order_by(MetricValue.collected_at.desc(), MetricValue.value_id.desc())
        .limit(limit)
        .all()
    )

    results = []
    for mv, metric in rows:
        results.append({
            "value_id": int(mv.value_id),
            "db_id": int(mv.db_id),
            "metric_id": int(mv.metric_id),
            "metric_code": metric.metric_code,
            "value_number": float(mv.value_number) if mv.value_number is not None else None,
            "value_text": mv.value_text,
            "severity": mv.severity,
            "collected_at": mv.collected_at,
            "unit": metric.unit,
            "warn_threshold": float(metric.warn_threshold) if metric.warn_threshold is not None else None,
            "crit_threshold": float(metric.crit_threshold) if metric.crit_threshold is not None else None,
        })

    return list(reversed(results))


@router.get("/{db_id}/top-queries")
def get_target_db_top_queries(
    db_id: int,
    db: Session = Depends(get_db),
):
    obj = db.query(TargetDB).filter(TargetDB.db_id == db_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Target DB not found")

    return [
        {
            "sql_id": "Q1",
            "sql_text": "SELECT * FROM employees WHERE department_id = :1",
            "executions": 120,
            "avg_time_ms": 145,
            "status": "warning",
        },
        {
            "sql_id": "Q2",
            "sql_text": "UPDATE orders SET status = :1 WHERE order_id = :2",
            "executions": 84,
            "avg_time_ms": 98,
            "status": "ok",
        },
        {
            "sql_id": "Q3",
            "sql_text": "SELECT customer_id, SUM(amount) FROM payments GROUP BY customer_id",
            "executions": 63,
            "avg_time_ms": 230,
            "status": "critical",
        },
        {
            "sql_id": "Q4",
            "sql_text": "DELETE FROM audit_logs WHERE created_at < SYSDATE - 30",
            "executions": 11,
            "avg_time_ms": 310,
            "status": "warning",
        },
        {
            "sql_id": "Q5",
            "sql_text": "SELECT COUNT(*) FROM sessions WHERE status = 'ACTIVE'",
            "executions": 156,
            "avg_time_ms": 45,
            "status": "ok",
        },
    ]


@router.get("/{db_id}", response_model=TargetDBOut)
def get_target_db(db_id: int, db: Session = Depends(get_db)):
    obj = db.query(TargetDB).filter(TargetDB.db_id == db_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Target DB not found")
    return obj


@router.post("/", response_model=TargetDBOut, status_code=status.HTTP_201_CREATED)
def create_target_db(payload: TargetDBCreate, db: Session = Depends(get_db)):
    exists = (
        db.query(TargetDB)
        .filter(
            TargetDB.db_name == payload.db_name,
            TargetDB.host == payload.host,
            TargetDB.port == payload.port,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="Target DB already exists")

    obj = TargetDB(**payload.model_dump())
    db.add(obj)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Integrity error: {str(e.orig)}")

    db.refresh(obj)
    return obj


@router.put("/{db_id}", response_model=TargetDBOut)
def update_target_db(db_id: int, payload: TargetDBUpdate, db: Session = Depends(get_db)):
    obj = db.query(TargetDB).filter(TargetDB.db_id == db_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Target DB not found")

    data = payload.model_dump(exclude_unset=True)

    for k, v in data.items():
        setattr(obj, k, v)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Integrity error: {str(e.orig)}")

    db.refresh(obj)
    return obj


@router.delete("/{db_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_target_db(
    db_id: int,
    hard: bool = Query(False, description="Si true => suppression physique (hard delete)"),
    db: Session = Depends(get_db),
):
    obj = db.query(TargetDB).filter(TargetDB.db_id == db_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Target DB not found")

    if not hard:
        obj.is_active = 0
        try:
            db.commit()
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Integrity error: {str(e.orig)}")
        return

    db.delete(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Cannot hard delete: child records exist (FK). {str(e.orig)}",
        )
    return