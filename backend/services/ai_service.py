import requests

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
OLLAMA_MODEL = "phi3"


def build_prompt(db_name: str, db_type: str, metrics: list[dict]) -> str:
    lines = [
        f"Base de données: {db_name}",
        f"Type: {db_type}",
        "",
        "Métriques collectées:",
    ]

    for m in metrics:
        code = m.get("code", "UNKNOWN")
        value = m.get("value", "N/A")
        severity = m.get("severity", "UNKNOWN")
        unit = m.get("unit") or ""
        lines.append(f"- {code}: {value} {unit} | severity={severity}")

    lines.extend(
        [
            "",
            "Tu es un expert en monitoring Oracle.",
            "Analyse brièvement ces métriques.",
            "Réponds en français simple et court.",
            "Donne :",
            "1. Un résumé global",
            "2. Les problèmes possibles",
            "3. Des recommandations concrètes",
        ]
    )

    return "\n".join(lines)


def ask_ollama(prompt: str, model: str = OLLAMA_MODEL) -> str:
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": 250
            }
        },
        timeout=300,
    )
    response.raise_for_status()
    data = response.json()
    return data.get("response", "").strip()


def analyze_metrics(db_name: str, db_type: str, metrics: list[dict]) -> str:
    prompt = build_prompt(db_name, db_type, metrics)
    return ask_ollama(prompt)