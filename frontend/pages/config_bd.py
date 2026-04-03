import streamlit as st
import pandas as pd
 
from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header
from api_client import api_get, api_post, api_put, api_delete
 
st.set_page_config(page_title="Config BD — DB Monitor IA", page_icon="🗄️", layout="wide")
apply_style()
require_auth()
render_sidebar(active="config_bd")
render_header("Configuration des Bases Surveillées", "Ajout, modification et désactivation des Target DBs")
 
TARGET_ENDPOINT  = "/target-dbs/"
DBTYPES_ENDPOINT = "/db-types/"
 
 
# ── Loaders ───────────────────────────────────────────────────────────────────
def load_db_types():
    data = api_get(DBTYPES_ENDPOINT)
    return data if isinstance(data, list) else []
 
def load_targets(only_active: bool = True):
    data = api_get(f"{TARGET_ENDPOINT}?only_active={'true' if only_active else 'false'}")
    return data if isinstance(data, list) else []
 
def int_or_none(v):
    if v is None: return None
    s = str(v).strip()
    if s == "": return None
    try: return int(s)
    except: return None
 
 
# ── State ─────────────────────────────────────────────────────────────────────
_EMPTY = {"db_name":"","db_type_id":None,"host":"","port":"1521",
          "service_name":"","username":"","password":"","is_active":1}
 
for k, v in [("td_edit_id", None), ("td_form", _EMPTY.copy())]:
    if k not in st.session_state:
        st.session_state[k] = v
 
def reset_form():
    st.session_state.td_edit_id = None
    st.session_state.td_form = _EMPTY.copy()
 
def fill_form(row):
    st.session_state.td_edit_id = row.get("db_id")
    st.session_state.td_form = {
        "db_name":      row.get("db_name") or "",
        "db_type_id":   int_or_none(row.get("db_type_id")),
        "host":         row.get("host") or "",
        "port":         "" if row.get("port") is None else str(row.get("port")),
        "service_name": row.get("service_name") or "",
        "username":     row.get("username") or "",
        "password":     "",
        "is_active":    int_or_none(row.get("is_active")) or 1,
    }
 
 
# ── Data ──────────────────────────────────────────────────────────────────────
db_types    = load_db_types()
db_type_map = {int(d["db_type_id"]): f'{d.get("name","")}'.strip()
               for d in db_types if d.get("db_type_id") is not None}
db_type_ids = sorted(db_type_map.keys())
 
 
# ── Toolbar ───────────────────────────────────────────────────────────────────
tb1, tb2, _ = st.columns([1.3, 1, 8])
with tb1:
    if st.button("➕ Nouvelle base", width="stretch"):
        reset_form()
        st.rerun()
with tb2:
    if st.button("🔄 Rafraîchir", width="stretch", key="cfg_bd_refresh"):
        st.rerun()
 
 
# ════════════════════════════════════════════════════════════════════
# FORMULAIRE
# ════════════════════════════════════════════════════════════════════
form    = st.session_state.td_form
is_edit = st.session_state.td_edit_id is not None
action  = "MODIFIER UNE TARGET DB" if is_edit else "AJOUTER UNE TARGET DB"
 
