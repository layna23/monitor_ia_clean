import streamlit as st
import pandas as pd
import textwrap
 
from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header
from api_client import api_get, api_post, api_put, api_delete
 
st.set_page_config(page_title="Types BD — DB Monitor IA", page_icon="🧩", layout="wide")
apply_style()
require_auth()
render_sidebar(active="db_types")
render_header("Types de Base de Données", "Référentiel des SGBD supportés par le monitoring")
 
 
# ── Helpers ───────────────────────────────────────────────────────────────────
def load_db_types():
    data = api_get("/db-types/")
    return data if isinstance(data, list) else []
 
def badge_status(status: str) -> str:
    s = (status or "").upper()
    if s == "ACTIVE":   return '<span class="badge badge-success">ACTIF</span>'
    if s == "INACTIVE": return '<span class="badge badge-error">INACTIF</span>'
    if s == "BETA":     return '<span class="badge badge-warning">BETA</span>'
    return f'<span class="badge badge-info">{s}</span>'
 
 
# ── State ─────────────────────────────────────────────────────────────────────
for key in ("open_create", "edit_item", "delete_item"):
    if key not in st.session_state:
        st.session_state[key] = None if key != "open_create" else False
 
 
# ── Toolbar ───────────────────────────────────────────────────────────────────
t1, t2, _ = st.columns([2.5, 1.5, 6])
with t1:
    search = st.text_input("🔎 Rechercher", placeholder="Oracle, postgresql…",
                            label_visibility="collapsed")
with t2:
    if st.button("➕ Nouveau type BD", width="stretch"):
        st.session_state["open_create"] = True
        st.session_state["edit_item"]   = None
        st.session_state["delete_item"] = None
 
 
# ── Dialogs ───────────────────────────────────────────────────────────────────
@st.dialog("Créer un type BD")
def dialog_create():
    c1, c2 = st.columns(2)
    with c1:
        code    = st.text_input("Code *",    placeholder="ORACLE")
        version = st.text_input("Version",   placeholder="19c")
    with c2:
        name   = st.text_input("Nom *",     placeholder="Oracle Database")
        driver = st.text_input("Driver",    placeholder="cx_Oracle")
    status      = st.selectbox("Statut", ["ACTIVE", "INACTIVE", "BETA"])
    description = st.text_area("Description", placeholder="Description du SGBD…", height=90)
    st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)
    ca, cs = st.columns(2)
    with ca:
        if st.button("Annuler", width="stretch", key="dlg_dbt_cancel"):
            st.session_state["open_create"] = False
            st.rerun()
    with cs:
        if st.button("Créer", width="stretch", key="dlg_dbt_save", type="primary"):
            if not code.strip() or not name.strip():
                st.warning("Code et Nom sont obligatoires.")
            else:
                api_post("/db-types/", {
                    "code": code.strip().upper(), "name": name.strip(),
                    "version": version.strip(),   "driver": driver.strip(),
                    "status": status,             "description": description.strip(),
                })
                st.success("Type BD créé ✅")
                st.session_state["open_create"] = False
                st.rerun()
 
 
@st.dialog("Modifier le type BD")
def dialog_edit(item):
    c1, c2 = st.columns(2)
    with c1:
        code    = st.text_input("Code",    value=item.get("code", ""))
        version = st.text_input("Version", value=item.get("version", ""))
    with c2:
        name   = st.text_input("Nom",    value=item.get("name", ""))
        driver = st.text_input("Driver", value=item.get("driver", ""))
    sl  = ["ACTIVE", "INACTIVE", "BETA"]
    cur = (item.get("status") or "ACTIVE").upper()
    status      = st.selectbox("Statut", sl, index=sl.index(cur) if cur in sl else 0)
    description = st.text_area("Description", value=item.get("description", ""), height=90)
    ca, cs = st.columns(2)
    with ca:
        if st.button("Annuler", width="stretch", key="dlg_edit_cancel"):
            st.session_state["edit_item"] = None
            st.rerun()
    with cs:
        if st.button("Enregistrer", width="stretch", key="dlg_edit_save", type="primary"):
            api_put(f"/db-types/{item['db_type_id']}", {
                "code": code.strip().upper(), "name": name.strip(),
                "version": version.strip(),   "driver": driver.strip(),
                "status": status,             "description": description.strip(),
            })
            st.success("Modifié ✅")
            st.session_state["edit_item"] = None
            st.rerun()
 
 
