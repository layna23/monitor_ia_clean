import streamlit as st
import pandas as pd

from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header
from api_client import api_get, api_post, api_put, api_delete

st.set_page_config(
    page_title="Config. Métriques — DB Monitor IA",
    page_icon="📐",
    layout="wide",
)

apply_style()
require_auth()
render_sidebar(active="config_metrics")
render_header(
    "Définition des Métriques",
    "Chaque métrique = type BD · requête SQL · seuils · fréquence",
)

# ── CSS : style des containers Streamlit en "card blanche" ────────────────────
st.markdown("""
<style>
div[data-testid="stVerticalBlock"] > div[data-testid="stVerticalBlockBorderWrapper"] {
    background: #ffffff !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 14px !important;
    padding: 1.5rem 1.75rem !important;
    box-shadow: 0 1px 4px rgba(15,23,42,0.06) !important;
}

.card-section-title {
    font-size: 0.70rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #64748b;
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.card-section-title::before {
    content: '';
    display: inline-block;
    width: 3px;
    height: 13px;
    background: #3b82f6;
    border-radius: 2px;
}

[data-testid="stDataFrame"] > div {
    border-radius: 10px !important;
    border: 1px solid #e2e8f0 !important;
    overflow: hidden !important;
}
[data-testid="stDataFrame"] th {
    background: #f8fafc !important;
    color: #94a3b8 !important;
    font-size: 0.68rem !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.09em !important;
}
[data-testid="stDataFrame"] td {
    font-size: 0.875rem !important;
    color: #334155 !important;
    background: #ffffff !important;
}
[data-testid="stDataFrame"] tr:hover td {
    background: #f8fafc !important;
}
</style>
""", unsafe_allow_html=True)


# ── API ───────────────────────────────────────────────────────────────────────
def load_db_types():
    data = api_get("/db-types/")
    return data if isinstance(data, list) else []


def load_metric_defs():
    data = api_get("/metric-defs/")
    return data if isinstance(data, list) else []


def safe_float(v):
    if v is None:
        return None
    s = str(v).strip()
    if s == "":
        return None
    try:
        return float(s)
    except Exception:
        return None


def classify_sql_source(sql_query: str) -> str:
    if not sql_query:
        return "AUTRE"

    sql_upper = str(sql_query).upper()

    oracle_markers = ["V$", "GV$", "DBA_", "ALL_", "USER_", "DUAL"]
    dbmon_markers = ["METRIC_RUNS", "METRIC_VALUES", "METRIC_DEFS", "TARGET_DBS", "ALERTS", "DBMON."]

    if any(marker in sql_upper for marker in oracle_markers):
        return "ORACLE"
    if any(marker in sql_upper for marker in dbmon_markers):
        return "DBMON"
    return "AUTRE"


def source_badge_html(source: str) -> str:
    source = (source or "").upper()

    styles = {
        "ORACLE": "background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;",
        "DBMON": "background:#fef3c7;color:#92400e;border:1px solid #fcd34d;",
        "AUTRE": "background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;",
    }
    style = styles.get(source, styles["AUTRE"])
    return (
        f'<span style="{style}padding:4px 10px;border-radius:999px;'
        f'font-size:0.72rem;font-weight:700;letter-spacing:0.05em;">{source}</span>'
    )


# ── State ─────────────────────────────────────────────────────────────────────
_EMPTY = {
    "metric_code": "",
    "db_type_id": None,
    "unit": "",
    "frequency_sec": 300,
    "warn_threshold": "",
    "crit_threshold": "",
    "is_active": True,
    "sql_query": "",
}
for k, v in [("md_edit_id", None), ("md_form", _EMPTY.copy())]:
    if k not in st.session_state:
        st.session_state[k] = v


def reset_form():
    st.session_state.md_edit_id = None
    st.session_state.md_form = _EMPTY.copy()


def fill_form(row):
    st.session_state.md_edit_id = row.get("metric_id")
    st.session_state.md_form = {
        "metric_code": row.get("metric_code") or "",
        "db_type_id": int(row["db_type_id"]) if row.get("db_type_id") is not None else None,
        "unit": row.get("unit") or "",
        "frequency_sec": int(row.get("frequency_sec") or 300),
        "warn_threshold": "" if row.get("warn_threshold") is None else str(row["warn_threshold"]),
        "crit_threshold": "" if row.get("crit_threshold") is None else str(row["crit_threshold"]),
        "is_active": True if int(row.get("is_active") or 1) == 1 else False,
        "sql_query": row.get("sql_query") or "",
    }


# ── Data ──────────────────────────────────────────────────────────────────────
db_types = load_db_types()
metric_defs = load_metric_defs()

db_type_map = {
    int(d["db_type_id"]): f'{d.get("name","")}'.strip()
    for d in db_types if d.get("db_type_id") is not None
}
db_type_ids = sorted(db_type_map.keys())

form = st.session_state.md_form
is_edit = st.session_state.md_edit_id is not None


# ════════════════════════════════════════════════════════════════════
# SECTION 1 — FORMULAIRE
# ════════════════════════════════════════════════════════════════════
action_label = "MODIFIER UNE MÉTRIQUE" if is_edit else "CRÉER UNE MÉTRIQUE"

