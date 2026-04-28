from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
import os
import json
import requests

from backend.database.session import get_db

router = APIRouter(prefix="/ai", tags=["AI"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def call_groq(prompt: str):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY manquante dans .env")

    try:
        res = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
            },
            timeout=90,
        )

        if res.status_code != 200:
            raise HTTPException(status_code=500, detail=res.text)

        data = res.json()
        return data["choices"][0]["message"]["content"]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def extract_best_phv(analysis: str):
    if not analysis:
        return None

    marker = "BEST_PHV ="
    if marker in analysis:
        return analysis.split(marker)[-1].strip().splitlines()[0].strip()

    return None


def get_db_context(db: Session, db_id: int):
    db_row = db.execute(
        text(
            """
            SELECT
                DB_ID,
                DB_NAME,
                DB_TYPE_ID,
                HOST,
                PORT,
                SERVICE_NAME,
                SID,
                USERNAME,
                IS_ACTIVE,
                LAST_COLLECT_AT,
                LAST_STATUS,
                LAST_ERROR,
                CREATED_AT
            FROM DBMON.TARGET_DBS
            WHERE DB_ID = :db_id
            """
        ),
        {"db_id": db_id},
    ).mappings().first()

    if not db_row:
        raise HTTPException(status_code=404, detail="Base introuvable")

    latest_metrics = db.execute(
        text(
            """
            SELECT *
            FROM (
                SELECT
                    mv.DB_ID,
                    mv.METRIC_ID,
                    md.METRIC_CODE,
                    md.UNIT,
                    md.CATEGORY,
                    md.WARN_THRESHOLD,
                    md.CRIT_THRESHOLD,
                    mv.VALUE_NUMBER,
                    mv.VALUE_TEXT,
                    mv.SEVERITY,
                    mv.COLLECTED_AT,
                    ROW_NUMBER() OVER (
                        PARTITION BY mv.METRIC_ID
                        ORDER BY mv.COLLECTED_AT DESC
                    ) AS RN
                FROM DBMON.METRIC_VALUES mv
                LEFT JOIN DBMON.METRIC_DEFS md
                    ON md.METRIC_ID = mv.METRIC_ID
                WHERE mv.DB_ID = :db_id
            )
            WHERE RN = 1
            """
        ),
        {"db_id": db_id},
    ).mappings().all()

    history_metrics = db.execute(
        text(
            """
            SELECT *
            FROM (
                SELECT
                    mv.DB_ID,
                    md.METRIC_CODE,
                    md.UNIT,
                    md.CATEGORY,
                    mv.VALUE_NUMBER,
                    mv.VALUE_TEXT,
                    mv.SEVERITY,
                    mv.COLLECTED_AT
                FROM DBMON.METRIC_VALUES mv
                LEFT JOIN DBMON.METRIC_DEFS md
                    ON md.METRIC_ID = mv.METRIC_ID
                WHERE mv.DB_ID = :db_id
                ORDER BY mv.COLLECTED_AT DESC
            )
            WHERE ROWNUM <= 40
            """
        ),
        {"db_id": db_id},
    ).mappings().all()

    return {
        "database": dict(db_row),
        "latest_metrics": [dict(r) for r in latest_metrics],
        "history_metrics": [dict(r) for r in history_metrics],
    }


