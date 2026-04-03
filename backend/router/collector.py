from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.services.collector_service import collect_one_metric
from backend.models.target_db import TargetDB

router = APIRouter(prefix="/collector", tags=["collector"])


@router.post("/run/{db_id}/{metric_id}")
def run_one_metric(db_id: int, metric_id: int, db: Session = Depends(get_db)):
    return collect_one_metric(db, db_id, metric_id)


def _to_json_serializable(value):
    if value is None:
        return None

    if hasattr(value, "read"):
        try:
            value = value.read()
        except Exception:
            value = str(value)

    if isinstance(value, datetime):
        return value.isoformat()

    return value


@router.get("/oracle-top-sql/{db_id}")
def get_oracle_top_sql(
    db_id: int,
    exclude_dbmon: bool = Query(True, description="Exclure le schéma DBMON"),
    limit: int = Query(10, ge=1, le=50, description="Nombre maximum de requêtes à retourner"),
    db: Session = Depends(get_db),
):
    import oracledb

    target_db = db.query(TargetDB).filter(TargetDB.db_id == db_id).first()

    if not target_db:
        raise HTTPException(status_code=404, detail="Base cible introuvable")

    if not target_db.host or not target_db.port or not target_db.username:
        raise HTTPException(status_code=400, detail="Configuration de connexion incomplète")

    service_part = target_db.service_name if target_db.service_name else target_db.sid
    if not service_part:
        raise HTTPException(status_code=400, detail="SERVICE_NAME ou SID manquant")

    password_value = (
        target_db.password_enc.read()
        if hasattr(target_db.password_enc, "read")
        else target_db.password_enc
    )

    if not password_value:
        raise HTTPException(status_code=400, detail="Mot de passe manquant")

    password_value = str(password_value).strip()

    oracle_conn = None
    cursor = None

    try:
        dsn = f"{target_db.host}:{int(target_db.port)}/{service_part}"

        oracle_conn = oracledb.connect(
            user=str(target_db.username).strip(),
            password=password_value,
            dsn=dsn,
        )

        cursor = oracle_conn.cursor()

        excluded_schemas = [
            "SYS",
            "SYSTEM",
            "DBSNMP",
            "ORACLE_OCM",
            "MDSYS",
        ]

        if exclude_dbmon:
            excluded_schemas.append("DBMON")

        excluded_schemas_sql = ", ".join(f"'{schema}'" for schema in excluded_schemas)

        sql_filters = """
          AND UPPER(s.sql_text) NOT LIKE '%METRIC_RUNS%'
          AND UPPER(s.sql_text) NOT LIKE '%METRIC_VALUES%'
          AND UPPER(s.sql_text) NOT LIKE '%METRIC_DEFS%'
          AND UPPER(s.sql_text) NOT LIKE '%TARGET_DBS%'
          AND UPPER(s.sql_text) NOT LIKE '%ALERTS%'
          AND UPPER(s.sql_text) NOT LIKE '%SEQ_METRIC_RUNS%'
          AND UPPER(s.sql_text) NOT LIKE '%SEQ_METRIC_VALUES%'
          AND UPPER(s.sql_text) NOT LIKE '%FROM V$SQL%'
          AND UPPER(s.sql_text) NOT LIKE '%V$DATABASE%'
          AND UPPER(s.sql_text) NOT LIKE '%GV$INSTANCE%'
          AND UPPER(s.sql_text) NOT LIKE '%V$PARAMETER%'
          AND UPPER(s.sql_text) NOT LIKE '%DBA_SCHEDULER_JOBS%'
        """

        if exclude_dbmon:
            sql_filters += "\n          AND UPPER(s.sql_text) NOT LIKE '%DBMON%'"

        query = f"""
        SELECT *
        FROM (
            SELECT
                s.sql_id,
                s.parsing_schema_name,
                s.executions,
                ROUND(s.elapsed_time / 1000000, 3) AS elapsed_time_sec,
                ROUND(s.cpu_time / 1000000, 3) AS cpu_time_sec,
                s.buffer_gets,
                s.disk_reads,
                s.rows_processed,
                s.last_active_time,
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM v$session vs
                        WHERE vs.sql_id = s.sql_id
                          AND vs.status = 'ACTIVE'
                          AND vs.type <> 'BACKGROUND'
                    ) THEN 'EN COURS'
                    ELSE 'TERMINEE'
                END AS running_status,
                s.sql_text
            FROM v$sql s
            WHERE s.sql_text IS NOT NULL
              AND s.parsing_schema_name IS NOT NULL
              AND UPPER(s.parsing_schema_name) NOT IN ({excluded_schemas_sql})
              {sql_filters}
            ORDER BY s.elapsed_time DESC
        )
        WHERE ROWNUM <= :limit_value
        """

        cursor.execute(query, {"limit_value": limit})
        rows = cursor.fetchall()
        columns = [col[0].lower() for col in cursor.description]

        queries = []
        for row in rows:
            item = dict(zip(columns, row))
            clean_item = {}

            for key, value in item.items():
                clean_item[key] = _to_json_serializable(value)
                if key == "sql_text" and clean_item[key] is not None:
                    clean_item[key] = str(clean_item[key])

            queries.append(clean_item)

        return {
            "db_id": int(target_db.db_id),
            "db_name": target_db.db_name,
            "exclude_dbmon": exclude_dbmon,
            "excluded_schemas": excluded_schemas,
            "count": len(queries),
            "limit": limit,
            "queries": queries,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur Oracle Top SQL: {str(e)}")

    finally:
        if cursor:
            cursor.close()
        if oracle_conn:
            oracle_conn.close()