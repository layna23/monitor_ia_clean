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


def save_chat_message(db: Session, sql_id: str, phv: str, role: str, content: str):
    if not content:
        return

    db.execute(
        text(
            """
            INSERT INTO DBMON.AI_CHAT_MESSAGES (
                SQL_ID,
                PHV,
                ROLE,
                CONTENT
            )
            VALUES (
                :sql_id,
                :phv,
                :role,
                :content
            )
            """
        ),
        {
            "sql_id": sql_id,
            "phv": str(phv) if phv is not None else None,
            "role": role,
            "content": content,
        },
    )


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
                "description": "Guide d’analyse pour identifier les causes possibles d’une RAM élevée.",
                "steps": [
                    "Vérifier la métrique RAM_USAGE et son évolution",
                    "Lister les sessions actives",
                    "Identifier les requêtes SQL les plus coûteuses",
                    "Analyser PGA / SGA",
                    "Proposer des pistes d’optimisation manuelles",
                ],
                "execution_mode": "MANUAL_GUIDE_ONLY",
            },
            {
                "code": "PLAYBOOK_CPU_HIGH",
                "title": "CPU élevé",
                "description": "Guide d’analyse pour identifier les sessions ou requêtes responsables de la charge CPU.",
                "steps": [
                    "Lire la métrique CPU",
                    "Lister les sessions actives",
                    "Identifier les SQL_ID les plus coûteux",
                    "Analyser les plans d’exécution",
                    "Proposer des pistes d’optimisation manuelles",
                ],
                "execution_mode": "MANUAL_GUIDE_ONLY",
            },
            {
                "code": "PLAYBOOK_DB_TIME_HIGH",
                "title": "DB Time élevé",
                "description": "Guide d’analyse des causes d’attente et des requêtes lentes.",
                "steps": [
                    "Vérifier DB Time",
                    "Analyser les événements d’attente",
                    "Identifier les requêtes SQL lentes",
                    "Comparer les PHV si disponibles",
                    "Proposer des pistes d’analyse manuelles",
                ],
                "execution_mode": "MANUAL_GUIDE_ONLY",
            },
            {
                "code": "PLAYBOOK_LOCKS",
                "title": "Locks ou sessions bloquées",
                "description": "Guide d’analyse pour identifier les sessions bloquantes et objets verrouillés.",
                "steps": [
                    "Lister les objets verrouillés",
                    "Identifier la session bloquante",
                    "Afficher la requête SQL associée",
                    "Proposer les vérifications manuelles avant toute action",
                ],
                "execution_mode": "MANUAL_GUIDE_ONLY",
            },
            {
                "code": "PLAYBOOK_SESSIONS_HIGH",
                "title": "Nombre de sessions élevé",
                "description": "Guide d’analyse de l’augmentation du nombre de sessions.",
                "steps": [
                    "Lister les sessions ouvertes",
                    "Identifier les programmes connectés",
                    "Détecter les sessions inactives",
                    "Vérifier l’évolution du nombre de sessions",
                    "Proposer des recommandations manuelles",
                ],
                "execution_mode": "MANUAL_GUIDE_ONLY",
            },
            {
                "code": "PLAYBOOK_SQL_TUNING",
                "title": "SQL tuning",
                "description": "Guide d’analyse des requêtes SQL lentes ou coûteuses.",
                "steps": [
                    "Lister le top SQL",
                    "Analyser le plan d’exécution",
                    "Comparer les PHV",
                    "Vérifier index et statistiques",
                    "Proposer des pistes SQL tuning manuelles",
                ],
                "execution_mode": "MANUAL_GUIDE_ONLY",
            },
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
Liste les anomalies détectées.

=== Incidents probables ===
Anticipe les incidents possibles.

=== Analyse des causes ===
Explique les causes possibles.

=== Actions recommandées ===
Donne uniquement des recommandations manuelles.
Ne propose aucune correction automatique.
Ne dis jamais que le système va exécuter une action.
L’admin reste responsable de toute décision.

=== Playbooks recommandés ===
Si une anomalie est détectée, propose un ou plusieurs playbooks.

IMPORTANT :
- Les playbooks sont uniquement des guides d’analyse.
- Ne propose aucune exécution automatique.
- Ne dis pas que le système va corriger le problème.
- Donne seulement les étapes manuelles recommandées.
- L’admin reste responsable de l’action.

Pour chaque playbook recommandé, donne :
- le code du playbook
- la raison
- les étapes proposées
- le niveau de risque LOW / MEDIUM / HIGH

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


