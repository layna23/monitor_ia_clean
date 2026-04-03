import streamlit as st
import pandas as pd

from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header
from api_client import api_get

st.set_page_config(page_title="Alertes", page_icon="🚨", layout="wide")

apply_style()
require_auth()
render_sidebar(active="alertes")
render_header(
    "Alertes de Monitoring",
    "Suivi des alertes ouvertes, critiques et résolues",
)


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

def empty_state(icon, message):
    st.markdown(
        f'<div style="text-align:center;padding:2rem;background:#f8fafc;'
        f'border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;">'
        f'<div style="font-size:1.5rem;margin-bottom:0.4rem;">{icon}</div>{message}</div>',
        unsafe_allow_html=True,
    )


# ── Chargement données ────────────────────────────────────────────────────────
alerts_data      = safe_api_get("/alerts/",      [])
target_dbs_data  = safe_api_get("/target-dbs/",  [])
metric_defs_data = safe_api_get("/metric-defs/", [])

df_alerts  = to_dataframe(alerts_data)
df_dbs     = to_dataframe(target_dbs_data)
df_metrics = to_dataframe(metric_defs_data)

# ── Mappings ──────────────────────────────────────────────────────────────────
db_map     = {}
metric_map = {}

if not df_dbs.empty and "db_id" in df_dbs.columns and "db_name" in df_dbs.columns:
    db_map = dict(zip(df_dbs["db_id"].astype(str), df_dbs["db_name"]))

if not df_metrics.empty and "metric_id" in df_metrics.columns and "metric_code" in df_metrics.columns:
    metric_map = dict(zip(df_metrics["metric_id"].astype(str), df_metrics["metric_code"]))

# ── Enrichissement ────────────────────────────────────────────────────────────
if not df_alerts.empty:
    if "db_id" in df_alerts.columns:
        df_alerts["db_name"] = df_alerts["db_id"].astype(str).map(db_map).fillna(df_alerts["db_id"].astype(str))
    if "metric_id" in df_alerts.columns:
        df_alerts["metric_code"] = df_alerts["metric_id"].astype(str).map(metric_map).fillna(df_alerts["metric_id"].astype(str))
    df_alerts = format_datetime_columns(df_alerts, ["created_at", "updated_at", "closed_at"])

# ── Calculs KPIs ──────────────────────────────────────────────────────────────
total_alerts    = len(df_alerts) if not df_alerts.empty else 0
open_alerts     = 0
resolved_alerts = 0
critical_alerts = 0
warning_alerts  = 0

if not df_alerts.empty:
    if "status" in df_alerts.columns:
        open_alerts     = len(df_alerts[df_alerts["status"].astype(str).str.upper() == "OPEN"])
        resolved_alerts = len(df_alerts[df_alerts["status"].astype(str).str.upper().isin(["RESOLVED", "CLOSED"])])
    if "severity" in df_alerts.columns:
        critical_alerts = len(df_alerts[df_alerts["severity"].astype(str).str.upper() == "CRITICAL"])
        warning_alerts  = len(df_alerts[df_alerts["severity"].astype(str).str.upper() == "WARNING"])


# ════════════════════════════════════════════════════════════════════
# KPIs
# ════════════════════════════════════════════════════════════════════
kpis = [
    ("🚨", "TOTAL ALERTES",    total_alerts,    "#64748b"),
    ("🔴", "ALERTES OUVERTES", open_alerts,     "#ef4444"),
    ("✅", "RÉSOLUES",         resolved_alerts, "#10b981"),
    ("💥", "CRITIQUES",        critical_alerts, "#9f1239"),
    ("⚠️", "WARNING",          warning_alerts,  "#f59e0b"),
]

