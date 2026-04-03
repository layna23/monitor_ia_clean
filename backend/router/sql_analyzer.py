# backend/router/sql_analyzer.py
"""
Deux préfixes :
  /sql-scripts/   → CRUD des scripts sauvegardés
  /sql-analyzer/  → EXPLAIN PLAN + exécution
"""
import time
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
    category:    Optional[str] = None
    db_type:     Optional[str] = "ORACLE"
    sql_content: str
    is_active:   Optional[int] = 1

class SqlScriptUpdate(BaseModel):
    script_name: Optional[str] = None
    description: Optional[str] = None
    category:    Optional[str] = None
    sql_content: Optional[str] = None
    is_active:   Optional[int] = None

class ExplainRequest(BaseModel):
    db_id:       int
    sql_content: str

class ExecuteRequest(BaseModel):
    db_id:       int
    sql_content: str
    max_rows:    Optional[int] = 100


# ════════════════════════════════════════════════════════════════════
# /sql-scripts/  — CRUD
# ════════════════════════════════════════════════════════════════════

@router.get("/sql-scripts/", summary="Liste tous les scripts SQL")
def list_scripts(
    category:  Optional[str] = None,
    is_active: Optional[int] = 1,
    db: Session = Depends(get_db),
):
    q = db.query(SqlScript)
    if is_active is not None:
        q = q.filter(SqlScript.is_active == is_active)
    if category:
        q = q.filter(SqlScript.category == category.upper())
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
        script_id   = next_id,
        script_name = payload.script_name,
        description = payload.description,
        category    = (payload.category or "").upper() or None,
        db_type     = payload.db_type or "ORACLE",
        sql_content = payload.sql_content,
        is_active   = payload.is_active if payload.is_active is not None else 1,
        created_by  = "ADMIN",
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
    if payload.script_name is not None: s.script_name = payload.script_name
    if payload.description is not None: s.description = payload.description
    if payload.category    is not None: s.category    = payload.category.upper()
    if payload.sql_content is not None: s.sql_content = payload.sql_content
    if payload.is_active   is not None: s.is_active   = payload.is_active
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
    Génère le EXPLAIN PLAN Oracle pour le SQL fourni sur la base cible.
    Retourne le plan structuré pour analyse IA.
    """
    target = db.query(TargetDB).filter(TargetDB.db_id == payload.db_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Base cible introuvable")

    sql = payload.sql_content.strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL vide")

    # Connexion à la base cible
    conn = _get_target_conn(target)

    try:
        cursor = conn.cursor()

        # Nettoyer le plan précédent
        statement_id = f"DBMON_{int(time.time())}"
        try:
            cursor.execute(f"DELETE FROM PLAN_TABLE WHERE STATEMENT_ID = '{statement_id}'")
        except Exception:
            pass

        # Générer le plan
        cursor.execute(f"EXPLAIN PLAN SET STATEMENT_ID = '{statement_id}' FOR {sql}")

        # Lire le plan
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

        columns = [d[0].lower() for d in cursor.description]
        rows    = [dict(zip(columns, row)) for row in cursor.fetchall()]

        # Calcul coût total
        total_cost = 0
        try:
            cursor.execute(f"""
                SELECT NVL(SUM(COST),0)
                FROM PLAN_TABLE
                WHERE STATEMENT_ID = '{statement_id}'
            """)
            total_cost = int(cursor.fetchone()[0] or 0)
        except Exception:
            pass

        # Nettoyage
        try:
            cursor.execute(f"DELETE FROM PLAN_TABLE WHERE STATEMENT_ID = '{statement_id}'")
            conn.commit()
        except Exception:
            pass

        cursor.close()
        conn.close()

        # Évaluation du coût
        cost_level = _evaluate_cost(total_cost)

        return {
            "success":    True,
            "db_id":      payload.db_id,
            "db_name":    target.db_name,
            "total_cost": total_cost,
            "cost_level": cost_level,   # LOW | MEDIUM | HIGH | CRITICAL
            "plan_rows":  rows,
            "sql":        sql,
        }

    except Exception as e:
        try:
            conn.close()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Erreur EXPLAIN PLAN : {str(e)}")


@router.post("/sql-analyzer/execute", summary="Exécuter un script SQL")
def execute_script(payload: ExecuteRequest, db: Session = Depends(get_db)):
    """
    Exécute le script SQL sur la base cible et retourne les résultats.
    Limité à max_rows lignes (défaut 100).
    """
    target = db.query(TargetDB).filter(TargetDB.db_id == payload.db_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Base cible introuvable")

    sql = payload.sql_content.strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL vide")

    conn = _get_target_conn(target)
    t0   = time.time()

    try:
        cursor = conn.cursor()
        cursor.execute(sql)

        columns = [d[0].lower() for d in cursor.description] if cursor.description else []
        rows    = []
        if columns:
            raw = cursor.fetchmany(payload.max_rows or 100)
            rows = [dict(zip(columns, [str(v) if v is not None else None for v in row])) for row in raw]

        duration_ms = int((time.time() - t0) * 1000)
        cursor.close()
        conn.close()

        return {
            "success":     True,
            "db_id":       payload.db_id,
            "db_name":     target.db_name,
            "columns":     columns,
            "rows":        rows,
            "row_count":   len(rows),
            "duration_ms": duration_ms,
            "sql":         sql,
        }

    except Exception as e:
        try:
            conn.close()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Erreur exécution : {str(e)}")


# ── Helpers privés ────────────────────────────────────────────────────────────

def _script_to_dict(s: SqlScript) -> dict:
    return {
        "script_id":   int(s.script_id),
        "script_name": s.script_name,
        "description": s.description,
        "category":    s.category,
        "db_type":     s.db_type,
        "sql_content": s.sql_content,
        "is_active":   int(s.is_active) if s.is_active is not None else 1,
        "created_at":  str(s.created_at) if s.created_at else None,
        "created_by":  s.created_by,
    }


def _evaluate_cost(total_cost: int) -> str:
    if total_cost == 0:           return "UNKNOWN"
    if total_cost < 100:          return "LOW"
    if total_cost < 1000:         return "MEDIUM"
    if total_cost < 10000:        return "HIGH"
    return "CRITICAL"


def _get_target_conn(target):
    """Connexion lazy Oracle vers la base cible."""
    import oracledb
    service = target.service_name or target.db_name
    dsn     = f"{target.host}:{target.port}/{service}"
    return oracledb.connect(
        user     = target.username,
        password = target.password_enc or target.password,
        dsn      = dsn,
    )