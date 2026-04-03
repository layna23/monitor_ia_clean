from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.models.alerts import Alert  # adapte si ton fichier s'appelle alerts.py


def _next_alert_id(db: Session) -> int:
    return db.execute(text("SELECT DBMON.ALERTS_SEQ.NEXTVAL FROM DUAL")).scalar()


def upsert_alert(
    db: Session,
    db_id: int,
    metric_id: int,
    severity: str,
    title: str,
    details: str | None,
    last_value: str | None,
    status_open_values: tuple[str, ...] = ("OPEN", "ACK"),
) -> Alert:
    """
    Si une alerte OPEN/ACK existe pour (db_id, metric_id) => update.
    Sinon => create.
    """
    existing = (
        db.query(Alert)
        .filter(Alert.db_id == db_id, Alert.metric_id == metric_id, Alert.status.in_(status_open_values))
        .order_by(Alert.alert_id.desc())
        .first()
    )

    now = datetime.now()

    if existing:
        existing.severity = severity
        existing.title = title
        existing.details = details
        existing.last_value = last_value
        existing.updated_at = now
        # on garde status OPEN/ACK tel quel
        return existing

    new_alert = Alert(
        alert_id=_next_alert_id(db),
        db_id=db_id,
        metric_id=metric_id,
        severity=severity,
        status="OPEN",
        title=title,
        details=details,
        last_value=last_value,
        created_at=now,
        updated_at=now,
    )
    db.add(new_alert)
    return new_alert


def resolve_alert_if_exists(
    db: Session,
    db_id: int,
    metric_id: int,
    resolution_note: str | None = None,
    status_open_values: tuple[str, ...] = ("OPEN", "ACK"),
) -> Alert | None:
    """
    Si une alerte OPEN/ACK existe => RESOLVED + closed_at.
    """
    existing = (
        db.query(Alert)
        .filter(Alert.db_id == db_id, Alert.metric_id == metric_id, Alert.status.in_(status_open_values))
        .order_by(Alert.alert_id.desc())
        .first()
    )
    if not existing:
        return None

    now = datetime.now()
    existing.status = "RESOLVED"
    existing.closed_at = now
    existing.updated_at = now
    if resolution_note:
        existing.details = (existing.details or "") + f"\n[RESOLVED] {resolution_note}"
    return existing