@router.get("/playbooks")
def list_playbooks():
    return {
        "playbooks": [
            {
                "code": "PLAYBOOK_RAM_HIGH",
                "title": "Utilisation RAM élevée",
                "description": "Identifier les sessions et requêtes qui consomment beaucoup de mémoire.",
                "steps": [
                    "Lister les sessions actives",
                    "Vérifier les requêtes SQL les plus coûteuses",
                    "Analyser PGA / SGA",
                    "Proposer optimisation ou action manuelle"
                ],
                "requires_validation": True
            },
            {
                "code": "PLAYBOOK_CPU_HIGH",
                "title": "CPU élevé",
                "description": "Identifier les sessions ou requêtes responsables de la charge CPU.",
                "steps": [
                    "Lire la métrique CPU",
                    "Lister les sessions actives",
                    "Identifier les SQL_ID les plus coûteux",
                    "Analyser le plan d'exécution"
                ],
                "requires_validation": True
            },
            {
                "code": "PLAYBOOK_DB_TIME_HIGH",
                "title": "DB Time élevé",
                "description": "Analyser les causes d'attente et les requêtes lentes.",
                "steps": [
                    "Vérifier DB Time",
                    "Analyser les événements d'attente",
                    "Identifier les requêtes SQL lentes",
                    "Comparer les PHV si disponibles"
                ],
                "requires_validation": True
            },
            {
                "code": "PLAYBOOK_LOCKS",
                "title": "Locks ou sessions bloquées",
                "description": "Identifier les sessions bloquantes et les objets verrouillés.",
                "steps": [
                    "Lister les objets verrouillés",
                    "Identifier la session bloquante",
                    "Afficher la requête SQL associée",
                    "Demander validation avant action corrective"
                ],
                "requires_validation": True
            },
            {
                "code": "PLAYBOOK_SESSIONS_HIGH",
                "title": "Nombre de sessions élevé",
                "description": "Analyser l'augmentation du nombre de sessions.",
                "steps": [
                    "Lister les sessions ouvertes",
                    "Identifier les programmes connectés",
                    "Détecter les sessions inactives",
                    "Proposer nettoyage manuel"
                ],
                "requires_validation": True
            },
            {
                "code": "PLAYBOOK_SQL_TUNING",
                "title": "SQL tuning",
                "description": "Analyser les requêtes SQL lentes ou coûteuses.",
                "steps": [
                    "Lister le top SQL",
                    "Analyser le plan d'exécution",
                    "Comparer les PHV",
                    "Proposer index ou mise à jour des statistiques"
                ],
                "requires_validation": True
            }
        ]
    }


@router.post("/analyze-db/{db_id}")
def analyze_database_with_ai(db_id: int, db: Session = Depends(get_db)):
    context = get_db_context(db, db_id)

    prompt = f"""
Tu es un expert DBA Oracle et performance database.

Analyse en profondeur les métriques d'une base Oracle.

Données :
{json.dumps(context, ensure_ascii=False, default=str)}

Réponds uniquement en français.

Structure obligatoirement la réponse comme ceci :

=== Résumé global ===
Donne un résumé clair de l’état global de la base.

=== Analyse des métriques ===
Analyse CPU, RAM, DB Time, sessions, locks, transactions.
Explique les tendances et les anomalies.

=== Problèmes détectés ===
Liste les anomalies détectées (CPU élevé, DB Time élevé, sessions élevées, locks, etc).

=== Incidents probables ===
Anticipe les incidents possibles :
- saturation CPU
- blocage sessions
- requêtes lentes
- contention ressources

=== Analyse des causes ===
Explique les causes possibles :
- requêtes SQL lourdes
- manque d’index
- statistiques obsolètes
- surcharge système

=== Actions recommandées ===
Donne des actions concrètes :
- requêtes SQL à vérifier
- index à créer
- stats à mettre à jour
- sessions à analyser
- plans d’exécution à vérifier

=== Playbooks recommandés ===
Si une anomalie est détectée, propose un ou plusieurs playbooks parmi cette liste :

- PLAYBOOK_RAM_HIGH : Utilisation RAM élevée
- PLAYBOOK_CPU_HIGH : Utilisation CPU élevée
- PLAYBOOK_DB_TIME_HIGH : DB Time élevé
- PLAYBOOK_LOCKS : Locks ou sessions bloquées
- PLAYBOOK_SESSIONS_HIGH : Nombre de sessions élevé
- PLAYBOOK_SQL_TUNING : Requêtes SQL lentes ou coûteuses

Pour chaque playbook recommandé, donne :
- le code du playbook
- la raison
- les étapes prévues
- le niveau de risque LOW / MEDIUM / HIGH
- préciser que la validation humaine est obligatoire avant exécution

=== Conclusion finale ===
Conclusion claire avec niveau de risque : OK / WARNING / CRITICAL
"""

    analysis = call_groq(prompt)

    return {
        "success": True,
        "mode": "database_ai_analysis",
        "db_id": db_id,
        "analysis": analysis,
    }


