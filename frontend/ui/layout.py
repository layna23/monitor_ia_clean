import streamlit as st


def require_auth():
    if not st.session_state.get("authenticated"):
        st.switch_page("app.py")


def logout():
    st.session_state.authenticated = False
    st.session_state.user = None
    for key in ("auth_token", "user"):
        st.session_state.pop(key, None)
    st.rerun()


def _section_label(text: str):
    st.markdown(
        '<div style="padding:0.7rem 1rem 0.35rem; font-size:0.62rem; font-weight:800;'
        'text-transform:uppercase; letter-spacing:0.12em; color:#94a3b8;">'
        + text + "</div>",
        unsafe_allow_html=True,
    )


def _nav_btn(label: str, page: str, key: str, is_active: bool):
    if st.button(
        label,
        key=f"nav_{key}",
        use_container_width=True,
        type="primary" if is_active else "secondary",
    ):
        st.switch_page(page)


def _divider():
    st.markdown(
        '<div style="border-top:1px solid #e2e8f0;margin:0.65rem 0.75rem;"></div>',
        unsafe_allow_html=True,
    )


def render_sidebar(active: str = "accueil"):
    """
    active: accueil | db_types | config_bd | config_metrics | test_db | test_collecte
            | collecte_auto | roles | users | dashboard | vue_globale_bd
            | alertes | bases_surveillees | analyseur_sql
    """
    user = st.session_state.get("user") or {}
    user_name = user.get("full_name") or user.get("name") or "Utilisateur"
    user_role = (user.get("role_code") or user.get("role") or "user").replace("_", " ").title()
    user_email = user.get("email", "")
    initial = user_name[0].upper() if user_name else "U"

    with st.sidebar:
        st.markdown("""
        <style>
        section[data-testid="stSidebar"] {
            background: #ffffff !important;
            border-right: 1px solid #e2e8f0 !important;
        }

        section[data-testid="stSidebar"] * {
            color: #334155 !important;
        }

        section[data-testid="stSidebarNav"],
        [data-testid="stSidebarNav"] {
            display: none !important;
        }

        section[data-testid="stSidebar"] .stButton > button {
            background: transparent !important;
            border: 1px solid transparent !important;
            box-shadow: none !important;
            color: #475569 !important;
            font-weight: 500 !important;
            font-size: 0.875rem !important;
            border-radius: 12px !important;
            text-align: left !important;
            padding: 0.58rem 0.85rem !important;
            transition: all 0.15s ease !important;
            width: 100% !important;
        }

        section[data-testid="stSidebar"] .stButton > button:hover {
            background: #f8fafc !important;
            border-color: #e2e8f0 !important;
            color: #0f172a !important;
            transform: none !important;
        }

        section[data-testid="stSidebar"] .stButton > button[kind="primary"] {
            background: #eff6ff !important;
            border: 1px solid #bfdbfe !important;
            color: #1d4ed8 !important;
            font-weight: 600 !important;
        }

        section[data-testid="stSidebar"] .stButton > button:focus {
            outline: none !important;
            box-shadow: none !important;
        }
        </style>
        """, unsafe_allow_html=True)

        # Brand
        st.markdown(
            '<div style="padding:1rem 1.25rem 0.8rem;'
            'border-bottom:1px solid #e2e8f0;margin-bottom:0.3rem;">'
            '<div style="display:flex;align-items:center;gap:0.7rem;">'
            '<div style="width:34px;height:34px;background:linear-gradient(135deg,#2563eb,#3b82f6);'
            'border-radius:10px;display:flex;align-items:center;justify-content:center;'
            'font-size:0.82rem;font-weight:800;color:#ffffff;flex-shrink:0;">DB</div>'
            '<div>'
            '<div style="font-weight:700;font-size:0.96rem;color:#0f172a;letter-spacing:-0.01em;">DB Monitor IA</div>'
            '<div style="font-size:0.65rem;color:#64748b;letter-spacing:0.05em;text-transform:uppercase;margin-top:1px;">v1.0 · Monitoring</div>'
            '</div></div></div>',
            unsafe_allow_html=True,
        )

        # User card
        st.markdown(
            '<div style="margin:0.75rem 0.75rem 0.55rem;padding:0.75rem 0.9rem;'
            'background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">'
            '<div style="display:flex;align-items:center;gap:0.65rem;">'
            '<div style="width:36px;height:36px;flex-shrink:0;background:linear-gradient(135deg,#2563eb,#3b82f6);'
            'border-radius:10px;display:flex;align-items:center;justify-content:center;'
            'color:#ffffff;font-weight:700;font-size:0.92rem;">'
            + initial +
            '</div>'
            '<div style="min-width:0;">'
            '<div style="font-weight:600;font-size:0.86rem;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
            + user_name +
            '</div>'
            '<div style="font-size:0.70rem;color:#64748b;margin-top:1px;">'
            + user_role +
            '</div></div></div>'
            '<div style="margin-top:0.45rem;font-size:0.68rem;color:#94a3b8;'
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
            + user_email +
            '</div></div>',
            unsafe_allow_html=True,
        )

        _divider()

        _nav_btn("Accueil", "pages/accueil.py", "accueil", active == "accueil")

        _divider()

        _section_label("Paramétrage")
        _nav_btn("Types de bases", "pages/db_types.py", "db_types", active == "db_types")
        _nav_btn("Configuration des bases", "pages/config_bd.py", "config_bd", active == "config_bd")
        _nav_btn("Configuration des métriques", "pages/configuration_metriques.py", "config_metrics", active == "config_metrics")
        _nav_btn("Test de connexion", "pages/test_db.py", "test_db", active == "test_db")
        _nav_btn("Test de collecte", "pages/test_collecte.py", "test_collecte", active == "test_collecte")
        _nav_btn("Suivi des collectes automatiques", "pages/collecte_auto.py", "collecte_auto", active == "collecte_auto")
        _nav_btn("Analyseur SQL", "pages/analyseur_sql.py", "analyseur_sql", active == "analyseur_sql")

        _divider()

        _section_label("Utilisateurs")
        _nav_btn("Rôles", "pages/roles.py", "roles", active == "roles")
        _nav_btn("Utilisateurs", "pages/users.py", "users", active == "users")

        _divider()

        _section_label("Monitoring")
        _nav_btn("Dashboard", "pages/dashboard.py", "dashboard", active == "dashboard")
        _nav_btn("Vue globale des bases", "pages/vue_globale_bd.py", "vue_globale_bd", active == "vue_globale_bd")
        _nav_btn("Alertes", "pages/alertes.py", "alertes", active == "alertes")
        _nav_btn("Bases surveillées", "pages/bases_surveillees.py", "bases_surveillees", active == "bases_surveillees")

        st.markdown(
            '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.9rem;'
            'margin:0.15rem 0.5rem;border-radius:12px;color:#94a3b8;'
            'font-size:0.88rem;cursor:not-allowed;user-select:none;'
            'border:1px dashed #e2e8f0;background:#f8fafc;">'
            'Diagnostic IA'
            '<span style="margin-left:auto;font-size:0.60rem;font-weight:700;'
            'background:#ffffff;color:#94a3b8;'
            'padding:0.12rem 0.45rem;border-radius:9999px;letter-spacing:0.04em;border:1px solid #e2e8f0;">Bientôt</span>'
            '</div>',
            unsafe_allow_html=True,
        )

        _divider()

        if st.button("Déconnexion", key="btn_logout", use_container_width=True):
            logout()

        st.markdown(
            '<div style="padding:0.55rem 1rem 1rem;text-align:center;">'
            '<span style="font-size:0.65rem;color:#94a3b8;">DB Monitor IA · 2026</span>'
            '</div>',
            unsafe_allow_html=True,
        )


