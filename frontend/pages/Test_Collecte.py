import streamlit as st
from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header
from api_client import api_get, api_post

st.set_page_config(
    page_title="Test Collecte — DB Monitor IA",
    page_icon="🧪",
    layout="wide",
)

apply_style()
require_auth()
render_sidebar(active="test_collecte")
render_header(
    "Test Collecte des Métriques",
    "Exécutez manuellement une métrique sur une base configurée",
)


# ── Helpers ───────────────────────────────────────────────────────────────────
def load_target_dbs():
    data = api_get("/target-dbs/")
    return data if isinstance(data, list) else []

def load_metric_defs():
    data = api_get("/metric-defs/")
    return data if isinstance(data, list) else []

def format_db_label(db):
    return (
        f"{db['db_id']} - {db.get('db_name','N/A')} "
        f"({db.get('host','')}:{db.get('port','')}/{db.get('service_name','')})"
    )

def format_metric_label(metric):
    return f"{metric['metric_id']} - {metric.get('metric_code','N/A')}"

def severity_style(sev: str):
    s = (sev or "").upper()
    if s == "CRITICAL": return "#fff1f2", "#fecdd3", "#9f1239", "❌"
    if s == "WARNING":  return "#fffbeb", "#fde68a", "#92400e", "⚠️"
    if s == "OK":       return "#f0fdf4", "#bbf7d0", "#166534", "✅"
    return "#f8fafc", "#e2e8f0", "#475569", "ℹ️"

def _info_row(label, value):
    return (
        '<div style="display:flex;justify-content:space-between;align-items:center;'
        'padding:0.45rem 0;border-bottom:1px solid #f1f5f9;">'
        '<span style="font-size:0.75rem;font-weight:600;color:#94a3b8;text-transform:uppercase;'
        'letter-spacing:0.06em;">' + label + '</span>'
        '<span style="font-size:0.88rem;font-weight:600;color:#0f172a;">' + str(value) + '</span>'
        '</div>'
    )

def _card(title_icon, title, rows_html, accent="#3b82f6"):
    return (
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;'
        'overflow:hidden;box-shadow:0 1px 4px rgba(15,23,42,0.05);">'
        '<div style="padding:0.7rem 1.25rem;background:#f8fafc;border-bottom:1px solid #e2e8f0;'
        'display:flex;align-items:center;gap:0.5rem;">'
        '<span style="font-size:1rem;">' + title_icon + '</span>'
        '<span style="font-size:0.72rem;font-weight:800;text-transform:uppercase;'
        'letter-spacing:0.1em;color:#475569;">' + title + '</span>'
        '</div>'
        '<div style="padding:0.25rem 1.25rem 0.75rem;">'
        + rows_html +
        '</div></div>'
    )

def _kpi_card(icon, label, value, accent):
    return (
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;'
        'padding:1.1rem 1.25rem;box-shadow:0 1px 4px rgba(15,23,42,0.06);'
        'position:relative;overflow:hidden;">'
        '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:'
        + accent + ';border-radius:3px 3px 0 0;"></div>'
        '<div style="font-size:1.4rem;margin-bottom:0.35rem;">' + icon + '</div>'
        '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;'
        'letter-spacing:0.08em;color:#94a3b8;margin-bottom:0.3rem;">' + label + '</div>'
        '<div style="font-size:1.05rem;font-weight:700;color:#0f172a;">' + str(value) + '</div>'
        '</div>'
    )


# ── Data ──────────────────────────────────────────────────────────────────────
target_dbs  = load_target_dbs()
metric_defs = load_metric_defs()

if not target_dbs:
    st.markdown("""
    <div style="text-align:center;padding:4rem;background:#f8fafc;border:1px dashed #cbd5e1;
                border-radius:16px;margin-top:2rem;">
        <div style="font-size:2.5rem;margin-bottom:0.75rem;">🗄️</div>
        <div style="font-weight:700;font-size:1.1rem;color:#334155;">Aucune base active trouvée</div>
        <div style="color:#94a3b8;margin-top:0.4rem;">Ajoutez une base dans <b>Config BD</b> d'abord.</div>
    </div>""", unsafe_allow_html=True)
    st.stop()