with st.container(border=True):
    st.markdown(f'<div class="card-section-title">🗄️ {action}</div>', unsafe_allow_html=True)
    st.markdown(
        '<div style="font-size:0.78rem;color:#94a3b8;margin:0.25rem 0 0.75rem;">'
        'db_name + host + port doivent être uniques.</div>',
        unsafe_allow_html=True,
    )
 
    r1c1, r1c2, r1c3 = st.columns([1.4, 1.3, 0.9])
    with r1c1:
        db_name = st.text_input("Nom DB (db_name) *", value=form["db_name"], placeholder="ex: ORCL_PROD")
    with r1c2:
        if db_type_ids:
            idx = db_type_ids.index(form["db_type_id"]) if form["db_type_id"] in db_type_ids else 0
            db_type_id = st.selectbox(
                "Type BD *", options=db_type_ids, index=idx,
                format_func=lambda x: db_type_map.get(int(x), str(x)),
            )
        else:
            st.warning("Aucun Type BD. Ajoutez d'abord dans Types BD.")
            db_type_id = None
    with r1c3:
        is_active_label = st.selectbox(
            "Actif", ["Oui", "Non"],
            index=0 if int(form["is_active"]) == 1 else 1,
        )
 
    r2c1, r2c2, r2c3 = st.columns([1.5, 0.8, 1.4])
    with r2c1:
        host         = st.text_input("Host / IP *",    value=form["host"],         placeholder="192.168.1.10")
    with r2c2:
        port         = st.text_input("Port *",          value=form["port"],         placeholder="1521")
    with r2c3:
        service_name = st.text_input("Service name *", value=form["service_name"], placeholder="ORCLPDB1")
 
    r3c1, r3c2 = st.columns(2)
    with r3c1:
        username = st.text_input("Username *", value=form["username"], placeholder="system")
    with r3c2:
        password = st.text_input("Password *", value=form["password"], type="password", placeholder="••••••••")
 
    st.markdown("<div style='height:0.25rem'></div>", unsafe_allow_html=True)
    b1, b2, b3, _ = st.columns([1.2, 1.2, 1.4, 5])
 
    with b1:
        if st.button("💾 Sauvegarder", width="stretch", key="cfg_bd_save", type="primary"):
            payload = {
                "db_name":      db_name.strip(),
                "db_type_id":   int_or_none(db_type_id),
                "host":         host.strip(),
                "port":         int_or_none(port),
                "service_name": service_name.strip(),
                "username":     username.strip(),
                "password":     password,
                "is_active":    1 if is_active_label == "Oui" else 0,
            }
            err = None
            if not payload["db_name"]:          err = "db_name obligatoire."
            elif payload["db_type_id"] is None: err = "db_type_id obligatoire."
            elif not payload["host"]:           err = "host obligatoire."
            elif payload["port"] is None:       err = "port obligatoire."
            elif not payload["service_name"]:   err = "service_name obligatoire."
            elif not payload["username"]:       err = "username obligatoire."
 
            if err:
                st.error(err)
            else:
                if is_edit:
                    upd = payload.copy()
                    if not (upd.get("password") or "").strip():
                        upd.pop("password", None)
                    api_put(f"{TARGET_ENDPOINT}{st.session_state.td_edit_id}", upd)
                    st.success("Target DB modifiée ✅")
                else:
                    if not (payload.get("password") or "").strip():
                        st.error("password obligatoire à la création.")
                        st.stop()
                    api_post(TARGET_ENDPOINT, payload)
                    st.success("Target DB ajoutée ✅")
                reset_form()
                st.rerun()
 
    with b2:
        if st.button("🧹 Réinitialiser", width="stretch", key="cfg_bd_reset"):
            reset_form()
            st.rerun()
 
    with b3:
        if st.button("🔌 Aperçu config", width="stretch", key="cfg_bd_preview"):
            st.code(
                f"DB_NAME={db_name}\nTYPE={db_type_map.get(int_or_none(db_type_id),'?')}\n"
                f"HOST={host}\nPORT={port}\nSERVICE={service_name}\nUSER={username}",
                language="text",
            )
 
 
# ════════════════════════════════════════════════════════════════════
# TABLE BASES CONFIGURÉES
# ════════════════════════════════════════════════════════════════════
st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)
show_inactive = st.checkbox("Afficher aussi les bases désactivées", value=False)
targets = load_targets(only_active=not show_inactive)
 