cols_kpi = st.columns(5)
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
    st.markdown('<div class="card-section-title">🔍 FILTRES</div>', unsafe_allow_html=True)
    st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

    colf1, colf2, colf3, colf4 = st.columns(4)

    with colf1:
        db_options = ["Toutes"]
        if not df_alerts.empty and "db_name" in df_alerts.columns:
            db_options += sorted(df_alerts["db_name"].dropna().astype(str).unique().tolist())
        db_filter = st.selectbox("Base", db_options, label_visibility="collapsed")

    with colf2:
        metric_options = ["Toutes"]
        if not df_alerts.empty and "metric_code" in df_alerts.columns:
            metric_options += sorted(df_alerts["metric_code"].dropna().astype(str).unique().tolist())
        metric_filter = st.selectbox("Métrique", metric_options, label_visibility="collapsed")

    with colf3:
        severity_options = ["Toutes"]
        if not df_alerts.empty and "severity" in df_alerts.columns:
            severity_options += sorted(df_alerts["severity"].dropna().astype(str).unique().tolist())
        severity_filter = st.selectbox("Sévérité", severity_options, label_visibility="collapsed")

    with colf4:
        status_options = ["Tous"]
        if not df_alerts.empty and "status" in df_alerts.columns:
            status_options += sorted(df_alerts["status"].dropna().astype(str).unique().tolist())
        status_filter = st.selectbox("Statut", status_options, label_visibility="collapsed")

# ── Application filtres ───────────────────────────────────────────────────────
df_filtered = df_alerts.copy() if not df_alerts.empty else pd.DataFrame()

if not df_filtered.empty:
    if db_filter       != "Toutes" and "db_name"     in df_filtered.columns: df_filtered = df_filtered[df_filtered["db_name"]                  == db_filter]
    if metric_filter   != "Toutes" and "metric_code" in df_filtered.columns: df_filtered = df_filtered[df_filtered["metric_code"]               == metric_filter]
    if severity_filter != "Toutes" and "severity"    in df_filtered.columns: df_filtered = df_filtered[df_filtered["severity"].astype(str)       == severity_filter]
    if status_filter   != "Tous"   and "status"      in df_filtered.columns: df_filtered = df_filtered[df_filtered["status"].astype(str)         == status_filter]

st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════
# ALERTES OUVERTES
# ════════════════════════════════════════════════════════════════════
with st.container(border=True):
    st.markdown('<div class="card-section-title">🔴 ALERTES OUVERTES</div>', unsafe_allow_html=True)
    st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

    if df_filtered.empty:
        empty_state("🔴", "Aucune alerte trouvée.")
    else:
        df_open = df_filtered[df_filtered["status"].astype(str).str.upper() == "OPEN"].copy() if "status" in df_filtered.columns else pd.DataFrame()

        if df_open.empty:
            st.markdown(
                '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;'
                'padding:0.75rem 1rem;font-size:0.88rem;font-weight:600;color:#166534;">'
                '✅ Aucune alerte ouverte pour les filtres sélectionnés.</div>',
                unsafe_allow_html=True,
            )
        else:
            st.markdown(
                '<div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;'
                'padding:0.5rem 1rem;margin-bottom:0.75rem;font-size:0.82rem;font-weight:600;color:#9f1239;">'
                '🔴 ' + str(len(df_open)) + ' alerte(s) ouverte(s)</div>',
                unsafe_allow_html=True,
            )
            display_cols = [c for c in ["alert_id","db_name","metric_code","severity","status","last_value","title","details","created_at","updated_at"] if c in df_open.columns]
            if "alert_id" in df_open.columns:
                df_open = df_open.sort_values("alert_id", ascending=False)
            df_open_display = df_open[display_cols].copy()
            for col in df_open_display.columns:
                df_open_display[col] = df_open_display[col].astype(str)
            st.dataframe(df_open_display, width="stretch", hide_index=True)

st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════
# HISTORIQUE COMPLET
# ════════════════════════════════════════════════════════════════════
with st.container(border=True):
    st.markdown('<div class="card-section-title">📋 HISTORIQUE DES ALERTES</div>', unsafe_allow_html=True)
    st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

    if df_filtered.empty:
        empty_state("📋", "Aucune alerte disponible.")
    else:
        display_cols = [c for c in ["alert_id","db_name","metric_code","severity","status","last_value","title","details","created_at","updated_at","closed_at"] if c in df_filtered.columns]
        df_hist = df_filtered.copy()
        if "alert_id" in df_hist.columns:
            df_hist = df_hist.sort_values("alert_id", ascending=False)
        df_hist_display = df_hist[display_cols].copy()
        for col in df_hist_display.columns:
            df_hist_display[col] = df_hist_display[col].astype(str)
        st.dataframe(df_hist_display, width="stretch", hide_index=True)