if not metric_defs:
    st.markdown("""
    <div style="text-align:center;padding:4rem;background:#f8fafc;border:1px dashed #cbd5e1;
                border-radius:16px;margin-top:2rem;">
        <div style="font-size:2.5rem;margin-bottom:0.75rem;">📐</div>
        <div style="font-weight:700;font-size:1.1rem;color:#334155;">Aucune métrique configurée</div>
        <div style="color:#94a3b8;margin-top:0.4rem;">Ajoutez une métrique dans <b>Configuration métriques</b> d'abord.</div>
    </div>""", unsafe_allow_html=True)
    st.stop()


# ── Sélection ─────────────────────────────────────────────────────────────────
st.markdown(
    '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;'
    'letter-spacing:0.08em;color:#94a3b8;margin-bottom:0.5rem;">Sélection</div>',
    unsafe_allow_html=True,
)

col1, col2 = st.columns(2)

with col1:
    selected_db = st.selectbox(
        "Choisir une base de données",
        options=target_dbs,
        format_func=format_db_label,
        label_visibility="collapsed",
    )

with col2:
    selected_metric = st.selectbox(
        "Choisir une métrique",
        options=metric_defs,
        format_func=format_metric_label,
        label_visibility="collapsed",
    )


# ── Fiche détail ──────────────────────────────────────────────────────────────
if selected_db and selected_metric:

    db_rows = (
        _info_row("ID",          selected_db.get("db_id"))
        + _info_row("Nom",       selected_db.get("db_name",     "—"))
        + _info_row("Host",      selected_db.get("host",        "—"))
        + _info_row("Port",      selected_db.get("port",        "—"))
        + _info_row("Service",   selected_db.get("service_name","—"))
        + _info_row("Utilisateur", selected_db.get("username",  "—"))
    )

    mt_rows = (
        _info_row("ID",          selected_metric.get("metric_id"))
        + _info_row("Code",      selected_metric.get("metric_code",   "—"))
        + _info_row("Fréquence", str(selected_metric.get("frequency_sec","—")) + " s")
        + _info_row("Warning ≥", selected_metric.get("warn_threshold", "—"))
        + _info_row("Critical ≥",selected_metric.get("crit_threshold", "—"))
        + _info_row("DB Type ID",selected_metric.get("db_type_id",    "—"))
    )

    compat = selected_db.get("db_type_id") == selected_metric.get("db_type_id")
    compat_badge = (
        '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;'
        'padding:0.5rem 1rem;font-size:0.82rem;font-weight:600;color:#166534;">'
        '✅ Types BD compatibles — collecte possible</div>'
        if compat else
        '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;'
        'padding:0.5rem 1rem;font-size:0.82rem;font-weight:600;color:#92400e;">'
        '⚠️ Types BD incompatibles — la collecte risque d\'échouer</div>'
    )

    c1, c2 = st.columns(2)
    with c1:
        st.markdown(
            '<div style="margin-top:0.75rem;">'
            + _card("🗄️", "Base sélectionnée", db_rows)
            + '</div>',
            unsafe_allow_html=True,
        )
    with c2:
        st.markdown(
            '<div style="margin-top:0.75rem;">'
            + _card("📐", "Métrique sélectionnée", mt_rows)
            + '</div>',
            unsafe_allow_html=True,
        )

    st.markdown(
        '<div style="margin-top:0.75rem;">' + compat_badge + '</div>',
        unsafe_allow_html=True,
    )

st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)

# ── Bouton lancer ─────────────────────────────────────────────────────────────
run = st.button("▶  Lancer le test de collecte", type="primary", width="stretch")


