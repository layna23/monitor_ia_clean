from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.models.target_db import TargetDB
from backend.models.metric_value import MetricValue
from backend.models.metric_def import MetricDef
from backend.services.ai_service import analyze_metrics


def analyze_database_from_db(db: Session, db_id: int) -> str:
    target = db.query(TargetDB).filter(TargetDB.db_id == db_id).first()
    if not target:
        raise ValueError("Base cible introuvable")

    subq = (
        db.query(
            MetricValue.metric_id,
            func.max(MetricValue.collected_at).label("max_collected_at"),
        )
        .filter(MetricValue.db_id == db_id)
        .group_by(MetricValue.metric_id)
        .subquery()
    )

    rows = (
        db.query(MetricValue, MetricDef)
        .join(
            subq,
            (MetricValue.metric_id == subq.c.metric_id)
            & (MetricValue.collected_at == subq.c.max_collected_at),
        )
        .join(MetricDef, MetricDef.metric_id == MetricValue.metric_id)
        .filter(MetricValue.db_id == db_id)
        .all()
    )

    metrics = []
    for mv, md in rows:
        value = mv.value_number if mv.value_number is not None else mv.value_text

        metrics.append({
            "code": md.metric_code,
            "value": value,
            "severity": mv.severity or "UNKNOWN",
            "unit": md.unit or "",
        })

    if not metrics:
        raise ValueError("Aucune métrique trouvée pour cette base")

    return analyze_metrics(
        db_name=target.db_name,
        db_type=(target.db_type.name if target.db_type else "ORACLE"),
        metrics=metrics,
    )