"""
SQL Analyzer Router
Logique:
  Top 10 SQL -> PHV list -> click PHV -> DBMS_XPLAN.DISPLAY_CURSOR
"""

import os
import re
import time
import zipfile
import tempfile
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.metric_def import MetricDef
from backend.models.metric_value import MetricValue
from backend.models.target_db import TargetDB

router = APIRouter(tags=["SQL Analyzer"])


# =============================================================================
# Pydantic Schemas
# =============================================================================

class ExplainRequest(BaseModel):
    db_id: int
    sql_content: str


class ExecuteRequest(BaseModel):
    db_id: int
    sql_content: str
    max_rows: Optional[int] = 100


# =============================================================================
# Generic Helpers
# =============================================================================

def _serialize_value(value):
    if value is None:
        return None

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, Decimal):
        try:
            if value == value.to_integral_value():
                return int(value)
            return float(value)
        except Exception:
            return str(value)

    if hasattr(value, "read"):
        try:
            lob_value = value.read()
            if isinstance(lob_value, bytes):
                return lob_value.decode("utf-8", errors="replace")
            return str(lob_value)
        except Exception:
            return str(value)

    if isinstance(value, bytes):
        try:
            return value.decode("utf-8", errors="replace")
        except Exception:
            return str(value)

    if isinstance(value, (int, float, str, bool)):
        return value

    return str(value)


def _normalize_db_type(target) -> str:
    candidates = [
        getattr(target, "db_type", None),
        getattr(target, "db_type_name", None),
        getattr(target, "name", None),
        getattr(target, "db_name", None),
        getattr(target, "service_name", None),
        getattr(target, "sid", None),
    ]

    joined = " ".join(str(v or "").upper() for v in candidates)

    if "MYSQL" in joined:
        return "MYSQL"
    if "ORACLE" in joined or "ORCL" in joined:
        return "ORACLE"

    return str(getattr(target, "db_type", "") or "").upper()