def render_header(title: str, subtitle: str | None = None, badge: str | None = None):
    if badge:
        badge_html = (
            '<span style="display:inline-flex;align-items:center;'
            'background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:9999px;'
            'padding:0.22rem 0.78rem;font-size:0.72rem;font-weight:700;'
            'letter-spacing:0.04em;text-transform:uppercase;margin-left:0.75rem;">'
            + badge + '</span>'
        )
    else:
        badge_html = ""

    if subtitle:
        subtitle_html = (
            '<p style="font-size:0.94rem;color:#64748b;margin-top:0.35rem;font-weight:400;">'
            + subtitle + '</p>'
        )
    else:
        subtitle_html = ""

    st.markdown(
        '<div style="margin-bottom:2rem;padding-bottom:1.25rem;border-bottom:1px solid #e2e8f0;">'
        '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:0.25rem;">'
        '<h1 style="font-size:1.75rem;font-weight:700;color:#0f172a;letter-spacing:-0.03em;'
        'line-height:1.2;margin:0;">' + title + '</h1>'
        + badge_html +
        '</div>'
        + subtitle_html +
        '</div>',
        unsafe_allow_html=True,
    )


def render_footer():
    st.markdown(
        '<div style="margin-top:3rem;padding-top:1.25rem;border-top:1px solid #e2e8f0;'
        'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">'
        '<span style="color:#94a3b8;font-size:0.78rem;font-weight:500;">'
        'DB Monitor IA · Surveillance intelligente de bases de données</span>'
        '<span style="display:inline-flex;align-items:center;gap:0.4rem;color:#64748b;font-size:0.78rem;">'
        '<span style="width:6px;height:6px;background:#22c55e;border-radius:50%;'
        'display:inline-block;box-shadow:0 0 0 2px rgba(34,197,94,0.2);"></span>'
        'Système opérationnel · 2026</span></div>',
        unsafe_allow_html=True,
    )