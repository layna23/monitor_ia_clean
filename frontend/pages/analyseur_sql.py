import streamlit as st
import pandas as pd

from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header
from api_client import api_get, api_post, api_put, api_delete

st.set_page_config(
    page_title="Analyseur SQL — DB Monitor IA",
    page_icon="🔬",
    layout="wide",
)

apply_style()
require_auth()
render_sidebar(active="analyseur_sql")
render_header(
    "Analyseur SQL Intelligent",
    "Sélectionnez une base et un script — analysez le plan d'exécution avant de lancer",
)

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

:root {
    --c-bg: #f6f8fc;
    --c-surface: #ffffff;
    --c-border: #e4e9f2;
    --c-border-hover:#c7d3ea;
    --c-text-primary:#0d1b2a;
    --c-text-second:#526077;
    --c-text-muted:#8fa0bb;
    --c-accent:#2563eb;
    --c-accent-soft:#eff4ff;
    --c-accent-glow: rgba(37,99,235,0.12);
    --c-success:#059669;
    --c-warning:#d97706;
    --c-danger:#dc2626;
    --c-mono:'JetBrains Mono', monospace;
    --radius-sm:8px;
    --radius-md:12px;
    --radius-lg:16px;
    --shadow-xs:0 1px 3px rgba(13,27,42,0.06);
    --shadow-sm:0 2px 8px rgba(13,27,42,0.08);
    --shadow-md:0 4px 20px rgba(13,27,42,0.10);
    --shadow-focus:0 0 0 3px rgba(37,99,235,0.20);
    --transition:all 0.18s ease;
}

html, body, [class*="css"] {
    font-family: 'DM Sans', sans-serif !important;
    color: var(--c-text-primary);
    background-color: var(--c-bg) !important;
    letter-spacing: -0.01em;
}

[data-testid="stVerticalBlock"] > [data-testid="stVerticalBlockBorderWrapper"] {
    background: var(--c-surface) !important;
    border: 1px solid var(--c-border) !important;
    border-radius: var(--radius-lg) !important;
    box-shadow: var(--shadow-sm) !important;
    transition: var(--transition) !important;
    overflow: hidden;
}
[data-testid="stVerticalBlock"] > [data-testid="stVerticalBlockBorderWrapper"]:hover {
    border-color: var(--c-border-hover) !important;
    box-shadow: var(--shadow-md) !important;
}

.card-section-title {
    font-size: 0.67rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--c-text-muted);
    padding: 0.1rem 0 0.6rem 0;
    border-bottom: 1px solid var(--c-border);
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.45rem;
}
.card-section-title::after {
    content: '';
    flex: 1;
}

[data-baseweb="select"] > div {
    background: var(--c-surface) !important;
    border: 1.5px solid var(--c-border) !important;
    border-radius: var(--radius-md) !important;
    box-shadow: var(--shadow-xs) !important;
    font-family: 'DM Sans', sans-serif !important;
    font-size: 0.875rem !important;
    transition: var(--transition) !important;
    min-height: 42px !important;
}
[data-baseweb="select"] > div:hover,
[data-baseweb="select"] > div:focus-within {
    border-color: var(--c-accent) !important;
    box-shadow: var(--shadow-focus) !important;
}

[data-baseweb="input"] > div,
[data-baseweb="textarea"] > div,
textarea {
    background: var(--c-surface) !important;
    border: 1.5px solid var(--c-border) !important;
    border-radius: var(--radius-md) !important;
    font-family: 'DM Sans', sans-serif !important;
    font-size: 0.875rem !important;
    transition: var(--transition) !important;
    box-shadow: var(--shadow-xs) !important;
}
textarea {
    font-family: var(--c-mono) !important;
    font-size: 0.825rem !important;
    line-height: 1.65 !important;
    color: var(--c-text-primary) !important;
}
[data-baseweb="input"] > div:focus-within,
[data-baseweb="textarea"] > div:focus-within,
textarea:focus {
    border-color: var(--c-accent) !important;
    box-shadow: var(--shadow-focus) !important;
    outline: none !important;
}
[data-testid="stTextInput"] label,
[data-testid="stTextArea"] label,
[data-testid="stSelectbox"] label {
    font-size: 0.78rem !important;
    font-weight: 600 !important;
    color: var(--c-text-second) !important;
    margin-bottom: 0.25rem !important;
}

