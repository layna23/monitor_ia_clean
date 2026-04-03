import streamlit as st
import pandas as pd

from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header, render_footer
from api_client import api_get, api_healthcheck

st.set_page_config(
    page_title="Accueil — DB Monitor IA",
    page_icon="🏠",
    layout="wide",
    initial_sidebar_state="expanded",
)

apply_style()
require_auth()
render_sidebar(active="accueil")


# ── Helpers ───────────────────────────────────────────────────────────────────
def safe_get(endpoint, default=None):
    try:
        data = api_get(endpoint)
        return data if data is not None else (default or [])
    except Exception:
        return default or []


# ── Données réelles ───────────────────────────────────────────────────────────
hc              = api_healthcheck()
backend_ok      = isinstance(hc, dict) and hc.get("status") == "ok"
backend_label   = "✅ En ligne" if backend_ok else "❌ Hors ligne"

target_dbs      = safe_get("/target-dbs/",   [])
metric_defs     = safe_get("/metric-defs/",  [])
alerts_data     = safe_get("/alerts/",       [])
metric_runs     = safe_get("/metric-runs/",  [])
metric_values   = safe_get("/metric-values/",[])

# Calculs KPIs
total_dbs       = len(target_dbs)
active_dbs      = sum(1 for d in target_dbs if int(d.get("is_active") or 0) == 1)
active_metrics  = sum(1 for m in metric_defs if int(m.get("is_active") or 0) == 1)

open_alerts     = sum(1 for a in alerts_data if str(a.get("status","")).upper() == "OPEN")
critical_alerts = sum(1 for a in alerts_data if str(a.get("severity","")).upper() == "CRITICAL"
                      and str(a.get("status","")).upper() == "OPEN")
warning_alerts  = open_alerts - critical_alerts

total_runs      = len(metric_runs)
success_runs    = sum(1 for r in metric_runs if str(r.get("status","")).upper() == "SUCCESS")
success_rate    = round(success_runs / total_runs * 100) if total_runs > 0 else 0

# Mappings
db_map     = {str(d.get("db_id")): d.get("db_name","?") for d in target_dbs}
metric_map = {str(m.get("metric_id")): m.get("metric_code","?") for m in metric_defs}

# Header
render_header(
    "Vue d'ensemble",
    f"Monitoring assisté par IA  ·  Backend : {backend_label}",
    badge="Live",
)


# ════════════════════════════════════════════════════════════════════
# KPIs
# ════════════════════════════════════════════════════════════════════
kpis = [
    ("🗄️",  "BASES ACTIVES",       f"{active_dbs} / {total_dbs}",   "sur " + str(total_dbs) + " configurées",      "#2563eb"),
    ("⚠️",  "ALERTES OUVERTES",    str(open_alerts),                 f"{critical_alerts} critiques · {warning_alerts} warning", "#dc2626"),
    ("⚡",  "RUNS COLLECTE",       str(total_runs),                  f"{success_rate} % de succès",                 "#059669"),
    ("📐",  "MÉTRIQUES ACTIVES",   str(active_metrics),              f"sur {len(metric_defs)} configurées",          "#7c3aed"),
]

cols_kpi = st.columns(4, gap="medium")
for col, (ico, lbl, val, sub, accent) in zip(cols_kpi, kpis):
    with col:
        st.markdown(
            '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;'
            'padding:1.25rem 1.5rem;box-shadow:0 1px 4px rgba(15,23,42,0.06);'
            'position:relative;overflow:hidden;">'
            '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:'
            + accent + ';border-radius:3px 3px 0 0;"></div>'
            '<div style="font-size:1.6rem;margin-bottom:0.4rem;">' + ico + '</div>'
            '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;'
            'letter-spacing:0.09em;color:#94a3b8;margin-bottom:0.3rem;">' + lbl + '</div>'
            '<div style="font-size:1.75rem;font-weight:700;color:#0f172a;letter-spacing:-0.03em;line-height:1;">' + val + '</div>'
            '<div style="font-size:0.75rem;color:#94a3b8;margin-top:0.35rem;">' + sub + '</div>'
            '</div>',
            unsafe_allow_html=True,
        )

