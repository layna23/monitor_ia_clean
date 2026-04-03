import streamlit as st
import time

from api_client import api_healthcheck, api_post
from ui.style import apply_style, hide_sidebar

st.set_page_config(
    page_title="DB Monitor IA · Connexion",
    page_icon="🗄️",
    layout="centered",
)

apply_style()
hide_sidebar()

# ── Redirect if already authenticated ──────────────────────────────────────
if st.session_state.get("authenticated"):
    st.switch_page("pages/accueil.py")

# ── Backend health check ────────────────────────────────────────────────────
health     = api_healthcheck()
backend_ok = isinstance(health, dict)

# ── Page background ─────────────────────────────────────────────────────────
st.markdown("""
<style>
.stApp {
    background: linear-gradient(135deg, #f0f4ff 0%, #f8fafc 55%, #e8f4fd 100%) !important;
    min-height: 100vh;
}
.block-container { padding-top: 4rem !important; }
</style>
""", unsafe_allow_html=True)

# ── Logo + Brand ─────────────────────────────────────────────────────────────
st.markdown("""
<div style="max-width:420px; margin:0 auto 1.5rem;">
    <div style="display:flex; align-items:center; gap:0.75rem; justify-content:center;">
        <div style="
            width:48px; height:48px;
            background:#2563eb;
            border-radius:14px;
            display:flex; align-items:center; justify-content:center;
            font-size:1.5rem;
            box-shadow:0 4px 14px rgba(37,99,235,0.30);">
            🗄️
        </div>
        <div>
            <div style="font-size:1.3rem; font-weight:700; color:#0f172a; letter-spacing:-0.03em; line-height:1.1;">
                DB Monitor IA
            </div>
            <div style="font-size:0.75rem; color:#64748b; letter-spacing:0.02em; margin-top:1px;">
                Surveillance intelligente de bases de données
            </div>
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

# ── Card top ──────────────────────────────────────────────────────────────────
st.markdown("""
<div style="
    max-width:420px; margin:0 auto;
    background:#ffffff;
    border:1px solid #e2e8f0;
    border-radius:20px;
    padding:2rem 2rem 0.5rem;
    box-shadow:0 12px 40px rgba(15,23,42,0.10), 0 2px 8px rgba(15,23,42,0.05);
">
    <div style="margin-bottom:1.25rem;">
        <div style="font-size:1.25rem; font-weight:700; color:#0f172a; letter-spacing:-0.02em;">
            Connexion
        </div>
        <div style="font-size:0.875rem; color:#64748b; margin-top:0.2rem;">
            Accédez à votre espace de monitoring
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

# ── Inline CSS to constrain Streamlit widgets to card width ──────────────────
st.markdown("""
<style>
div[data-testid="stVerticalBlock"] > div {
    max-width: 420px;
    margin-left: auto;
    margin-right: auto;
}
</style>
""", unsafe_allow_html=True)

# ── Backend status ────────────────────────────────────────────────────────────
if backend_ok:
    st.success("✓  Backend connecté et opérationnel")
else:
    st.error("✗  Backend inaccessible — vérifiez votre serveur FastAPI")

# ── Form fields ───────────────────────────────────────────────────────────────
email    = st.text_input("Adresse e-mail", placeholder="vous@entreprise.com")
password = st.text_input("Mot de passe",   placeholder="••••••••", type="password")


# ── Helpers ───────────────────────────────────────────────────────────────────
def try_backend_login(email: str, password: str):
    resp  = api_post("/auth/login", {"email": email, "password": password})
    if not isinstance(resp, dict):
        return None
    token = resp.get("access_token")
    if not token:
        return None
    return {"token": token, "user": resp.get("user"), "roles": resp.get("roles", [])}


def pick_main_role(role_codes: list[str]) -> str:
    priority = ["SUPER_ADMIN", "ADMIN", "DB_ADMIN", "CONSULTANT", "USER"]
    for p in priority:
        if p in role_codes:
            return p
    return role_codes[0] if role_codes else "USER"


# ── Submit ────────────────────────────────────────────────────────────────────
if st.button("Se connecter →", type="primary", use_container_width=True, disabled=not backend_ok):
    if not email or not password:
        st.error("Veuillez remplir tous les champs.")
        st.stop()

    with st.spinner("Authentification en cours…"):
        result = try_backend_login(email.strip(), password)

    if not result:
        st.error("Email ou mot de passe incorrect.")
        st.stop()

    roles      = result.get("roles", [])
    role_codes = [r.get("role_code") for r in roles if isinstance(r, dict) and r.get("role_code")]
    main_role  = pick_main_role(role_codes)
    user       = result.get("user") or {}

    st.session_state.auth_token    = result["token"]
    st.session_state.authenticated = True
    st.session_state.user = {
        "user_id":   user.get("user_id"),
        "email":     user.get("email"),
        "full_name": user.get("full_name"),
        "role_code": main_role,
        "all_roles": role_codes,
    }

    st.success(f"✓  Connexion réussie · {main_role.replace('_', ' ').title()}")
    time.sleep(0.6)
    st.switch_page("pages/accueil.py")

# ── Footer hint ───────────────────────────────────────────────────────────────
st.markdown("""
<div style="max-width:420px; margin:0.75rem auto 0; text-align:center;">
    <span style="font-size:0.78rem; color:#94a3b8;">
        Connectez-vous avec un compte existant dans la base
    </span>
</div>
""", unsafe_allow_html=True)