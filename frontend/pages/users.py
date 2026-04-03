import streamlit as st
import pandas as pd
 
from api_client import api_get, api_post, api_put, api_delete
from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header
 
 
def refresh_users():
    users = api_get("/users/") or []
    st.session_state["users_cache"] = users
    return users
 
 
def get_users_cached():
    if "users_cache" not in st.session_state:
        return refresh_users()
    return st.session_state["users_cache"]
 
 
def user_label(u: dict) -> str:
    return f'{u.get("email","(sans email)")}  ·  {u.get("full_name","")}'
 
 
st.set_page_config(page_title="Utilisateurs — DB Monitor IA", page_icon="👤", layout="wide")
apply_style()
require_auth()
render_sidebar(active="users")
render_header("Gestion des Utilisateurs", "Créer, modifier et supprimer les comptes utilisateurs")
 
 
# ── Toolbar ───────────────────────────────────────────────────────────────────
tb1, tb2, _ = st.columns([1.4, 1, 8])
with tb1:
    if st.button("➕ Nouvel utilisateur", width="stretch"):
        st.session_state["open_user_create"] = True
with tb2:
    if st.button("🔄 Rafraîchir", width="stretch", key="users_refresh"):
        refresh_users()
        st.rerun()
 
 
# ── Dialog create ─────────────────────────────────────────────────────────────
@st.dialog("Créer un utilisateur")
def dialog_create_user():
    c1, c2 = st.columns(2)
    with c1:
        email = st.text_input("Email *", placeholder="user@entreprise.dz")
    with c2:
        full_name = st.text_input("Nom complet", placeholder="Ahmed Benali")
    password = st.text_input("Mot de passe *", type="password", placeholder="Min. 8 caractères")
    is_active = st.checkbox("Compte actif", value=True)
    st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)
    ca, cs = st.columns(2)
    with ca:
        if st.button("Annuler", width="stretch", key="dlg_user_cancel"):
            st.session_state["open_user_create"] = False
            st.rerun()
    with cs:
        if st.button("Créer", width="stretch", key="dlg_user_save", type="primary"):
            if not email.strip():
                st.warning("Email obligatoire.")
            elif not password.strip():
                st.warning("Mot de passe obligatoire.")
            else:
                res = api_post("/users/", {
                    "email": email.strip(),
                    "full_name": full_name.strip(),
                    "password": password,
                    "is_active": 1 if is_active else 0,
                })
                if res is not None:
                    st.success("Utilisateur créé ✅")
                    refresh_users()
                    st.session_state["open_user_create"] = False
                    st.rerun()
 
 
if st.session_state.get("open_user_create"):
    dialog_create_user()
 
 
# ── Table des utilisateurs ────────────────────────────────────────────────────
users = get_users_cached()
 
with st.container(border=True):
    st.markdown('<div class="card-section-title">👤 UTILISATEURS ENREGISTRÉS</div>', unsafe_allow_html=True)
    st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)
    if users:
        df = pd.DataFrame(users)
        for col in ["created_at", "last_login_at"]:
            if col in df.columns:
                df[col] = df[col].astype(str)
        if "is_active" in df.columns:
            df["statut"] = df["is_active"].apply(
                lambda x: "✅ Actif" if int(x or 0) == 1 else "⛔ Inactif"
            )
        cols_show = [c for c in ["user_id", "email", "full_name", "statut", "created_at", "last_login_at"] if c in df.columns]
        df_display = df[cols_show].copy()
        for col in df_display.columns:
            df_display[col] = df_display[col].astype(str)
        st.dataframe(df_display, width="stretch", hide_index=True)
    else:
        st.markdown("""
        <div style="text-align:center;padding:3rem;background:#f8fafc;
                    border:1px dashed #cbd5e1;border-radius:12px;">
            <div style="font-size:2rem;margin-bottom:0.5rem;">👤</div>
            <div style="font-weight:600;color:#64748b;">Aucun utilisateur trouvé</div>
            <div style="font-size:0.82rem;color:#94a3b8;margin-top:0.3rem;">
                Créez votre premier compte avec le bouton ci-dessus.
            </div>
        </div>
        """, unsafe_allow_html=True)
 
 
# ── Edit / Delete ─────────────────────────────────────────────────────────────
if users:
    st.markdown("<div style='height:0.75rem;'></div>", unsafe_allow_html=True)
    col_edit, col_delete = st.columns([1.3, 1], gap="medium")
 
    with col_edit:
        with st.container(border=True):
            st.markdown('<div class="card-section-title">✏️ MODIFIER UN UTILISATEUR</div>', unsafe_allow_html=True)
            st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)
            sel = st.selectbox(
                "Utilisateur", options=users, format_func=user_label,
                key="sel_user_edit", label_visibility="collapsed",
            )
            uid = sel.get("user_id")
            st.caption(f"Créé le : {sel.get('created_at', '-')}  ·  Dernière connexion : {sel.get('last_login_at', '-')}")
            c1, c2 = st.columns(2)
            with c1:
                new_email = st.text_input("Email", value=sel.get("email", ""))
            with c2:
                new_name = st.text_input("Nom complet", value=sel.get("full_name", ""))
            new_active = st.checkbox("Compte actif", value=bool(sel.get("is_active", 1)), key=f"chk_{uid}")
            new_password = st.text_input(
                "Nouveau mot de passe (optionnel)",
                type="password",
                placeholder="Laisser vide si inchangé"
            )
            if st.button("Mettre à jour", width="stretch", key="btn_user_upd", type="primary"):
                payload = {
                    "email": new_email.strip(),
                    "full_name": new_name.strip(),
                    "is_active": 1 if new_active else 0,
                }
                if new_password.strip():
                    payload["password"] = new_password
                res = api_put(f"/users/{uid}", payload)
                if res is not None:
                    st.success("Utilisateur mis à jour ✅")
                    refresh_users()
                    st.rerun()
 
    with col_delete:
        with st.container(border=True):
            st.markdown('<div class="card-section-title">🗑️ SUPPRIMER UN UTILISATEUR</div>', unsafe_allow_html=True)
            st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)
            sel_del = st.selectbox(
                "Utilisateur", options=users, format_func=user_label,
                key="sel_user_del", label_visibility="collapsed",
            )
            del_id = sel_del.get("user_id")
            st.markdown(f"""
            <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;
                        padding:0.75rem;margin:0.5rem 0;font-size:0.82rem;color:#9f1239;">
                ⚠️ Suppression définitive du compte <b>{sel_del.get('email','?')}</b>.
            </div>
            """, unsafe_allow_html=True)
            confirm = st.checkbox("Je confirme la suppression", key=f"confirm_del_user_{del_id}")
            if st.button("Supprimer", width="stretch", key="btn_user_del",
                         disabled=not confirm, type="primary"):
                api_delete(f"/users/{del_id}")
                st.session_state["users_cache"] = [u for u in users if u.get("user_id") != del_id]
                st.success("Utilisateur supprimé ✅")
                st.rerun()