st.markdown("<div style='height:1.25rem'></div>", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════
# CONTENU PRINCIPAL
# ════════════════════════════════════════════════════════════════════
col_left, col_right = st.columns([2, 1], gap="large")


# ── COLONNE GAUCHE ────────────────────────────────────────────────────────────
with col_left:

    # ── Graphique évolution métriques ─────────────────────────────────────────
    with st.container(border=True):
        st.markdown(
            '<div class="card-section-title">📈 ÉVOLUTION DES VALEURS COLLECTÉES</div>',
            unsafe_allow_html=True,
        )
        st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

        if metric_values:
            df_vals = pd.DataFrame(metric_values)
            df_vals["metric_code"] = df_vals["metric_id"].astype(str).map(metric_map).fillna("?")

            # Filtre les métriques numériques uniquement
            df_num = df_vals[df_vals["value_number"].notna()].copy()

            if not df_num.empty and "collected_at" in df_num.columns:
                df_num["collected_at"] = pd.to_datetime(df_num["collected_at"], errors="coerce")
                df_num = df_num.dropna(subset=["collected_at"])
                df_num = df_num.sort_values("collected_at")

                # Pivot : une colonne par métrique
                df_pivot = df_num.pivot_table(
                    index="collected_at",
                    columns="metric_code",
                    values="value_number",
                    aggfunc="mean",
                )
                # Garder max 5 métriques pour lisibilité
                if len(df_pivot.columns) > 5:
                    df_pivot = df_pivot[df_pivot.columns[:5]]

                st.line_chart(df_pivot, height=220)
            else:
                st.markdown(
                    '<div style="text-align:center;padding:2rem;background:#f8fafc;'
                    'border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;">'
                    'Aucune donnée numérique disponible pour le graphique.</div>',
                    unsafe_allow_html=True,
                )
        else:
            st.markdown(
                '<div style="text-align:center;padding:2rem;background:#f8fafc;'
                'border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;">'
                '⚡ Aucune collecte effectuée pour le moment.</div>',
                unsafe_allow_html=True,
            )

    st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

    # ── État des bases surveillées ─────────────────────────────────────────────
    with st.container(border=True):
        st.markdown(
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">'
            '<div class="card-section-title" style="margin-bottom:0;">🗄️ ÉTAT DES BASES SURVEILLÉES</div>'
            '</div>',
            unsafe_allow_html=True,
        )

        if not target_dbs:
            st.markdown(
                '<div style="text-align:center;padding:2rem;background:#f8fafc;'
                'border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;">'
                'Aucune base configurée.</div>',
                unsafe_allow_html=True,
            )
        else:
            # Header tableau
            h1, h2, h3, h4, h5 = st.columns([0.3, 1.8, 1.2, 1.0, 0.8])
            for col, lbl in zip([h1,h2,h3,h4,h5], ["","BASE","TYPE","HOST","STATUT"]):
                col.markdown(
                    f'<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;'
                    f'letter-spacing:0.09em;color:#94a3b8;padding:0.3rem 0;">{lbl}</div>',
                    unsafe_allow_html=True,
                )
            st.markdown('<hr style="border:none;border-top:1px solid #e2e8f0;margin:0.2rem 0;">', unsafe_allow_html=True)

            # Déterminer le statut de chaque base via les dernières alertes
            db_alert_status = {}
            for a in alerts_data:
                if str(a.get("status","")).upper() == "OPEN":
                    db_id = str(a.get("db_id",""))
                    sev   = str(a.get("severity","")).upper()
                    # Garde la sévérité la plus haute
                    current = db_alert_status.get(db_id, "OK")
                    if sev == "CRITICAL" or (sev == "WARNING" and current == "OK"):
                        db_alert_status[db_id] = sev

            for db in target_dbs[:8]:  # Max 8 bases affichées
                db_id    = str(db.get("db_id",""))
                is_active = int(db.get("is_active") or 0) == 1
                status   = db_alert_status.get(db_id, "OK") if is_active else "INACTIVE"

                # Dot couleur
                dot_color = {"OK": "#22c55e", "WARNING": "#f59e0b", "CRITICAL": "#ef4444", "INACTIVE": "#94a3b8"}.get(status, "#94a3b8")
                status_label = {"OK": "OK", "WARNING": "Warning", "CRITICAL": "Critical", "INACTIVE": "Inactif"}.get(status, status)
                badge_bg     = {"OK": "#f0fdf4", "WARNING": "#fffbeb", "CRITICAL": "#fff1f2", "INACTIVE": "#f8fafc"}.get(status, "#f8fafc")
                badge_color  = {"OK": "#166534", "WARNING": "#92400e", "CRITICAL": "#9f1239", "INACTIVE": "#64748b"}.get(status, "#64748b")
                badge_border = {"OK": "#bbf7d0", "WARNING": "#fde68a", "CRITICAL": "#fecdd3", "INACTIVE": "#e2e8f0"}.get(status, "#e2e8f0")

                c1, c2, c3, c4, c5 = st.columns([0.3, 1.8, 1.2, 1.0, 0.8])
                with c1:
                    st.markdown(
                        f'<div style="padding:0.5rem 0;">'
                        f'<span style="width:8px;height:8px;border-radius:50%;background:{dot_color};'
                        f'display:inline-block;box-shadow:0 0 0 3px {dot_color}22;"></span>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )
                with c2:
                    st.markdown(
                        f'<div style="padding:0.5rem 0;font-size:0.875rem;font-weight:700;color:#0f172a;">'
                        f'{db.get("db_name","—")}</div>',
                        unsafe_allow_html=True,
                    )
                with c3:
                    st.markdown(
                        f'<div style="padding:0.5rem 0;font-size:0.82rem;color:#64748b;">'
                        f'{db.get("service_name","—")}</div>',
                        unsafe_allow_html=True,
                    )
                with c4:
                    st.markdown(
                        f'<div style="padding:0.5rem 0;font-size:0.82rem;color:#64748b;">'
                        f'{db.get("host","—")}</div>',
                        unsafe_allow_html=True,
                    )
                with c5:
                    st.markdown(
                        f'<div style="padding:0.5rem 0;">'
                        f'<span style="background:{badge_bg};border:1px solid {badge_border};color:{badge_color};'
                        f'padding:0.15rem 0.55rem;border-radius:9999px;font-size:0.72rem;font-weight:700;">'
                        f'{status_label}</span></div>',
                        unsafe_allow_html=True,
                    )
                st.markdown('<hr style="border:none;border-top:1px solid #f1f5f9;margin:0;">', unsafe_allow_html=True)


# ── COLONNE DROITE ────────────────────────────────────────────────────────────
with col_right:

    # ── Dernières alertes ─────────────────────────────────────────────────────
    with st.container(border=True):
        st.markdown(
            '<div class="card-section-title">🚨 ALERTES RÉCENTES</div>',
            unsafe_allow_html=True,
        )
        st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

        open_list = [a for a in alerts_data if str(a.get("status","")).upper() == "OPEN"]
        open_list = sorted(open_list, key=lambda x: str(x.get("created_at","")), reverse=True)[:5]

        if not open_list:
            st.markdown(
                '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;'
                'padding:1rem;text-align:center;font-size:0.85rem;font-weight:600;color:#166534;">'
                '✅ Aucune alerte ouverte</div>',
                unsafe_allow_html=True,
            )
        else:
            for a in open_list:
                sev = str(a.get("severity","")).upper()
                bg     = {"CRITICAL": "#fff1f2", "WARNING": "#fffbeb"}.get(sev, "#f8fafc")
                border = {"CRITICAL": "#fecdd3", "WARNING": "#fde68a"}.get(sev, "#e2e8f0")
                color  = {"CRITICAL": "#9f1239", "WARNING": "#92400e"}.get(sev, "#475569")
                icon   = {"CRITICAL": "🔴",     "WARNING": "⚠️"}.get(sev, "ℹ️")

                db_name  = db_map.get(str(a.get("db_id","")), f"DB #{a.get('db_id','')}")
                met_name = metric_map.get(str(a.get("metric_id","")), "—")
                title    = a.get("title") or f"{met_name} — {sev}"
                detail   = a.get("details") or a.get("last_value") or ""
                created  = str(a.get("created_at",""))[:16]

                detail_html = (
                    '<div style="font-size:0.75rem;color:' + color + ';margin-top:0.2rem;opacity:0.75;">' + str(detail)[:60] + '</div>'
                ) if detail else ''

                html = (
                    '<div style="background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;'
                    'padding:0.75rem 1rem;margin-bottom:0.5rem;">'
                    '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.2rem;">'
                    '<span>' + icon + '</span>'
                    '<span style="font-size:0.82rem;font-weight:700;color:' + color + ';"> ' + title[:45] + '</span>'
                    '</div>'
                    '<div style="font-size:0.75rem;color:' + color + ';opacity:0.8;">' + db_name + ' · ' + created + '</div>'
                    + detail_html +
                    '</div>'
                )
                st.markdown(html, unsafe_allow_html=True)

    st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

    # ── Dernières collectes ───────────────────────────────────────────────────
    with st.container(border=True):
        st.markdown(
            '<div class="card-section-title">⚡ DERNIÈRES COLLECTES</div>',
            unsafe_allow_html=True,
        )
        st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

        recent_runs = sorted(metric_runs, key=lambda x: str(x.get("started_at","")), reverse=True)[:6]

        if not recent_runs:
            st.markdown(
                '<div style="text-align:center;padding:1.5rem;background:#f8fafc;'
                'border:1px dashed #cbd5e1;border-radius:10px;color:#94a3b8;font-size:0.82rem;">'
                'Aucune collecte effectuée.</div>',
                unsafe_allow_html=True,
            )
        else:
            for r in recent_runs:
                status  = str(r.get("status","")).upper()
                icon    = "✅" if status == "SUCCESS" else "❌"
                color   = "#166534" if status == "SUCCESS" else "#9f1239"
                bg      = "#f0fdf4" if status == "SUCCESS" else "#fff1f2"
                border  = "#bbf7d0" if status == "SUCCESS" else "#fecdd3"

                db_name  = db_map.get(str(r.get("db_id","")),     f"DB #{r.get('db_id','')}")
                met_name = metric_map.get(str(r.get("metric_id","")), "—")
                duration = r.get("duration_ms")
                started  = str(r.get("started_at",""))[:16]

                st.markdown(
                    f'<div style="background:{bg};border:1px solid {border};border-radius:8px;'
                    f'padding:0.55rem 0.85rem;margin-bottom:0.4rem;'
                    f'display:flex;align-items:center;justify-content:space-between;">'
                    f'<div>'
                    f'<div style="font-size:0.82rem;font-weight:600;color:{color};">{icon} {met_name}</div>'
                    f'<div style="font-size:0.72rem;color:{color};opacity:0.75;">{db_name} · {started}</div>'
                    f'</div>'
                    f'<div style="font-size:0.72rem;color:{color};font-weight:600;">'
                    f'{str(duration) + " ms" if duration else ""}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

    st.markdown("<div style='height:0.75rem'></div>", unsafe_allow_html=True)

    # ── Recommandations IA (préparées) ────────────────────────────────────────
    with st.container(border=True):
        st.markdown(
            '<div class="card-section-title">🤖 RECOMMANDATIONS IA</div>',
            unsafe_allow_html=True,
        )
        st.markdown("<div style='height:0.4rem'></div>", unsafe_allow_html=True)

        st.markdown(
            '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;'
            'padding:0.85rem 1rem;margin-bottom:0.5rem;">'
            '<div style="display:flex;gap:0.5rem;align-items:flex-start;">'
            '<span>📈</span>'
            '<div>'
            '<div style="font-weight:600;font-size:0.82rem;color:#0c4a6e;">Optimisation suggérée</div>'
            '<div style="font-size:0.75rem;color:#0369a1;margin-top:0.2rem;line-height:1.4;">'
            'Analysez vos scripts SQL avec l\'<b>Analyseur SQL</b> pour détecter les Full Table Scans.'
            '</div></div></div></div>'
            '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;'
            'padding:0.85rem 1rem;">'
            '<div style="display:flex;gap:0.5rem;align-items:flex-start;">'
            '<span>🔄</span>'
            '<div>'
            '<div style="font-weight:600;font-size:0.82rem;color:#166534;">Diagnostic automatique</div>'
            '<div style="font-size:0.75rem;color:#15803d;margin-top:0.2rem;line-height:1.4;">'
            'L\'IA analysera vos alertes critiques et suggérera des actions correctives. <b>Bientôt.</b>'
            '</div></div></div></div>',
            unsafe_allow_html=True,
        )

st.markdown("<div style='height:1rem'></div>", unsafe_allow_html=True)
render_footer()