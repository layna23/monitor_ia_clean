# -*- coding: utf-8 -*-
import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header
from api_client import api_get, get_latest_metric_values, get_metric_detail

st.set_page_config(
    page_title="Dashboard — DB Monitor IA",
    page_icon="📊",
    layout="wide",
)

apply_style()
require_auth()
render_sidebar(active="dashboard")
render_header(
    "Dashboard Analytics",
    "Visualisation des métriques, alertes et performances de vos bases",
)

# ── STYLE LIGHT (inspiré du layout Stock peer analysis) ─────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');

* { font-family: 'DM Sans', sans-serif; }

/* Tags multiselect */
span[data-baseweb="tag"] {
    background: #eff6ff !important;
    border: 1px solid #bfdbfe !important;
}
span[data-baseweb="tag"] span {
    color: #1d4ed8 !important;
}

.section-title {
    font-size: 1.6rem;
    font-weight: 800;
    color: #0f172a;
    margin-top: 0.2rem;
    margin-bottom: 0.15rem;
    letter-spacing: -0.02em;
}

.section-sub {
    font-size: 0.92rem;
    color: #64748b;
    margin-bottom: 1rem;
}

.card-title {
    font-size: 0.8rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #64748b;
    margin-bottom: 0.75rem;
}

/* KPI card */
.kpi-box {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 1rem 1.1rem 0.9rem;
    box-shadow: 0 1px 3px rgba(15,23,42,0.06);
    position: relative;
    overflow: hidden;
    min-height: 108px;
}
.kpi-topline {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    border-radius: 3px 3px 0 0;
}
.kpi-icon  { font-size: 1.15rem; margin-bottom: 0.15rem; }
.kpi-label {
    font-size: 0.63rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #94a3b8;
    margin-bottom: 0.18rem;
}
.kpi-value {
    font-size: 1.5rem;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.1;
}
.kpi-chip {
    display: inline-block;
    margin-top: 0.5rem;
    padding: 0.22rem 0.5rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
}
.chip-green  { background:#dcfce7; color:#166534; }
.chip-red    { background:#fee2e2; color:#991b1b; }
.chip-blue   { background:#dbeafe; color:#1d4ed8; }
.chip-amber  { background:#fef3c7; color:#92400e; }
.chip-rose   { background:#ffe4e6; color:#9f1239; }
</style>
""", unsafe_allow_html=True)


# ── Helpers ────────────────────────────────────────────────────────
def safe_get(endpoint, default=None):
    try:
        data = api_get(endpoint)
        return data if data is not None else (default or [])
    except Exception:
        return default or []


def filter_by_period(df: pd.DataFrame, period_key: str, date_col: str = "collected_at") -> pd.DataFrame:
    if df.empty or date_col not in df.columns:
        return df
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col])
    if period_key == "all":
        return df
    now = pd.Timestamp.now()
    delta = {"24h": pd.Timedelta(hours=24), "7j": pd.Timedelta(days=7), "30j": pd.Timedelta(days=30)}
    return df[df[date_col] >= now - delta[period_key]] if period_key in delta else df


def render_kpi(icon, label, value, accent, chip_text=None, chip_cls="chip-blue"):
    chip_html = f'<div class="kpi-chip {chip_cls}">{chip_text}</div>' if chip_text else ""
    st.markdown(f"""
    <div class="kpi-box">
        <div class="kpi-topline" style="background:{accent};"></div>
        <div class="kpi-icon">{icon}</div>
        <div class="kpi-label">{label}</div>
        <div class="kpi-value">{value}</div>
        {chip_html}
    </div>""", unsafe_allow_html=True)


def classify_sql_source(sql_query):
    if not sql_query:
        return "none"
    sql_upper = str(sql_query).upper()
    if any(m in sql_upper for m in ["V$", "GV$", "DBA_", "ALL_", "USER_", "DUAL"]):
        return "oracle"
    if any(m in sql_upper for m in ["METRIC_RUNS", "METRIC_VALUES", "METRIC_DEFS", "TARGET_DBS", "ALERTS", "DBMON."]):
        return "dbmon"
    return "other"


def render_sql_block(sql_query):
    if not sql_query:
        st.caption("SQL non disponible.")
        return
    kind = classify_sql_source(sql_query)
    titles = {
        "oracle": ("Requête SQL Oracle (collecte réelle)", "Exécutée sur la base Oracle cible surveillée."),
        "dbmon":  ("Requête SQL interne DBMON", "Interroge la base interne DBMON (runs, valeurs, alertes)."),
        "other":  ("Requête SQL utilisée", None),
    }
    title, hint = titles.get(kind, (None, None))
    if title:
        st.markdown(f"**{title}**")
    if hint:
        st.caption(hint)
    st.code(sql_query, language="sql")


# ── Couleurs & layout Plotly ───────────────────────────────────────
C = {
    "blue": "#3b82f6", "green": "#10b981", "red": "#ef4444",
    "orange": "#f59e0b", "purple": "#8b5cf6", "cyan": "#06b6d4",
    "gray": "#94a3b8", "rose": "#9f1239",
}

BASE_LAYOUT = dict(
    paper_bgcolor="#ffffff", plot_bgcolor="#ffffff",
    font=dict(family="DM Sans, sans-serif", color="#0f172a", size=12),
    margin=dict(l=10, r=10, t=30, b=10),
    legend=dict(font=dict(color="#0f172a", size=11), bgcolor="#ffffff",
                bordercolor="#e2e8f0", borderwidth=1),
)
AX = dict(color="#0f172a", tickfont=dict(color="#0f172a", size=11),
          linecolor="#e2e8f0", gridcolor="#f1f5f9", showgrid=True)

# ── Chargement données ─────────────────────────────────────────────
target_dbs    = safe_get("/target-dbs/", [])
metric_defs   = safe_get("/metric-defs/", [])
alerts_data   = safe_get("/alerts/", [])
metric_runs   = safe_get("/metric-runs/", [])
metric_values = safe_get("/metric-values/", [])

metric_map = {str(m.get("metric_id")): m.get("metric_code", "?") for m in metric_defs}
db_map     = {str(d.get("db_id")):     d.get("db_name",    "?") for d in target_dbs}

# ── Calculs globaux ────────────────────────────────────────────────
total_dbs       = len(target_dbs)
active_dbs      = sum(1 for d in target_dbs if int(d.get("is_active") or 0) == 1)
total_runs      = len(metric_runs)
success_runs    = sum(1 for r in metric_runs if str(r.get("status","")).upper() == "SUCCESS")
failed_runs     = total_runs - success_runs
success_rate    = round(success_runs / total_runs * 100) if total_runs > 0 else 0
open_alerts     = sum(1 for a in alerts_data if str(a.get("status","")).upper() == "OPEN")
critical_alerts = sum(1 for a in alerts_data
                      if str(a.get("severity","")).upper() == "CRITICAL"
                      and str(a.get("status","")).upper() == "OPEN")
total_values    = len(metric_values)
health          = max(0, success_rate - critical_alerts * 5) if total_runs > 0 else (100 if total_dbs > 0 else 0)

# ══════════════════════════════════════════════════════════════════
# SECTION 1 — En-tête + filtres (layout 2 colonnes comme le template)
# ══════════════════════════════════════════════════════════════════
st.markdown('<div class="section-title">🗄️ DB Monitor — Vue globale</div>', unsafe_allow_html=True)
st.markdown('<div class="section-sub">Analyse consolidée des bases surveillées, runs, alertes et métriques Oracle collectées.</div>', unsafe_allow_html=True)
st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

left_col, right_col = st.columns([1, 2.8], gap="medium")

with left_col:
    with st.container(border=True):
        st.markdown('<div class="card-title">Filtres</div>', unsafe_allow_html=True)

        db_options = sorted([d.get("db_name","?") for d in target_dbs if d.get("db_name")])
        selected_dbs = st.multiselect(
            "Bases surveillées",
            options=db_options,
            default=db_options[:5] if len(db_options) > 5 else db_options,
            placeholder="Choisir des bases…",
        )

        selected_period = st.pills(
            "Période",
            options=["24h", "7j", "30j", "all"],
            default="7j",
            format_func=lambda x: {"24h": "24 h", "7j": "7 jours", "30j": "30 jours", "all": "Tout"}[x],
        )

        st.markdown("<div style='height:0.6rem'></div>", unsafe_allow_html=True)

        m1, m2 = st.columns(2)
        with m1:
            render_kpi("🚨", "Alertes ouvertes", str(open_alerts), C["red"],
                       chip_text=f"{critical_alerts} critiques", chip_cls="chip-red")
        with m2:
            render_kpi("✅", "Taux succès", f"{success_rate}%", C["green"],
                       chip_text=f"{success_runs}/{total_runs}", chip_cls="chip-green")

with right_col:
    with st.container(border=True):
        st.markdown('<div class="card-title">Évolution des métriques Oracle collectées</div>', unsafe_allow_html=True)

        if metric_values:
            df_v = pd.DataFrame(metric_values)
            df_v["metric_code"] = df_v["metric_id"].astype(str).map(metric_map).fillna("?")
            if "db_id" in df_v.columns:
                df_v["db_name"] = df_v["db_id"].astype(str).map(db_map).fillna("?")
                if selected_dbs:
                    df_v = df_v[df_v["db_name"].isin(selected_dbs)]
            df_v   = filter_by_period(df_v, selected_period, "collected_at")
            df_num = df_v[df_v["value_number"].notna()].copy()

            if not df_num.empty and "collected_at" in df_num.columns:
                df_num["collected_at"] = pd.to_datetime(df_num["collected_at"], errors="coerce")
                df_num = df_num.dropna(subset=["collected_at"]).sort_values("collected_at")
                all_metrics     = sorted(df_num["metric_code"].unique().tolist())
                default_metrics = all_metrics[:5] if len(all_metrics) >= 5 else all_metrics

                selected_metrics = st.multiselect(
                    "Métriques à afficher",
                    options=all_metrics,
                    default=default_metrics,
                    key="dash_main_metrics",
                )

                if selected_metrics:
                    palette = [C["blue"], C["green"], C["orange"], C["purple"], C["cyan"], C["red"]]
                    fig = go.Figure()
                    for i, m in enumerate(selected_metrics):
                        df_m = df_num[df_num["metric_code"] == m]
                        fig.add_trace(go.Scatter(
                            x=df_m["collected_at"], y=df_m["value_number"],
                            name=m, mode="lines",
                            line=dict(color=palette[i % len(palette)], width=2.5),
                        ))
                    fig.update_layout(**BASE_LAYOUT, height=380,
                                      xaxis=dict(**AX), yaxis=dict(**AX))
                    st.plotly_chart(fig, width="stretch")
                else:
                    st.info("Sélectionnez au moins une métrique.")
            else:
                st.info("Aucune valeur numérique disponible pour cette sélection.")
        else:
            st.info("Aucune donnée disponible.")

# ══════════════════════════════════════════════════════════════════
# SECTION 2 — Bande KPIs (4 colonnes)
# ══════════════════════════════════════════════════════════════════
st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)

k1, k2, k3, k4 = st.columns(4, gap="small")
with k1:
    render_kpi("🗄️", "Bases actives", f"{active_dbs}/{total_dbs}", C["blue"],
               chip_text="Infrastructure", chip_cls="chip-blue")
with k2:
    render_kpi("💥", "Critiques ouvertes", str(critical_alerts), C["rose"],
               chip_text="À surveiller", chip_cls="chip-red")
with k3:
    render_kpi("⚡", "Total runs", str(total_runs), C["purple"],
               chip_text=f"{failed_runs} échecs", chip_cls="chip-amber")
with k4:
    render_kpi("📈", "Valeurs collectées", str(total_values), C["cyan"],
               chip_text="Historique DBMON", chip_cls="chip-blue")

# ══════════════════════════════════════════════════════════════════
# SECTION 3 — Analyse détaillée (grille 3 colonnes)
# ══════════════════════════════════════════════════════════════════
st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)
st.markdown('<div class="section-title">Analyse détaillée</div>', unsafe_allow_html=True)
st.markdown('<div class="section-sub">Score santé, répartition des alertes et runs par base.</div>', unsafe_allow_html=True)

g1, g2, g3 = st.columns(3, gap="medium")

with g1:
    with st.container(border=True):
        st.markdown('<div class="card-title">Score santé global</div>', unsafe_allow_html=True)
        c_gauge = C["green"] if health >= 80 else (C["orange"] if health >= 50 else C["red"])
        fig = go.Figure(go.Indicator(
            mode="gauge+number",
            value=health,
            number={"suffix": "%", "font": {"size": 30, "color": "#0f172a", "family": "DM Sans"}},
            gauge={
                "axis": {"range": [0, 100], "tickcolor": "#0f172a", "tickfont": {"size": 10}},
                "bar": {"color": c_gauge, "thickness": 0.25},
                "bgcolor": "#f8fafc",
                "steps": [
                    {"range": [0,  50], "color": "#fff1f2"},
                    {"range": [50, 80], "color": "#fffbeb"},
                    {"range": [80,100], "color": "#f0fdf4"},
                ],
                "threshold": {"line": {"color": c_gauge, "width": 3}, "thickness": 0.8, "value": health},
            },
        ))
        fig.update_layout(**BASE_LAYOUT, height=240)
        st.plotly_chart(fig, width="stretch")

with g2:
    with st.container(border=True):
        st.markdown('<div class="card-title">Répartition des alertes</div>', unsafe_allow_html=True)
        warning_alerts  = sum(1 for a in alerts_data
                              if str(a.get("severity","")).upper() == "WARNING"
                              and str(a.get("status","")).upper() == "OPEN")
        resolved_alerts = sum(1 for a in alerts_data
                              if str(a.get("status","")).upper() in ["RESOLVED","CLOSED"])
        raw = [(l, v, c) for l, v, c in [
            ("Critiques", critical_alerts, C["red"]),
            ("Warning",   warning_alerts,  C["orange"]),
            ("Résolues",  resolved_alerts, C["green"]),
        ] if v > 0]
        if raw:
            lbs, vals, clrs = zip(*raw)
            fig = go.Figure(go.Pie(
                labels=list(lbs), values=list(vals), hole=0.58,
                marker=dict(colors=list(clrs), line=dict(color="#fff", width=2)),
                textfont=dict(size=11, color="#0f172a"),
            ))
            fig.update_layout(**BASE_LAYOUT, height=240)
            st.plotly_chart(fig, width="stretch")
        else:
            st.info("Aucune alerte à afficher.")

with g3:
    with st.container(border=True):
        st.markdown('<div class="card-title">Runs par statut / base</div>', unsafe_allow_html=True)
        if metric_runs:
            stats = {}
            for r in metric_runs:
                name   = db_map.get(str(r.get("db_id","")), "?")
                status = str(r.get("status","")).upper()
                stats.setdefault(name, {"SUCCESS": 0, "FAILED": 0})
                if status in stats[name]:
                    stats[name][status] += 1
            names = list(stats.keys())[:6]
            fig = go.Figure()
            fig.add_trace(go.Bar(name="Succès", x=names,
                                 y=[stats[n]["SUCCESS"] for n in names],
                                 marker_color=C["green"], marker_line_width=0))
            fig.add_trace(go.Bar(name="Échecs", x=names,
                                 y=[stats[n]["FAILED"] for n in names],
                                 marker_color=C["red"], marker_line_width=0))
            fig.update_layout(**BASE_LAYOUT, height=240, barmode="stack",
                              xaxis=dict(**AX, tickangle=-30), yaxis=dict(**AX))
            st.plotly_chart(fig, width="stretch")
        else:
            st.info("Aucun run disponible.")

# ── 2e grille ──────────────────────────────────────────────────────
st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)
g4, g5, g6 = st.columns(3, gap="medium")

with g4:
    with st.container(border=True):
        st.markdown('<div class="card-title">Top collectes par métrique</div>', unsafe_allow_html=True)
        if metric_values:
            df_top = pd.DataFrame(metric_values)
            df_top["metric_code"] = df_top["metric_id"].astype(str).map(metric_map).fillna("?")
            df_top = filter_by_period(df_top, selected_period, "collected_at")
            if not df_top.empty:
                top = (df_top.groupby("metric_code").size()
                       .reset_index(name="nb").sort_values("nb").tail(8))
                fig = go.Figure(go.Bar(
                    x=top["nb"], y=top["metric_code"], orientation="h",
                    marker=dict(color=top["nb"],
                                colorscale=[[0,"#dbeafe"],[1,"#2563eb"]],
                                line=dict(width=0)),
                    text=top["nb"], textposition="outside",
                    textfont=dict(size=10, color="#0f172a"),
                ))
                fig.update_layout(**BASE_LAYOUT, height=260,
                                  xaxis=dict(**AX), yaxis=dict(**AX))
                st.plotly_chart(fig, width="stretch")
            else:
                st.info("Aucune donnée sur cette période.")
        else:
            st.info("Aucune donnée.")

with g5:
    with st.container(border=True):
        st.markdown('<div class="card-title">Alertes ouvertes par base</div>', unsafe_allow_html=True)
        if alerts_data:
            df_al = pd.DataFrame(alerts_data)
            df_al["status"]  = df_al["status"].astype(str)
            df_al["db_name"] = df_al["db_id"].astype(str).map(db_map).fillna("?")
            by_db = (df_al[df_al["status"].str.upper() == "OPEN"]
                     .groupby("db_name").size()
                     .reset_index(name="count")
                     .sort_values("count", ascending=False).head(6))
            if not by_db.empty:
                fig = go.Figure(go.Bar(
                    x=by_db["db_name"], y=by_db["count"],
                    marker=dict(color=by_db["count"],
                                colorscale=[[0,"#fecdd3"],[1,"#9f1239"]],
                                line=dict(width=0)),
                    text=by_db["count"], textposition="outside",
                    textfont=dict(size=10, color="#0f172a"),
                ))
                fig.update_layout(**BASE_LAYOUT, height=260,
                                  xaxis=dict(**AX, tickangle=-30), yaxis=dict(**AX))
                st.plotly_chart(fig, width="stretch")
            else:
                st.markdown(
                    '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;'
                    'padding:1.5rem;text-align:center;font-size:0.85rem;font-weight:600;color:#166534;">'
                    '✅ Aucune alerte ouverte</div>', unsafe_allow_html=True)
        else:
            st.info("Aucune alerte.")

with g6:
    with st.container(border=True):
        st.markdown('<div class="card-title">Taux de succès par base</div>', unsafe_allow_html=True)
        if metric_runs:
            df_r = pd.DataFrame(metric_runs)
            df_r["status"]  = df_r["status"].astype(str)
            df_r["db_name"] = df_r["db_id"].astype(str).map(db_map).fillna("?")
            df_r["success"] = df_r["status"].str.upper() == "SUCCESS"
            rate_db = (df_r.groupby("db_name")
                       .agg(total=("success","count"), ok=("success","sum"))
                       .reset_index())
            rate_db["rate"] = (rate_db["ok"] / rate_db["total"] * 100).round(1)
            rate_db = rate_db.sort_values("rate").tail(6)
            bar_colors = [C["green"] if r >= 80 else (C["orange"] if r >= 50 else C["red"])
                          for r in rate_db["rate"]]
            fig = go.Figure(go.Bar(
                x=rate_db["rate"], y=rate_db["db_name"], orientation="h",
                marker=dict(color=bar_colors, line=dict(width=0)),
                text=[f"{r}%" for r in rate_db["rate"]],
                textposition="outside",
                textfont=dict(size=10, color="#0f172a"),
            ))
            fig.update_layout(**BASE_LAYOUT, height=260,
                              xaxis=dict(**AX, range=[0, 115]), yaxis=dict(**AX))
            st.plotly_chart(fig, width="stretch")
        else:
            st.info("Aucun run.")

# ── Top valeurs récentes ───────────────────────────────────────────
st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)
with st.container(border=True):
    st.markdown('<div class="card-title">Top valeurs Oracle récentes</div>', unsafe_allow_html=True)
    if metric_values:
        df_real = pd.DataFrame(metric_values)
        df_real["metric_code"] = df_real["metric_id"].astype(str).map(metric_map).fillna("?")
        if "db_id" in df_real.columns:
            df_real["db_name"] = df_real["db_id"].astype(str).map(db_map).fillna("?")
            if selected_dbs:
                df_real = df_real[df_real["db_name"].isin(selected_dbs)]
        df_real = filter_by_period(df_real, selected_period, "collected_at")
        df_real = df_real[df_real["value_number"].notna()].copy()
        if not df_real.empty:
            df_real["collected_at"] = pd.to_datetime(df_real["collected_at"], errors="coerce")
            df_real = (df_real.sort_values(["metric_code","collected_at"])
                       .groupby("metric_code", as_index=False).tail(1)
                       .sort_values("value_number").tail(10))
            fig = go.Figure(go.Bar(
                x=df_real["value_number"], y=df_real["metric_code"], orientation="h",
                marker=dict(color=df_real["value_number"],
                            colorscale=[[0,"#dcfce7"],[1,"#16a34a"]],
                            line=dict(width=0)),
                text=df_real["value_number"].round(2),
                textposition="outside",
                textfont=dict(size=10, color="#0f172a"),
            ))
            fig.update_layout(**BASE_LAYOUT, height=320,
                              xaxis=dict(**AX), yaxis=dict(**AX))
            st.plotly_chart(fig, width="stretch")
        else:
            st.info("Aucune valeur Oracle récente disponible.")
    else:
        st.info("Aucune donnée.")

# ══════════════════════════════════════════════════════════════════
# SECTION 4 — Détail dynamique d'une métrique (comme "Individual stocks")
# ══════════════════════════════════════════════════════════════════
st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)
st.markdown('<div class="section-title">Détail dynamique d\'une métrique</div>', unsafe_allow_html=True)
st.markdown('<div class="section-sub">Exploration complète : valeur actuelle, historique, sévérité et requête SQL.</div>', unsafe_allow_html=True)

with st.container(border=True):
    latest_metrics = get_latest_metric_values()

    if latest_metrics:
        options_map = {
            f"{item.get('metric_code','?')} | {item.get('db_name','?')}": item
            for item in latest_metrics
        }
        option_labels = sorted(options_map.keys())
        default_index = 0
        if "selected_metric_label" in st.session_state and st.session_state["selected_metric_label"] in option_labels:
            default_index = option_labels.index(st.session_state["selected_metric_label"])

        selected_label = st.selectbox(
            "Choisir une métrique à explorer",
            option_labels, index=default_index, key="selected_metric_label",
        )
        selected_item = options_map[selected_label]
        detail = get_metric_detail(metric_id=selected_item["metric_id"], db_id=selected_item["db_id"])

        if detail:
            dc1, dc2, dc3, dc4 = st.columns(4)
            current_value = detail.get("current_value_number") or detail.get("current_value_text") or "-"
            with dc1: st.metric("Valeur actuelle", current_value)
            with dc2: st.metric("Sévérité", detail.get("severity", "-"))
            with dc3: st.metric("Base", detail.get("db_name", "-"))
            with dc4:
                raw_ts = detail.get("collected_at")
                try:
                    ts_display = pd.to_datetime(raw_ts).strftime("%d/%m/%Y %H:%M:%S") if raw_ts else "-"
                except Exception:
                    ts_display = str(raw_ts)
                st.metric("Heure collecte", ts_display)

            info1, info2, info3 = st.columns(3)
            with info1: st.write(f"**Seuil warning :** {detail.get('warn_threshold', '-')}")
            with info2: st.write(f"**Seuil critique :** {detail.get('crit_threshold', '-')}")
            with info3: st.write(f"**Fréquence :** {detail.get('frequency_sec', '-')} sec")

            history = detail.get("history", [])
            if history:
                df_hist = pd.DataFrame(history)
                if "collected_at" in df_hist.columns:
                    df_hist["collected_at"] = pd.to_datetime(df_hist["collected_at"], errors="coerce")
                    df_hist = df_hist.sort_values("collected_at")

                st.markdown("<div style='height:0.3rem'></div>", unsafe_allow_html=True)
                hc1, hc2 = st.columns([2, 1], gap="medium")

                with hc1:
                    with st.container(border=True):
                        st.markdown(f'<div class="card-title">Historique — {detail.get("metric_code","?")}</div>',
                                    unsafe_allow_html=True)
                        has_num = ("value_number" in df_hist.columns
                                   and not df_hist["value_number"].isna().all())
                        has_txt = ("value_text" in df_hist.columns
                                   and not df_hist["value_text"].fillna("").eq("").all())
                        if has_num:
                            fig = go.Figure()
                            fig.add_trace(go.Scatter(
                                x=df_hist["collected_at"], y=df_hist["value_number"],
                                mode="lines+markers",
                                name=detail.get("metric_code", "Metric"),
                                line=dict(color=C["blue"], width=2),
                                marker=dict(size=5),
                            ))
                            fig.update_layout(**BASE_LAYOUT, height=280,
                                             xaxis=dict(**AX), yaxis=dict(**AX))
                            st.plotly_chart(fig, width="stretch")
                        elif has_txt:
                            st.info("Métrique textuelle — aucune courbe numérique disponible.")
                            df_txt = df_hist.copy()
                            df_txt["collected_at"] = df_txt["collected_at"].dt.strftime("%d/%m/%Y %H:%M:%S")
                            cols_disp = [c for c in ["value_id","value_text","severity","collected_at"]
                                         if c in df_txt.columns]
                            st.dataframe(df_txt[cols_disp].astype(str), width="stretch", hide_index=True)
                        else:
                            st.info("Aucune donnée exploitable.")

                with hc2:
                    with st.container(border=True):
                        st.markdown('<div class="card-title">Dernières collectes</div>', unsafe_allow_html=True)
                        df_show = df_hist.copy()
                        if "collected_at" in df_show.columns:
                            df_show["collected_at"] = df_show["collected_at"].dt.strftime("%d/%m/%Y %H:%M:%S")
                        cols_disp = [c for c in ["value_id","value_number","value_text","severity","collected_at"]
                                     if c in df_show.columns]
                        st.dataframe(df_show[cols_disp].astype(str), width="stretch", hide_index=True)

            sql_query = detail.get("sql_query")
            if sql_query:
                with st.expander("Voir la requête SQL de collecte"):
                    render_sql_block(sql_query)
    else:
        st.info("Aucune métrique disponible pour l'exploration dynamique.")

# ══════════════════════════════════════════════════════════════════
# SECTION 5 — Données brutes (tabs, comme "Raw data" du template)
# ══════════════════════════════════════════════════════════════════
st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)
st.markdown('<div class="section-title">Données brutes</div>', unsafe_allow_html=True)
st.markdown('<div class="section-sub">Vue tabulaire des runs, alertes et valeurs collectées.</div>', unsafe_allow_html=True)

tab1, tab2, tab3 = st.tabs(["📋 Runs", "🚨 Alertes", "📈 Valeurs métriques"])

with tab1:
    if metric_runs:
        df_runs = pd.DataFrame(metric_runs)
        if "db_id" in df_runs.columns:
            df_runs["db_name"] = df_runs["db_id"].astype(str).map(db_map).fillna("?")
        st.dataframe(df_runs, width="stretch", hide_index=True)
    else:
        st.info("Aucun run disponible.")

with tab2:
    if alerts_data:
        df_alerts = pd.DataFrame(alerts_data)
        if "db_id" in df_alerts.columns:
            df_alerts["db_name"] = df_alerts["db_id"].astype(str).map(db_map).fillna("?")
        st.dataframe(df_alerts, width="stretch", hide_index=True)
    else:
        st.info("Aucune alerte.")

with tab3:
    if metric_values:
        df_vals = pd.DataFrame(metric_values)
        if "metric_id" in df_vals.columns:
            df_vals["metric_code"] = df_vals["metric_id"].astype(str).map(metric_map).fillna("?")
        if "db_id" in df_vals.columns:
            df_vals["db_name"] = df_vals["db_id"].astype(str).map(db_map).fillna("?")
        st.dataframe(df_vals, width="stretch", hide_index=True)
    else:
        st.info("Aucune valeur de métrique.")