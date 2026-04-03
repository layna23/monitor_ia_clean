import streamlit as st

from ui.style import apply_style
from ui.layout import require_auth, render_sidebar, render_header
from api_client import api_get, api_post

st.set_page_config(
    page_title="Test Connexion BD — DB Monitor IA",
    page_icon="🔌",
    layout="wide",
)

apply_style()
require_auth()
render_sidebar(active="test_db")
render_header(
    "Test de Connexion",
    "Vérifiez la connectivité et récupérez les informations de vos bases cibles",
)


# ── Helpers ───────────────────────────────────────────────────────────────────
def load_targets():
    data = api_get("/target-dbs/?only_active=true")
    return data if isinstance(data, list) else []


def load_db_types():
    data = api_get("/db-types/")
    if not isinstance(data, list):
        return {}
    return {
        int(d["db_type_id"]): (d.get("code") or "").upper()
        for d in data if d.get("db_type_id") is not None
    }


def latency_label(ms) -> str:
    if ms is None:
        return "—"
    if ms < 100:
        return f"{ms} ms 🟢"
    if ms < 500:
        return f"{ms} ms 🟡"
    return f"{ms} ms 🔴"


# ── Charger données ───────────────────────────────────────────────────────────
targets = load_targets()
db_type_map = load_db_types()

if not targets:
    st.markdown("""
    <div style="text-align:center;padding:4rem;background:#f8fafc;
                border:1px dashed #cbd5e1;border-radius:16px;margin-top:2rem;">
        <div style="font-size:2.5rem;margin-bottom:0.75rem;">🗄️</div>
        <div style="font-weight:700;font-size:1.1rem;color:#334155;">
            Aucune base cible configurée
        </div>
        <div style="color:#94a3b8;margin-top:0.4rem;font-size:0.9rem;">
            Ajoutez d'abord une base dans <b>Config BD</b> avant de tester.
        </div>
    </div>
    """, unsafe_allow_html=True)
    st.stop()


# ── Sélection de la base ──────────────────────────────────────────────────────
st.markdown(
    """
    <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;
                letter-spacing:0.08em;color:#94a3b8;margin-bottom:0.5rem;">
        Base cible
    </div>
    """,
    unsafe_allow_html=True,
)

col_sel, col_btn, col_refresh, _ = st.columns([2.5, 1.4, 1, 4])

with col_sel:
    selected = st.selectbox(
        "base",
        options=targets,
        format_func=lambda t: f"{t.get('db_name','')}  ·  {t.get('host','')}:{t.get('port','')}",
        label_visibility="collapsed",
    )

with col_btn:
    run_test = st.button("🔌  Tester la connexion", type="primary", width="stretch")

with col_refresh:
    if st.button("🔄", width="stretch", key="tdb_refresh", help="Rafraîchir"):
        st.session_state.pop("last_test_result", None)
        st.rerun()


# ── Info card base sélectionnée ───────────────────────────────────────────────
if selected:
    db_type_id = selected.get("db_type_id")
    db_type_code = db_type_map.get(int(db_type_id), "—") if db_type_id else "—"
    db_name = selected.get("db_name", "—")
    host = selected.get("host", "—")
    port = selected.get("port", "—")
    svc = selected.get("service_name") or selected.get("sid") or "—"
    usr = selected.get("username", "—")

    infos = [
        ("Base", db_name),
        ("Type BD", db_type_code),
        ("Host", str(host)),
        ("Port", str(port)),
        ("Service/SID", str(svc)),
        ("Utilisateur", str(usr)),
    ]

    cells = ""
    for label, value in infos:
        cells += f"""
        <div>
            <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;
                        letter-spacing:0.08em;color:#94a3b8;">{label}</div>
            <div style="font-weight:600;color:#0f172a;font-size:0.88rem;margin-top:2px;">{value}</div>
        </div>
        """

    st.markdown(
        f"""
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;
                    padding:1rem 1.5rem;margin:0.75rem 0 1.25rem;display:flex;
                    flex-wrap:wrap;gap:2rem;">
            {cells}
        </div>
        """,
        unsafe_allow_html=True,
    )


# ── Lancer le test ────────────────────────────────────────────────────────────
if run_test and selected:
    db_type_id = selected.get("db_type_id")
    db_type_code = db_type_map.get(int(db_type_id), "") if db_type_id else ""

    if not db_type_code:
        st.error("Impossible de déterminer le type BD. Vérifiez la configuration dans Types BD.")
        st.stop()

    password = selected.get("password") or selected.get("password_enc") or ""

    payload = {
        "db_type": db_type_code,
        "host": selected.get("host"),
        "port": selected.get("port"),
        "service": selected.get("service_name") or selected.get("sid"),
        "username": selected.get("username"),
        "password": password,
    }

    with st.spinner(f"Connexion à {selected.get('db_name','')} en cours…"):
        result = api_post("/db-test/", payload)

    if result is None:
        st.error("Impossible de joindre le backend. Vérifiez que l'API FastAPI est démarrée.")
        st.stop()

    st.session_state["last_test_result"] = result
    st.session_state["last_test_name"] = selected.get("db_name", "")
    st.session_state["last_test_type"] = db_type_code


