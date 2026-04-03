import streamlit as st
import pandas as pd

from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header
from api_client import api_get

st.set_page_config(page_title="Suivi Collectes", page_icon="📡", layout="wide")

apply_style()
require_auth()
render_sidebar(active="collecte_auto")
render_header(
    "Suivi des Collectes Automatiques",
    "Historique des exécutions et valeurs collectées",
)

# ── CSS spécifique ────────────────────────────────────────────────────────────
st.markdown("""
<style>
.sev-ok       { color:#166534; font-weight:700; }
.sev-warning  { color:#92400e; font-weight:700; }
.sev-critical { color:#9f1239; font-weight:700; }
.sev-failed   { color:#9f1239; font-weight:700; }
.sev-success  { color:#166534; font-weight:700; }
</style>
""", unsafe_allow_html=True)


# ── Helpers ───────────────────────────────────────────────────────────────────
def safe_api_get(endpoint, default=None):
    try:
        data = api_get(endpoint)
        return data if data is not None else (default if default is not None else [])
    except Exception as e:
        st.error(f"Erreur API sur {endpoint} : {e}")
        return default if default is not None else []

def to_dataframe(data):
    return pd.DataFrame(data) if data else pd.DataFrame()

def format_datetime_columns(df, cols):
    for col in cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce").dt.strftime("%Y-%m-%d %H:%M:%S")
    return df


# ── Chargement données ────────────────────────────────────────────────────────
metric_runs_data   = safe_api_get("/metric-runs/",  [])
metric_values_data = safe_api_get("/metric-values/", [])
target_dbs_data    = safe_api_get("/target-dbs/",   [])
metric_defs_data   = safe_api_get("/metric-defs/",  [])

df_runs   = to_dataframe(metric_runs_data)
df_values = to_dataframe(metric_values_data)
df_dbs    = to_dataframe(target_dbs_data)
df_metrics = to_dataframe(metric_defs_data)

# ── Mappings ──────────────────────────────────────────────────────────────────
db_map     = {}
metric_map = {}

if not df_dbs.empty and "db_id" in df_dbs.columns and "db_name" in df_dbs.columns:
    db_map = dict(zip(df_dbs["db_id"].astype(str), df_dbs["db_name"]))

if not df_metrics.empty and "metric_id" in df_metrics.columns and "metric_code" in df_metrics.columns:
    metric_map = dict(zip(df_metrics["metric_id"].astype(str), df_metrics["metric_code"]))

# ── Enrichissement runs ───────────────────────────────────────────────────────
if not df_runs.empty:
    if "db_id"     in df_runs.columns: df_runs["db_name"]     = df_runs["db_id"].astype(str).map(db_map).fillna(df_runs["db_id"].astype(str))
    if "metric_id" in df_runs.columns: df_runs["metric_code"] = df_runs["metric_id"].astype(str).map(metric_map).fillna(df_runs["metric_id"].astype(str))
    df_runs = format_datetime_columns(df_runs, ["started_at", "ended_at"])

# ── Enrichissement values ─────────────────────────────────────────────────────
if not df_values.empty:
    if "db_id"     in df_values.columns: df_values["db_name"]     = df_values["db_id"].astype(str).map(db_map).fillna(df_values["db_id"].astype(str))
    if "metric_id" in df_values.columns: df_values["metric_code"] = df_values["metric_id"].astype(str).map(metric_map).fillna(df_values["metric_id"].astype(str))
    df_values = format_datetime_columns(df_values, ["collected_at"])


# ════════════════════════════════════════════════════════════════════
# KPIs
# ════════════════════════════════════════════════════════════════════
total_dbs      = len(df_dbs)
active_dbs     = len(df_dbs[df_dbs["is_active"] == 1])     if not df_dbs.empty    and "is_active" in df_dbs.columns    else 0
total_metrics  = len(df_metrics)
active_metrics = len(df_metrics[df_metrics["is_active"] == 1]) if not df_metrics.empty and "is_active" in df_metrics.columns else 0
total_runs     = len(df_runs)
success_runs   = len(df_runs[df_runs["status"] == "SUCCESS"]) if not df_runs.empty and "status" in df_runs.columns else 0
failed_runs    = len(df_runs[df_runs["status"] == "FAILED"])  if not df_runs.empty and "status" in df_runs.columns else 0
latest_values  = len(df_values)

