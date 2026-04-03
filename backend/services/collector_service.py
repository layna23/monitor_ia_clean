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

import backend.models
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
    raw_value = row[0] if isinstance(row, (tuple, list)) else row
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
        raise ValueError("La métrique ne correspond pas au type de la base cible")

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
    app_db.refresh(run)

    conn = None
    cursor = None

    try:
        logger.info("====================================================")
        logger.info("[START] DB=%s | metric=%s | run_id=%s", target_db.db_name, metric.metric_code, run_id)

        conn = get_target_connection(target_db)
        cursor = conn.cursor()

        clean_sql = " ".join(str(metric.sql_query).split())
        logger.info("[SQL]   DB=%s | metric=%s | query=%s", target_db.db_name, metric.metric_code, clean_sql)

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
            "[DATA]  DB=%s | metric=%s | raw=%s | value_number=%s | value_text=%s | severity=%s",
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
        app_db.refresh(metric_value)

        run.status = "SUCCESS"
        run.value_id = metric_value.value_id
        run.duration_ms = duration_ms
        run.ended_at = now_tunis()
        run.error_message = None
        target_db.last_collect_at = now_tunis()

        last_val_str = str(value_number) if value_number is not None else (value_text or "N/A")

        if severity in ("WARNING", "CRITICAL"):
            upsert_alert(
                db=app_db,
                db_id=db_id,
                metric_id=metric_id,
                severity=severity,
                title=f"Metric {metric.metric_code} is {severity}",
                details=f"Value={last_val_str} | warn={metric.warn_threshold} | crit={metric.crit_threshold}",
                last_value=last_val_str,
            )
        else:
            resolve_alert_if_exists(
                db=app_db,
                db_id=db_id,
                metric_id=metric_id,
            )

        app_db.commit()

        logger.info(
            "[OK]    DB=%s | metric=%s | run_id=%s | value_id=%s | duration_ms=%s",
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
            "value_number": value_number,
            "value_text": value_text,
            "severity": severity,
            "collected_at": metric_value.collected_at,
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

        logger.exception("[FAIL]  DB=%s | metric=%s | run_id=%s", target_db.db_name, metric.metric_code, run_id)

        return {
            "success": False,
            "run_id": int(run_id),
            "db_id": db_id,
            "metric_id": metric_id,
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

    started_at = last_run.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=TUNIS_TZ)

    next_run_time = started_at + timedelta(seconds=int(frequency_sec))
    return now_tunis() >= next_run_time


def run_due_collections():
    app_db = SessionLocal()
    results = []

    try:
        logger.info("#################### START AUTO COLLECTION ####################")

        target_dbs = (
            app_db.query(TargetDB)
            .options(joinedload(TargetDB.db_type))
            .filter(TargetDB.is_active == 1)
            .all()
        )

        metric_defs = (
            app_db.query(MetricDef)
            .filter(MetricDef.is_active == 1)
            .all()
        )

        for db in target_dbs:
            logger.info("--------------------------------------------------------------")
            logger.info("[DB] %s (db_id=%s)", db.db_name, db.db_id)

            compatible_metrics = [
                metric for metric in metric_defs
                if int(db.db_type_id) == int(metric.db_type_id)
            ]

            for metric in compatible_metrics:
                if should_run(
                    app_db=app_db,
                    db_id=int(db.db_id),
                    metric_id=int(metric.metric_id),
                    frequency_sec=int(metric.frequency_sec),
                ):
                    logger.info("[LAUNCH] DB=%s | metric=%s", db.db_name, metric.metric_code)
                    result = collect_one_metric(
                        app_db=app_db,
                        db_id=int(db.db_id),
                        metric_id=int(metric.metric_id),
                    )
                    results.append(result)
                else:
                    logger.info("[SKIP]   DB=%s | metric=%s | fréquence non atteinte", db.db_name, metric.metric_code)

        logger.info("#################### END AUTO COLLECTION ######################")
        return results

    finally:
        app_db.close()