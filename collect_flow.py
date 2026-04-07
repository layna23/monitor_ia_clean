import logging

from prefect import flow, task, get_run_logger, serve

from backend.database.session import SessionLocal
from backend.models.db_type import DbType
from backend.models.target_db import TargetDB
from backend.models.metric_def import MetricDef
from backend.services.collector_service import collect_one_metric, should_run


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)


DB_CATEGORIES = {
    "ORACLE": {
        "SESSIONS": {
            "ACTIVE_SESSIONS",
            "SESSION_COUNT",
            "TOTAL_SESSIONS",
            "LOCKED_OBJECTS",
            "ACTIVE_TRANSACTIONS",
        },
        "STATUT": {
            "DB_STATUS",
            "DB_INFO",
        },
        "PERFORMANCE": {
            "CPU_USED_SESSION",
            "INSTANCE_UPTIME_HOURS",
            "CPU_USAGE",
            "RAM_USAGE",
        },
        "AUTRES": {
            "TEST_METRIC_02",
        },
    },
    "MYSQL": {
        "THREADS": {
            "THREADS_RUNNING",
            "THREADS_CONNECTED",
        },
        "AUTRES": set(),
    },
}


def get_metric_category(db_type_code: str, metric_code: str) -> str:
    db_type_code = str(db_type_code or "").strip().upper()
    metric_code = str(metric_code or "").strip().upper()

    categories = DB_CATEGORIES.get(db_type_code, {})
    for category_name, metric_codes in categories.items():
        if metric_code in metric_codes:
            return category_name
    return "AUTRES"


