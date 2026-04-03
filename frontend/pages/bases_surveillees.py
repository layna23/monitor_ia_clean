import streamlit as st
import pandas as pd

from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header
from api_client import api_get

st.set_page_config(
    page_title="Bases Surveillées — DB Monitor IA",
    page_icon="💾",
    layout="wide",
)

apply_style()
require_auth()
render_sidebar(active="bases_surveillees")
render_header(
    "Bases Surveillées",
    "Vue détaillée par base — métriques, alertes, historique des collectes",
)


# ── Helpers ───────────────────────────────────────────────────────────────────
def safe_get(endpoint, default=None):
    try:
        data = api_get(endpoint)
        return data if data is not None else (default or [])
    except Exception:
        return default or []

def severity_style(sev: str):
    s = (sev or "").upper()
    if s == "CRITICAL": return "#fff1f2", "#fecdd3", "#9f1239", "🔴"
    if s == "WARNING":  return "#fffbeb", "#fde68a", "#92400e", "⚠️"
    if s == "OK":       return "#f0fdf4", "#bbf7d0", "#166534", "✅"
    return "#f8fafc", "#e2e8f0", "#475569", "ℹ️"

def status_badge(status: str):
    s = (status or "").upper()
    cfg = {
        "OPEN":     ("#fff1f2", "#fecdd3", "#9f1239"),
        "ACK":      ("#fffbeb", "#fde68a", "#92400e"),
        "RESOLVED": ("#f0fdf4", "#bbf7d0", "#166534"),
        "CLOSED":   ("#f8fafc", "#e2e8f0", "#64748b"),
        "SUCCESS":  ("#f0fdf4", "#bbf7d0", "#166534"),
        "FAILED":   ("#fff1f2", "#fecdd3", "#9f1239"),
    }
    bg, border, color = cfg.get(s, ("#f8fafc", "#e2e8f0", "#64748b"))
    return (
        '<span style="background:' + bg + ';border:1px solid ' + border + ';color:' + color + ';'
        'padding:0.15rem 0.6rem;border-radius:9999px;font-size:0.72rem;font-weight:700;">'
        + (status or "—") + '</span>'
    )


# ── Chargement données ────────────────────────────────────────────────────────
target_dbs    = safe_get("/target-dbs/",   [])
metric_defs   = safe_get("/metric-defs/",  [])
alerts_data   = safe_get("/alerts/",       [])
metric_runs   = safe_get("/metric-runs/",  [])
metric_values = safe_get("/metric-values/", [])
db_types      = safe_get("/db-types/",     [])

if not target_dbs:
    st.markdown("""
    <div style="text-align:center;padding:4rem;background:#f8fafc;
                border:1px dashed #cbd5e1;border-radius:14px;margin-top:2rem;">
        <div style="font-size:2.5rem;margin-bottom:0.75rem;">💾</div>
        <div style="font-weight:700;font-size:1.1rem;color:#334155;">Aucune base configurée</div>
        <div style="color:#94a3b8;margin-top:0.4rem;">Ajoutez une base dans <b>Config BD</b> d'abord.</div>
    </div>""", unsafe_allow_html=True)
    st.stop()

# ── Mappings ──────────────────────────────────────────────────────────────────
metric_map  = {str(m.get("metric_id")): m.get("metric_code", "?") for m in metric_defs}
db_type_map = {str(d.get("db_type_id")): d.get("name", "?") for d in db_types}