[data-testid="stButton"] button {
    font-family: 'DM Sans', sans-serif !important;
    font-size: 0.82rem !important;
    font-weight: 600 !important;
    border-radius: var(--radius-md) !important;
    padding: 0.55rem 1rem !important;
    transition: var(--transition) !important;
    letter-spacing: -0.01em;
    border: 1.5px solid var(--c-border) !important;
    background: var(--c-surface) !important;
    color: var(--c-text-primary) !important;
    box-shadow: var(--shadow-xs) !important;
    height: 42px !important;
    white-space: nowrap !important;
}
[data-testid="stButton"] button:hover {
    border-color: var(--c-border-hover) !important;
    box-shadow: var(--shadow-sm) !important;
    transform: translateY(-1px) !important;
    color: var(--c-accent) !important;
}
[data-testid="stButton"] button[kind="primary"] {
    background: var(--c-accent) !important;
    border-color: var(--c-accent) !important;
    color: #fff !important;
    box-shadow: 0 2px 8px var(--c-accent-glow) !important;
}
[data-testid="stButton"] button[kind="primary"]:hover {
    background: #1d4ed8 !important;
    border-color: #1d4ed8 !important;
    color: #fff !important;
    box-shadow: 0 4px 16px rgba(37,99,235,0.28) !important;
}

[data-testid="stDataFrame"] {
    border-radius: var(--radius-md) !important;
    overflow: hidden !important;
    border: 1px solid var(--c-border) !important;
    box-shadow: var(--shadow-xs) !important;
}
[data-testid="stDataFrame"] th {
    background: #f1f5fb !important;
    font-family: 'DM Sans', sans-serif !important;
    font-size: 0.72rem !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.07em !important;
    color: var(--c-text-muted) !important;
    border-bottom: 1px solid var(--c-border) !important;
    padding: 0.65rem 0.9rem !important;
}
[data-testid="stDataFrame"] td {
    font-family: var(--c-mono) !important;
    font-size: 0.80rem !important;
    color: var(--c-text-primary) !important;
    padding: 0.55rem 0.9rem !important;
    border-bottom: 1px solid #f1f5fb !important;
}
[data-testid="stDataFrame"] tr:hover td {
    background: var(--c-accent-soft) !important;
}

[data-testid="stAlert"] {
    border-radius: var(--radius-md) !important;
    border-left-width: 3px !important;
    font-size: 0.875rem !important;
    font-family: 'DM Sans', sans-serif !important;
}

span[data-baseweb="tag"] {
    background: var(--c-accent-soft) !important;
    border: 1px solid #bfdbfe !important;
    border-radius: 6px !important;
}
span[data-baseweb="tag"] span {
    color: var(--c-accent) !important;
    font-weight: 600 !important;
    font-size: 0.8rem !important;
}

.small-muted {
    color: var(--c-text-muted);
    font-size: 0.75rem;
    font-weight: 500;
    margin-top: 1px;
}

.stat-card {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--radius-md);
    padding: 1rem 1.15rem;
    box-shadow: var(--shadow-xs);
    transition: var(--transition);
}
.stat-card__label {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--c-text-muted);
    margin-bottom: 0.45rem;
}
.stat-card__value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--c-text-primary);
    font-variant-numeric: tabular-nums;
    line-height: 1;
}

.db-target-card {
    background: linear-gradient(135deg, #f6f9ff 0%, #eef3fd 100%);
    border: 1px solid #d5e3f8;
    border-radius: var(--radius-md);
    padding: 0.85rem 1.1rem;
}
.db-target-card__label {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #7ba3d8;
    margin-bottom: 0.4rem;
}
.db-target-card__name {
    font-weight: 700;
    color: var(--c-text-primary);
    font-size: 0.95rem;
    margin-bottom: 0.15rem;
}
.db-target-card__host {
    font-size: 0.78rem;
    color: var(--c-text-second);
    font-family: var(--c-mono);
}
.db-target-card__service {
    font-size: 0.72rem;
    color: var(--c-text-muted);
    margin-top: 0.2rem;
}

.ai-panel {
    background: linear-gradient(135deg, #f0f7ff 0%, #e8f2ff 100%);
    border: 1px solid #bfdbfe;
    border-radius: var(--radius-md);
    padding: 1.1rem 1.3rem;
}
.ai-panel__header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.6rem;
}
.ai-panel__title {
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #1e4ea6;
}
.ai-panel__badge {
    margin-left: auto;
    background: #dbeafe;
    color: #1e40af;
    border: 1px solid #bfdbfe;
    padding: 0.1rem 0.55rem;
    border-radius: 9999px;
    font-size: 0.65rem;
    font-weight: 700;
}
.ai-panel__body {
    font-size: 0.845rem;
    color: #1e3a6e;
    line-height: 1.7;
}
.ai-panel__body ul {
    margin: 0.3rem 0 0 0.5rem;
    padding: 0;
    list-style: none;
}
.ai-panel__body ul li::before {
    content: '›';
    color: var(--c-accent);
    font-weight: 700;
    margin-right: 0.4rem;
}

.result-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border-radius: var(--radius-md);
    padding: 0.7rem 1.1rem;
    margin-bottom: 0.85rem;
    font-size: 0.86rem;
    font-weight: 600;
}
.result-banner--success {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
}
.result-banner--error {
    background: #fff1f2;
    border: 1px solid #fecdd3;
    color: #9f1239;
}
.result-banner__sep {
    color: #9ca3af;
    font-weight: 400;
}