with st.container(border=True):
    st.markdown(
        f'<div class="card-section-title">📐 {action_label}</div>',
        unsafe_allow_html=True,
    )
    st.markdown("<div style='height:0.6rem'></div>", unsafe_allow_html=True)

    c1, c2, c3 = st.columns([1.3, 1.3, 1.0])
    with c1:
        metric_code = st.text_input(
            "Code métrique *",
            value=form["metric_code"],
            max_chars=50,
            placeholder="ex: CPU_USAGE",
        )
    with c2:
        if db_type_ids:
            idx = db_type_ids.index(form["db_type_id"]) if form["db_type_id"] in db_type_ids else 0
            db_type_id = st.selectbox(
                "Type BD *",
                options=db_type_ids,
                index=idx,
                format_func=lambda x: db_type_map.get(int(x), str(x)),
            )
        else:
            st.warning("Aucun Type BD.")
            db_type_id = None
    with c3:
        frequency_sec = st.number_input("Fréquence (sec)", min_value=1, value=int(form["frequency_sec"]))

    sql_query = st.text_area(
        "Requête SQL *",
        value=form["sql_query"],
        height=160,
        placeholder="SELECT metric_value FROM v$sysstat WHERE ...",
    )

    sql_source = classify_sql_source(sql_query)
    st.markdown(
        f'<div style="margin-top:-0.35rem;margin-bottom:0.7rem;">{source_badge_html(sql_source)}</div>',
        unsafe_allow_html=True,
    )

    c4, c5, c6, c7 = st.columns([1.1, 1.1, 1.1, 1.0])
    with c4:
        unit = st.text_input("Unité", value=form["unit"], max_chars=30, placeholder="%, count, ms…")
    with c5:
        warn_threshold = st.text_input("Seuil WARNING", value=form["warn_threshold"], placeholder="ex: 80")
    with c6:
        crit_threshold = st.text_input("Seuil CRITICAL", value=form["crit_threshold"], placeholder="ex: 95")
    with c7:
        is_active = st.selectbox("Actif", ["Oui", "Non"], index=0 if form["is_active"] else 1)

    st.markdown("<div style='height:0.25rem'></div>", unsafe_allow_html=True)

    b1, b2, b3, _ = st.columns([1.2, 1.5, 1.2, 6])
    with b1:
        if st.button("💾 Sauvegarder", width="stretch", key="met_save", type="primary"):
            payload = {
                "metric_code": metric_code.strip(),
                "db_type_id": int(db_type_id) if db_type_id is not None else None,
                "unit": unit.strip() or None,
                "frequency_sec": int(frequency_sec),
                "warn_threshold": safe_float(warn_threshold),
                "crit_threshold": safe_float(crit_threshold),
                "is_active": 1 if is_active == "Oui" else 0,
                "sql_query": sql_query.strip(),
            }
            if not payload["metric_code"]:
                st.error("Code métrique obligatoire.")
            elif payload["db_type_id"] is None:
                st.error("Type BD obligatoire.")
            elif not payload["sql_query"]:
                st.error("Requête SQL obligatoire.")
            else:
                if is_edit:
                    api_put(f"/metric-defs/{st.session_state.md_edit_id}", payload)
                    st.success("Métrique modifiée ✅")
                else:
                    api_post("/metric-defs/", payload)
                    st.success("Métrique créée ✅")
                reset_form()
                st.rerun()
    with b2:
        if st.button("▶ Tester la requête", width="stretch", key="met_test"):
            if not sql_query.strip():
                st.warning("Renseigne une requête SQL.")
            else:
                st.info("Aperçu (12 premières lignes) :")
                st.code("\n".join(sql_query.strip().splitlines()[:12]), language="sql")
    with b3:
        if st.button("🧹 Réinitialiser", width="stretch", key="met_reset"):
            reset_form()
            st.rerun()


# ════════════════════════════════════════════════════════════════════
# SECTION 2 — TABLE MÉTRIQUES CONFIGURÉES
# ════════════════════════════════════════════════════════════════════
rows = []
for m in metric_defs:
    r = dict(m)
    did = None
    try:
        did = int(r["db_type_id"]) if r.get("db_type_id") is not None else None
    except Exception:
        pass
    r["type_bd"] = db_type_map.get(did, str(did) if did is not None else "—")
    r["actif"] = "Oui" if int(r.get("is_active") or 0) == 1 else "Non"
    r["source_sql"] = classify_sql_source(r.get("sql_query"))
    rows.append(r)

df = pd.DataFrame(rows)