def collect_db_category(db_name_filter: str, db_type_filter: str, category_name: str):
    logger = get_run_logger()
    app_db = SessionLocal()
    results = []

    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info(
        "[FLOW-START] DB=%s | TYPE=%s | CATEGORIE=%s",
        db_name_filter,
        db_type_filter,
        category_name,
    )

    try:
        db_type_rows = app_db.query(DbType).all()
        db_type_map = {
            int(row.db_type_id): str(row.code or "").strip().upper()
            for row in db_type_rows
        }

        target_dbs = (
            app_db.query(TargetDB)
            .filter(TargetDB.is_active == 1)
            .all()
        )

        metric_defs = (
            app_db.query(MetricDef)
            .filter(MetricDef.is_active == 1)
            .all()
        )

        selected_dbs = [
            db for db in target_dbs
            if db_type_map.get(int(db.db_type_id), "") == db_type_filter
            and str(db.db_name or "").strip().upper() == db_name_filter.strip().upper()
        ]

        logger.info(
            "[FLOW-INFO] Bases actives trouvées | DB=%s | TYPE=%s | COUNT=%s",
            db_name_filter,
            db_type_filter,
            len(selected_dbs),
        )

        if not selected_dbs:
            logger.warning(
                "[FLOW-WARN] Aucune base active trouvée pour DB=%s | TYPE=%s",
                db_name_filter,
                db_type_filter,
            )
            return results

        for db in selected_dbs:
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info(
                "[DB] db_id=%s | db_name=%s | db_type=%s",
                db.db_id,
                db.db_name,
                db_type_filter,
            )

            compatible_metrics = [
                metric for metric in metric_defs
                if int(metric.db_type_id) == int(db.db_type_id)
                and get_metric_category(db_type_filter, metric.metric_code) == category_name
            ]

            logger.info(
                "[DB] Métriques compatibles | DB=%s | CATEGORIE=%s | COUNT=%s",
                db.db_name,
                category_name,
                len(compatible_metrics),
            )

            if not compatible_metrics:
                logger.warning(
                    "[FLOW-WARN] Aucune métrique active | DB=%s | CATEGORIE=%s",
                    db.db_name,
                    category_name,
                )
                continue

            for metric in compatible_metrics:
                logger.info(
                    "[METRIC] categorie=%s | DB=%s | metric=%s | frequency=%ss",
                    category_name,
                    db.db_name,
                    metric.metric_code,
                    metric.frequency_sec,
                )

                if should_run(
                    app_db=app_db,
                    db_id=int(db.db_id),
                    metric_id=int(metric.metric_id),
                    frequency_sec=int(metric.frequency_sec),
                ):
                    logger.info(
                        "[LAUNCH] categorie=%s | DB=%s | metric=%s -> COLLECTE EN COURS",
                        category_name,
                        db.db_name,
                        metric.metric_code,
                    )

                    result = collect_one_metric(
                        app_db=app_db,
                        db_id=int(db.db_id),
                        metric_id=int(metric.metric_id),
                    )

                    logger.info(
                        "[QUERY] categorie=%s | DB=%s | metric=%s | sql=%s",
                        category_name,
                        db.db_name,
                        metric.metric_code,
                        result.get("sql_query", "N/A"),
                    )

                    if result.get("success"):
                        value_label = result.get("value_number")
                        if value_label is None:
                            value_label = result.get("value_text", "N/A")

                        logger.info(
                            "[RESULT] categorie=%s | DB=%s | metric=%s | raw=%s | value=%s | severity=%s | duration_ms=%s",
                            category_name,
                            db.db_name,
                            metric.metric_code,
                            result.get("raw_row", "N/A"),
                            value_label,
                            result.get("severity", "N/A"),
                            result.get("duration_ms", "N/A"),
                        )

                        logger.info(
                            "[DONE] categorie=%s | DB=%s | metric=%s | status=SUCCESS",
                            category_name,
                            db.db_name,
                            metric.metric_code,
                        )
                    else:
                        logger.error(
                            "[FAIL] categorie=%s | DB=%s | metric=%s | sql=%s | error=%s",
                            category_name,
                            db.db_name,
                            metric.metric_code,
                            result.get("sql_query", "N/A"),
                            result.get("error", "N/A"),
                        )

                    results.append(result)
                else:
                    logger.warning(
                        "[SKIP] Fréquence non atteinte -> categorie=%s | DB=%s | metric=%s",
                        category_name,
                        db.db_name,
                        metric.metric_code,
                    )

        success_count = sum(1 for r in results if r.get("success"))
        failed_count = sum(1 for r in results if not r.get("success"))
        skipped_count = 0

        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info(
            "[FLOW-END] DB=%s | TYPE=%s | CATEGORIE=%s",
            db_name_filter,
            db_type_filter,
            category_name,
        )
        logger.info("[FLOW-END] total_lancées = %s", len(results))
        logger.info("[FLOW-END] success       = %s", success_count)
        logger.info("[FLOW-END] failed        = %s", failed_count)
        logger.info("[FLOW-END] skipped       = %s", skipped_count)

        return results

    finally:
        app_db.close()
        logger.info(
            "[FLOW-END] Session fermée | DB=%s | TYPE=%s | CATEGORIE=%s",
            db_name_filter,
            db_type_filter,
            category_name,
        )


@task(name="collecte oracle sessions")
def collect_oracle_sessions_task():
    logger = get_run_logger()
    logger.info("[TASK-START] Oracle Sessions")
    results = collect_db_category("LOCAL_19C", "ORACLE", "SESSIONS")
    logger.info("[TASK-END] Oracle Sessions | results=%s", len(results))
    return results


@task(name="collecte oracle statut")
def collect_oracle_statut_task():
    logger = get_run_logger()
    logger.info("[TASK-START] Oracle Statut")
    results = collect_db_category("LOCAL_19C", "ORACLE", "STATUT")
    logger.info("[TASK-END] Oracle Statut | results=%s", len(results))
    return results


@task(name="collecte oracle performance")
def collect_oracle_performance_task():
    logger = get_run_logger()
    logger.info("[TASK-START] Oracle Performance")
    results = collect_db_category("LOCAL_19C", "ORACLE", "PERFORMANCE")
    logger.info("[TASK-END] Oracle Performance | results=%s", len(results))
    return results