# ════════════════════════════════════════════════════════════════════
# SÉLECTION BASE
# ════════════════════════════════════════════════════════════════════
with st.container(border=True):
    st.markdown('<div class="card-section-title">🗄️ SÉLECTIONNER UNE BASE</div>', unsafe_allow_html=True)
    st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

    col_sel, col_info = st.columns([2, 3])

    with col_sel:
        selected_db = st.selectbox(
            "Base",
            options=target_dbs,
            format_func=lambda d: f"{d.get('db_name','?')}  ·  {d.get('host','')}:{d.get('port','')}",
            label_visibility="collapsed",
        )

    if selected_db:
        db_id        = selected_db.get("db_id")
        is_active    = int(selected_db.get("is_active") or 0) == 1
        db_type_name = db_type_map.get(str(selected_db.get("db_type_id", "")), "—")

        db_alerts_open = [
            a for a in alerts_data
            if str(a.get("db_id", "")) == str(db_id)
            and str(a.get("status", "")).upper() == "OPEN"
        ]
        has_critical = any(str(a.get("severity", "")).upper() == "CRITICAL" for a in db_alerts_open)
        has_warning  = any(str(a.get("severity", "")).upper() == "WARNING" for a in db_alerts_open)
        global_status = "CRITICAL" if has_critical else ("WARNING" if has_warning else ("OK" if is_active else "INACTIF"))

        dot_color = {"CRITICAL":"#ef4444","WARNING":"#f59e0b","OK":"#22c55e","INACTIF":"#94a3b8"}.get(global_status, "#94a3b8")
        badge_cfg = {
            "CRITICAL": ("#fff1f2","#fecdd3","#9f1239"),
            "WARNING":  ("#fffbeb","#fde68a","#92400e"),
            "OK":       ("#f0fdf4","#bbf7d0","#166534"),
            "INACTIF":  ("#f8fafc","#e2e8f0","#64748b"),
        }.get(global_status, ("#f8fafc","#e2e8f0","#64748b"))

        with col_info:
            st.markdown(
                '<div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;">'
                '<div>'
                '<span style="width:10px;height:10px;border-radius:50%;background:' + dot_color + ';'
                'display:inline-block;box-shadow:0 0 0 3px ' + dot_color + '33;margin-right:0.5rem;"></span>'
                '<span style="background:' + badge_cfg[0] + ';border:1px solid ' + badge_cfg[1] + ';color:' + badge_cfg[2] + ';'
                'padding:0.2rem 0.7rem;border-radius:9999px;font-size:0.78rem;font-weight:700;">' + global_status + '</span>'
                '</div>'
                '<div style="font-size:0.82rem;color:#64748b;"><b>Type :</b> ' + db_type_name + '</div>'
                '<div style="font-size:0.82rem;color:#64748b;"><b>Service :</b> ' + (selected_db.get("service_name") or "—") + '</div>'
                '<div style="font-size:0.82rem;color:#64748b;"><b>User :</b> ' + (selected_db.get("username") or "—") + '</div>'
                '</div>',
                unsafe_allow_html=True,
            )


