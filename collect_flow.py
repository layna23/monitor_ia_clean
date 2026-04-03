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


# ─────────────────────────────────────────────────────────────────────────────
# MAPPING DES CATÉGORIES ORACLE
# Ajouter un metric_code ici pour l'affecter à une catégorie.
# Tout code absent de ce mapping sera placé dans "AUTRES".
# ─────────────────────────────────────────────────────────────────────────────
ORACLE_CATEGORIES = {
    "SESSIONS": {
        "ACTIVE_SESSIONS",
        "SESSION_COUNT",
        "TOTAL SESSIONS",
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
    },
    "AUTRES": {
        "TEST_METRIC_02",
    },
}


def get_oracle_category(metric_code: str) -> str:
    code = str(metric_code or "").strip().upper()
    for category_name, metric_codes in ORACLE_CATEGORIES.items():
        if code in metric_codes:
            return category_name
    return "AUTRES"


# ─────────────────────────────────────────────────────────────────────────────
# FONCTION DE COLLECTE PAR CATÉGORIE
# Appelée par chaque task. Contient tous les logs structurés.
# ─────────────────────────────────────────────────────────────────────────────
def collect_oracle_category(category_name: str):
    logger = get_run_logger()
    app_db = SessionLocal()
    results = []

    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("[FLOW-START] CATEGORIE=%s", category_name)

    try:
        # ── Chargement des types de BDD ───────────────────────────
        db_type_rows = app_db.query(DbType).all()
        db_type_map = {
            int(row.db_type_id): str(row.code or "").upper()
            for row in db_type_rows
        }

        # ── Bases Oracle actives ──────────────────────────────────
        target_dbs = (
            app_db.query(TargetDB)
            .filter(TargetDB.is_active == 1)
            .all()
        )
        oracle_dbs = [
            db for db in target_dbs
            if db_type_map.get(int(db.db_type_id), "") == "ORACLE"
        ]

        # ── Métriques Oracle actives de la catégorie ──────────────
        metric_defs = (
            app_db.query(MetricDef)
            .filter(MetricDef.is_active == 1)
            .all()
        )
        oracle_metrics = [
            metric for metric in metric_defs
            if db_type_map.get(int(metric.db_type_id), "") == "ORACLE"
            and get_oracle_category(metric.metric_code) == category_name
        ]

        logger.info("[FLOW-INFO]  Bases Oracle actives   = %s", len(oracle_dbs))
        logger.info("[FLOW-INFO]  Métriques [%s]         = %s", category_name, len(oracle_metrics))

        if not oracle_dbs:
            logger.warning("[FLOW-WARN]  Aucune base Oracle active trouvée")

        if not oracle_metrics:
            logger.warning("[FLOW-WARN]  Aucune métrique active pour la catégorie [%s]", category_name)

        # ── Boucle bases x métriques ──────────────────────────────
        for db in oracle_dbs:
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info("[DB]         db_id=%s | db_name=%s", db.db_id, db.db_name)

            compatible_metrics = [
                metric for metric in oracle_metrics
                if int(metric.db_type_id) == int(db.db_type_id)
            ]

            logger.info(
                "[DB]         Métriques [%s] compatibles pour %s = %s",
                category_name,
                db.db_name,
                len(compatible_metrics),
            )

            for metric in compatible_metrics:
                logger.info(
                    "[METRIC]     categorie=%s | DB=%s | metric=%s | frequency=%ss",
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
                        "[LAUNCH]     categorie=%s | DB=%s | metric=%s -> COLLECTE EN COURS",
                        category_name,
                        db.db_name,
                        metric.metric_code,
                    )

                    result = collect_one_metric(
                        app_db=app_db,
                        db_id=int(db.db_id),
                        metric_id=int(metric.metric_id),
                    )

                    status_label = "SUCCESS" if result.get("success") else "FAILED"
                    logger.info(
                        "[DONE]       categorie=%s | DB=%s | metric=%s | status=%s | severity=%s | value=%s",
                        category_name,
                        db.db_name,
                        metric.metric_code,
                        status_label,
                        result.get("severity", "N/A"),
                        result.get("value_number") if result.get("value_number") is not None else result.get("value_text", "N/A"),
                    )

                    results.append(result)

                else:
                    logger.info(
                        "[SKIP]       Fréquence non atteinte -> categorie=%s | DB=%s | metric=%s",
                        category_name,
                        db.db_name,
                        metric.metric_code,
                    )

        # ── Résumé final ──────────────────────────────────────────
        success_count = sum(1 for r in results if r.get("success"))
        failed_count = sum(1 for r in results if not r.get("success"))
        skipped_count = sum(
            len([metric for metric in oracle_metrics if int(metric.db_type_id) == int(db.db_type_id)])
            for db in oracle_dbs
        ) - len(results)

        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info("[FLOW-END]   CATEGORIE=%s", category_name)
        logger.info("[FLOW-END]   total_lancées = %s", len(results))
        logger.info("[FLOW-END]   success       = %s", success_count)
        logger.info("[FLOW-END]   failed        = %s", failed_count)
        logger.info("[FLOW-END]   skipped       = %s", max(skipped_count, 0))

        return results

    finally:
        app_db.close()
        logger.info("[FLOW-END]   Session fermée | categorie=%s", category_name)


