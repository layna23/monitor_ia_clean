import logging
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.orm import joinedload

from backend.database.session import SessionLocal
from backend.models.target_db import TargetDB
from backend.models.metric_def import MetricDef
from backend.models.metric_value import MetricValue
from backend.models.metric_run import MetricRun

from backend.services.connection_service import get_target_connection
from backend.services.alert_service import upsert_alert, resolve_alert_if_exists


TUNIS_TZ = ZoneInfo("Africa/Tunis")
logger = logging.getLogger("collector_service")


def now_tunis():
    return datetime.now(TUNIS_TZ)


def evaluate_severity(value_number, warn_threshold, crit_threshold):
    if value_number is None:
        return "INFO"
    if crit_threshold is not None and float(value_number) >= float(crit_threshold):
        return "CRITICAL"
    if warn_threshold is not None and float(value_number) >= float(warn_threshold):
        return "WARNING"
    return "OK"


def normalize_result(row):
    if row is None:
        return None, None

    if isinstance(row, (tuple, list)):
        if len(row) >= 2:
            raw_value = row[1]
        elif len(row) == 1:
            raw_value = row[0]
        else:
            raw_value = None
    else:
        raw_value = row

    try:
        return float(raw_value), None
    except Exception:
        return None, str(raw_value)


def get_next_sequence_value(app_db, sequence_name: str) -> int:
    result = app_db.execute(text(f"SELECT {sequence_name}.NEXTVAL FROM dual"))
    return int(result.scalar())


def collect_one_metric(app_db, db_id: int, metric_id: int):
    started_ts = time.time()
    started_at = now_tunis()

    target_db = (
        app_db.query(TargetDB)
        .options(joinedload(TargetDB.db_type))
        .filter(TargetDB.db_id == db_id)
        .first()
    )
    if not target_db:
        raise ValueError("Base cible introuvable")

    metric = (
        app_db.query(MetricDef)
        .filter(MetricDef.metric_id == metric_id)
        .first()
    )
    if not metric:
        raise ValueError("Métrique introuvable")

    if int(target_db.db_type_id) != int(metric.db_type_id):
        raise ValueError("Type DB incompatible")

    run_id = get_next_sequence_value(app_db, "SEQ_METRIC_RUNS")

    run = MetricRun(
        run_id=run_id,
        db_id=db_id,
        metric_id=metric_id,
        status="FAILED",
        started_at=started_at,
    )
    app_db.add(run)
    app_db.commit()

    conn = None
    cursor = None
    clean_sql = " ".join(str(metric.sql_query or "").split())

    try:
        logger.info("====================================================")
        logger.info("[START] DB=%s | metric=%s | run_id=%s", target_db.db_name, metric.metric_code, run_id)
        logger.info("[SQL] DB=%s | metric=%s | query=%s", target_db.db_name, metric.metric_code, clean_sql)

        conn = get_target_connection(target_db)
        cursor = conn.cursor()

        cursor.execute(metric.sql_query)
        row = cursor.fetchone()

        value_number, value_text = normalize_result(row)

        severity = evaluate_severity(
            value_number=value_number,
            warn_threshold=metric.warn_threshold,
            crit_threshold=metric.crit_threshold,
        )

        duration_ms = int((time.time() - started_ts) * 1000)

        logger.info(
            "[DATA] DB=%s | metric=%s | raw=%s | value_number=%s | value_text=%s | severity=%s",
            target_db.db_name,
            metric.metric_code,
            row,
            value_number,
            value_text,
            severity,
        )

        value_id = get_next_sequence_value(app_db, "SEQ_METRIC_VALUES")

        metric_value = MetricValue(
            value_id=value_id,
            db_id=db_id,
            metric_id=metric_id,
            value_number=value_number,
            value_text=value_text,
            severity=severity,
            collected_at=now_tunis(),
        )
        app_db.add(metric_value)
        app_db.commit()

        run.status = "SUCCESS"
        run.value_id = metric_value.value_id
        run.duration_ms = duration_ms
        run.ended_at = now_tunis()
        run.error_message = None
        target_db.last_collect_at = now_tunis()

        last_val = str(value_number) if value_number is not None else (value_text or "N/A")

        if severity in ("WARNING", "CRITICAL"):
            upsert_alert(
                db=app_db,
                db_id=db_id,
                metric_id=metric_id,
                severity=severity,
                title=f"{metric.metric_code} {severity}",
                details=f"value={last_val} | warn={metric.warn_threshold} | crit={metric.crit_threshold}",
                last_value=last_val,
            )
        else:
            resolve_alert_if_exists(
                db=app_db,
                db_id=db_id,
                metric_id=metric_id,
            )

        app_db.commit()

        logger.info(
            "[OK] DB=%s | metric=%s | run_id=%s | value_id=%s | duration_ms=%s",
            target_db.db_name,
            metric.metric_code,
            run.run_id,
            metric_value.value_id,
            duration_ms,
        )

        return {
            "success": True,
            "run_id": int(run.run_id),
            "value_id": int(metric_value.value_id),
            "db_id": db_id,
            "metric_id": metric_id,
            "metric_code": metric.metric_code,
            "db_name": target_db.db_name,
            "sql_query": clean_sql,
            "raw_row": str(row),
            "value_number": value_number,
            "value_text": value_text,
            "severity": severity,
            "duration_ms": duration_ms,
            "collected_at": metric_value.collected_at,
            "error": None,
        }

    except Exception as e:
        app_db.rollback()

        run = app_db.query(MetricRun).filter(MetricRun.run_id == run_id).first()
        if run:
            run.status = "FAILED"
            run.error_message = str(e)
            run.duration_ms = int((time.time() - started_ts) * 1000)
            run.ended_at = now_tunis()
            run.value_id = None
            app_db.commit()

        try:
            upsert_alert(
                db=app_db,
                db_id=db_id,
                metric_id=metric_id,
                severity="CRITICAL",
                title=f"Metric {metric.metric_code} execution failed",
                details=str(e),
                last_value=None,
            )
            app_db.commit()
        except Exception:
            app_db.rollback()

        logger.exception("[FAIL] DB=%s | metric=%s | run_id=%s", target_db.db_name, metric.metric_code, run_id)

        return {
            "success": False,
            "run_id": int(run_id),
            "db_id": db_id,
            "metric_id": metric_id,
            "metric_code": metric.metric_code,
            "db_name": target_db.db_name,
            "sql_query": clean_sql,
            "raw_row": None,
            "value_number": None,
            "value_text": None,
            "severity": "N/A",
            "duration_ms": int((time.time() - started_ts) * 1000),
            "collected_at": None,
            "error": str(e),
        }

    finally:
        try:
            if cursor:
                cursor.close()
        except Exception:
            pass
        try:
            if conn:
                conn.close()
        except Exception:
            pass


def should_run(app_db, db_id: int, metric_id: int, frequency_sec: int) -> bool:
    last_run = (
        app_db.query(MetricRun)
        .filter(
            MetricRun.db_id == db_id,
            MetricRun.metric_id == metric_id,
            MetricRun.status == "SUCCESS",
        )
        .order_by(MetricRun.started_at.desc())
        .first()
    )

    if not last_run or not last_run.started_at:
        return True

    last_time = last_run.started_at
    if last_time.tzinfo is None:
        last_time = last_time.replace(tzinfo=TUNIS_TZ)

    next_time = last_time + timedelta(seconds=int(frequency_sec))
    return now_tunis() >= next_time