kpis = [
    ("🗄️",  "BASES TOTALES",      total_dbs,      "#3b82f6"),
    ("✅",  "BASES ACTIVES",      active_dbs,     "#10b981"),
    ("📐",  "MÉTRIQUES TOTALES",  total_metrics,  "#8b5cf6"),
    ("⚡",  "MÉTRIQUES ACTIVES",  active_metrics, "#f59e0b"),
    ("✔️",  "RUNS SUCCESS",       success_runs,   "#10b981"),
    ("❌",  "RUNS FAILED",        failed_runs,    "#ef4444"),
]

cols_kpi = st.columns(6)
for col, (ico, lbl, val, accent) in zip(cols_kpi, kpis):
    with col:
        st.markdown(
            '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;'
            'padding:1rem 1.1rem;box-shadow:0 1px 4px rgba(15,23,42,0.05);'
            'position:relative;overflow:hidden;">'
            '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:'
            + accent + ';border-radius:3px 3px 0 0;"></div>'
            '<div style="font-size:1.3rem;margin-bottom:0.3rem;">' + ico + '</div>'
            '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;'
            'letter-spacing:0.09em;color:#94a3b8;margin-bottom:0.2rem;">' + lbl + '</div>'
            '<div style="font-size:1.5rem;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">'
            + str(val) + '</div>'
            '</div>',
            unsafe_allow_html=True,
        )

st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════
# FILTRES
# ════════════════════════════════════════════════════════════════════
with st.container(border=True):
    st.markdown(
        '<div class="card-section-title">🔍 FILTRES</div>',
        unsafe_allow_html=True,
    )
    st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

    colf1, colf2, colf3 = st.columns(3)

    with colf1:
        db_options = ["Toutes"]
        if not df_runs.empty and "db_name" in df_runs.columns:
            db_options += sorted(df_runs["db_name"].dropna().astype(str).unique().tolist())
        db_filter = st.selectbox("Base", db_options, label_visibility="collapsed")

    with colf2:
        metric_options = ["Toutes"]
        if not df_runs.empty and "metric_code" in df_runs.columns:
            metric_options += sorted(df_runs["metric_code"].dropna().astype(str).unique().tolist())
        metric_filter = st.selectbox("Métrique", metric_options, label_visibility="collapsed")

    with colf3:
        status_filter = st.selectbox("Statut", ["Tous", "SUCCESS", "FAILED"], label_visibility="collapsed")


# ── Application filtres ───────────────────────────────────────────────────────
df_runs_filtered   = df_runs.copy()   if not df_runs.empty   else pd.DataFrame()
df_values_filtered = df_values.copy() if not df_values.empty else pd.DataFrame()

if not df_runs_filtered.empty:
    if db_filter     != "Toutes" and "db_name"     in df_runs_filtered.columns: df_runs_filtered = df_runs_filtered[df_runs_filtered["db_name"]     == db_filter]
    if metric_filter != "Toutes" and "metric_code" in df_runs_filtered.columns: df_runs_filtered = df_runs_filtered[df_runs_filtered["metric_code"] == metric_filter]
    if status_filter != "Tous"   and "status"      in df_runs_filtered.columns: df_runs_filtered = df_runs_filtered[df_runs_filtered["status"]      == status_filter]

if not df_values_filtered.empty:
    if db_filter     != "Toutes" and "db_name"     in df_values_filtered.columns: df_values_filtered = df_values_filtered[df_values_filtered["db_name"]     == db_filter]
    if metric_filter != "Toutes" and "metric_code" in df_values_filtered.columns: df_values_filtered = df_values_filtered[df_values_filtered["metric_code"] == metric_filter]