@router.post("/analyze-sql")
def analyze_sql(payload: dict):
    sql = payload.get("sql", "")
    plan = payload.get("plan", "")
    phv = payload.get("phv", "")

    if not sql.strip():
        raise HTTPException(status_code=400, detail="SQL obligatoire")

    prompt = f"""
Tu es un expert Oracle SQL tuning.

Analyse cette requête SQL et son plan d'exécution.

SQL :
{sql}

PHV :
{phv or "Non fourni"}

PLAN :
{plan or "Non fourni"}

Réponds uniquement en français.

Structure obligatoirement la réponse comme ceci :

=== Résumé du problème ===

=== Analyse du plan ===

=== Problèmes détectés ===

=== Index recommandés ===

=== Requête optimisée si possible ===

=== Conclusion ===
"""

    analysis = call_groq(prompt)

    return {
        "success": True,
        "mode": "single_plan",
        "analysis": analysis,
    }


@router.post("/analyze-phv")
def analyze_phv(payload: dict):
    sql_id = payload.get("sql_id", "")
    sql = payload.get("sql", "")
    plans = payload.get("plans", [])

    if not sql.strip():
        raise HTTPException(status_code=400, detail="SQL obligatoire")

    if not isinstance(plans, list) or len(plans) < 2:
        raise HTTPException(
            status_code=400,
            detail="Il faut au moins 2 PHV pour comparer les plans",
        )

    prompt = f"""
Tu es un expert Oracle SQL tuning.

Une même requête possède plusieurs PHV.
Compare les plans et choisis le meilleur PHV.

SQL_ID :
{sql_id or "Non fourni"}

SQL :
{sql}

PLANS PHV :
{json.dumps(plans, ensure_ascii=False, indent=2)}

Règles :
- Analyse chaque PHV séparément.
- Compare cost, buffer_gets, disk_reads, elapsed_time, cpu_time, executions si disponibles.
- Compare aussi FULL TABLE SCAN, INDEX RANGE SCAN, TABLE ACCESS BY INDEX ROWID, NESTED LOOPS, HASH JOIN, SORT et TEMP.
- Donne un score /100 pour chaque PHV.
- Choisis un seul meilleur PHV.
- Le meilleur PHV n'est pas forcément celui avec le plus petit cost : justifie avec les métriques disponibles.
- Si les métriques sont insuffisantes, dis que le choix est estimé.
- Explique clairement pourquoi ce PHV est meilleur que les autres.

Réponds uniquement en français.

Structure obligatoirement la réponse comme ceci :

=== Résumé global ===
Explique brièvement le contexte.

=== Tableau comparatif des PHV ===
Présente les PHV avec coût, buffer_gets, disk_reads, type d'accès et score /100.

=== Analyse détaillée de chaque PHV ===
Analyse chaque PHV séparément.

=== Meilleur PHV choisi ===
Indique clairement le meilleur PHV.

=== Pourquoi ce PHV est le meilleur ===
Explique pourquoi il est meilleur que les autres.

=== Risques ou limites de l'analyse ===
Explique si le choix est estimé ou sûr.

=== Recommandations SQL / index ===
Donne les recommandations.

=== Conclusion finale ===
Conclusion claire.

IMPORTANT :
À la toute fin, écris exactement :
BEST_PHV = <valeur_du_meilleur_phv>
"""

    analysis = call_groq(prompt)
    best_phv = extract_best_phv(analysis)

    return {
        "success": True,
        "mode": "multi_phv",
        "sql_id": sql_id,
        "plans_count": len(plans),
        "best_phv": best_phv,
        "analysis": analysis,
    }