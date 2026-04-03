import streamlit as st
import pandas as pd
 
from api_client import api_get, api_post, api_put, api_delete
from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header
 
 
def refresh_roles():
    roles = api_get("/roles/") or []
    st.session_state["roles_cache"] = roles
    return roles
 
 
def get_roles_cached():
    if "roles_cache" not in st.session_state:
        return refresh_roles()
    return st.session_state["roles_cache"]
 
 
def role_label(r: dict) -> str:
    return f'{r.get("role_code","—")}  ·  {r.get("role_name","")}'
 
 
st.set_page_config(page_title="Rôles — DB Monitor IA", page_icon="👥", layout="wide")
apply_style()
require_auth()
render_sidebar(active="roles")
render_header("Gestion des Rôles", "Créer, modifier et supprimer les rôles système")
 
 
# ── Toolbar ───────────────────────────────────────────────────────────────────
tb1, tb2, _ = st.columns([1.2, 1, 8])
with tb1:
    if st.button("➕ Nouveau rôle", width="stretch"):
        st.session_state["open_role_create"] = True
with tb2:
    if st.button("🔄 Rafraîchir", width="stretch", key="roles_refresh"):
        refresh_roles()
        st.rerun()
 
 
# ── Dialog create ─────────────────────────────────────────────────────────────
@st.dialog("Créer un rôle")
def dialog_create_role():
    st.markdown("""
    <div style="font-size:0.82rem;color:#718096;margin-bottom:1rem;">
        Le <b>code</b> est utilisé en interne (ex : <code>DB_ADMIN</code>).
    </div>
    """, unsafe_allow_html=True)
    role_code = st.text_input("Code du rôle *", placeholder="ex: DB_ADMIN")
    role_name = st.text_input("Nom affiché *", placeholder="ex: Administrateur Base")
    st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)
    c1, c2 = st.columns(2)
    with c1:
        if st.button("Annuler", width="stretch", key="dlg_role_cancel"):
            st.session_state["open_role_create"] = False
            st.rerun()
    with c2:
        if st.button("Créer le rôle", width="stretch", key="dlg_role_save", type="primary"):
            rc = role_code.strip().upper()
            rn = role_name.strip()
            if not rc or not rn:
                st.warning("Tous les champs sont obligatoires.")
            else:
                res = api_post("/roles/", {"role_code": rc, "role_name": rn})
                if res is not None:
                    st.success("Rôle créé ✅")
                    refresh_roles()
                    st.session_state["open_role_create"] = False
                    st.rerun()
 
 
if st.session_state.get("open_role_create"):
    dialog_create_role()
 
 
# ── Table des rôles ───────────────────────────────────────────────────────────
roles = get_roles_cached()
 
with st.container(border=True):
    st.markdown('<div class="card-section-title">👥 RÔLES CONFIGURÉS</div>', unsafe_allow_html=True)
    st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)
    if roles:
        df = pd.DataFrame(roles)
        for col in df.columns:
            df[col] = df[col].astype(str)
        st.dataframe(df, width="stretch", hide_index=True)
    else:
        st.markdown("""
        <div style="text-align:center;padding:3rem;background:#f8fafc;
                    border:1px dashed #cbd5e1;border-radius:12px;">
            <div style="font-size:2rem;margin-bottom:0.5rem;">👥</div>
            <div style="font-weight:600;color:#64748b;">Aucun rôle trouvé</div>
            <div style="font-size:0.82rem;color:#94a3b8;margin-top:0.3rem;">
                Créez votre premier rôle avec le bouton ci-dessus.
            </div>
        </div>
        """, unsafe_allow_html=True)
 
 
# ── Edit / Delete ─────────────────────────────────────────────────────────────
if roles:
    st.markdown("<div style='height:0.75rem;'></div>", unsafe_allow_html=True)
    col_edit, col_delete = st.columns(2, gap="medium")
 
    with col_edit:
        with st.container(border=True):
            st.markdown('<div class="card-section-title">✏️ MODIFIER UN RÔLE</div>', unsafe_allow_html=True)
            st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)
            selected_edit = st.selectbox(
                "Rôle", options=roles, format_func=role_label,
                key="sel_role_edit", label_visibility="collapsed",
            )
            new_code = st.text_input("Nouveau code", value=selected_edit.get("role_code", ""))
            new_name = st.text_input("Nouveau nom", value=selected_edit.get("role_name", ""))
            if st.button("Mettre à jour", width="stretch", key="btn_role_update", type="primary"):
                res = api_put(
                    f"/roles/{selected_edit['role_id']}",
                    {"role_code": new_code.strip().upper(), "role_name": new_name.strip()},
                )
                if res is not None:
                    st.success("Rôle mis à jour ✅")
                    refresh_roles()
                    st.rerun()
 
    with col_delete:
        with st.container(border=True):
            st.markdown('<div class="card-section-title">🗑️ SUPPRIMER UN RÔLE</div>', unsafe_allow_html=True)
            st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)
            selected_del = st.selectbox(
                "Rôle", options=roles, format_func=role_label,
                key="sel_role_del", label_visibility="collapsed",
            )
            rid = selected_del.get("role_id")
            st.markdown(f"""
            <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;
                        padding:0.75rem;margin:0.5rem 0;font-size:0.82rem;color:#9f1239;">
                ⚠️ Action irréversible — rôle <b>{selected_del.get('role_code','?')}</b> supprimé définitivement.
            </div>
            """, unsafe_allow_html=True)
            confirm = st.checkbox("Je confirme la suppression", key=f"confirm_del_role_{rid}")
            if st.button("Supprimer", width="stretch", key="btn_role_del",
                         disabled=not confirm, type="primary"):
                api_delete(f"/roles/{rid}")
                st.session_state["roles_cache"] = [r for r in roles if r.get("role_id") != rid]
                st.success("Rôle supprimé ✅")
                st.rerun()