st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════
# HISTORIQUE DES EXÉCUTIONS
# ════════════════════════════════════════════════════════════════════
with st.container(border=True):
    st.markdown(
        '<div class="card-section-title">🕒 HISTORIQUE DES EXÉCUTIONS</div>',
        unsafe_allow_html=True,
    )
    st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

    if df_runs_filtered.empty:
        st.markdown("""
        <div style="text-align:center;padding:2rem;background:#f8fafc;
                    border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;">
            <div style="font-size:1.5rem;margin-bottom:0.4rem;">🕒</div>
            Aucune exécution trouvée.
        </div>
        """, unsafe_allow_html=True)
    else:
        display_cols_runs = [c for c in [
            "run_id", "db_name", "metric_code", "status",
            "duration_ms", "started_at", "ended_at", "value_id", "error_message",
        ] if c in df_runs_filtered.columns]

        df_show = df_runs_filtered[display_cols_runs].copy()
        if "run_id" in df_show.columns:
            df_show = df_show.sort_values("run_id", ascending=False)

        for col in df_show.columns:
            df_show[col] = df_show[col].astype(str)

        st.dataframe(df_show, width="stretch", hide_index=True)

st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════
# DERNIÈRES VALEURS COLLECTÉES
# ════════════════════════════════════════════════════════════════════
with st.container(border=True):
    st.markdown(
        '<div class="card-section-title">📈 DERNIÈRES VALEURS COLLECTÉES</div>',
        unsafe_allow_html=True,
    )
    st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

    if df_values_filtered.empty:
        st.markdown("""
        <div style="text-align:center;padding:2rem;background:#f8fafc;
                    border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;">
            <div style="font-size:1.5rem;margin-bottom:0.4rem;">📈</div>
            Aucune valeur collectée trouvée.
        </div>
        """, unsafe_allow_html=True)
    else:
        display_cols_values = [c for c in [
            "value_id", "db_name", "metric_code",
            "value_number", "value_text", "severity", "collected_at",
        ] if c in df_values_filtered.columns]

        df_show_v = df_values_filtered[display_cols_values].copy()
        if "value_id" in df_show_v.columns:
            df_show_v = df_show_v.sort_values("value_id", ascending=False)

        for col in df_show_v.columns:
            df_show_v[col] = df_show_v[col].astype(str)

        st.dataframe(df_show_v, width="stretch", hide_index=True)

st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════
# DERNIERS ÉCHECS
# ════════════════════════════════════════════════════════════════════
with st.container(border=True):
    st.markdown(
        '<div class="card-section-title">❌ DERNIERS ÉCHECS</div>',
        unsafe_allow_html=True,
    )
    st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

    if df_runs.empty or "status" not in df_runs.columns:
        st.markdown("""
        <div style="text-align:center;padding:2rem;background:#f8fafc;
                    border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;">
            Aucune information d'échec disponible.
        </div>
        """, unsafe_allow_html=True)
    else:
        df_failed = df_runs[df_runs["status"] == "FAILED"].copy()
        if db_filter     != "Toutes" and "db_name"     in df_failed.columns: df_failed = df_failed[df_failed["db_name"]     == db_filter]
        if metric_filter != "Toutes" and "metric_code" in df_failed.columns: df_failed = df_failed[df_failed["metric_code"] == metric_filter]

        if df_failed.empty:
            st.markdown("""
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
                        padding:0.85rem 1rem;font-size:0.88rem;font-weight:600;color:#166534;">
                ✅ Aucun échec de collecte pour les filtres sélectionnés.
            </div>
            """, unsafe_allow_html=True)
        else:
            display_cols_failed = [c for c in [
                "run_id", "db_name", "metric_code",
                "started_at", "ended_at", "duration_ms", "error_message",
            ] if c in df_failed.columns]

            df_failed = df_failed.sort_values("run_id", ascending=False) if "run_id" in df_failed.columns else df_failed
            df_failed_display = df_failed[display_cols_failed].copy()

            for col in df_failed_display.columns:
                df_failed_display[col] = df_failed_display[col].astype(str)

            st.markdown(
                '<div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;'
                'padding:0.6rem 1rem;margin-bottom:0.75rem;font-size:0.85rem;font-weight:600;color:#9f1239;">'
                '⚠️ ' + str(len(df_failed)) + ' échec(s) détecté(s)'
                '</div>',
                unsafe_allow_html=True,
            )

            st.dataframe(df_failed_display, width="stretch", hide_index=True)