@task(name="collecte oracle autres")
def collect_oracle_autres_task():
    logger = get_run_logger()
    logger.info("[TASK-START] Oracle Autres")
    results = collect_db_category("LOCAL_19C", "ORACLE", "AUTRES")
    logger.info("[TASK-END] Oracle Autres | results=%s", len(results))
    return results


@task(name="collecte mysql threads")
def collect_mysql_threads_task():
    logger = get_run_logger()
    logger.info("[TASK-START] MySQL Threads")
    results = collect_db_category("MY SQL", "MYSQL", "THREADS")
    logger.info("[TASK-END] MySQL Threads | results=%s", len(results))
    return results


@task(name="collecte mysql autres")
def collect_mysql_autres_task():
    logger = get_run_logger()
    logger.info("[TASK-START] MySQL Autres")
    results = collect_db_category("MY SQL", "MYSQL", "AUTRES")
    logger.info("[TASK-END] MySQL Autres | results=%s", len(results))
    return results


@flow(name="Collect Oracle Sessions Flow")
def collect_oracle_sessions_flow():
    logger = get_run_logger()
    logger.info("[FLOW] Démarrage -> Oracle Sessions")
    results = collect_oracle_sessions_task()
    logger.info("[FLOW] Terminé -> Oracle Sessions | results=%s", len(results))
    return results


@flow(name="Collect Oracle Statut Flow")
def collect_oracle_statut_flow():
    logger = get_run_logger()
    logger.info("[FLOW] Démarrage -> Oracle Statut")
    results = collect_oracle_statut_task()
    logger.info("[FLOW] Terminé -> Oracle Statut | results=%s", len(results))
    return results


@flow(name="Collect Oracle Performance Flow")
def collect_oracle_performance_flow():
    logger = get_run_logger()
    logger.info("[FLOW] Démarrage -> Oracle Performance")
    results = collect_oracle_performance_task()
    logger.info("[FLOW] Terminé -> Oracle Performance | results=%s", len(results))
    return results


@flow(name="Collect Oracle Autres Flow")
def collect_oracle_autres_flow():
    logger = get_run_logger()
    logger.info("[FLOW] Démarrage -> Oracle Autres")
    results = collect_oracle_autres_task()
    logger.info("[FLOW] Terminé -> Oracle Autres | results=%s", len(results))
    return results


@flow(name="Collect MySQL Threads Flow")
def collect_mysql_threads_flow():
    logger = get_run_logger()
    logger.info("[FLOW] Démarrage -> MySQL Threads")
    results = collect_mysql_threads_task()
    logger.info("[FLOW] Terminé -> MySQL Threads | results=%s", len(results))
    return results


@flow(name="Collect MySQL Autres Flow")
def collect_mysql_autres_flow():
    logger = get_run_logger()
    logger.info("[FLOW] Démarrage -> MySQL Autres")
    results = collect_mysql_autres_task()
    logger.info("[FLOW] Terminé -> MySQL Autres | results=%s", len(results))
    return results


if __name__ == "__main__":
    serve(
        collect_oracle_sessions_flow.to_deployment(
            name="collect-oracle-sessions-local-19c",
            interval=120,
        ),
        collect_oracle_statut_flow.to_deployment(
            name="collect-oracle-statut-local-19c",
            interval=120,
        ),
        collect_oracle_performance_flow.to_deployment(
            name="collect-oracle-performance-local-19c",
            interval=120,
        ),
        collect_oracle_autres_flow.to_deployment(
            name="collect-oracle-autres-local-19c",
            interval=120,
        ),
        collect_mysql_threads_flow.to_deployment(
            name="collect-mysql-threads-my-sql",
            interval=120,
        ),
        collect_mysql_autres_flow.to_deployment(
            name="collect-mysql-autres-my-sql",
            interval=120,
        ),
    )