import os
import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
DEFAULT_TIMEOUT = 20  # secondes


def _get_auth_headers():
    """Retourne les headers d'auth si un token est présent dans la session Streamlit."""
    headers = {"Accept": "application/json"}
    token = None
    try:
        token = st.session_state.get("auth_token")
    except Exception:
        token = None

    if token:
        headers["Authorization"] = f"Bearer {token}"

    return headers


def _handle_response(resp: requests.Response):
    """
    Retourne (ok, data).
    - ok=True: data = json (ou texte si pas json)
    - ok=False: affiche st.error et data=None
    """
    try:
        data = resp.json()
    except Exception:
        data = resp.text

    if 200 <= resp.status_code < 300:
        return True, data

    detail = None
    if isinstance(data, dict) and "detail" in data:
        detail = data["detail"]
    else:
        detail = data

    st.error(f"API Error {resp.status_code}: {detail}")
    return False, None


def api_get(path: str, params: dict | None = None):
    url = f"{API_BASE_URL}{path}"
    try:
        resp = requests.get(
            url,
            params=params,
            timeout=DEFAULT_TIMEOUT,
            headers=_get_auth_headers()
        )
        ok, data = _handle_response(resp)
        return data if ok else None
    except requests.RequestException as e:
        st.error(f"Connexion API impossible: {e}")
        return None


def api_post(path: str, payload: dict | None = None):
    url = f"{API_BASE_URL}{path}"
    try:
        resp = requests.post(
            url,
            json=payload,
            timeout=DEFAULT_TIMEOUT,
            headers=_get_auth_headers()
        )
        ok, data = _handle_response(resp)
        return data if ok else None
    except requests.RequestException as e:
        st.error(f"Connexion API impossible: {e}")
        return None


def api_put(path: str, payload: dict | None = None):
    url = f"{API_BASE_URL}{path}"
    try:
        resp = requests.put(
            url,
            json=payload,
            timeout=DEFAULT_TIMEOUT,
            headers=_get_auth_headers()
        )
        ok, data = _handle_response(resp)
        return data if ok else None
    except requests.RequestException as e:
        st.error(f"Connexion API impossible: {e}")
        return None


def api_delete(path: str):
    """DELETE -> retourne data (json/texte) si ok, sinon None"""
    url = f"{API_BASE_URL}{path}"
    try:
        resp = requests.delete(
            url,
            timeout=DEFAULT_TIMEOUT,
            headers=_get_auth_headers()
        )
        ok, data = _handle_response(resp)
        return data if ok else None
    except requests.RequestException as e:
        st.error(f"Connexion API impossible: {e}")
        return None


def api_healthcheck():
    """
    Si tu as GET / (ou /health), adapte ici.
    """
    data = api_get("/")
    return data


# =========================
# NOUVELLES FONCTIONS DASHBOARD
# =========================

def get_latest_metric_values():
    """Récupère la dernière valeur de chaque métrique par base."""
    return api_get("/metric-values/latest")


def get_metric_detail(metric_id: int, db_id: int):
    """Récupère le détail d'une métrique pour une base donnée."""
    return api_get(f"/metric-values/details/{metric_id}/{db_id}")


def get_metric_history(metric_id: int, db_id: int, limit: int = 50):
    """Récupère l'historique d'une métrique pour une base donnée."""
    return api_get(f"/metric-values/history/{metric_id}/{db_id}", params={"limit": limit})


def get_target_db_overview(db_id: int):
    """Récupère la vue globale d'une base."""
    return api_get(f"/target-dbs/{db_id}/overview")