def _get_target_or_404(db: Session, db_id: int):
    target = db.query(TargetDB).filter(TargetDB.db_id == db_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Base cible introuvable")
    return target


def _ensure_oracle_target(target):
    db_type = _normalize_db_type(target)
    if db_type != "ORACLE":
        raise HTTPException(status_code=400, detail="Cette fonctionnalité est disponible seulement pour Oracle")


def _get_target_conn(target):
    db_type = _normalize_db_type(target)

    if db_type == "ORACLE":
        import oracledb

        service = target.service_name or target.db_name
        dsn = f"{target.host}:{target.port}/{service}"

        return oracledb.connect(
            user=target.username,
            password=target.password_enc or target.password,
            dsn=dsn,
        )

    if db_type == "MYSQL":
        import pymysql

        return pymysql.connect(
            host=target.host,
            port=int(target.port),
            user=target.username,
            password=target.password_enc or target.password,
            database=target.db_name,
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False,
        )

    raise Exception(f"Type de base non supporté: {db_type}")


def _close_safely(cursor=None, conn=None):
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


def _evaluate_cost(total_cost: int) -> str:
    if total_cost == 0:
        return "UNKNOWN"
    if total_cost < 100:
        return "LOW"
    if total_cost < 1000:
        return "MEDIUM"
    if total_cost < 10000:
        return "HIGH"
    return "CRITICAL"


# =============================================================================
# ZIP Import Helpers
# =============================================================================

def _read_sql_file_content(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except UnicodeDecodeError:
        with open(file_path, "r", encoding="latin-1") as f:
            return f.read()


def _slug_metric_code(filename: str) -> str:
    base = os.path.splitext(filename)[0].upper().strip()
    base = re.sub(r"[^A-Z0-9]+", "_", base)
    base = re.sub(r"_+", "_", base).strip("_")
    return base[:50] if base else "SQL_METRIC"


def _next_metric_code(db: Session, raw_code: str) -> str:
    candidate = raw_code[:50]
    exists = db.query(MetricDef).filter(MetricDef.metric_code == candidate).first()
    if not exists:
        return candidate

    i = 1
    while True:
        suffix = f"_{i}"
        trimmed = raw_code[: 50 - len(suffix)]
        candidate = f"{trimmed}{suffix}"
        exists = db.query(MetricDef).filter(MetricDef.metric_code == candidate).first()
        if not exists:
            return candidate
        i += 1


# =============================================================================
# Oracle SQL / PHV / PLAN Helpers
# =============================================================================

def _oracle_fetch_all_dict(cursor, sql: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    cursor.execute(sql, params or {})
    columns = [d[0].lower() for d in cursor.description] if cursor.description else []
    rows = cursor.fetchall() if columns else []
    return [dict(zip(columns, [_serialize_value(v) for v in row])) for row in rows]


def _oracle_get_sql_phv_summary(cursor, sql_id: str) -> Dict[str, Any]:
    sql = """
        SELECT
            sql_id,
            COUNT(DISTINCT plan_hash_value) AS phv_count,
            LISTAGG(DISTINCT plan_hash_value, ', ')
                WITHIN GROUP (ORDER BY plan_hash_value) AS phv_list
        FROM v$sql
        WHERE sql_id = :sql_id
          AND sql_id IS NOT NULL
          AND plan_hash_value IS NOT NULL
          AND plan_hash_value <> 0
        GROUP BY sql_id
    """
    cursor.execute(sql, {"sql_id": sql_id})
    row = cursor.fetchone()

    if not row:
        return {
            "sql_id": sql_id,
            "phv_count": 0,
            "phv_list": [],
            "has_phv": False,
            "has_multiple_phv": False,
        }

    phv_raw = str(row[2]) if row[2] is not None else ""
    phv_list = []

    for value in phv_raw.split(","):
        value = value.strip()
        if not value:
            continue
        try:
            phv_list.append(int(value))
        except Exception:
            pass

    return {
        "sql_id": row[0],
        "phv_count": int(row[1]) if row[1] is not None else 0,
        "phv_list": phv_list,
        "has_phv": len(phv_list) > 0,
        "has_multiple_phv": len(phv_list) > 1,
    }


def _oracle_get_child_numbers_for_phv(cursor, sql_id: str, phv: int) -> List[int]:
    sql = """
        SELECT DISTINCT child_number
        FROM v$sql
        WHERE sql_id = :sql_id
          AND plan_hash_value = :phv
        ORDER BY child_number
    """
    cursor.execute(sql, {"sql_id": sql_id, "phv": phv})
    rows = cursor.fetchall() or []

    result = []
    for row in rows:
        try:
            result.append(int(row[0]))
        except Exception:
            pass

    return result


def _oracle_pick_child_number_for_phv(cursor, sql_id: str, phv: int) -> Optional[int]:
    child_numbers = _oracle_get_child_numbers_for_phv(cursor, sql_id, phv)
    if not child_numbers:
        return None
    return child_numbers[0]


def _oracle_get_plan_rows(cursor, sql_id: str, phv: int) -> List[Dict[str, Any]]:
    sql = """
        SELECT
            id,
            parent_id,
            depth,
            position,
            operation,
            options,
            object_owner,
            object_name,
            object_type,
            optimizer,
            cost,
            cardinality,
            bytes,
            cpu_cost,
            io_cost,
            access_predicates,
            filter_predicates,
            projection,
            time
        FROM v$sql_plan
        WHERE sql_id = :sql_id
          AND plan_hash_value = :phv
          AND child_number = (
              SELECT MIN(child_number)
              FROM v$sql_plan
              WHERE sql_id = :sql_id
                AND plan_hash_value = :phv
          )
        ORDER BY id
    """
    return _oracle_fetch_all_dict(cursor, sql, {"sql_id": sql_id, "phv": phv})


def _oracle_get_plan_text_from_display_cursor(
    cursor,
    sql_id: str,
    phv: int,
    format_value: str = "TYPICAL"
) -> Dict[str, Any]:
    child_number = _oracle_pick_child_number_for_phv(cursor, sql_id, phv)

    if child_number is None:
        return {
            "sql_id": sql_id,
            "phv": phv,
            "child_number": None,
            "lines": [],
            "plan_text": "",
            "message": "Aucun child_number trouvé pour ce SQL_ID / PHV",
        }

    sql = """
        SELECT plan_table_output
        FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(:sql_id, :child_number, :format_value))
    """
    cursor.execute(
        sql,
        {
            "sql_id": sql_id,
            "child_number": child_number,
            "format_value": format_value,
        },
    )
    rows = cursor.fetchall() or []

    lines = []
    for row in rows:
        value = _serialize_value(row[0]) if row else None
        if value is None:
            value = ""
        lines.append(str(value))

    return {
        "sql_id": sql_id,
        "phv": phv,
        "child_number": child_number,
        "lines": lines,
        "plan_text": "\n".join(lines),
        "message": "Plan DBMS_XPLAN récupéré avec succès",
    }


def _oracle_enrich_top_queries_with_phv(cursor, queries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    enriched = []

    for item in queries:
        sql_id = item.get("sql_id")
        if not sql_id:
            item["phv_count"] = 0
            item["phv_list"] = []
            item["has_phv"] = False
            item["has_multiple_phv"] = False
            enriched.append(item)
            continue

        summary = _oracle_get_sql_phv_summary(cursor, str(sql_id))
        item["phv_count"] = summary["phv_count"]
        item["phv_list"] = summary["phv_list"]
        item["has_phv"] = summary["has_phv"]
        item["has_multiple_phv"] = summary["has_multiple_phv"]
        item["default_phv"] = summary["phv_list"][0] if summary["phv_list"] else None

        enriched.append(item)

    return enriched


# =============================================================================
# Metrics
# =============================================================================

@router.get("/sql-analyzer/metrics", summary="Liste des métriques SQL réellement collectées")
def get_sql_metrics(
    db_id: Optional[int] = None,
    is_active: Optional[int] = 1,
    metric_code: Optional[str] = None,
    db: Session = Depends(get_db),
):
    selected_target = None

    if db_id is not None:
        selected_target = db.query(TargetDB).filter(TargetDB.db_id == db_id).first()
        if not selected_target:
            raise HTTPException(status_code=404, detail="Base cible introuvable")

    query = db.query(MetricDef)

    if is_active is not None:
        query = query.filter(MetricDef.is_active == is_active)

    if metric_code and metric_code.strip():
        query = query.filter(MetricDef.metric_code.ilike(f"%{metric_code.strip()}%"))

    if selected_target is not None and selected_target.db_type_id is not None:
        query = query.filter(MetricDef.db_type_id == selected_target.db_type_id)

    metrics = query.order_by(MetricDef.metric_id).all()

    results = []
    for m in metrics:
        value_query = db.query(MetricValue).filter(MetricValue.metric_id == m.metric_id)

        if db_id is not None:
            value_query = value_query.filter(MetricValue.db_id == db_id)

        last_value = value_query.order_by(MetricValue.collected_at.desc()).first()

        results.append({
            "metric_id": int(m.metric_id),
            "metric_code": m.metric_code,
            "db_type_id": int(m.db_type_id) if m.db_type_id is not None else None,
            "unit": m.unit,
            "frequency_sec": int(m.frequency_sec) if m.frequency_sec is not None else None,
            "warn_threshold": float(m.warn_threshold) if m.warn_threshold is not None else None,
            "crit_threshold": float(m.crit_threshold) if m.crit_threshold is not None else None,
            "is_active": int(m.is_active) if m.is_active is not None else 1,
            "sql_query": _serialize_value(m.sql_query),
            "created_at": str(m.created_at) if m.created_at else None,
            "db_id": int(last_value.db_id) if last_value and last_value.db_id is not None else db_id,
            "value_id": int(last_value.value_id) if last_value and last_value.value_id is not None else None,
            "value_number": float(last_value.value_number) if last_value and last_value.value_number is not None else None,
            "value_text": last_value.value_text if last_value else None,
            "severity": last_value.severity if last_value else None,
            "collected_at": str(last_value.collected_at) if last_value and last_value.collected_at else None,
        })

    return results


# =============================================================================
# ZIP Import
# =============================================================================

@router.post("/sql-analyzer/import-zip", summary="Importer en masse des fichiers SQL vers METRIC_DEFS")
async def import_metrics_zip(
    db_id: int = Form(...),
    file: UploadFile = File(...),
    frequency_sec: int = Form(60),
    unit: str = Form("count"),
    warn_threshold: Optional[float] = Form(None),
    crit_threshold: Optional[float] = Form(None),
    is_active: int = Form(1),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier invalide")

    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Veuillez envoyer un fichier ZIP valide")

    target = _get_target_or_404(db, db_id)

    if target.db_type_id is None:
        raise HTTPException(status_code=400, detail="db_type_id introuvable pour la base cible")

    imported = 0
    skipped = 0
    errors = []

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, file.filename)

            with open(zip_path, "wb") as buffer:
                buffer.write(await file.read())

            try:
                with zipfile.ZipFile(zip_path, "r") as zip_ref:
                    zip_ref.extractall(temp_dir)
            except zipfile.BadZipFile:
                raise HTTPException(status_code=400, detail="Le fichier envoyé n'est pas un ZIP valide")

            for root, _, files in os.walk(temp_dir):
                for filename in files:
                    if not filename.lower().endswith(".sql"):
                        continue

                    file_path = os.path.join(root, filename)

                    try:
                        sql_content = _read_sql_file_content(file_path).strip()
                    except Exception as e:
                        errors.append({"file": filename, "error": f"Lecture impossible: {str(e)}"})
                        continue

                    if not sql_content:
                        skipped += 1
                        errors.append({"file": filename, "error": "Contenu SQL vide"})
                        continue

                    raw_code = _slug_metric_code(filename)
                    metric_code = _next_metric_code(db, raw_code)

                    try:
                        next_id = db.execute(text("SELECT METRIC_DEFS_SEQ.NEXTVAL FROM DUAL")).scalar()
                    except Exception as e:
                        raise HTTPException(
                            status_code=500,
                            detail=f"Impossible de récupérer NEXTVAL sur METRIC_DEFS_SEQ: {str(e)}",
                        )

                    obj = MetricDef(
                        metric_id=next_id,
                        metric_code=metric_code,
                        db_type_id=target.db_type_id,
                        unit=unit,
                        frequency_sec=frequency_sec,
                        warn_threshold=warn_threshold,
                        crit_threshold=crit_threshold,
                        is_active=is_active,
                        sql_query=sql_content,
                        created_at=datetime.now(),
                    )

                    db.add(obj)
                    imported += 1

            db.commit()

        return {
            "success": True,
            "message": f"{imported} métrique(s) importée(s) avec succès",
            "imported": imported,
            "skipped": skipped,
            "errors": errors,
            "db_id": db_id,
            "db_type_id": int(target.db_type_id),
            "filename": file.filename,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'import ZIP : {str(e)}")


# =============================================================================
# Top Queries
# =============================================================================

@router.get("/sql-analyzer/top-queries", summary="Top requêtes SQL + PHV")
def get_top_sql_queries(
    db_id: int = Query(..., description="ID de la base cible"),
    limit: int = Query(10, ge=1, le=100),
    exclude_schema: Optional[str] = Query(None),
    sort_by: str = Query("elapsed_time"),
    db: Session = Depends(get_db),
):
    target = _get_target_or_404(db, db_id)
    _ensure_oracle_target(target)

    metric_query = db.query(MetricDef).filter(
        MetricDef.metric_code == "TOP_SQL",
        MetricDef.is_active == 1
    )

    if target.db_type_id is not None:
        metric_query = metric_query.filter(MetricDef.db_type_id == target.db_type_id)

    top_sql_metric = metric_query.order_by(MetricDef.metric_id.desc()).first()

    if not top_sql_metric or not (top_sql_metric.sql_query or "").strip():
        raise HTTPException(
            status_code=400,
            detail="La métrique TOP_SQL n'est pas configurée ou sa requête SQL est vide."
        )

    metric_sql = (top_sql_metric.sql_query or "").strip()

    allowed_sort_columns = {
        "elapsed_time": "elapsed_time_sec",
        "cpu_time": "cpu_time_sec",
        "buffer_gets": "buffer_gets",
        "disk_reads": "disk_reads",
        "executions": "executions",
    }
    sort_key = allowed_sort_columns.get(sort_by, "elapsed_time_sec")

    conn = None
    cursor = None

    try:
        conn = _get_target_conn(target)
        cursor = conn.cursor()

        cursor.execute(metric_sql)
        columns = [d[0].lower() for d in cursor.description] if cursor.description else []
        raw_rows = cursor.fetchall() if columns else []
        queries = [dict(zip(columns, [_serialize_value(v) for v in row])) for row in raw_rows]

        if exclude_schema:
            queries = [
                row for row in queries
                if str(row.get("parsing_schema_name") or "").upper() != str(exclude_schema).upper()
            ]

        def _sort_value(row):
            value = row.get(sort_key)
            if value is None:
                return float("-inf")
            try:
                return float(value)
            except Exception:
                return float("-inf")

        queries = sorted(queries, key=_sort_value, reverse=True)[:limit]
        queries = _oracle_enrich_top_queries_with_phv(cursor, queries)

        return {
            "success": True,
            "db_id": db_id,
            "db_name": target.db_name,
            "metric_id": int(top_sql_metric.metric_id),
            "metric_code": top_sql_metric.metric_code,
            "sort_by": sort_by,
            "exclude_schema": exclude_schema,
            "count": len(queries),
            "queries": queries,
            "message": "Top requêtes SQL récupérées avec leurs PHV",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur récupération top requêtes : {str(e)}")
    finally:
        _close_safely(cursor, conn)


@router.get("/sql-analyzer/sql-phv-summary", summary="Résumé PHV d'un SQL_ID")
def get_sql_phv_summary(
    db_id: int = Query(..., description="ID de la base cible"),
    sql_id: str = Query(..., description="SQL_ID Oracle"),
    db: Session = Depends(get_db),
):
    target = _get_target_or_404(db, db_id)
    _ensure_oracle_target(target)

    conn = None
    cursor = None

    try:
        conn = _get_target_conn(target)
        cursor = conn.cursor()

        item = _oracle_get_sql_phv_summary(cursor, sql_id)

        return {
            "success": True,
            "db_id": db_id,
            "db_name": target.db_name,
            "item": item,
            "message": "Résumé PHV récupéré avec succès",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur récupération résumé PHV : {str(e)}")
    finally:
        _close_safely(cursor, conn)


# =============================================================================
# Plan display from PHV
# =============================================================================

@router.get("/sql-analyzer/sql-plan-text", summary="Plan texte Oracle via DBMS_XPLAN pour un SQL_ID + PHV")
def get_sql_plan_text(
    db_id: int = Query(..., description="ID de la base cible"),
    sql_id: str = Query(..., description="SQL_ID Oracle"),
    phv: int = Query(..., description="PLAN_HASH_VALUE sélectionné"),
    format_value: str = Query("TYPICAL", description="Format DBMS_XPLAN: BASIC / TYPICAL / ALLSTATS LAST ..."),
    db: Session = Depends(get_db),
):
    target = _get_target_or_404(db, db_id)
    _ensure_oracle_target(target)

    conn = None
    cursor = None

    try:
        conn = _get_target_conn(target)
        cursor = conn.cursor()

        result = _oracle_get_plan_text_from_display_cursor(
            cursor=cursor,
            sql_id=sql_id,
            phv=phv,
            format_value=format_value,
        )

        return {
            "success": True,
            "db_id": db_id,
            "db_name": target.db_name,
            **result,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur récupération DBMS_XPLAN : {str(e)}")
    finally:
        _close_safely(cursor, conn)


@router.get("/sql-analyzer/sql-plan-rows", summary="Plan structuré v$sql_plan pour un SQL_ID + PHV")
def get_sql_plan_rows(
    db_id: int = Query(..., description="ID de la base cible"),
    sql_id: str = Query(..., description="SQL_ID Oracle"),
    phv: int = Query(..., description="PLAN_HASH_VALUE sélectionné"),
    db: Session = Depends(get_db),
):
    target = _get_target_or_404(db, db_id)
    _ensure_oracle_target(target)

    conn = None
    cursor = None

    try:
        conn = _get_target_conn(target)
        cursor = conn.cursor()

        items = _oracle_get_plan_rows(cursor, sql_id=sql_id, phv=phv)

        return {
            "success": True,
            "db_id": db_id,
            "db_name": target.db_name,
            "sql_id": sql_id,
            "phv": phv,
            "count": len(items),
            "items": items,
            "message": "Plan structuré récupéré avec succès",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur récupération détail du plan : {str(e)}")
    finally:
        _close_safely(cursor, conn)


# =============================================================================
# Explain Plan / Execute
# =============================================================================

@router.post("/sql-analyzer/explain", summary="Générer le plan d'exécution")
def explain_plan(payload: ExplainRequest, db: Session = Depends(get_db)):
    target = _get_target_or_404(db, payload.db_id)

    sql = (payload.sql_content or "").strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL vide")

    db_type = _normalize_db_type(target)
    conn = None
    cursor = None
    statement_id = f"DBMON_{int(time.time())}"

    sql_upper = sql.upper()
    first_token = sql_upper.split(None, 1)[0] if sql_upper else ""

    try:
        conn = _get_target_conn(target)
        cursor = conn.cursor()

        if db_type == "MYSQL":
            if sql_upper.startswith("SHOW "):
                return {
                    "success": True,
                    "analysis_type": "mysql_command",
                    "db_id": payload.db_id,
                    "db_name": target.db_name,
                    "total_cost": 0,
                    "cost_level": "UNKNOWN",
                    "plan_rows": [],
                    "sql": sql,
                    "detected_type": "SHOW",
                    "message": "Commande MySQL détectée. EXPLAIN standard non applicable.",
                }

            try:
                cursor.execute(f"EXPLAIN {sql}")
                raw_rows = cursor.fetchall()

                rows = []
                if isinstance(raw_rows, list):
                    for row in raw_rows:
                        if isinstance(row, dict):
                            rows.append({k.lower(): _serialize_value(v) for k, v in row.items()})
                        elif isinstance(row, (list, tuple)):
                            columns = [d[0].lower() for d in cursor.description] if cursor.description else []
                            rows.append(dict(zip(columns, [_serialize_value(v) for v in row])))
                        else:
                            rows.append({"value": _serialize_value(row)})

                total_cost = len(rows)

                return {
                    "success": True,
                    "analysis_type": "execution_plan",
                    "db_id": payload.db_id,
                    "db_name": target.db_name,
                    "total_cost": total_cost,
                    "cost_level": _evaluate_cost(total_cost),
                    "plan_rows": rows,
                    "sql": sql,
                    "detected_type": first_token or "UNKNOWN",
                    "message": "Plan MySQL généré avec succès",
                }
            except Exception as e:
                return {
                    "success": False,
                    "analysis_type": "execution_plan",
                    "db_id": payload.db_id,
                    "db_name": target.db_name,
                    "total_cost": 0,
                    "cost_level": "UNKNOWN",
                    "plan_rows": [],
                    "sql": sql,
                    "detected_type": first_token or "UNKNOWN",
                    "message": f"EXPLAIN MySQL indisponible : {str(e)}",
                }

        sql_supported_tokens = {"SELECT", "INSERT", "UPDATE", "DELETE", "MERGE"}
        plsql_tokens = {"BEGIN", "DECLARE", "CALL"}

        if first_token in plsql_tokens:
            return {
                "success": True,
                "analysis_type": "plsql_block",
                "db_id": payload.db_id,
                "db_name": target.db_name,
                "total_cost": 0,
                "cost_level": "UNKNOWN",
                "plan_rows": [{
                    "plan_step": "PL/SQL BLOCK",
                    "details": "Bloc PL/SQL détecté : EXPLAIN PLAN standard non applicable."
                }],
                "sql": sql,
                "detected_type": first_token,
                "message": "Bloc PL/SQL détecté.",
            }

        if first_token not in sql_supported_tokens:
            return {
                "success": True,
                "analysis_type": "command_analysis",
                "db_id": payload.db_id,
                "db_name": target.db_name,
                "total_cost": 0,
                "cost_level": "UNKNOWN",
                "plan_rows": [{
                    "plan_step": "UNSUPPORTED COMMAND",
                    "details": "Commande Oracle non gérée par EXPLAIN PLAN standard."
                }],
                "sql": sql,
                "detected_type": first_token or "UNKNOWN",
                "message": "Commande détectée.",
            }

        try:
            cursor.execute(
                "DELETE FROM PLAN_TABLE WHERE STATEMENT_ID = :statement_id",
                {"statement_id": statement_id},
            )
            conn.commit()
        except Exception:
            pass

        try:
            cursor.execute(f"EXPLAIN PLAN SET STATEMENT_ID = '{statement_id}' FOR {sql}")
        except Exception as e:
            return {
                "success": False,
                "analysis_type": "execution_plan",
                "db_id": payload.db_id,
                "db_name": target.db_name,
                "total_cost": 0,
                "cost_level": "UNKNOWN",
                "plan_rows": [],
                "sql": sql,
                "detected_type": first_token or "UNKNOWN",
                "message": f"EXPLAIN PLAN indisponible : {str(e)}",
            }

        try:
            cursor.execute(f"""
                SELECT LPAD(' ', 2*(LEVEL-1)) || OPERATION || ' ' ||
                       NVL(OPTIONS,'') || ' ' || NVL(OBJECT_NAME,'') AS plan_step,
                       COST,
                       CARDINALITY,
                       BYTES,
                       CPU_COST,
                       IO_COST,
                       ACCESS_PREDICATES,
                       FILTER_PREDICATES,
                       LEVEL AS depth
                FROM PLAN_TABLE
                START WITH STATEMENT_ID = '{statement_id}' AND PARENT_ID IS NULL
                CONNECT BY PRIOR ID = PARENT_ID
                       AND STATEMENT_ID = '{statement_id}'
                ORDER SIBLINGS BY ID
            """)
            columns = [d[0].lower() for d in cursor.description] if cursor.description else []
            raw_rows = cursor.fetchall() if columns else []
            rows = [dict(zip(columns, [_serialize_value(v) for v in row])) for row in raw_rows]
        except Exception as e:
            return {
                "success": False,
                "analysis_type": "execution_plan",
                "db_id": payload.db_id,
                "db_name": target.db_name,
                "total_cost": 0,
                "cost_level": "UNKNOWN",
                "plan_rows": [],
                "sql": sql,
                "detected_type": first_token or "UNKNOWN",
                "message": f"Lecture du plan impossible : {str(e)}",
            }

        total_cost = 0
        try:
            cursor.execute(f"""
                SELECT NVL(SUM(COST), 0)
                FROM PLAN_TABLE
                WHERE STATEMENT_ID = '{statement_id}'
            """)
            total_cost = int((cursor.fetchone() or [0])[0] or 0)
        except Exception:
            total_cost = 0

        try:
            cursor.execute(
                "DELETE FROM PLAN_TABLE WHERE STATEMENT_ID = :statement_id",
                {"statement_id": statement_id},
            )
            conn.commit()
        except Exception:
            pass

        return {
            "success": True,
            "analysis_type": "execution_plan",
            "db_id": payload.db_id,
            "db_name": target.db_name,
            "total_cost": total_cost,
            "cost_level": _evaluate_cost(total_cost),
            "plan_rows": rows,
            "sql": sql,
            "detected_type": first_token or "UNKNOWN",
            "message": "Plan Oracle généré avec succès",
        }

    except Exception as e:
        return {
            "success": False,
            "analysis_type": "unknown",
            "db_id": payload.db_id,
            "db_name": target.db_name if target else None,
            "total_cost": 0,
            "cost_level": "UNKNOWN",
            "plan_rows": [],
            "sql": sql,
            "detected_type": first_token or "UNKNOWN",
            "message": f"Erreur analyse du plan : {str(e)}",
        }
    finally:
        _close_safely(cursor, conn)


@router.post("/sql-analyzer/execute", summary="Exécuter un script SQL")
def execute_script(payload: ExecuteRequest, db: Session = Depends(get_db)):
    target = _get_target_or_404(db, payload.db_id)

    sql = (payload.sql_content or "").strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL vide")

    max_rows = payload.max_rows or 100
    if max_rows <= 0:
        max_rows = 100
    if max_rows > 1000:
        max_rows = 1000

    conn = None
    cursor = None
    t0 = time.time()

    try:
        conn = _get_target_conn(target)
        cursor = conn.cursor()
        cursor.execute(sql)

        duration_ms = int((time.time() - t0) * 1000)

        if cursor.description:
            columns = [d[0].lower() for d in cursor.description]
            raw_rows = cursor.fetchmany(max_rows)

            rows = []
            for row in raw_rows:
                if isinstance(row, dict):
                    rows.append({k.lower(): _serialize_value(v) for k, v in row.items()})
                else:
                    rows.append(dict(zip(columns, [_serialize_value(v) for v in row])))

            return {
                "success": True,
                "db_id": payload.db_id,
                "db_name": target.db_name,
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "returned_rows": len(rows),
                "max_rows": max_rows,
                "duration_ms": duration_ms,
                "statement_type": "QUERY",
                "message": f"{len(rows)} ligne(s) récupérée(s)",
                "sql": sql,
            }

        try:
            affected_rows = cursor.rowcount if cursor.rowcount is not None else 0
        except Exception:
            affected_rows = 0

        try:
            conn.commit()
        except Exception:
            pass

        return {
            "success": True,
            "db_id": payload.db_id,
            "db_name": target.db_name,
            "columns": [],
            "rows": [],
            "row_count": affected_rows,
            "returned_rows": 0,
            "max_rows": max_rows,
            "duration_ms": duration_ms,
            "statement_type": "COMMAND",
            "message": f"Commande exécutée avec succès. Lignes impactées : {affected_rows}",
            "sql": sql,
        }

    except Exception as e:
        try:
            if conn:
                conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Erreur exécution : {str(e)}")
    finally:
        _close_safely(cursor, conn)