# backend/router/sql_analyzer.py
"""
Préfixe principal :
  /sql-analyzer/  → liste des métriques SQL collectées + import ZIP + EXPLAIN PLAN + exécution
"""
import os
import re
import time
import zipfile
import tempfile
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.metric_def import MetricDef
from backend.models.metric_value import MetricValue
from backend.models.target_db import TargetDB

router = APIRouter(tags=["SQL Analyzer"])


# ── Schémas Pydantic ──────────────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    db_id: int
    sql_content: str


class ExecuteRequest(BaseModel):
    db_id: int
    sql_content: str
    max_rows: Optional[int] = 100


# ── Helpers import ZIP ────────────────────────────────────────────────────────

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


# ════════════════════════════════════════════════════════════════════
# /sql-analyzer/  — MÉTRIQUES SQL RÉELLEMENT COLLECTÉES
# ════════════════════════════════════════════════════════════════════

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
            "value_number": (
                float(last_value.value_number)
                if last_value and last_value.value_number is not None
                else None
            ),
            "value_text": last_value.value_text if last_value else None,
            "severity": last_value.severity if last_value else None,
            "collected_at": str(last_value.collected_at) if last_value and last_value.collected_at else None,
        })

    return results


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

    target = db.query(TargetDB).filter(TargetDB.db_id == db_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Base cible introuvable")

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
                        errors.append({
                            "file": filename,
                            "error": f"Lecture impossible: {str(e)}",
                        })
                        continue

                    if not sql_content:
                        skipped += 1
                        errors.append({
                            "file": filename,
                            "error": "Contenu SQL vide",
                        })
                        continue

                    raw_code = _slug_metric_code(filename)
                    metric_code = _next_metric_code(db, raw_code)

                    try:
                        next_id = db.execute(
                            text("SELECT METRIC_DEFS_SEQ.NEXTVAL FROM DUAL")
                        ).scalar()
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


# ════════════════════════════════════════════════════════════════════
# /sql-analyzer/  — EXPLAIN PLAN + EXECUTE
# ════════════════════════════════════════════════════════════════════

@router.post("/sql-analyzer/explain", summary="Générer le plan d'exécution")
def explain_plan(payload: ExplainRequest, db: Session = Depends(get_db)):
    """
    Oracle : utilise EXPLAIN PLAN + PLAN_TABLE
    MySQL  : utilise EXPLAIN si la requête est compatible
    """
    target = db.query(TargetDB).filter(TargetDB.db_id == payload.db_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Base cible introuvable")

    sql = (payload.sql_content or "").strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL vide")

    db_type = _normalize_db_type(target)
    conn = None
    cursor = None
    statement_id = f"DBMON_{int(time.time())}"

    try:
        conn = _get_target_conn(target)
        cursor = conn.cursor()

        # ===== MYSQL =====
        if db_type == "MYSQL":
            sql_upper = sql.strip().upper()

            if sql_upper.startswith("SHOW "):
                return {
                    "success": False,
                    "db_id": payload.db_id,
                    "db_name": target.db_name,
                    "total_cost": 0,
                    "cost_level": "UNKNOWN",
                    "plan_rows": [],
                    "sql": sql,
                    "message": "EXPLAIN n'est pas supporté pour les requêtes SHOW en MySQL. Utilisez 'Lancer l'exécution'.",
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
                    "db_id": payload.db_id,
                    "db_name": target.db_name,
                    "total_cost": total_cost,
                    "cost_level": _evaluate_cost(total_cost),
                    "plan_rows": rows,
                    "sql": sql,
                    "message": "Plan MySQL généré avec succès",
                }
            except Exception as e:
                return {
                    "success": False,
                    "db_id": payload.db_id,
                    "db_name": target.db_name,
                    "total_cost": 0,
                    "cost_level": "UNKNOWN",
                    "plan_rows": [],
                    "sql": sql,
                    "message": f"EXPLAIN MySQL indisponible : {str(e)}",
                }

        # ===== ORACLE =====
        try:
            cursor.execute(
                "DELETE FROM PLAN_TABLE WHERE STATEMENT_ID = :statement_id",
                statement_id=statement_id,
            )
            conn.commit()
        except Exception:
            pass

        try:
            cursor.execute(f"EXPLAIN PLAN SET STATEMENT_ID = '{statement_id}' FOR {sql}")
        except Exception as e:
            return {
                "success": False,
                "db_id": payload.db_id,
                "db_name": target.db_name,
                "total_cost": 0,
                "cost_level": "UNKNOWN",
                "plan_rows": [],
                "sql": sql,
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
                "db_id": payload.db_id,
                "db_name": target.db_name,
                "total_cost": 0,
                "cost_level": "UNKNOWN",
                "plan_rows": [],
                "sql": sql,
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
                statement_id=statement_id,
            )
            conn.commit()
        except Exception:
            pass

        return {
            "success": True,
            "db_id": payload.db_id,
            "db_name": target.db_name,
            "total_cost": total_cost,
            "cost_level": _evaluate_cost(total_cost),
            "plan_rows": rows,
            "sql": sql,
            "message": "Plan Oracle généré avec succès",
        }

    except Exception as e:
        return {
            "success": False,
            "db_id": payload.db_id,
            "db_name": target.db_name if target else None,
            "total_cost": 0,
            "cost_level": "UNKNOWN",
            "plan_rows": [],
            "sql": sql,
            "message": f"Erreur analyse du plan : {str(e)}",
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


@router.post("/sql-analyzer/execute", summary="Exécuter un script SQL")
def execute_script(payload: ExecuteRequest, db: Session = Depends(get_db)):
    """
    Exécute le script SQL sur la base cible et retourne les résultats.
    Limité à max_rows lignes (défaut 100).
    """
    target = db.query(TargetDB).filter(TargetDB.db_id == payload.db_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Base cible introuvable")

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


# ── Helpers privés ────────────────────────────────────────────────────────────

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


def _get_target_conn(target):
    """
    Connexion dynamique selon type de base (Oracle / MySQL)
    """
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