@router.post("/chat-db-analysis")
def chat_db_analysis(payload: dict, db: Session = Depends(get_db)):
    db_id = payload.get("db_id")
    db_name = payload.get("db_name", "")
    analysis = payload.get("analysis", "")
    messages = payload.get("messages", [])

    if not db_id:
        raise HTTPException(status_code=400, detail="db_id obligatoire")

    if not isinstance(messages, list) or len(messages) == 0:
        raise HTTPException(status_code=400, detail="Messages obligatoires")

    context = get_db_context(db, int(db_id))

    prompt = f"""
Tu es un chatbot expert DBA Oracle.

Tu discutes avec l'utilisateur à propos d'une analyse IA globale d'une base de données.

Base :
{db_name or "Non fournie"}

Contexte DB :
{json.dumps(context, ensure_ascii=False, default=str)}

Analyse IA précédente :
{analysis or "Aucune analyse précédente"}

Conversation :
{json.dumps(messages, ensure_ascii=False, indent=2, default=str)}

Règles :
- Réponds uniquement en français.
- Réponds comme un assistant DBA.
- Explique les anomalies détectées.
- Explique les métriques CPU, RAM, sessions, DB Time, locks, transactions.
- Si l'utilisateur demande un playbook, propose seulement les étapes.
- Ne dis jamais que tu vas exécuter une correction.
- Ne propose aucune action automatique.
- Ne dis jamais que le système peut corriger automatiquement.
- Donne des recommandations manuelles et prudentes.
- Si les données sont insuffisantes, dis-le clairement.
- L'objectif est d'aider à comprendre et guider, pas d'exécuter.
"""

    answer = call_groq(prompt)

    try:
        history_key = f"DB_ANALYSIS_{db_id}"
        last_user_message = messages[-1].get("content", "")

        save_chat_message(
            db=db,
            sql_id=history_key,
            phv=None,
            role="user",
            content=last_user_message,
        )

        save_chat_message(
            db=db,
            sql_id=history_key,
            phv=None,
            role="assistant",
            content=answer,
        )

        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Réponse IA générée mais sauvegarde discussion échouée : {str(e)}",
        )

    return {
        "success": True,
        "mode": "chat_db_analysis",
        "answer": answer,
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
- Compare FULL TABLE SCAN, INDEX RANGE SCAN, TABLE ACCESS BY INDEX ROWID, NESTED LOOPS, HASH JOIN, SORT et TEMP.
- Donne un score /100 pour chaque PHV.
- Choisis un seul meilleur PHV.
- Le meilleur PHV n'est pas forcément celui avec le plus petit cost.
- Si les métriques sont insuffisantes, dis que le choix est estimé.
- Explique clairement pourquoi ce PHV est meilleur que les autres.

Réponds uniquement en français.

Structure obligatoirement la réponse comme ceci :

=== Résumé global ===

=== Tableau comparatif des PHV ===

=== Analyse détaillée de chaque PHV ===

=== Meilleur PHV choisi ===

=== Pourquoi ce PHV est le meilleur ===

=== Risques ou limites de l'analyse ===

=== Recommandations SQL / index ===

=== Conclusion finale ===

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


@router.post("/chat-sql-analysis")
def chat_sql_analysis(payload: dict, db: Session = Depends(get_db)):
    sql_id = payload.get("sql_id", "")
    sql = payload.get("sql", "")
    selected_phv = payload.get("selected_phv", "")
    best_phv = payload.get("best_phv", "")
    analysis = payload.get("analysis", "")
    plans = payload.get("plans", [])
    messages = payload.get("messages", [])

    if not sql.strip():
        raise HTTPException(status_code=400, detail="SQL obligatoire")

    if not isinstance(messages, list) or len(messages) == 0:
        raise HTTPException(status_code=400, detail="Messages obligatoires")

    prompt = f"""
Tu es un chatbot expert DBA Oracle et SQL tuning.

Tu discutes avec un administrateur DBA à propos d'une analyse IA déjà générée.
Tu dois répondre uniquement en français.

CONTEXTE SQL :
SQL_ID : {sql_id or "Non fourni"}

SQL :
{sql}

PHV sélectionné :
{selected_phv or "Non fourni"}

Meilleur PHV choisi par l'analyse IA :
{best_phv or "Non fourni"}

ANALYSE IA PRÉCÉDENTE :
{analysis or "Aucune analyse précédente"}

PLANS DISPONIBLES :
{json.dumps(plans, ensure_ascii=False, indent=2, default=str)}

CONVERSATION :
{json.dumps(messages, ensure_ascii=False, indent=2, default=str)}

Règles de réponse :
- Réponds comme un chatbot DBA Oracle.
- Sois clair, précis et pédagogique.
- Si l'admin conteste ton choix de PHV, explique calmement pourquoi.
- Si l'admin a raison ou soulève un doute valide, reconnais-le.
- Ne prétends pas être sûr à 100% si les métriques sont insuffisantes.
- Explique toujours les limites de l'analyse.
- Ne propose jamais une action dangereuse sans validation humaine.
- Si l'admin demande une comparaison, compare les PHV.
- Si l'admin demande une correction, reformule l'analyse corrigée.
- Si l'admin demande pourquoi un autre PHV n'a pas été choisi, compare-le au meilleur PHV.
- Si l'admin demande une recommandation, donne des étapes concrètes.
"""

    answer = call_groq(prompt)

    try:
        last_user_message = messages[-1].get("content", "")

        save_chat_message(
            db=db,
            sql_id=sql_id,
            phv=selected_phv,
            role="user",
            content=last_user_message,
        )

        save_chat_message(
            db=db,
            sql_id=sql_id,
            phv=selected_phv,
            role="assistant",
            content=answer,
        )

        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Réponse IA générée mais sauvegarde discussion échouée : {str(e)}",
        )

    return {
        "success": True,
        "mode": "chat_sql_analysis",
        "answer": answer,
    }


@router.get("/chat-history/{sql_id}")
def get_chat_history(sql_id: str, db: Session = Depends(get_db)):
    try:
        rows = db.execute(
            text(
                """
                SELECT
                    MESSAGE_ID,
                    SQL_ID,
                    PHV,
                    ROLE,
                    CONTENT,
                    CREATED_AT
                FROM DBMON.AI_CHAT_MESSAGES
                WHERE SQL_ID = :sql_id
                ORDER BY CREATED_AT ASC, MESSAGE_ID ASC
                """
            ),
            {"sql_id": sql_id},
        ).mappings().all()

        return {
            "success": True,
            "sql_id": sql_id,
            "messages": [
                {
                    "message_id": row["message_id"],
                    "sql_id": row["sql_id"],
                    "phv": row["phv"],
                    "role": row["role"],
                    "content": row["content"],
                    "created_at": str(row["created_at"]),
                }
                for row in rows
            ],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))