# ════════════════════════════════════════════════════════════════════
# KPIs PAR BASE
# ════════════════════════════════════════════════════════════════════
if selected_db:
    db_id = selected_db.get("db_id")

    db_runs   = [r for r in metric_runs   if str(r.get("db_id", "")) == str(db_id)]
    db_values = [v for v in metric_values if str(v.get("db_id", "")) == str(db_id)]
    db_alerts = [a for a in alerts_data   if str(a.get("db_id", "")) == str(db_id)]

    total_runs    = len(db_runs)
    success_runs  = sum(1 for r in db_runs if str(r.get("status", "")).upper() == "SUCCESS")
    failed_runs   = total_runs - success_runs
    success_rate  = round(success_runs / total_runs * 100) if total_runs > 0 else 0
    open_alerts_n = sum(1 for a in db_alerts if str(a.get("status", "")).upper() == "OPEN")
    total_values  = len(db_values)

    st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)

    kpis = [
        ("⚡", "RUNS TOTAL", str(total_runs), "#3b82f6"),
        ("✅", "SUCCÈS", str(success_runs), "#10b981"),
        ("❌", "ÉCHECS", str(failed_runs), "#ef4444"),
        ("📊", "TAUX SUCCÈS", str(success_rate) + " %", "#8b5cf6"),
        ("🚨", "ALERTES OUVERTES", str(open_alerts_n), "#f59e0b"),
        ("📈", "VALEURS COLLECTÉES", str(total_values), "#06b6d4"),
    ]

    cols_kpi = st.columns(6)
    for col, (ico, lbl, val, accent) in zip(cols_kpi, kpis):
        with col:
            st.markdown(
                '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;'
                'padding:0.9rem 1rem;box-shadow:0 1px 4px rgba(15,23,42,0.05);'
                'position:relative;overflow:hidden;">'
                '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:'
                + accent + ';border-radius:3px 3px 0 0;"></div>'
                '<div style="font-size:1.2rem;margin-bottom:0.25rem;">' + ico + '</div>'
                '<div style="font-size:0.60rem;font-weight:700;text-transform:uppercase;'
                'letter-spacing:0.08em;color:#94a3b8;margin-bottom:0.2rem;">' + lbl + '</div>'
                '<div style="font-size:1.4rem;font-weight:700;color:#0f172a;">' + val + '</div>'
                '</div>',
                unsafe_allow_html=True,
            )

    st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

    col_left, col_right = st.columns([3, 2], gap="large")

    with col_left:
        with st.container(border=True):
            st.markdown('<div class="card-section-title">📈 ÉVOLUTION DES MÉTRIQUES</div>', unsafe_allow_html=True)
            st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

            if db_values:
                df_v = pd.DataFrame(db_values)
                df_v["metric_code"] = df_v["metric_id"].astype(str).map(metric_map).fillna("?")
                df_num = df_v[df_v["value_number"].notna()].copy()

                if not df_num.empty and "collected_at" in df_num.columns:
                    df_num["collected_at"] = pd.to_datetime(df_num["collected_at"], errors="coerce")
                    df_num = df_num.dropna(subset=["collected_at"]).sort_values("collected_at")
                    df_pivot = df_num.pivot_table(
                        index="collected_at",
                        columns="metric_code",
                        values="value_number",
                        aggfunc="mean",
                    )
                    if len(df_pivot.columns) > 5:
                        df_pivot = df_pivot[df_pivot.columns[:5]]
                    st.line_chart(df_pivot, height=200)
                else:
                    st.markdown(
                        '<div style="text-align:center;padding:2rem;background:#f8fafc;'
                        'border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;">'
                        'Aucune valeur numérique disponible.</div>',
                        unsafe_allow_html=True,
                    )
            else:
                st.markdown(
                    '<div style="text-align:center;padding:2rem;background:#f8fafc;'
                    'border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;">'
                    '⚡ Aucune collecte pour cette base.</div>',
                    unsafe_allow_html=True,
                )

        st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

        with st.container(border=True):
            st.markdown('<div class="card-section-title">📊 DERNIÈRES VALEURS COLLECTÉES</div>', unsafe_allow_html=True)
            st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

            if db_values:
                df_vals = pd.DataFrame(db_values)
                df_vals["metric_code"] = df_vals["metric_id"].astype(str).map(metric_map).fillna("?")
                if "collected_at" in df_vals.columns:
                    df_vals["collected_at"] = pd.to_datetime(df_vals["collected_at"], errors="coerce").dt.strftime("%Y-%m-%d %H:%M:%S")
                cols_show = [c for c in ["value_id","metric_code","value_number","value_text","severity","collected_at"] if c in df_vals.columns]
                df_show = df_vals[cols_show].sort_values("value_id", ascending=False) if "value_id" in df_vals.columns else df_vals[cols_show]
                df_show_display = df_show.head(20).copy()
                for col in df_show_display.columns:
                    df_show_display[col] = df_show_display[col].astype(str)
                st.dataframe(df_show_display, width="stretch", hide_index=True)
            else:
                st.markdown(
                    '<div style="text-align:center;padding:2rem;background:#f8fafc;'
                    'border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;">'
                    'Aucune valeur collectée.</div>',
                    unsafe_allow_html=True,
                )

        st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

        with st.container(border=True):
            st.markdown('<div class="card-section-title">🕒 HISTORIQUE DES RUNS</div>', unsafe_allow_html=True)
            st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

            if db_runs:
                df_runs = pd.DataFrame(db_runs)
                df_runs["metric_code"] = df_runs["metric_id"].astype(str).map(metric_map).fillna("?")
                for col in ["started_at","ended_at"]:
                    if col in df_runs.columns:
                        df_runs[col] = pd.to_datetime(df_runs[col], errors="coerce").dt.strftime("%Y-%m-%d %H:%M:%S")
                cols_show = [c for c in ["run_id","metric_code","status","duration_ms","started_at","ended_at","error_message"] if c in df_runs.columns]
                df_show = df_runs[cols_show].sort_values("run_id", ascending=False) if "run_id" in df_runs.columns else df_runs[cols_show]
                df_show_display = df_show.head(20).copy()
                for col in df_show_display.columns:
                    df_show_display[col] = df_show_display[col].astype(str)
                st.dataframe(df_show_display, width="stretch", hide_index=True)
            else:
                st.markdown(
                    '<div style="text-align:center;padding:2rem;background:#f8fafc;'
                    'border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;">'
                    'Aucun run pour cette base.</div>',
                    unsafe_allow_html=True,
                )

    with col_right:
        with st.container(border=True):
            st.markdown('<div class="card-section-title">🚨 ALERTES OUVERTES</div>', unsafe_allow_html=True)
            st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

            open_db_alerts = [a for a in db_alerts if str(a.get("status", "")).upper() == "OPEN"]
            open_db_alerts = sorted(open_db_alerts, key=lambda x: str(x.get("created_at", "")), reverse=True)

            if not open_db_alerts:
                st.markdown(
                    '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;'
                    'padding:1rem;text-align:center;font-size:0.85rem;font-weight:600;color:#166534;">'
                    '✅ Aucune alerte ouverte</div>',
                    unsafe_allow_html=True,
                )
            else:
                for a in open_db_alerts[:6]:
                    sev    = str(a.get("severity", "")).upper()
                    bg, border, color, icon = severity_style(sev)
                    met    = metric_map.get(str(a.get("metric_id", "")), "—")
                    title  = a.get("title") or met
                    detail = a.get("details") or a.get("last_value") or ""
                    created = str(a.get("created_at", ""))[:16]

                    detail_html = (
                        '<div style="font-size:0.73rem;color:' + color + ';opacity:0.8;margin-top:0.2rem;">'
                        + str(detail)[:55] + '</div>'
                    ) if detail else ''

                    st.markdown(
                        '<div style="background:' + bg + ';border:1px solid ' + border + ';'
                        'border-radius:10px;padding:0.7rem 0.9rem;margin-bottom:0.5rem;">'
                        '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.15rem;">'
                        '<span>' + icon + '</span>'
                        '<span style="font-size:0.82rem;font-weight:700;color:' + color + ';">' + title[:40] + '</span>'
                        '</div>'
                        '<div style="font-size:0.72rem;color:' + color + ';opacity:0.75;">'
                        + met + ' · ' + created + '</div>'
                        + detail_html +
                        '</div>',
                        unsafe_allow_html=True,
                    )

        st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

        with st.container(border=True):
            st.markdown('<div class="card-section-title">📐 MÉTRIQUES CONFIGURÉES</div>', unsafe_allow_html=True)
            st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

            db_type_id = selected_db.get("db_type_id")
            compatible_metrics = [
                m for m in metric_defs
                if str(m.get("db_type_id", "")) == str(db_type_id)
                and int(m.get("is_active") or 0) == 1
            ]

            if not compatible_metrics:
                st.markdown(
                    '<div style="text-align:center;padding:1.5rem;background:#f8fafc;'
                    'border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;font-size:0.82rem;">'
                    'Aucune métrique active pour ce type de base.</div>',
                    unsafe_allow_html=True,
                )
            else:
                for m in compatible_metrics[:10]:
                    warn = m.get("warn_threshold")
                    crit = m.get("crit_threshold")
                    freq = m.get("frequency_sec", "—")

                    warn_html = (
                        '<span style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;'
                        'padding:0.1rem 0.4rem;border-radius:9999px;font-size:0.68rem;font-weight:700;">'
                        'W:' + str(warn) + '</span>&nbsp;'
                    ) if warn is not None else ''

                    crit_html = (
                        '<span style="background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;'
                        'padding:0.1rem 0.4rem;border-radius:9999px;font-size:0.68rem;font-weight:700;">'
                        'C:' + str(crit) + '</span>'
                    ) if crit is not None else ''

                    st.markdown(
                        '<div style="display:flex;align-items:center;justify-content:space-between;'
                        'padding:0.45rem 0;border-bottom:1px solid #f1f5f9;">'
                        '<div>'
                        '<div style="font-size:0.85rem;font-weight:700;color:#0f172a;">' + m.get("metric_code", "—") + '</div>'
                        '<div style="font-size:0.72rem;color:#94a3b8;">⏱ ' + str(freq) + 's</div>'
                        '</div>'
                        '<div>' + warn_html + crit_html + '</div>'
                        '</div>',
                        unsafe_allow_html=True,
                    )

        st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

        with st.container(border=True):
            st.markdown('<div class="card-section-title">📋 HISTORIQUE ALERTES</div>', unsafe_allow_html=True)
            st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

            if db_alerts:
                df_al = pd.DataFrame(db_alerts)
                df_al["metric_code"] = df_al["metric_id"].astype(str).map(metric_map).fillna("?")
                for col in ["created_at","updated_at","closed_at"]:
                    if col in df_al.columns:
                        df_al[col] = pd.to_datetime(df_al[col], errors="coerce").dt.strftime("%Y-%m-%d %H:%M")
                cols_show = [c for c in ["alert_id","metric_code","severity","status","last_value","created_at"] if c in df_al.columns]
                df_show = df_al[cols_show].sort_values("alert_id", ascending=False) if "alert_id" in df_al.columns else df_al[cols_show]
                df_show_display = df_show.head(10).copy()
                for col in df_show_display.columns:
                    df_show_display[col] = df_show_display[col].astype(str)
                st.dataframe(df_show_display, width="stretch", hide_index=True)
            else:
                st.markdown(
                    '<div style="text-align:center;padding:1.5rem;background:#f8fafc;'
                    'border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;font-size:0.82rem;">'
                    'Aucune alerte pour cette base.</div>',
                    unsafe_allow_html=True,
                )