.lib-col-header {
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--c-text-muted);
    padding: 0.4rem 0 0.4rem 0;
}
.lib-row-name {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--c-text-primary);
    padding-top: 0.5rem;
}
.lib-row-id {
    padding-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--c-text-muted);
    font-weight: 600;
    font-family: var(--c-mono);
}
.lib-row-desc {
    padding-top: 0.5rem;
    font-size: 0.82rem;
    color: var(--c-text-second);
    line-height: 1.45;
}

.delete-confirm {
    background: #fff8f8;
    border: 1.5px dashed #fecdd3;
    border-radius: var(--radius-md);
    padding: 1rem 1.25rem;
}

.empty-state {
    text-align: center;
    padding: 3.5rem 2rem;
    background: #f8fafc;
    border: 1.5px dashed var(--c-border);
    border-radius: var(--radius-lg);
    color: var(--c-text-muted);
}
.empty-state__icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
.empty-state__title { font-weight: 700; font-size: 1.05rem; color: #334155; margin-bottom: 0.35rem; }
.empty-state__sub { font-size: 0.875rem; }

.lib-divider {
    border: none;
    border-top: 1px solid #f1f5f9;
    margin: 0;
}
.lib-divider--header {
    border-top: 1px solid var(--c-border);
    margin: 0.25rem 0;
}

[data-testid="stCode"] {
    border-radius: var(--radius-md) !important;
    font-family: var(--c-mono) !important;
    font-size: 0.82rem !important;
    border: 1px solid var(--c-border) !important;
}
</style>
""", unsafe_allow_html=True)

DEFAULT_CATEGORY_OPTIONS = ["PERFORMANCE", "STOCKAGE", "BLOCAGE", "SECURITE", "OPTIMISATION"]

for k in (
    "explain_result",
    "execute_result",
    "pending_explain",
    "pending_execute",
    "selected_script_id",
    "selected_category",
    "reset_sql_requested",
    "load_script_requested",
    "load_script_id",
    "show_add_form",
    "edit_mode",
    "reset_form",
    "delete_target_id",
):
    if k not in st.session_state:
        st.session_state[k] = None

if "sql_editor" not in st.session_state:
    st.session_state["sql_editor"] = ""

if "script_name_input" not in st.session_state:
    st.session_state["script_name_input"] = ""

if "script_category_input" not in st.session_state:
    st.session_state["script_category_input"] = DEFAULT_CATEGORY_OPTIONS[0]

if "script_desc_input" not in st.session_state:
    st.session_state["script_desc_input"] = ""

if "script_sql_input" not in st.session_state:
    st.session_state["script_sql_input"] = ""

if "script_active_input" not in st.session_state:
    st.session_state["script_active_input"] = True

if st.session_state["show_add_form"] is None:
    st.session_state["show_add_form"] = False

if st.session_state["edit_mode"] is None:
    st.session_state["edit_mode"] = False

if st.session_state["reset_form"] is None:
    st.session_state["reset_form"] = False

if st.session_state["delete_target_id"] is None:
    st.session_state["delete_target_id"] = None

if st.session_state.get("reset_form"):
    st.session_state["script_name_input"] = ""
    st.session_state["script_category_input"] = DEFAULT_CATEGORY_OPTIONS[0]
    st.session_state["script_desc_input"] = ""
    st.session_state["script_sql_input"] = ""
    st.session_state["script_active_input"] = True
    st.session_state["reset_form"] = False

if st.session_state.get("_apply_pending"):
    st.session_state["script_name_input"] = st.session_state.pop("_pending_name", "")
    st.session_state["script_category_input"] = st.session_state.pop("_pending_category", DEFAULT_CATEGORY_OPTIONS[0])
    st.session_state["script_desc_input"] = st.session_state.pop("_pending_desc", "")
    st.session_state["script_sql_input"] = st.session_state.pop("_pending_sql", "")
    st.session_state["script_active_input"] = st.session_state.pop("_pending_active", True)
    st.session_state["_apply_pending"] = False


def safe_get(endpoint, default=None):
    try:
        data = api_get(endpoint)
        return data if data is not None else (default or [])
    except Exception as e:
        st.error(f"Erreur API : {e}")
        return default or []

def safe_post(endpoint, payload):
    try:
        return api_post(endpoint, payload)
    except Exception as e:
        st.error(f"Erreur API POST : {e}")
        return None

def safe_put(endpoint, payload):
    try:
        return api_put(endpoint, payload)
    except Exception as e:
        st.error(f"Erreur API PUT : {e}")
        return None

def safe_delete(endpoint):
    try:
        return api_delete(endpoint)
    except Exception as e:
        st.error(f"Erreur API DELETE : {e}")
        return None

def cost_badge(level: str) -> str:
    cfg = {
        "LOW": ("#f0fdf4", "#86efac", "#166534", "✅ Faible"),
        "MEDIUM": ("#fffbeb", "#fcd34d", "#92400e", "⚠️ Moyen"),
        "HIGH": ("#fff7ed", "#fb923c", "#9a3412", "🔶 Élevé"),
        "CRITICAL": ("#fff1f2", "#fb7185", "#9f1239", "🔴 Critique"),
        "UNKNOWN": ("#f8fafc", "#cbd5e1", "#475569", "❓ Inconnu"),
    }
    bg, border, color, label = cfg.get((level or "").upper(), cfg["UNKNOWN"])
    return (
        f'<span style="background:{bg};border:1px solid {border};color:{color};'
        f'padding:0.28rem 0.8rem;border-radius:9999px;font-size:0.76rem;font-weight:700;">'
        f'{label}</span>'
    )

def category_badge(cat: str) -> str:
    cfg = {
        "PERFORMANCE": ("#eff6ff", "#93c5fd", "#1d4ed8"),
        "BLOCAGE": ("#fff1f2", "#fda4af", "#9f1239"),
        "STOCKAGE": ("#f0fdf4", "#6ee7b7", "#065f46"),
        "SECURITE": ("#fdf4ff", "#d8b4fe", "#7e22ce"),
        "OPTIMISATION": ("#fffbeb", "#fcd34d", "#92400e"),
    }
    bg, border, color = cfg.get((cat or "").upper(), ("#f8fafc", "#cbd5e1", "#475569"))
    return (
        f'<span style="background:{bg};border:1px solid {border};color:{color};'
        f'padding:0.18rem 0.65rem;border-radius:9999px;font-size:0.70rem;font-weight:700;">'
        f'{cat or "—"}</span>'
    )

def start_new_form():
    st.session_state["show_add_form"] = True
    st.session_state["edit_mode"] = False
    st.session_state["reset_form"] = True

def load_script_into_form(script: dict):
    st.session_state["show_add_form"] = True
    st.session_state["edit_mode"] = True
    st.session_state["selected_script_id"] = script.get("script_id")
    st.session_state["_pending_name"] = script.get("script_name", "") or ""
    st.session_state["_pending_category"] = script.get("category", DEFAULT_CATEGORY_OPTIONS[0]) or DEFAULT_CATEGORY_OPTIONS[0]
    st.session_state["_pending_desc"] = script.get("description", "") or ""
    st.session_state["_pending_sql"] = script.get("sql_content", "") or ""
    st.session_state["_pending_active"] = int(script.get("is_active", 1) or 1) == 1
    st.session_state["_apply_pending"] = True

def cancel_form():
    st.session_state["show_add_form"] = False
    st.session_state["edit_mode"] = False
    st.session_state["selected_script_id"] = None
    st.session_state["reset_form"] = True

def normalize_category(value: str) -> str:
    v = (value or "").strip().upper()
    return v if v in DEFAULT_CATEGORY_OPTIONS else DEFAULT_CATEGORY_OPTIONS[0]


target_dbs = safe_get("/target-dbs/", [])
sql_scripts = safe_get("/sql-scripts/", [])

if not target_dbs:
    st.markdown("""
    <div class="empty-state">
        <div class="empty-state__icon">🗄️</div>
        <div class="empty-state__title">Aucune base configurée</div>
        <div class="empty-state__sub">Ajoutez une base dans <b>Config BD</b> d'abord.</div>
    </div>""", unsafe_allow_html=True)
    st.stop()

categories_from_db = sorted(set(
    (s.get("category") or "").upper()
    for s in sql_scripts if s.get("category")
))
categories = sorted(set(DEFAULT_CATEGORY_OPTIONS + categories_from_db))

if not sql_scripts:
    st.info("Aucun script disponible pour le moment. Vous pouvez en créer un avec le bouton Nouveau.")

if st.session_state.get("load_script_requested") and st.session_state.get("load_script_id") is not None:
    script_to_load = next(
        (s for s in sql_scripts if s.get("script_id") == st.session_state["load_script_id"]),
        None
    )
    if script_to_load:
        st.session_state["selected_script_id"] = script_to_load.get("script_id")
        st.session_state["selected_category"] = script_to_load.get("category") or "Toutes"
        st.session_state["sql_editor"] = script_to_load.get("sql_content", "") or ""
        st.session_state["explain_result"] = None
        st.session_state["execute_result"] = None

    st.session_state["load_script_requested"] = False
    st.session_state["load_script_id"] = None


selected_script = None

with st.container(border=True):
    st.markdown('<div class="card-section-title">⚙️ SÉLECTION BASE & SCRIPT</div>', unsafe_allow_html=True)
    st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)

    col_db, col_cat, col_script, col_add = st.columns([1.5, 1.0, 2.5, 1.1])

    with col_db:
        selected_db = st.selectbox(
            "Base",
            options=target_dbs,
            format_func=lambda d: f"{d.get('db_name','?')}  ·  {d.get('host','')}",
            label_visibility="collapsed",
        )

    default_cat = st.session_state.get("selected_category")
    cat_options = ["Toutes"] + categories
    if default_cat not in cat_options:
        default_cat = "Toutes"
    default_cat_index = cat_options.index(default_cat)

    with col_cat:
        cat_filter = st.selectbox(
            "Catégorie",
            options=cat_options,
            index=default_cat_index,
            label_visibility="collapsed",
        )

    if cat_filter != st.session_state.get("selected_category"):
        st.session_state["selected_category"] = cat_filter
        if not st.session_state.get("load_script_requested"):
            st.session_state["selected_script_id"] = None

    scripts_filtered = sql_scripts if cat_filter == "Toutes" else [
        s for s in sql_scripts if (s.get("category") or "").upper() == cat_filter
    ]

    with col_script:
        if scripts_filtered:
            script_ids = [s.get("script_id") for s in scripts_filtered]

            if st.session_state["selected_script_id"] in script_ids:
                default_index = script_ids.index(st.session_state["selected_script_id"])
            else:
                default_index = 0

            selected_script = st.selectbox(
                "Script",
                options=scripts_filtered,
                index=default_index,
                format_func=lambda s: s.get("script_name", "?"),
                label_visibility="collapsed",
            )
        else:
            st.selectbox(
                "Script",
                options=["Aucun script disponible"],
                index=0,
                label_visibility="collapsed",
                disabled=True,
            )
            selected_script = None

    with col_add:
        if st.button("➕ Nouveau", width="stretch"):
            start_new_form()
            st.rerun()

    if selected_script and st.session_state.get("reset_sql_requested"):
        st.session_state["sql_editor"] = selected_script.get("sql_content", "") or ""
        st.session_state["reset_sql_requested"] = False

    if selected_script:
        current_script_id = selected_script.get("script_id")
        previous_script_id = st.session_state.get("selected_script_id")

        if current_script_id != previous_script_id:
            st.session_state["selected_script_id"] = current_script_id
            st.session_state["sql_editor"] = selected_script.get("sql_content", "") or ""


if st.session_state.get("show_add_form"):
    with st.container(border=True):
        title = "✏️ MODIFIER LE SCRIPT SQL" if st.session_state.get("edit_mode") else "➕ AJOUTER UN SCRIPT SQL"
        st.markdown(f'<div class="card-section-title">{title}</div>', unsafe_allow_html=True)
        st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)

        ctop1, ctop2 = st.columns([2.2, 1.2])

        with ctop1:
            st.text_input(
                "Nom du script",
                key="script_name_input",
                placeholder="Ex: Sessions actives Oracle",
            )

        with ctop2:
            st.markdown("<div style='height:1.6rem'></div>", unsafe_allow_html=True)
            st.checkbox(
                "Script actif",
                key="script_active_input",
            )

        cform1, cform2 = st.columns([1.1, 2.6])

        with cform1:
            st.selectbox(
                "Catégorie",
                options=DEFAULT_CATEGORY_OPTIONS,
                key="script_category_input",
            )

        with cform2:
            st.text_input(
                "Description",
                key="script_desc_input",
                placeholder="Description fonctionnelle du script",
            )

        st.text_area(
            "Contenu SQL",
            key="script_sql_input",
            height=180,
            placeholder="SELECT COUNT(*) FROM v$session ...",
        )

        st.markdown("<div style='height:0.25rem'></div>", unsafe_allow_html=True)
        bsave, bcancel = st.columns([1.2, 1.2])

        with bsave:
            save_label = "💾 Enregistrer les modifications" if st.session_state.get("edit_mode") else "💾 Enregistrer"
            if st.button(save_label, width="stretch", type="primary"):
                payload = {
                    "script_name": st.session_state.get("script_name_input", "").strip(),
                    "description": st.session_state.get("script_desc_input", "").strip() or None,
                    "category": normalize_category(st.session_state.get("script_category_input")),
                    "sql_content": st.session_state.get("script_sql_input", "").strip(),
                    "is_active": 1 if st.session_state.get("script_active_input") else 0,
                }

                if not payload["script_name"]:
                    st.error("Le nom du script est obligatoire.")
                elif not payload["sql_content"]:
                    st.error("Le contenu SQL est obligatoire.")
                else:
                    if st.session_state.get("edit_mode") and st.session_state.get("selected_script_id"):
                        result = safe_put(
                            f"/sql-scripts/{st.session_state['selected_script_id']}",
                            payload
                        )
                        if result:
                            st.success("Script modifié avec succès.")
                            st.session_state["show_add_form"] = False
                            st.session_state["edit_mode"] = False
                            st.rerun()
                    else:
                        payload["db_type"] = "ORACLE"
                        result = safe_post("/sql-scripts/", payload)
                        if result:
                            st.success("Script ajouté avec succès.")
                            st.session_state["show_add_form"] = False
                            st.session_state["edit_mode"] = False
                            st.session_state["selected_script_id"] = result.get("script_id")
                            st.session_state["reset_form"] = True
                            st.rerun()

        with bcancel:
            if st.button("❌ Annuler", width="stretch"):
                cancel_form()
                st.rerun()


if selected_script:
    with st.container(border=True):
        st.markdown('<div class="card-section-title">📜 DÉTAIL DU SCRIPT</div>', unsafe_allow_html=True)
        st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

        c1, c2 = st.columns([2, 1])
        with c1:
            st.markdown(
                f'<div style="font-size:1.05rem;font-weight:700;color:var(--c-text-primary);margin-bottom:0.3rem;">'
                f'{selected_script.get("script_name","")}</div>'
                f'<div style="font-size:0.85rem;color:var(--c-text-second);margin-bottom:0.7rem;line-height:1.5;">'
                f'{selected_script.get("description","—")}</div>'
                + category_badge(selected_script.get("category", ""))
                + f'&nbsp;&nbsp;<span style="font-size:0.72rem;color:var(--c-text-muted);font-family:var(--c-mono);">'
                  f'#{selected_script.get("script_id","")}</span>',
                unsafe_allow_html=True,
            )
        with c2:
            st.markdown(
                f'<div class="db-target-card">'
                f'<div class="db-target-card__label">BASE CIBLE</div>'
                f'<div class="db-target-card__name">{selected_db.get("db_name","")}</div>'
                f'<div class="db-target-card__host">{selected_db.get("host","")}:{selected_db.get("port","")}</div>'
                f'<div class="db-target-card__service">{selected_db.get("service_name","")}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

        st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)

        sql_edited = st.text_area(
            "SQL (modifiable avant exécution)",
            height=160,
            key="sql_editor",
        )

        st.markdown("<div style='height:0.25rem'></div>", unsafe_allow_html=True)
        b1, b2, b3, b4, b5 = st.columns([1.4, 1.4, 1.2, 1.1, 1.0])

        with b1:
            if st.button("🔍 Analyser le plan", width="stretch", type="primary", key="btn_explain"):
                st.session_state["pending_explain"] = {
                    "db_id": selected_db["db_id"],
                    "sql_content": sql_edited.strip(),
                    "db_name": selected_db.get("db_name", ""),
                }
                st.session_state["execute_result"] = None

        with b2:
            if st.button("▶ Lancer l'exécution", width="stretch", key="btn_execute"):
                st.session_state["pending_execute"] = {
                    "db_id": selected_db["db_id"],
                    "sql_content": sql_edited.strip(),
                    "db_name": selected_db.get("db_name", ""),
                }

        with b3:
            if st.button("🔄 Réinitialiser", width="stretch", key="btn_reset"):
                for k in ("explain_result", "execute_result", "pending_explain", "pending_execute"):
                    st.session_state[k] = None
                st.session_state["reset_sql_requested"] = True
                st.rerun()

        with b4:
            if st.button("✏️ Modifier", width="stretch", key="btn_edit"):
                load_script_into_form(selected_script)
                st.rerun()

        with b5:
            if st.button("🗑️ Supprimer", width="stretch", key="btn_delete"):
                st.session_state["delete_target_id"] = selected_script.get("script_id")
                st.rerun()
else:
    with st.container(border=True):
        st.markdown(
            '<div class="empty-state" style="padding:2rem;">'
            'Aucun script disponible pour cette catégorie.'
            '</div>',
            unsafe_allow_html=True,
        )


if st.session_state.get("delete_target_id") is not None:
    script_del = next(
        (s for s in sql_scripts if s.get("script_id") == st.session_state["delete_target_id"]),
        None
    )

    if script_del:
        with st.container(border=True):
            st.markdown('<div class="card-section-title">🗑️ CONFIRMATION DE SUPPRESSION</div>', unsafe_allow_html=True)
            st.markdown(
                f'<div class="delete-confirm">'
                f'⚠️ Vous êtes sur le point de supprimer le script : '
                f'<strong>{script_del.get("script_name", "")}</strong> '
                f'<span style="font-family:var(--c-mono);color:var(--c-text-muted);font-size:0.8rem;">'
                f'(ID #{script_del.get("script_id")})</span>'
                f'</div>',
                unsafe_allow_html=True,
            )
            st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)

            d1, d2 = st.columns([1.2, 1.2])
            with d1:
                if st.button("✅ Oui, supprimer", width="stretch", key="confirm_delete"):
                    result = safe_delete(f"/sql-scripts/{script_del.get('script_id')}")
                    st.session_state["delete_target_id"] = None
                    st.session_state["selected_script_id"] = None
                    st.session_state["show_add_form"] = False
                    st.session_state["edit_mode"] = False
                    st.success("Script supprimé avec succès.")
                    st.rerun()

            with d2:
                if st.button("❌ Annuler suppression", width="stretch", key="cancel_delete"):
                    st.session_state["delete_target_id"] = None
                    st.rerun()


if st.session_state.get("pending_explain"):
    payload = st.session_state.pop("pending_explain")
    with st.spinner(f"Génération du plan d'exécution sur {payload['db_name']}..."):
        result = safe_post("/sql-analyzer/explain", {
            "db_id": payload["db_id"],
            "sql_content": payload["sql_content"],
        })
    if result and result.get("success"):
        st.session_state["explain_result"] = result
        st.rerun()
    else:
        st.error(f"Erreur plan : {result.get('detail', result) if result else 'Pas de réponse'}")

if st.session_state.get("pending_execute"):
    payload = st.session_state.pop("pending_execute")

    if not st.session_state.get("explain_result"):
        st.warning("⚠️ Recommandé : analysez le plan avant d'exécuter.")

    with st.spinner(f"Exécution en cours sur {payload['db_name']}..."):
        result = safe_post("/sql-analyzer/execute", {
            "db_id": payload["db_id"],
            "sql_content": payload["sql_content"],
            "max_rows": 200,
        })
    if result:
        st.session_state["execute_result"] = result
        st.rerun()
    else:
        st.error("Erreur lors de l'exécution.")


if st.session_state.get("explain_result"):
    res = st.session_state["explain_result"]

    with st.container(border=True):
        st.markdown('<div class="card-section-title">📊 PLAN D\'EXÉCUTION</div>', unsafe_allow_html=True)
        st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

        k1, k2, k3 = st.columns(3)
        with k1:
            st.markdown(
                '<div class="stat-card">'
                '<div class="stat-card__label">COÛT TOTAL</div>'
                f'<div class="stat-card__value">{res.get("total_cost", 0):,}</div>'
                '</div>', unsafe_allow_html=True,
            )
        with k2:
            st.markdown(
                '<div class="stat-card">'
                '<div class="stat-card__label">NIVEAU DE COÛT</div>'
                f'<div style="margin-top:0.35rem;">{cost_badge(res.get("cost_level",""))}</div>'
                '</div>', unsafe_allow_html=True,
            )
        with k3:
            st.markdown(
                '<div class="stat-card">'
                '<div class="stat-card__label">ÉTAPES DU PLAN</div>'
                f'<div class="stat-card__value">{len(res.get("plan_rows", []))}</div>'
                '</div>', unsafe_allow_html=True,
            )

        st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

        plan_rows = res.get("plan_rows", [])
        if plan_rows:
            df_plan = pd.DataFrame(plan_rows)
            cols_show = [
                c for c in [
                    "plan_step", "cost", "cardinality", "bytes",
                    "cpu_cost", "io_cost", "access_predicates", "filter_predicates"
                ] if c in df_plan.columns
            ]
            df_plan_display = df_plan[cols_show].copy()
            for col in df_plan_display.columns:
                df_plan_display[col] = df_plan_display[col].astype(str)
            st.dataframe(df_plan_display, width="stretch", hide_index=True)
        else:
            st.info("Aucun détail de plan disponible.")

        st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

        st.markdown(
            '<div class="ai-panel">'
            '<div class="ai-panel__header">'
            '<span style="font-size:1.2rem;">🤖</span>'
            '<span class="ai-panel__title">ANALYSE IA — DIAGNOSTIC AUTOMATIQUE</span>'
            '<span class="ai-panel__badge">Bientôt</span>'
            '</div>'
            '<div class="ai-panel__body">'
            "L'IA analysera le plan et vous donnera :"
            '<ul>'
            '<li>Évaluation du coût et des risques</li>'
            '<li>Détection de Full Table Scan, index manquants</li>'
            "<li>Recommandations d'optimisation</li>"
            '<li>Décision suggérée : Lancer / Optimiser / Ne pas lancer</li>'
            '</ul>'
            '</div>'
            '</div>',
            unsafe_allow_html=True,
        )


if st.session_state.get("execute_result"):
    res = st.session_state["execute_result"]

    with st.container(border=True):
        st.markdown('<div class="card-section-title">📋 RÉSULTATS DE L\'EXÉCUTION</div>', unsafe_allow_html=True)
        st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

        if res.get("success"):
            st.markdown(
                '<div class="result-banner result-banner--success">'
                '✅ Exécution réussie'
                '<span class="result-banner__sep">·</span>'
                f'<span>{res.get("row_count", 0)} ligne(s) retournée(s)</span>'
                '<span class="result-banner__sep">·</span>'
                f'<span>⏱ {res.get("duration_ms", 0)} ms</span>'
                '</div>',
                unsafe_allow_html=True,
            )
            rows = res.get("rows", [])
            columns = res.get("columns", [])
            if rows:
                df_exec = pd.DataFrame(rows, columns=columns) if columns else pd.DataFrame(rows)
                for col in df_exec.columns:
                    df_exec[col] = df_exec[col].astype(str)
                st.dataframe(df_exec, width="stretch", hide_index=True)
            else:
                st.info("La requête n'a retourné aucune ligne.")
        else:
            st.markdown(
                '<div class="result-banner result-banner--error">'
                '❌ Exécution échouée'
                '</div>',
                unsafe_allow_html=True,
            )
            st.code(str(res.get("detail", res)), language="text")


st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)

with st.container(border=True):
    st.markdown('<div class="card-section-title">📚 BIBLIOTHÈQUE DES SCRIPTS</div>', unsafe_allow_html=True)
    st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

    bf1, bf2 = st.columns([3, 1])
    with bf1:
        search_lib = st.text_input(
            "Rechercher",
            placeholder="🔎  Rechercher un script par nom, description ou contenu…",
            key="lib_search",
            label_visibility="collapsed",
        )
    with bf2:
        cat_lib = st.selectbox(
            "Catégorie lib",
            ["Toutes"] + categories,
            key="lib_cat",
            label_visibility="collapsed",
        )

    lib_scripts = sql_scripts
    if search_lib.strip():
        q = search_lib.strip().lower()
        lib_scripts = [
            s for s in lib_scripts
            if q in (s.get("script_name", "").lower())
            or q in (s.get("description", "").lower())
            or q in (s.get("sql_content", "").lower())
        ]
    if cat_lib != "Toutes":
        lib_scripts = [s for s in lib_scripts if (s.get("category") or "").upper() == cat_lib]

    if not lib_scripts:
        st.markdown(
            '<div class="empty-state" style="padding:2rem;">'
            'Aucun script trouvé pour ces critères.'
            '</div>',
            unsafe_allow_html=True,
        )
    else:
        h1, h2, h3, h4 = st.columns([0.5, 2.2, 1.3, 3.0])
        for col, label in zip([h1, h2, h3, h4], ["ID", "NOM", "CATÉGORIE", "DESCRIPTION"]):
            col.markdown(f'<div class="lib-col-header">{label}</div>', unsafe_allow_html=True)

        st.markdown('<hr class="lib-divider--header">', unsafe_allow_html=True)

        for s in lib_scripts:
            c1, c2, c3, c4 = st.columns([0.5, 2.2, 1.3, 3.0])

            with c1:
                st.markdown(
                    f'<div class="lib-row-id">#{s.get("script_id")}</div>',
                    unsafe_allow_html=True
                )

            with c2:
                is_active = int(s.get("is_active", 1) or 1) == 1
                status_dot = (
                    '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;'
                    'background:#10b981;margin-right:5px;vertical-align:middle;"></span>'
                    if is_active else
                    '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;'
                    'background:#94a3b8;margin-right:5px;vertical-align:middle;"></span>'
                )
                st.markdown(
                    f'<div class="lib-row-name">{s.get("script_name","")}</div>'
                    f'<div class="small-muted">{status_dot}{"Actif" if is_active else "Inactif"}</div>',
                    unsafe_allow_html=True
                )

            with c3:
                st.markdown(
                    f'<div style="padding-top:0.5rem;">{category_badge(s.get("category",""))}</div>',
                    unsafe_allow_html=True
                )

            with c4:
                desc = s.get("description", "") or ""
                st.markdown(
                    f'<div class="lib-row-desc">{desc[:100]}{"…" if len(desc) > 100 else ""}</div>',
                    unsafe_allow_html=True
                )

            st.markdown('<hr class="lib-divider">', unsafe_allow_html=True)