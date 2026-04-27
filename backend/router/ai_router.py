from fastapi import APIRouter, HTTPException
import os
import json
import requests

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