st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════
# ALERTES CRITIQUES
# ════════════════════════════════════════════════════════════════════
with st.container(border=True):
    st.markdown('<div class="card-section-title">💥 ALERTES CRITIQUES</div>', unsafe_allow_html=True)
    st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

    if df_alerts.empty or "severity" not in df_alerts.columns:
        empty_state("💥", "Aucune donnée critique disponible.")
    else:
        df_critical = df_alerts[df_alerts["severity"].astype(str).str.upper() == "CRITICAL"].copy()
        if db_filter       != "Toutes" and "db_name"     in df_critical.columns: df_critical = df_critical[df_critical["db_name"]            == db_filter]
        if metric_filter   != "Toutes" and "metric_code" in df_critical.columns: df_critical = df_critical[df_critical["metric_code"]         == metric_filter]
        if status_filter   != "Tous"   and "status"      in df_critical.columns: df_critical = df_critical[df_critical["status"].astype(str)  == status_filter]

        if df_critical.empty:
            st.markdown(
                '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;'
                'padding:0.75rem 1rem;font-size:0.88rem;font-weight:600;color:#166534;">'
                '✅ Aucune alerte critique pour les filtres sélectionnés.</div>',
                unsafe_allow_html=True,
            )
        else:
            st.markdown(
                '<div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;'
                'padding:0.5rem 1rem;margin-bottom:0.75rem;font-size:0.82rem;font-weight:600;color:#9f1239;">'
                '💥 ' + str(len(df_critical)) + ' alerte(s) critique(s)</div>',
                unsafe_allow_html=True,
            )
            display_cols = [c for c in ["alert_id","db_name","metric_code","severity","status","last_value","title","details","created_at","updated_at"] if c in df_critical.columns]
            if "alert_id" in df_critical.columns:
                df_critical = df_critical.sort_values("alert_id", ascending=False)
            df_critical_display = df_critical[display_cols].copy()
            for col in df_critical_display.columns:
                df_critical_display[col] = df_critical_display[col].astype(str)
            st.dataframe(df_critical_display, width="stretch", hide_index=True)

st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════
# ALERTES RÉSOLUES
# ════════════════════════════════════════════════════════════════════
with st.container(border=True):
    st.markdown('<div class="card-section-title">✅ ALERTES RÉSOLUES</div>', unsafe_allow_html=True)
    st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

    if df_alerts.empty or "status" not in df_alerts.columns:
        empty_state("✅", "Aucune donnée résolue disponible.")
    else:
        df_resolved = df_alerts[df_alerts["status"].astype(str).str.upper().isin(["RESOLVED", "CLOSED"])].copy()
        if db_filter       != "Toutes" and "db_name"     in df_resolved.columns: df_resolved = df_resolved[df_resolved["db_name"]             == db_filter]
        if metric_filter   != "Toutes" and "metric_code" in df_resolved.columns: df_resolved = df_resolved[df_resolved["metric_code"]          == metric_filter]
        if severity_filter != "Toutes" and "severity"    in df_resolved.columns: df_resolved = df_resolved[df_resolved["severity"].astype(str) == severity_filter]

        if df_resolved.empty:
            empty_state("✅", "Aucune alerte résolue pour les filtres sélectionnés.")
        else:
            st.markdown(
                '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;'
                'padding:0.5rem 1rem;margin-bottom:0.75rem;font-size:0.82rem;font-weight:600;color:#166534;">'
                '✅ ' + str(len(df_resolved)) + ' alerte(s) résolue(s)</div>',
                unsafe_allow_html=True,
            )
            display_cols = [c for c in ["alert_id","db_name","metric_code","severity","status","last_value","title","details","created_at","updated_at","closed_at"] if c in df_resolved.columns]
            if "alert_id" in df_resolved.columns:
                df_resolved = df_resolved.sort_values("alert_id", ascending=False)
            df_resolved_display = df_resolved[display_cols].copy()
            for col in df_resolved_display.columns:
                df_resolved_display[col] = df_resolved_display[col].astype(str)
            st.dataframe(df_resolved_display, width="stretch", hide_index=True)