# ── Exécution ─────────────────────────────────────────────────────────────────
if run:
    db_id     = selected_db["db_id"]
    metric_id = selected_metric["metric_id"]

    with st.spinner(f"Collecte de {selected_metric.get('metric_code','')} sur {selected_db.get('db_name','')}…"):
        result = api_post(f"/collector/run/{db_id}/{metric_id}", payload={})

    if result is None:
        st.error("Aucune réponse valide retournée par l'API.")
        st.stop()

    st.session_state["collecte_result"] = result


# ── Résultat ──────────────────────────────────────────────────────────────────
result = st.session_state.get("collecte_result")

if result:
    success  = result.get("success", False)
    severity = result.get("severity", "")
    bg, border, color, icon = severity_style(severity)

    st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)

    if success:
        st.markdown(
            '<div style="background:' + bg + ';border:1px solid ' + border + ';'
            'border-radius:12px;padding:0.9rem 1.25rem;margin-bottom:1.25rem;'
            'display:flex;align-items:center;gap:0.75rem;">'
            '<span style="font-size:1.4rem;">' + icon + '</span>'
            '<div>'
            '<div style="font-weight:700;font-size:1rem;color:' + color + ';">Collecte exécutée avec succès</div>'
            '<div style="font-size:0.82rem;color:' + color + ';opacity:0.85;margin-top:0.1rem;">'
            'Sévérité détectée : <b>' + (severity or "—") + '</b></div>'
            '</div></div>',
            unsafe_allow_html=True,
        )

        val_number = result.get("value_number") if result.get("value_number") is not None else result.get("value")
        val_text   = result.get("value_text")
        run_id     = result.get("run_id",   "—")
        value_id   = result.get("value_id", "—")

        kpis = [
            ("🔢", "VALEUR",   str(val_number) if val_number is not None else "Texte", "#3b82f6"),
            ("🎯", "SÉVÉRITÉ", severity or "—",                                        "#8b5cf6"),
            ("🆔", "RUN ID",   str(run_id),                                             "#f59e0b"),
            ("📌", "VALUE ID", str(value_id),                                           "#10b981"),
        ]

        cols = st.columns(4)
        for col, (ico, lbl, val, accent) in zip(cols, kpis):
            with col:
                st.markdown(_kpi_card(ico, lbl, val, accent), unsafe_allow_html=True)

        if val_text:
            st.markdown(
                '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;'
                'padding:0.75rem 1rem;margin-top:0.75rem;font-size:0.88rem;color:#0369a1;">'
                '📝 Valeur texte : <b>' + str(val_text) + '</b></div>',
                unsafe_allow_html=True,
            )

    else:
        st.markdown(
            '<div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;'
            'padding:0.9rem 1.25rem;margin-bottom:1rem;'
            'display:flex;align-items:center;gap:0.75rem;">'
            '<span style="font-size:1.4rem;">❌</span>'
            '<div style="font-weight:700;font-size:1rem;color:#9f1239;">La collecte a échoué</div>'
            '</div>',
            unsafe_allow_html=True,
        )

    st.markdown(
        '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;'
        'letter-spacing:0.08em;color:#94a3b8;margin:1rem 0 0.4rem;">Réponse complète</div>',
        unsafe_allow_html=True,
    )
    st.json(result)

else:
    st.markdown("""
    <div style="text-align:center;padding:3rem 2rem;background:#f8fafc;
                border:1px dashed #cbd5e1;border-radius:14px;margin-top:1rem;">
        <div style="font-size:2.5rem;margin-bottom:0.75rem;">🧪</div>
        <div style="font-weight:600;color:#64748b;font-size:0.95rem;">
            Sélectionnez une base et une métrique, puis cliquez sur <b>Lancer le test de collecte</b>
        </div>
        <div style="color:#94a3b8;font-size:0.82rem;margin-top:0.4rem;">
            La valeur collectée, la sévérité et les IDs d'exécution s'afficheront ici.
        </div>
    </div>
    """, unsafe_allow_html=True)