# ─────────────────────────────────────────────────────────────────────────────
# TASKS PREFECT — une par catégorie
# ─────────────────────────────────────────────────────────────────────────────

@task(name="collecte oracle sessions")
def collect_oracle_sessions_task():
    logger = get_run_logger()
    logger.info("[TASK-START] Oracle Sessions")
    results = collect_oracle_category("SESSIONS")
    logger.info("[TASK-END]   Oracle Sessions | results=%s", len(results))
    return results


@task(name="collecte oracle statut")
def collect_oracle_statut_task():
    logger = get_run_logger()
    logger.info("[TASK-START] Oracle Statut")
    results = collect_oracle_category("STATUT")
    logger.info("[TASK-END]   Oracle Statut | results=%s", len(results))
    return results


@task(name="collecte oracle performance")
def collect_oracle_performance_task():
    logger = get_run_logger()
    logger.info("[TASK-START] Oracle Performance")
    results = collect_oracle_category("PERFORMANCE")
    logger.info("[TASK-END]   Oracle Performance | results=%s", len(results))
    return results


@task(name="collecte oracle autres")
def collect_oracle_autres_task():
    logger = get_run_logger()
    logger.info("[TASK-START] Oracle Autres")
    results = collect_oracle_category("AUTRES")
    logger.info("[TASK-END]   Oracle Autres | results=%s", len(results))
    return results


# ─────────────────────────────────────────────────────────────────────────────
# FLOWS PREFECT — un par catégorie
# ─────────────────────────────────────────────────────────────────────────────

@flow(name="Collect Oracle Sessions Flow")
def collect_oracle_sessions_flow():
    logger = get_run_logger()
    logger.info("[FLOW]  Démarrage -> Oracle Sessions")
    results = collect_oracle_sessions_task()
    logger.info("[FLOW]  Terminé  -> Oracle Sessions | results=%s", len(results))
    return results


@flow(name="Collect Oracle Statut Flow")
def collect_oracle_statut_flow():
    logger = get_run_logger()
    logger.info("[FLOW]  Démarrage -> Oracle Statut")
    results = collect_oracle_statut_task()
    logger.info("[FLOW]  Terminé  -> Oracle Statut | results=%s", len(results))
    return results


@flow(name="Collect Oracle Performance Flow")
def collect_oracle_performance_flow():
    logger = get_run_logger()
    logger.info("[FLOW]  Démarrage -> Oracle Performance")
    results = collect_oracle_performance_task()
    logger.info("[FLOW]  Terminé  -> Oracle Performance | results=%s", len(results))
    return results


@flow(name="Collect Oracle Autres Flow")
def collect_oracle_autres_flow():
    logger = get_run_logger()
    logger.info("[FLOW]  Démarrage -> Oracle Autres")
    results = collect_oracle_autres_task()
    logger.info("[FLOW]  Terminé  -> Oracle Autres | results=%s", len(results))
    return results


# ─────────────────────────────────────────────────────────────────────────────
# POINT D'ENTRÉE — lance les 4 flows en parallèle toutes les 60 secondes
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    serve(
        collect_oracle_sessions_flow.to_deployment(
            name="collect-oracle-sessions",
            interval=60,
        ),
        collect_oracle_statut_flow.to_deployment(
            name="collect-oracle-statut",
            interval=60,
        ),
        collect_oracle_performance_flow.to_deployment(
            name="collect-oracle-performance",
            interval=60,
        ),
        collect_oracle_autres_flow.to_deployment(
            name="collect-oracle-autres",
            interval=60,
        ),
    )