with st.container(border=True):
    st.markdown('<div class="card-section-title">📌 BASES CONFIGURÉES</div>', unsafe_allow_html=True)
    st.markdown(
        '<div style="font-size:0.78rem;color:#94a3b8;margin:0.25rem 0 0.75rem;">Liste des Target DBs</div>',
        unsafe_allow_html=True,
    )
 
    df = pd.DataFrame([dict(x) for x in targets]) if targets else pd.DataFrame()
 
    if df.empty:
        st.markdown("""
        <div style="text-align:center;padding:2rem;background:#f8fafc;
                    border:1px dashed #cbd5e1;border-radius:10px;
                    color:#94a3b8;font-size:0.875rem;">
            Aucune base configurée.
        </div>
        """, unsafe_allow_html=True)
    else:
        if "db_type_id" in df.columns:
            df["type_bd"] = df["db_type_id"].apply(lambda x: db_type_map.get(int_or_none(x), str(x)))
        df["actif"] = df["is_active"].apply(lambda x: "Oui" if int_or_none(x) == 1 else "Non")
 
        f1, f2, f3 = st.columns([2.2, 2.0, 1.2])
        with f1:
            q = st.text_input(
                "Rechercher", value="", key="cfg_bd_search",
                placeholder="Rechercher (nom / host / service)",
                label_visibility="collapsed",
            )
        with f2:
            typ = st.selectbox(
                "Type BD", ["Tous"] + [db_type_map[i] for i in db_type_ids],
                key="cfg_bd_typ", label_visibility="collapsed",
            )
        with f3:
            act = st.selectbox(
                "Actif", ["Tous", "Oui", "Non"],
                key="cfg_bd_act", label_visibility="collapsed",
            )
 
        view = df.copy()
        if q.strip():
            qq = q.strip().lower()
            view = view[
                view.get("db_name",      pd.Series(dtype=str)).fillna("").astype(str).str.lower().str.contains(qq)
                | view.get("host",       pd.Series(dtype=str)).fillna("").astype(str).str.lower().str.contains(qq)
                | view.get("service_name", pd.Series(dtype=str)).fillna("").astype(str).str.lower().str.contains(qq)
            ]
        if typ != "Tous" and "type_bd" in view.columns:
            view = view[view["type_bd"] == typ]
        if act != "Tous":
            view = view[view["actif"] == act]
 
        cols_show = [c for c in ["db_id","db_name","type_bd","host","port",
                                  "service_name","username","last_status","actif"] if c in view.columns]
        view_display = view[cols_show].copy()
        for col in view_display.columns:
            view_display[col] = view_display[col].astype(str)

        st.dataframe(view_display, width="stretch", hide_index=True)
 
        st.markdown('<div style="border-top:1px solid #e2e8f0;margin:0.75rem 0 0.5rem;"></div>', unsafe_allow_html=True)
 
        ids = view["db_id"].tolist() if "db_id" in view.columns else []
        if ids:
            a1, a2, a3, a4 = st.columns([2.4, 1.1, 1.2, 1.3])
            with a1:
                selected_id = st.selectbox(
                    "Sélectionner", options=ids,
                    format_func=lambda x: f"#{x}  —  {next((r.get('db_name','') for r in targets if int_or_none(r.get('db_id'))==int_or_none(x)), '')}",
                    key="cfg_bd_sel", label_visibility="collapsed",
                )
                selected_row = next((x for x in targets if int_or_none(x.get("db_id")) == int_or_none(selected_id)), None)
            with a2:
                if st.button("✏️ Modifier", width="stretch", key="cfg_bd_edit"):
                    if selected_row:
                        fill_form(selected_row)
                        st.rerun()
            with a3:
                if st.button("⛔ Désactiver", width="stretch", key="cfg_bd_deact"):
                    api_delete(f"{TARGET_ENDPOINT}{int_or_none(selected_id)}")
                    st.success("Désactivée ✅")
                    st.rerun()
            with a4:
                if st.button("🗑️ Hard delete", width="stretch", key="cfg_bd_hard"):
                    api_delete(f"{TARGET_ENDPOINT}{int_or_none(selected_id)}?hard=true")
                    st.success("Supprimée ✅")
                    st.rerun()