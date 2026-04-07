# backend/router/sql_analyzer.py
"""
Deux préfixes :
  /sql-scripts/   → CRUD des scripts sauvegardés
  /sql-analyzer/  → EXPLAIN PLAN + exécution
"""
import time
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.sql_script import SqlScript
from backend.models.target_db import TargetDB

router = APIRouter(tags=["SQL Analyzer"])


# ── Schémas Pydantic ──────────────────────────────────────────────────────────

class SqlScriptCreate(BaseModel):
    script_name: str
    description: Optional[str] = None
    category: Optional[str] = None
    db_type: Optional[str] = "ORACLE"
    sql_content: str
    is_active: Optional[int] = 1


class SqlScriptUpdate(BaseModel):
    script_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    db_type: Optional[str] = None
    sql_content: Optional[str] = None
    is_active: Optional[int] = None


class ExplainRequest(BaseModel):
    db_id: int
    sql_content: str


class ExecuteRequest(BaseModel):
    db_id: int
    sql_content: str
    max_rows: Optional[int] = 100


# ════════════════════════════════════════════════════════════════════
# /sql-scripts/  — CRUD
# ════════════════════════════════════════════════════════════════════

@router.get("/sql-scripts/", summary="Liste tous les scripts SQL")
def list_scripts(
    category: Optional[str] = None,
    db_type: Optional[str] = None,
    is_active: Optional[int] = 1,
    db: Session = Depends(get_db),
):
    q = db.query(SqlScript)

    if is_active is not None:
        q = q.filter(SqlScript.is_active == is_active)

    if category and category.strip() and category.upper() != "TOUTES":
        q = q.filter(SqlScript.category == category.upper())

    if db_type and db_type.strip() and db_type.upper() != "TOUTES":
        q = q.filter(SqlScript.db_type == db_type.upper())

    scripts = q.order_by(SqlScript.script_id).all()
    return [_script_to_dict(s) for s in scripts]


@router.get("/sql-scripts/{script_id}", summary="Détail d'un script")
def get_script(script_id: int, db: Session = Depends(get_db)):
    s = db.query(SqlScript).filter(SqlScript.script_id == script_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Script introuvable")
    return _script_to_dict(s)


@router.post("/sql-scripts/", status_code=201, summary="Créer un script")
def create_script(payload: SqlScriptCreate, db: Session = Depends(get_db)):
    next_id = db.execute(text("SELECT DBMON.SQL_SCRIPTS_SEQ.NEXTVAL FROM DUAL")).scalar()

    s = SqlScript(
        script_id=next_id,
        script_name=payload.script_name,
        description=payload.description,
        category=(payload.category or "").upper() or None,
        db_type=(payload.db_type or "ORACLE").upper(),
        sql_content=payload.sql_content,
        is_active=payload.is_active if payload.is_active is not None else 1,
        created_by="ADMIN",
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _script_to_dict(s)


@router.put("/sql-scripts/{script_id}", summary="Modifier un script")
def update_script(script_id: int, payload: SqlScriptUpdate, db: Session = Depends(get_db)):
    s = db.query(SqlScript).filter(SqlScript.script_id == script_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Script introuvable")

    if payload.script_name is not None:
        s.script_name = payload.script_name

    if payload.description is not None:
        s.description = payload.description

    if payload.category is not None:
        s.category = payload.category.upper() if payload.category else None

    if payload.db_type is not None:
        s.db_type = payload.db_type.upper() if payload.db_type else None

    if payload.sql_content is not None:
        s.sql_content = payload.sql_content

    if payload.is_active is not None:
        s.is_active = payload.is_active

    db.commit()
    db.refresh(s)
    return _script_to_dict(s)


@router.delete("/sql-scripts/{script_id}", status_code=204, summary="Supprimer un script")
def delete_script(script_id: int, db: Session = Depends(get_db)):
    s = db.query(SqlScript).filter(SqlScript.script_id == script_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Script introuvable")
    db.delete(s)
    db.commit()


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

def _script_to_dict(s: SqlScript) -> dict:
    return {
        "script_id": int(s.script_id),
        "script_name": s.script_name,
        "description": s.description,
        "category": s.category,
        "db_type": s.db_type,
        "sql_content": s.sql_content,
        "is_active": int(s.is_active) if s.is_active is not None else 1,
        "created_at": str(s.created_at) if s.created_at else None,
        "created_by": s.created_by,
    }


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