@st.dialog("Supprimer le type BD")
def dialog_delete(item):
    st.markdown(f"""
    <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;
                padding:0.9rem;margin-bottom:1rem;font-size:0.875rem;color:#9f1239;">
        ⚠️ Vous allez supprimer <b>{item.get('name','')}</b> (ID {item.get('db_type_id','')}).
        Cette action est <b>irréversible</b>.
    </div>
    """, unsafe_allow_html=True)
    ca, cs = st.columns(2)
    with ca:
        if st.button("Annuler", width="stretch", key="dlg_del_cancel"):
            st.session_state["delete_item"] = None
            st.rerun()
    with cs:
        if st.button("Supprimer", width="stretch", key="dlg_del_confirm", type="primary"):
            item_id = item.get("db_type_id")
            api_delete(f"/db-types/{item_id}")
            st.session_state["delete_item"] = None
            st.session_state["deleted_id"]  = item_id
            st.rerun()
 
 
# ── Ouvrir dialog ─────────────────────────────────────────────────────────────
if st.session_state.get("open_create"):
    dialog_create()
elif st.session_state.get("edit_item") is not None:
    dialog_edit(st.session_state["edit_item"])
elif st.session_state.get("delete_item") is not None:
    dialog_delete(st.session_state["delete_item"])
 
 
# ── Data ──────────────────────────────────────────────────────────────────────
data = load_db_types()
deleted_id = st.session_state.pop("deleted_id", None)
if deleted_id is not None:
    data = [x for x in data if x.get("db_type_id") != deleted_id]
 
if search:
    s = search.lower().strip()
    data = [x for x in data
            if s in str(x.get("code","")).lower()
            or s in str(x.get("name","")).lower()
            or s in str(x.get("driver","")).lower()
            or s in str(x.get("status","")).lower()]
 
 
# ── Cards SGBD ────────────────────────────────────────────────────────────────
st.markdown(
    '<div class="card-section-title" style="margin-bottom:0.75rem;">🧩 SGBD SUPPORTÉS</div>',
    unsafe_allow_html=True,
)
 
if not data:
    st.markdown("""
    <div style="text-align:center;padding:3rem;background:#f8fafc;
                border:1px dashed #cbd5e1;border-radius:12px;">
        <div style="font-size:2rem;margin-bottom:0.5rem;">🧩</div>
        <div style="font-weight:600;color:#64748b;">Aucun type BD trouvé</div>
    </div>
    """, unsafe_allow_html=True)
else:
    cols = st.columns(3, gap="medium")
    for i, item in enumerate(data):
        with cols[i % 3]:
            with st.container(border=True):
                header = f"""
                <div class="dbTypeHeader">
                    <div>
                        <div class="dbTypeTitle">{item.get("name","")}</div>
                        <div class="dbTypeSub">Code : {item.get("code","")} · ID : {item.get("db_type_id","")}</div>
                    </div>
                    {badge_status(item.get("status",""))}
                </div>"""
                st.markdown(textwrap.dedent(header.strip()), unsafe_allow_html=True)
 
                body = f"""
                <div class="dbTypeGrid">
                    <div class="dbTypeBox">
                        <div class="dbTypeLabel">VERSION</div>
                        <div class="dbTypeValue">{item.get("version","—")}</div>
                    </div>
                    <div class="dbTypeBox">
                        <div class="dbTypeLabel">DRIVER</div>
                        <div class="dbTypeValue">{item.get("driver","—")}</div>
                    </div>
                </div>
                <div class="dbTypeDesc">{item.get("description","Aucune description")}</div>"""
                st.markdown(textwrap.dedent(body.strip()), unsafe_allow_html=True)
 
                ba, bd = st.columns(2)
                with ba:
                    if st.button("✏️ Modifier", key=f"edit_{item['db_type_id']}", width="stretch"):
                        st.session_state["edit_item"]   = item
                        st.session_state["delete_item"] = None
                        st.session_state["open_create"] = False
                        st.rerun()
                with bd:
                    if st.button("🗑️ Supprimer", key=f"del_{item['db_type_id']}", width="stretch"):
                        st.session_state["delete_item"] = item
                        st.session_state["edit_item"]   = None
                        st.session_state["open_create"] = False
                        st.rerun()
 
 
# ── Table ─────────────────────────────────────────────────────────────────────
st.markdown("<div style='height:1.25rem;'></div>", unsafe_allow_html=True)
 
with st.container(border=True):
    st.markdown('<div class="card-section-title">📋 TABLE DB_TYPES</div>', unsafe_allow_html=True)
    st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)
    df = pd.DataFrame(data)
    if df.empty:
        st.info("Aucune donnée.")
    else:
        cols_show = [c for c in ["db_type_id","code","name","version","driver","description","status"] if c in df.columns]
        df_display = df[cols_show].copy()
        for col in df_display.columns:
            df_display[col] = df_display[col].astype(str)
        st.dataframe(df_display, width="stretch", hide_index=True)