# ── Affichage du résultat ─────────────────────────────────────────────────────
result = st.session_state.get("last_test_result")

if result:
    success = result.get("success", False)
    status = "OK" if success else "KO"
    version = result.get("version") or "—"
    open_mode = result.get("open_mode") or "—"
    log_mode = result.get("log_mode") or "—"
    latency_ms = result.get("latency_ms")
    error_msg = result.get("message") if not success else None
    res_name = st.session_state.get("last_test_name", "")
    res_type = st.session_state.get("last_test_type", "")

    if success:
        bg, border, color, icon, txt = "#f0fdf4", "#bbf7d0", "#166534", "✅", "Connexion réussie"
    else:
        bg, border, color, icon, txt = "#fff1f2", "#fecdd3", "#9f1239", "❌", "Connexion échouée"

    st.markdown(
        f"""
        <div style="background:{bg}; border:1px solid {border};
                    border-radius:12px; padding:0.9rem 1.25rem; margin-bottom:1.25rem;
                    display:flex; align-items:center; gap:0.75rem;">
            <span style="font-size:1.4rem;">{icon}</span>
            <div>
                <div style="font-weight:700; color:{color}; font-size:1rem;">
                    {txt} — {res_name} ({res_type})
                </div>
                <div style="font-size:0.82rem; color:{color}; opacity:0.8; margin-top:0.1rem;">
                    Temps de réponse : {latency_label(latency_ms)}
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if success:
        c1, c2, c3 = st.columns(3)
        cards = [
            (c1, "🧬", "VERSION DU SGBD", version, "#3b82f6"),
            (c2, "🔓", "MODE D'OUVERTURE", open_mode, "#8b5cf6"),
            (c3, "📋", "MODE ARCHIVAGE", log_mode, "#f59e0b"),
        ]

        for col, ico, lbl, val, accent in cards:
            with col:
                st.markdown(
                    f"""
                    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;
                                padding:1.25rem 1.5rem;box-shadow:0 1px 4px rgba(15,23,42,0.06);
                                position:relative;overflow:hidden;">
                        <div style="position:absolute;top:0;left:0;right:0;height:3px;
                                    background:{accent};border-radius:3px 3px 0 0;"></div>
                        <div style="font-size:1.6rem;margin-bottom:0.5rem;">{ico}</div>
                        <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;
                                    letter-spacing:0.08em;color:#94a3b8;margin-bottom:0.4rem;">{lbl}</div>
                        <div style="font-size:0.95rem;font-weight:700;color:#0f172a;line-height:1.4;">{val}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

        st.markdown(
            """
            <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;
                        letter-spacing:0.08em;color:#94a3b8;margin:1.25rem 0 0.5rem;">
                Détails complets
            </div>
            """,
            unsafe_allow_html=True,
        )

        details = [
            ("Base", res_name),
            ("Type BD", res_type),
            ("Version", version),
            ("Mode", open_mode),
            ("Archivage", log_mode),
            ("Latence", latency_label(latency_ms)),
            ("Statut", "✅ OK"),
        ]

        rows = ""
        for i, (k, v) in enumerate(details):
            row_bg = "#f8fafc" if i % 2 == 0 else "#ffffff"
            rows += f"""
            <tr style="background:{row_bg};">
                <td style="padding:0.6rem 1rem;font-size:0.8rem;font-weight:600;
                           color:#64748b;width:150px;border-bottom:1px solid #f1f5f9;">{k}</td>
                <td style="padding:0.6rem 1rem;font-size:0.85rem;color:#1e293b;
                           border-bottom:1px solid #f1f5f9;">{v}</td>
            </tr>
            """

        st.markdown(
            f"""
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;">
                    {rows}
                </table>
            </div>
            """,
            unsafe_allow_html=True,
        )

    else:
        if error_msg:
            st.markdown(
                f"""
                <div style="background:#fff1f2;border:1px solid #fecdd3;
                            border-radius:10px;padding:1rem;margin-bottom:1rem;">
                    <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;
                                letter-spacing:0.08em;color:#9f1239;margin-bottom:0.5rem;">
                        Détail de l'erreur
                    </div>
                    <pre style="font-size:0.82rem;color:#7f1d1d;white-space:pre-wrap;margin:0;">{error_msg}</pre>
                </div>
                """,
                unsafe_allow_html=True,
            )

        st.info("💡 Vérifiez que la base est démarrée, que host/port/service sont corrects et que l'utilisateur a les droits de connexion.")

else:
    st.markdown("""
    <div style="text-align:center;padding:3rem 2rem;background:#f8fafc;
                border:1px dashed #cbd5e1;border-radius:14px;margin-top:1rem;">
        <div style="font-size:2.5rem;margin-bottom:0.75rem;">🔌</div>
        <div style="font-weight:600;color:#64748b;font-size:0.95rem;">
            Sélectionnez une base et cliquez sur <b>Tester la connexion</b>
        </div>
        <div style="color:#94a3b8;font-size:0.82rem;margin-top:0.4rem;">
            Affichera la version du SGBD, le mode d'ouverture et le mode d'archivage.
        </div>
    </div>
    """, unsafe_allow_html=True)