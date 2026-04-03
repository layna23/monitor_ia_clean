import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header
from api_client import api_get, get_target_db_overview

st.set_page_config(
    page_title="Vue globale de la base — DB Monitor IA",
    page_icon="📊",
    layout="wide",
)

apply_style()
require_auth()
render_sidebar(active="vue_globale_bd")

render_header(
    "Vue globale de la base",
    "Vision synthétique d'une base surveillée : état, métriques, alertes et santé globale",
)

COLORS = {
    "blue": "#3b82f6",
    "green": "#10b981",
    "red": "#ef4444",
    "orange": "#f59e0b",
    "purple": "#8b5cf6",
    "cyan": "#06b6d4",
    "gray": "#94a3b8",
    "rose": "#9f1239",
}

BASE_LAYOUT = dict(
    paper_bgcolor="#ffffff",
    plot_bgcolor="#ffffff",
    font=dict(family="DM Sans, sans-serif", color="#0f172a", size=12),
    margin=dict(l=10, r=10, t=30, b=10),
    legend=dict(
        font=dict(color="#0f172a", size=11),
        bgcolor="#ffffff",
        bordercolor="#e2e8f0",
        borderwidth=1,
    ),
)

AX = dict(
    color="#0f172a",
    tickfont=dict(color="#0f172a", size=11),
    linecolor="#e2e8f0",
    gridcolor="#f1f5f9",
    showgrid=True,
)


def safe_get(endpoint, default=None):
    try:
        data = api_get(endpoint)
        return data if data is not None else (default or [])
    except Exception:
        return default or []


def format_dt(dt):
    if not dt:
        return "-"
    try:
        return pd.to_datetime(dt).strftime("%d/%m/%Y %H:%M:%S")
    except Exception:
        return str(dt)


