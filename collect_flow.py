import logging
import time

from prefect import flow, task, get_run_logger
from prefect.artifacts import create_markdown_artifact, create_link_artifact

from backend.database.session import SessionLocal
from backend.models.db_type import DbType
from backend.models.target_db import TargetDB
from backend.models.metric_def import MetricDef
from backend.services.collector_service import collect_one_metric, should_run


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)


def normalize_category(value: str) -> str:
    return str(value or "").strip().upper()


def collect_db_category(category_name: str):
    logger = get_run_logger()
    app_db = SessionLocal()
    results = []

    category_name = normalize_category(category_name)

    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("[FLOW-START] CATEGORIE=%s", category_name)

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

        logger.info(
            "[FLOW-INFO] Bases actives trouvées | CATEGORIE=%s | COUNT=%s",
            category_name,
            len(target_dbs),
        )

        if not target_dbs:
            logger.warning(
                "[FLOW-WARN] Aucune base active trouvée | CATEGORIE=%s",
                category_name,
            )
            return results

        for db in target_dbs:
            db_type_code = db_type_map.get(int(db.db_type_id), "UNKNOWN")

            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info(
                "[DB] db_id=%s | db_name=%s | db_type=%s",
                db.db_id,
                db.db_name,
                db_type_code,
            )

            compatible_metrics = [
                metric for metric in metric_defs
                if int(metric.db_type_id) == int(db.db_type_id)
                and normalize_category(metric.category) == category_name
            ]

            logger.info(
                "[DB] Métriques compatibles | DB=%s | TYPE=%s | CATEGORIE=%s | COUNT=%s",
                db.db_name,
                db_type_code,
                category_name,
                len(compatible_metrics),
            )

            if not compatible_metrics:
                logger.warning(
                    "[FLOW-WARN] Aucune métrique active | DB=%s | TYPE=%s | CATEGORIE=%s",
                    db.db_name,
                    db_type_code,
                    category_name,
                )
                continue

            for metric in compatible_metrics:
                logger.info(
                    "[METRIC] categorie=%s | DB=%s | TYPE=%s | metric=%s | frequency=%ss",
                    category_name,
                    db.db_name,
                    db_type_code,
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
                        "[LAUNCH] categorie=%s | DB=%s | TYPE=%s | metric=%s -> COLLECTE EN COURS",
                        category_name,
                        db.db_name,
                        db_type_code,
                        metric.metric_code,
                    )

                    result = collect_one_metric(
                        app_db=app_db,
                        db_id=int(db.db_id),
                        metric_id=int(metric.metric_id),
                    )

                    logger.info(
                        "[QUERY] categorie=%s | DB=%s | TYPE=%s | metric=%s | sql=%s",
                        category_name,
                        db.db_name,
                        db_type_code,
                        metric.metric_code,
                        result.get("sql_query", "N/A"),
                    )

                    if result.get("success"):
                        value_label = result.get("value_number")
                        if value_label is None:
                            value_label = result.get("value_text", "N/A")

                        logger.info(
                            "[RESULT] categorie=%s | DB=%s | TYPE=%s | metric=%s | raw=%s | value=%s | severity=%s | duration_ms=%s",
                            category_name,
                            db.db_name,
                            db_type_code,
                            metric.metric_code,
                            result.get("raw_row", "N/A"),
                            value_label,
                            result.get("severity", "N/A"),
                            result.get("duration_ms", "N/A"),
                        )

                        logger.info(
                            "[DONE] categorie=%s | DB=%s | TYPE=%s | metric=%s | status=SUCCESS",
                            category_name,
                            db.db_name,
                            db_type_code,
                            metric.metric_code,
                        )
                    else:
                        logger.error(
                            "[FAIL] categorie=%s | DB=%s | TYPE=%s | metric=%s | sql=%s | error=%s",
                            category_name,
                            db.db_name,
                            db_type_code,
                            metric.metric_code,
                            result.get("sql_query", "N/A"),
                            result.get("error", "N/A"),
                        )

                    results.append(result)
                else:
                    logger.warning(
                        "[SKIP] Fréquence non atteinte -> categorie=%s | DB=%s | TYPE=%s | metric=%s",
                        category_name,
                        db.db_name,
                        db_type_code,
                        metric.metric_code,
                    )

        success_count = sum(1 for r in results if r.get("success"))
        failed_count = sum(1 for r in results if not r.get("success"))

        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info("[FLOW-END] CATEGORIE=%s", category_name)
        logger.info("[FLOW-END] total_lancées = %s", len(results))
        logger.info("[FLOW-END] success       = %s", success_count)
        logger.info("[FLOW-END] failed        = %s", failed_count)

        return results

    finally:
        app_db.close()
        logger.info("[FLOW-END] Session fermée | CATEGORIE=%s", category_name)


@task(name="01 - Initialisation collecte")
def init_collect_task(category_name: str):
    logger = get_run_logger()
    logger.info("[TASK-INIT] Préparation collecte | CATEGORIE=%s", category_name)
    return normalize_category(category_name)


@task(name="02 - Collecte catégorie")
def collect_category_task(category_name: str):
    logger = get_run_logger()
    logger.info("[TASK-START] Collecte catégorie %s", category_name)

    results = collect_db_category(category_name)

    logger.info("[TASK-END] Collecte catégorie %s | results=%s", category_name, len(results))
    return results


@task(name="03 - Finalisation collecte")
def finish_collect_task(category_name: str, results: list):
    logger = get_run_logger()

    total = len(results)
    success = sum(1 for r in results if r.get("success"))
    failed = total - success

    logger.info("[TASK-FINISH] %s | total=%s success=%s failed=%s", category_name, total, success, failed)

    return {
        "category": category_name,
        "total": total,
        "success": success,
        "failed": failed,
    }


@task(name="04 - Artifact résumé collecte")
def create_collect_artifact(category_name: str, results: list):
    total = len(results)
    success = sum(1 for r in results if r.get("success"))
    failed = total - success

    markdown = f"""
# Résumé collecte {category_name}

| Indicateur | Valeur |
|---|---:|
| Catégorie | {category_name} |
| Total métriques lancées | {total} |
| Succès | {success} |
| Échecs | {failed} |
"""

    create_markdown_artifact(
        key=f"resume-collecte-{category_name.lower()}",
        markdown=markdown,
        description=f"Résumé collecte {category_name}",
    )

    create_link_artifact(
        key=f"dashboard-collecte-{category_name.lower()}",
        link=f"http://127.0.0.1:5173/collecte?categorie={category_name}",
        description=f"Dashboard frontend pour la collecte {category_name}",
    )


@flow(name="Subflow Collecte Catégorie")
def collect_category_subflow(category_name: str):
    category = init_collect_task(category_name)
    results = collect_category_task(category)
    finish_collect_task(category, results)
    create_collect_artifact(category, results)
    return results


@flow(name="Collect Performance Flow")
def collect_performance_flow(category_name: str = "PERFORMANCE"):
    return collect_category_subflow(category_name)


# 🔥 BOUCLE CORRIGÉE
if __name__ == "__main__":
    try:
        while True:
            collect_performance_flow()
            time.sleep(10)  # tu peux changer l’intervalle ici
    except KeyboardInterrupt:
        print("\nArrêt manuel de la collecte (Ctrl+C)")