with st.container(border=True):
    st.markdown(
        '<div class="card-section-title">📌 MÉTRIQUES CONFIGURÉES</div>',
        unsafe_allow_html=True,
    )
    st.markdown("<div style='height:0.6rem'></div>", unsafe_allow_html=True)

    if df.empty:
        st.markdown("""
        <div style="text-align:center;padding:2.5rem;background:#f8fafc;
                    border:1px dashed #cbd5e1;border-radius:10px;
                    color:#94a3b8;font-size:0.875rem;">
            <div style="font-size:2rem;margin-bottom:0.5rem;">📐</div>
            Aucune métrique configurée.
        </div>
        """, unsafe_allow_html=True)
    else:
        f1, f2, f3 = st.columns([2.2, 2.2, 1.2])
        with f1:
            q = st.text_input(
                "Rechercher",
                value="",
                key="met_search",
                placeholder="Rechercher (code / SQL / unité)",
                label_visibility="collapsed",
            )
        with f2:
            db_filter = st.selectbox(
                "Type BD",
                ["Tous"] + [db_type_map[i] for i in db_type_ids],
                key="met_dbf",
                label_visibility="collapsed",
            )
        with f3:
            act_filter = st.selectbox(
                "Actif",
                ["Tous", "Oui", "Non"],
                key="met_actf",
                label_visibility="collapsed",
            )

        view = df.copy()
        if q.strip():
            qq = q.strip().lower()
            for col in ["metric_code", "sql_query", "unit", "type_bd", "source_sql"]:
                if col not in view.columns:
                    view[col] = ""
            view = view[
                view["metric_code"].fillna("").astype(str).str.lower().str.contains(qq)
                | view["sql_query"].fillna("").astype(str).str.lower().str.contains(qq)
                | view["unit"].fillna("").astype(str).str.lower().str.contains(qq)
                | view["type_bd"].fillna("").astype(str).str.lower().str.contains(qq)
                | view["source_sql"].fillna("").astype(str).str.lower().str.contains(qq)
            ]
        if db_filter != "Tous":
            view = view[view["type_bd"] == db_filter]
        if act_filter != "Tous":
            view = view[view["actif"] == act_filter]
        if "created_at" in view.columns:
            view = view.sort_values(by="created_at", ascending=False)

        cols_show = [c for c in [
            "metric_id", "metric_code", "type_bd", "source_sql", "unit",
            "frequency_sec", "warn_threshold", "crit_threshold", "actif", "created_at",
        ] if c in view.columns]

        display_df = view[cols_show].copy()
        if "metric_id" in display_df.columns:
            display_df["metric_id"] = display_df["metric_id"].apply(lambda x: f"#{x}")
        if "created_at" in display_df.columns:
            display_df["created_at"] = display_df["created_at"].astype(str).str[:10]
        for col in ["warn_threshold", "crit_threshold"]:
            if col in display_df.columns:
                display_df[col] = display_df[col].apply(
                    lambda x: "—" if (x is None or str(x) in ("None", "nan", "")) else str(x)
                )

        display_df = display_df.rename(columns={
            "metric_id": "ID",
            "metric_code": "CODE",
            "type_bd": "TYPE BD",
            "source_sql": "SOURCE SQL",
            "unit": "UNITÉ",
            "frequency_sec": "FRÉQ.(S)",
            "warn_threshold": "WARN",
            "crit_threshold": "CRIT",
            "actif": "ACTIF",
            "created_at": "CRÉÉ LE",
        })

        for col in display_df.columns:
            display_df[col] = display_df[col].astype(str)

        st.dataframe(display_df, width="stretch", hide_index=True)

        st.markdown(
            '<div style="border-top:1px solid #e2e8f0;margin:0.75rem 0 0.5rem;"></div>',
            unsafe_allow_html=True,
        )

        ids = view["metric_id"].tolist() if "metric_id" in view.columns else []
        if ids:
            a1, a2, a3 = st.columns([2.5, 1.1, 1.1])
            with a1:
                selected_id = st.selectbox(
                    "Sélectionner",
                    options=ids,
                    format_func=lambda x: f"#{x} — {next((r.get('metric_code','') for r in metric_defs if int(r.get('metric_id',0)) == int(x)), '')}",
                    key="met_sel",
                    label_visibility="collapsed",
                )

            selected_row = next(
                (r for r in metric_defs if int(r.get("metric_id")) == int(selected_id)), None
            )

            if selected_row:
                sql_preview = selected_row.get("sql_query") or ""
                sql_source_selected = classify_sql_source(sql_preview)

                st.markdown("<div style='height:0.3rem'></div>", unsafe_allow_html=True)
                st.markdown(
                    f'<div style="margin-bottom:0.5rem;">{source_badge_html(sql_source_selected)}</div>',
                    unsafe_allow_html=True,
                )
                if sql_preview.strip():
                    st.code(sql_preview, language="sql")

            with a2:
                if st.button("✏️ Modifier", width="stretch", key="met_edit"):
                    if selected_row:
                        fill_form(selected_row)
                        st.rerun()
            with a3:
                if st.button("🗑️ Supprimer", width="stretch", key="met_del"):
                    api_delete(f"/metric-defs/{int(selected_id)}")
                    st.session_state["_met_deleted_id"] = int(selected_id)
                    st.success("Supprimée ✅")
                    st.rerun()

if "_met_deleted_id" in st.session_state:
    deleted = st.session_state.pop("_met_deleted_id")
    metric_defs = [m for m in metric_defs if int(m.get("metric_id", -1)) != deleted]