def minutes_since(dt):
    if not dt:
        return None
    try:
        now = pd.Timestamp.now()
        ts = pd.to_datetime(dt)
        return int((now - ts).total_seconds() // 60)
    except Exception:
        return None


def compute_health(overview):
    success = float(overview.get("success_rate", 0) or 0)
    crit = sum(
        1 for m in overview.get("latest_metrics", [])
        if str(m.get("severity", "")).upper() == "CRITICAL"
    )
    warn = sum(
        1 for m in overview.get("latest_metrics", [])
        if str(m.get("severity", "")).upper() == "WARNING"
    )
    return max(0, min(100, round(success - crit * 12 - warn * 5, 2)))


def get_metric_obj(latest_metrics, code):
    for m in latest_metrics:
        if str(m.get("metric_code", "")).upper() == code.upper():
            return m
    return None


def get_metric_value(latest_metrics, code):
    m = get_metric_obj(latest_metrics, code)
    if m:
        value = m.get("value_number") if m.get("value_number") is not None else m.get("value_text")
        return value, m.get("severity"), m.get("collected_at")
    return "-", "-", None


def status_color_from_health(health):
    if health >= 80:
        return COLORS["green"]
    if health >= 50:
        return COLORS["orange"]
    return COLORS["red"]


def normalize_latest_df(latest):
    df = pd.DataFrame(latest)
    if df.empty:
        return df
    if "collected_at" in df.columns:
        df["collected_at_raw"] = pd.to_datetime(df["collected_at"], errors="coerce")
        df["collected_at"] = df["collected_at_raw"].dt.strftime("%d/%m/%Y %H:%M:%S")
    df["value"] = df.apply(
        lambda r: r["value_number"] if pd.notna(r.get("value_number")) else r.get("value_text"),
        axis=1,
    )
    df["value"] = df["value"].astype(str)
    return df


def sev_badge(severity):
    s = str(severity).upper() if severity else ""
    colors = {
        "OK": "background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;",
        "WARNING": "background:#fffbeb;color:#92400e;border:1px solid #fde68a;",
        "CRITICAL": "background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;",
        "INFO": "background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;",
    }
    style = colors.get(s, "background:#f8fafc;color:#475569;border:1px solid #e2e8f0;")
    label = s if s else "—"
    return (
        f'<span style="{style}font-size:0.72rem;font-weight:600;'
        f'letter-spacing:0.06em;padding:2px 10px;border-radius:999px;">{label}</span>'
    )


def first_not_empty(*values):
    for v in values:
        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        return v
    return None


def classify_sql_source(sql_query):
    if not sql_query:
        return "none"

    sql_upper = sql_query.upper()

    oracle_markers = [
        "V$",
        "DBA_",
        "ALL_",
        "USER_",
        "GV$",
        "DUAL",
    ]
    internal_markers = [
        "METRIC_RUNS",
        "METRIC_VALUES",
        "METRIC_DEFS",
        "TARGET_DBS",
        "ALERTS",
        "DBMON.",
    ]

    if any(marker in sql_upper for marker in oracle_markers):
        return "oracle"

    if any(marker in sql_upper for marker in internal_markers):
        return "dbmon"

    return "other"


def get_sql_title(sql_query):
    kind = classify_sql_source(sql_query)

    if kind == "oracle":
        return "Requête SQL Oracle (collecte réelle)"
    if kind == "dbmon":
        return "Requête SQL interne DBMON (base de monitoring)"
    if kind == "other":
        return "Requête SQL utilisée"
    return None


def get_sql_hint(sql_query):
    kind = classify_sql_source(sql_query)

    if kind == "oracle":
        return "Cette requête est exécutée sur la base Oracle cible surveillée."
    if kind == "dbmon":
        return "Cette requête interroge la base interne de monitoring DBMON, pas la base Oracle cible."
    if kind == "other":
        return "Cette requête est utilisée par l'application pour calculer ou présenter l'indicateur."
    return None


def build_metric_info(metric_obj, fallback_definition, fallback_calculation):
    if not metric_obj:
        return {
            "definition": fallback_definition,
            "calculation": fallback_calculation,
            "sql_query": None,
            "collected_at": None,
            "severity": None,
            "warn": None,
            "crit": None,
            "freq": None,
            "unit": None,
        }

    return {
        "definition": first_not_empty(
            metric_obj.get("definition"),
            metric_obj.get("description"),
            metric_obj.get("metric_description"),
            fallback_definition,
        ),
        "calculation": first_not_empty(
            metric_obj.get("calculation"),
            metric_obj.get("formula"),
            metric_obj.get("logic"),
            metric_obj.get("explain_text"),
            fallback_calculation,
        ),
        "sql_query": first_not_empty(
            metric_obj.get("sql_query"),
            metric_obj.get("query"),
            metric_obj.get("sql"),
        ),
        "collected_at": metric_obj.get("collected_at"),
        "severity": metric_obj.get("severity"),
        "warn": metric_obj.get("warn_threshold"),
        "crit": metric_obj.get("crit_threshold"),
        "freq": metric_obj.get("frequency_sec"),
        "unit": metric_obj.get("unit"),
    }


def get_backend_kpi_meta(overview, key):
    meta_root = overview.get("indicator_meta") or overview.get("kpi_meta") or {}
    return meta_root.get(key, {}) if isinstance(meta_root, dict) else {}


def build_app_kpi_info(
    overview,
    key,
    fallback_definition,
    fallback_calculation,
    sql_fallback=None,
    collected_at=None,
):
    meta = get_backend_kpi_meta(overview, key)
    return {
        "definition": first_not_empty(
            meta.get("definition"),
            meta.get("description"),
            fallback_definition,
        ),
        "calculation": first_not_empty(
            meta.get("calculation"),
            meta.get("formula"),
            meta.get("logic"),
            fallback_calculation,
        ),
        "sql_query": first_not_empty(
            meta.get("sql_query"),
            meta.get("query"),
            sql_fallback,
        ),
        "collected_at": first_not_empty(
            meta.get("collected_at"),
            collected_at,
        ),
        "severity": first_not_empty(
            meta.get("severity"),
            None,
        ),
        "warn": first_not_empty(
            meta.get("warn_threshold"),
            None,
        ),
        "crit": first_not_empty(
            meta.get("crit_threshold"),
            None,
        ),
        "freq": first_not_empty(
            meta.get("frequency_sec"),
            None,
        ),
        "unit": first_not_empty(
            meta.get("unit"),
            None,
        ),
    }


def render_info_block(
    title,
    definition,
    calculation,
    sql_query=None,
    collected_at=None,
    severity=None,
    warn=None,
    crit=None,
    freq=None,
    unit=None,
):
    with st.expander(f"ℹ️  {title}", expanded=False):
        st.markdown(
            f'''
            <div style="background:#f8fafc;border-left:3px solid #3b82f6;
            border-radius:0 8px 8px 0;padding:0.6rem 0.9rem;margin-bottom:0.6rem;">
                <span style="font-size:0.78rem;font-weight:600;text-transform:uppercase;
                letter-spacing:0.07em;color:#94a3b8;">Définition</span><br/>
                <span style="font-size:0.9rem;color:#334155;">{definition}</span>
            </div>
            ''',
            unsafe_allow_html=True,
        )

        st.markdown(
            f'''
            <div style="background:#f8fafc;border-left:3px solid #8b5cf6;
            border-radius:0 8px 8px 0;padding:0.6rem 0.9rem;margin-bottom:0.6rem;">
                <span style="font-size:0.78rem;font-weight:600;text-transform:uppercase;
                letter-spacing:0.07em;color:#94a3b8;">Calcul / logique</span><br/>
                <span style="font-size:0.9rem;color:#334155;">{calculation}</span>
            </div>
            ''',
            unsafe_allow_html=True,
        )

        col1, col2, col3 = st.columns(3)

        with col1:
            if severity:
                st.markdown("**Sévérité**")
                st.markdown(sev_badge(severity), unsafe_allow_html=True)

        with col2:
            if collected_at:
                st.markdown("**Dernière collecte**")
                st.markdown(format_dt(collected_at))

        with col3:
            if freq is not None:
                st.markdown("**Fréquence**")
                st.markdown(f"{freq} sec")

        if warn is not None or crit is not None:
            st.markdown("**Seuils de monitoring**")

            col_w, col_c = st.columns(2)

            with col_w:
                if warn is not None:
                    st.markdown(
                        f'''
                        <span style="
                            background:#fffbeb;
                            color:#92400e;
                            border:1px solid #fde68a;
                            padding:4px 12px;
                            border-radius:999px;
                            font-size:0.75rem;
                            font-weight:600;
                            display:inline-block;">
                            ⚠️ WARNING : {warn}
                        </span>
                        ''',
                        unsafe_allow_html=True,
                    )

            with col_c:
                if crit is not None:
                    st.markdown(
                        f'''
                        <span style="
                            background:#fff1f2;
                            color:#9f1239;
                            border:1px solid #fecdd3;
                            padding:4px 12px;
                            border-radius:999px;
                            font-size:0.75rem;
                            font-weight:600;
                            display:inline-block;">
                            🔴 CRITICAL : {crit}
                        </span>
                        ''',
                        unsafe_allow_html=True,
                    )

        if unit:
            st.markdown(f"**Unité :** `{unit}`")

        if sql_query:
            sql_title = get_sql_title(sql_query)
            sql_hint = get_sql_hint(sql_query)

            if sql_title:
                st.markdown(f"**{sql_title}**")

            if sql_hint:
                st.caption(sql_hint)

            st.code(sql_query, language="sql")
        else:
            st.markdown("_SQL non disponible (calcul applicatif)_")


def kpi_card(label, value, accent, subtitle=""):
    subtitle_html = (
        f'<div style="font-size:0.75rem;color:#94a3b8;margin-top:0.3rem;">{subtitle}</div>'
        if subtitle else ""
    )
    return (
        f'<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;'
        f'padding:1rem 1.1rem;box-shadow:0 1px 4px rgba(15,23,42,0.05);'
        f'position:relative;overflow:hidden;min-height:110px;">'
        f'<div style="position:absolute;top:0;left:0;right:0;height:3px;'
        f'background:{accent};border-radius:3px 3px 0 0;"></div>'
        f'<div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;'
        f'letter-spacing:0.09em;color:#94a3b8;margin-top:0.4rem;margin-bottom:0.55rem;">'
        f'{label}</div>'
        f'<div style="font-size:1.55rem;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">'
        f'{value}</div>'
        f'{subtitle_html}'
        f'</div>'
    )


# ─── DATA ────────────────────────────────────────────────────────────────────
target_dbs = safe_get("/target-dbs/", [])
alerts_all = safe_get("/alerts/", [])

if not target_dbs:
    st.warning("Aucune base disponible.")
    st.stop()

db_options = {
    f"{d['db_name']} | {d['host']}:{d['port']}": int(d["db_id"])
    for d in target_dbs
}

selected = st.selectbox("Choisir une base", list(db_options.keys()))
db_id = db_options[selected]

overview = get_target_db_overview(db_id)
if not overview:
    st.error("Impossible de charger la vue globale.")
    st.stop()

latest = overview.get("latest_metrics", [])
health = compute_health(overview)
health_color = status_color_from_health(health)

alerts_db = [a for a in alerts_all if int(a.get("db_id", -1)) == int(db_id)]
open_alerts = [a for a in alerts_db if str(a.get("status", "")).upper() == "OPEN"]
critical_open_alerts = [
    a for a in open_alerts
    if str(a.get("severity", "")).upper() == "CRITICAL"
]

db_status_metric = get_metric_obj(latest, "DB_STATUS")
active_sessions_metric = get_metric_obj(latest, "ACTIVE_SESSIONS")
active_tx_metric = get_metric_obj(latest, "ACTIVE_TRANSACTIONS")
cpu_metric = get_metric_obj(latest, "CPU_USED_SESSION")
uptime_metric = get_metric_obj(latest, "INSTANCE_UPTIME_HOURS")
total_sessions_metric = (
    get_metric_obj(latest, "TOTAL_SESSIONS")
    or get_metric_obj(latest, "TOTAL SESSIONS")
)

db_status_value, db_status_sev, db_status_time = get_metric_value(latest, "DB_STATUS")
active_sessions_value, active_sessions_sev, active_sessions_time = get_metric_value(latest, "ACTIVE_SESSIONS")
active_tx_value, active_tx_sev, active_tx_time = get_metric_value(latest, "ACTIVE_TRANSACTIONS")
cpu_value, cpu_sev, cpu_time = get_metric_value(latest, "CPU_USED_SESSION")
uptime_value, uptime_sev, uptime_time = get_metric_value(latest, "INSTANCE_UPTIME_HOURS")

total_sessions_value, total_sessions_sev, total_sessions_time = get_metric_value(latest, "TOTAL_SESSIONS")
if total_sessions_value == "-":
    total_sessions_value, total_sessions_sev, total_sessions_time = get_metric_value(latest, "TOTAL SESSIONS")

latest_collect_at = None
if latest:
    latest_collect_at = max(
        [m.get("collected_at") for m in latest if m.get("collected_at")],
        default=None,
    )

freshness_min = minutes_since(latest_collect_at)
latest_df = normalize_latest_df(latest)

# ─── HEADER BASE ─────────────────────────────────────────────────────────────
st.markdown(
    f"""
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;
    padding:1.25rem 1.5rem;box-shadow:0 1px 6px rgba(15,23,42,0.06);margin-bottom:1.25rem;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;">
        <div>
          <div style="font-size:1.55rem;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">
            {overview.get("db_name")}
          </div>
          <div style="margin-top:0.35rem;color:#64748b;font-size:0.88rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
            <span style="background:#f1f5f9;border-radius:6px;padding:2px 8px;">
              <b style="color:#334155;">Host</b> {overview.get("host")}
            </span>
            <span style="background:#f1f5f9;border-radius:6px;padding:2px 8px;">
              <b style="color:#334155;">Port</b> {overview.get("port")}
            </span>
            <span style="background:#f1f5f9;border-radius:6px;padding:2px 8px;">
              <b style="color:#334155;">Service</b> {overview.get("service_name")}
            </span>
            <span style="background:#f1f5f9;border-radius:6px;padding:2px 8px;">
              <b style="color:#334155;">SID</b> {overview.get("sid")}
            </span>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="display:inline-block;padding:0.3rem 1rem;border-radius:999px;
          background:{'#dcfce7' if overview.get('is_active') == 1 else '#fee2e2'};
          color:{'#166534' if overview.get('is_active') == 1 else '#991b1b'};
          font-weight:700;font-size:0.78rem;letter-spacing:0.06em;border:1px solid {'#bbf7d0' if overview.get('is_active') == 1 else '#fecaca'};">
            {'● ACTIVE' if overview.get('is_active') == 1 else '● INACTIVE'}
          </div>
          <div style="margin-top:0.5rem;font-size:0.8rem;color:#94a3b8;">
            Dernière collecte : {format_dt(latest_collect_at)}
          </div>
        </div>
      </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ─── KPIs GLOBAUX ────────────────────────────────────────────────────────────
kpis = [
    ("SCORE SANTÉ", f"{health} %", COLORS["green"] if health >= 80 else COLORS["orange"] if health >= 50 else COLORS["red"], ""),
    ("TAUX SUCCÈS", f"{overview.get('success_rate')} %", COLORS["green"], ""),
    ("RUNS", str(overview.get("total_runs")), COLORS["purple"], "exécutions"),
    ("VALEURS", str(overview.get("total_metric_values")), COLORS["cyan"], "métriques"),
    ("ALERTES OUVERTES", str(len(open_alerts)), COLORS["red"], ""),
    ("CRITIQUES OUVERTES", str(len(critical_open_alerts)), COLORS["rose"], ""),
]

cols = st.columns(6)
for col, (lbl, val, accent, sub) in zip(cols, kpis):
    with col:
        st.markdown(kpi_card(lbl, val, accent, sub), unsafe_allow_html=True)

st.markdown("<div style='height:0.6rem'></div>", unsafe_allow_html=True)

# ─── KPIs OPÉRATIONNELS ──────────────────────────────────────────────────────
ops = [
    ("DB STATUS", str(db_status_value), COLORS["blue"]),
    ("ACTIVE SESSIONS", str(active_sessions_value),
     COLORS["red"] if str(active_sessions_sev).upper() == "CRITICAL" else COLORS["green"]),
    ("ACTIVE TRANSACTIONS", str(active_tx_value),
     COLORS["orange"] if str(active_tx_sev).upper() == "WARNING" else COLORS["blue"]),
    ("CPU USED SESSION", str(cpu_value), COLORS["purple"]),
    ("UPTIME (H)", str(uptime_value), COLORS["cyan"]),
    ("TOTAL SESSIONS", str(total_sessions_value), COLORS["green"]),
]

cols2 = st.columns(6)
for col, (lbl, val, accent) in zip(cols2, ops):
    with col:
        st.markdown(kpi_card(lbl, val, accent), unsafe_allow_html=True)

st.markdown("<div style='height:0.85rem'></div>", unsafe_allow_html=True)

# ─── SECTION EXPLICATION DES INDICATEURS ─────────────────────────────────────
score_sante_info = build_app_kpi_info(
    overview=overview,
    key="score_sante",
    fallback_definition="Indicateur synthétique de l'état global de la base surveillée.",
    fallback_calculation="Score santé = taux de succès - (12 × nb métriques critiques) - (5 × nb métriques warning), limité entre 0 et 100.",
    sql_fallback=None,
    collected_at=latest_collect_at,
)

taux_succes_info = build_app_kpi_info(
    overview=overview,
    key="taux_succes",
    fallback_definition="Pourcentage de runs exécutés avec succès pour cette base.",
    fallback_calculation="(Nombre de runs SUCCESS / Nombre total de runs) × 100.",
    sql_fallback="""SELECT
    ROUND(SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS success_rate
FROM metric_runs
WHERE db_id = :db_id;""",
    collected_at=latest_collect_at,
)

runs_info = build_app_kpi_info(
    overview=overview,
    key="runs",
    fallback_definition="Nombre total d'exécutions de collecte lancées sur cette base.",
    fallback_calculation="Comptage total des runs liés à la base.",
    sql_fallback="""SELECT COUNT(*) AS total_runs
FROM metric_runs
WHERE db_id = :db_id;""",
    collected_at=latest_collect_at,
)

values_info = build_app_kpi_info(
    overview=overview,
    key="valeurs",
    fallback_definition="Nombre total de valeurs de métriques collectées pour cette base.",
    fallback_calculation="Comptage des lignes de valeurs de métriques enregistrées pour la base.",
    sql_fallback="""SELECT COUNT(*) AS total_metric_values
FROM metric_values
WHERE db_id = :db_id;""",
    collected_at=latest_collect_at,
)

alertes_info = build_app_kpi_info(
    overview=overview,
    key="alertes_ouvertes",
    fallback_definition="Nombre d'alertes actuellement ouvertes pour cette base.",
    fallback_calculation="Comptage des alertes dont le statut = OPEN.",
    sql_fallback="""SELECT COUNT(*) AS open_alerts
FROM alerts
WHERE db_id = :db_id
  AND UPPER(status) = 'OPEN';""",
    collected_at=latest_collect_at,
)

critiques_info = build_app_kpi_info(
    overview=overview,
    key="critiques_ouvertes",
    fallback_definition="Nombre d'alertes ouvertes de sévérité critique.",
    fallback_calculation="Comptage des alertes OPEN avec severity = CRITICAL.",
    sql_fallback="""SELECT COUNT(*) AS critical_open_alerts
FROM alerts
WHERE db_id = :db_id
  AND UPPER(status) = 'OPEN'
  AND UPPER(severity) = 'CRITICAL';""",
    collected_at=latest_collect_at,
)

db_status_info = build_metric_info(
    db_status_metric,
    fallback_definition="État courant de la base Oracle.",
    fallback_calculation="Valeur directe issue de la métrique DB_STATUS.",
)

active_sessions_info = build_metric_info(
    active_sessions_metric,
    fallback_definition="Nombre de sessions actives actuellement sur la base.",
    fallback_calculation="Comptage des sessions Oracle actives.",
)

active_tx_info = build_metric_info(
    active_tx_metric,
    fallback_definition="Nombre de transactions actives au moment de la collecte.",
    fallback_calculation="Comptage des transactions actives au moment de la collecte.",
)

cpu_info = build_metric_info(
    cpu_metric,
    fallback_definition="Consommation CPU observée pour les sessions au moment de la collecte.",
    fallback_calculation="Valeur directe issue de la métrique CPU_USED_SESSION.",
)

uptime_info = build_metric_info(
    uptime_metric,
    fallback_definition="Temps de fonctionnement de l'instance en heures.",
    fallback_calculation="Valeur directe issue de la métrique INSTANCE_UPTIME_HOURS.",
)

total_sessions_info = build_metric_info(
    total_sessions_metric,
    fallback_definition="Nombre total de sessions observées sur la base.",
    fallback_calculation="Valeur directe issue de la métrique TOTAL_SESSIONS.",
)

with st.container(border=True):
    st.markdown(
        '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.25rem;">'
        '<span style="font-size:1.35rem;">🧠</span>'
        '<span style="font-size:1.2rem;font-weight:700;color:#0f172a;">Explication des indicateurs affichés</span>'
        '</div>',
        unsafe_allow_html=True,
    )
    st.markdown(
        '<p style="font-size:0.9rem;color:#64748b;margin-bottom:0.75rem;">'
        'Cliquez sur un indicateur pour voir sa <strong>définition</strong>, '
        'sa <strong>logique de calcul</strong> et la <strong>nature de la requête SQL</strong> utilisée. '
        'Les métriques Oracle sont distinguées des requêtes internes DBMON.</p>',
        unsafe_allow_html=True,
    )

    render_info_block("SCORE SANTÉ", **score_sante_info)
    render_info_block("TAUX SUCCÈS", **taux_succes_info)
    render_info_block("RUNS", **runs_info)
    render_info_block("VALEURS", **values_info)
    render_info_block("ALERTES OUVERTES", **alertes_info)
    render_info_block("CRITIQUES OUVERTES", **critiques_info)
    render_info_block("DB STATUS", **db_status_info)
    render_info_block("ACTIVE SESSIONS", **active_sessions_info)
    render_info_block("ACTIVE TRANSACTIONS", **active_tx_info)
    render_info_block("CPU USED SESSION", **cpu_info)
    render_info_block("UPTIME (H)", **uptime_info)
    render_info_block("TOTAL SESSIONS", **total_sessions_info)

st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

# ─── LIGNE SANTÉ / SÉVÉRITÉS / FRAÎCHEUR ────────────────────────────────────
c1, c2, c3 = st.columns([1.1, 1.1, 1.1], gap="medium")

with c1:
    with st.container(border=True):
        st.markdown("### État global")
        fig = go.Figure(go.Indicator(
            mode="gauge+number",
            value=health,
            number={"suffix": "%", "font": {"size": 30, "color": "#0f172a"}},
            gauge={
                "axis": {"range": [0, 100], "tickcolor": "#0f172a"},
                "bar": {"color": health_color, "thickness": 0.25},
                "bgcolor": "#f8fafc",
                "steps": [
                    {"range": [0, 50], "color": "#fff1f2"},
                    {"range": [50, 80], "color": "#fffbeb"},
                    {"range": [80, 100], "color": "#f0fdf4"},
                ],
            },
        ))
        fig.update_layout(**BASE_LAYOUT, height=240)
        st.plotly_chart(fig, width="stretch")

with c2:
    with st.container(border=True):
        st.markdown("### Répartition des sévérités")
        if latest:
            df_sev = pd.DataFrame(latest)
            sev_counts = df_sev["severity"].fillna("UNKNOWN").str.upper().value_counts()
            sev_colors = {
                "OK": COLORS["green"],
                "WARNING": COLORS["orange"],
                "CRITICAL": COLORS["red"],
                "INFO": COLORS["blue"],
                "UNKNOWN": COLORS["gray"],
            }
            labels = sev_counts.index.tolist()
            values = sev_counts.values.tolist()
            colors = [sev_colors.get(l, COLORS["gray"]) for l in labels]
            fig = go.Figure(go.Pie(
                labels=labels,
                values=values,
                hole=0.55,
                marker=dict(colors=colors, line=dict(color="#fff", width=2)),
                textfont=dict(size=11, color="#0f172a"),
            ))
            fig.update_layout(**BASE_LAYOUT, height=240)
            st.plotly_chart(fig, width="stretch")
        else:
            st.info("Aucune donnée de sévérité.")

with c3:
    with st.container(border=True):
        st.markdown("### Fraîcheur des données")

        freshness_text = "-"
        freshness_color = COLORS["gray"]
        freshness_label = ""

        if freshness_min is not None:
            freshness_text = f"{freshness_min} min"
            if freshness_min <= 2:
                freshness_color = COLORS["green"]
                freshness_label = "Données fraîches ✓"
            elif freshness_min <= 10:
                freshness_color = COLORS["orange"]
                freshness_label = "Collecte récente"
            else:
                freshness_color = COLORS["red"]
                freshness_label = "Données potentiellement obsolètes"

        st.markdown(
            f"""
            <div style="padding:0.75rem 0;">
              <div style="font-size:0.8rem;color:#94a3b8;margin-bottom:0.4rem;">Dernière collecte</div>
              <div style="font-size:2.1rem;font-weight:700;color:{freshness_color};
                letter-spacing:-0.02em;">{freshness_text}</div>
              <div style="margin-top:0.3rem;font-size:0.82rem;color:#64748b;">{format_dt(latest_collect_at)}</div>
              <div style="margin-top:0.5rem;font-size:0.78rem;font-weight:600;
                color:{freshness_color};">{freshness_label}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

# ─── DERNIÈRES MÉTRIQUES + TOP NUMÉRIQUES ───────────────────────────────────
c4, c5 = st.columns([1.45, 1.15], gap="medium")

with c4:
    with st.container(border=True):
        st.markdown("## Dernières métriques")
        if not latest_df.empty:
            df_display = latest_df[["metric_code", "value", "severity", "collected_at"]].copy()
            for col in df_display.columns:
                df_display[col] = df_display[col].astype(str)
            st.dataframe(df_display, width="stretch", hide_index=True)
        else:
            st.info("Aucune métrique disponible.")

with c5:
    with st.container(border=True):
        st.markdown("## Valeurs numériques")
        if not latest_df.empty:
            df_num = latest_df[latest_df["value_number"].notna()].copy()
            if not df_num.empty:
                df_num = df_num.sort_values("value_number", ascending=True)
                fig = go.Figure(go.Bar(
                    x=df_num["value_number"],
                    y=df_num["metric_code"],
                    orientation="h",
                    marker=dict(
                        color=df_num["value_number"],
                        colorscale=[[0, "#dbeafe"], [1, "#2563eb"]],
                        line=dict(width=0),
                    ),
                    text=df_num["value_number"],
                    textposition="outside",
                    textfont=dict(size=10, color="#0f172a"),
                ))
                fig.update_layout(**BASE_LAYOUT, height=360, xaxis=dict(**AX), yaxis=dict(**AX))
                st.plotly_chart(fig, width="stretch")
            else:
                st.info("Aucune métrique numérique.")
        else:
            st.info("Aucune donnée disponible.")

st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

# ─── MÉTRIQUES SENSIBLES ─────────────────────────────────────────────────────
with st.container(border=True):
    st.markdown("## Métriques sensibles")
    if not latest_df.empty:
        df_sensitive = latest_df.copy()
        df_sensitive["severity_rank"] = (
            df_sensitive["severity"].fillna("UNKNOWN").str.upper()
            .map({"CRITICAL": 3, "WARNING": 2, "INFO": 1, "OK": 0})
            .fillna(0)
        )
        df_sensitive = df_sensitive.sort_values(
            by=["severity_rank", "collected_at_raw"],
            ascending=[False, False],
        )
        df_sensitive_display = (
            df_sensitive[["metric_code", "value", "severity", "collected_at"]]
            .head(8).copy()
        )
        for col in df_sensitive_display.columns:
            df_sensitive_display[col] = df_sensitive_display[col].astype(str)
        st.dataframe(df_sensitive_display, width="stretch", hide_index=True)
    else:
        st.info("Aucune métrique sensible disponible.")

st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

# ─── ALERTES DE LA BASE ──────────────────────────────────────────────────────
with st.container(border=True):
    st.markdown("## Alertes de la base")

    alert_cols = st.columns(3)
    with alert_cols[0]:
        st.metric("Total alertes", len(alerts_db))
    with alert_cols[1]:
        st.metric("Ouvertes", len(open_alerts))
    with alert_cols[2]:
        st.metric("Critiques ouvertes", len(critical_open_alerts))

    if alerts_db:
        df_alerts = pd.DataFrame(alerts_db)
        if "created_at" in df_alerts.columns:
            df_alerts["created_at_raw"] = pd.to_datetime(df_alerts["created_at"], errors="coerce")
            df_alerts = df_alerts.sort_values("created_at_raw", ascending=False)
            df_alerts["created_at"] = df_alerts["created_at_raw"].dt.strftime("%d/%m/%Y %H:%M:%S")

        columns = [
            c for c in ["alert_id", "severity", "status", "title", "last_value", "created_at"]
            if c in df_alerts.columns
        ]
        df_alerts_display = df_alerts[columns].head(10).copy()
        for col in df_alerts_display.columns:
            df_alerts_display[col] = df_alerts_display[col].astype(str)

        st.dataframe(df_alerts_display, width="stretch", hide_index=True)
    else:
        st.success("Aucune alerte enregistrée pour cette base.")