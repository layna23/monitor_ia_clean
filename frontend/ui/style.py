import streamlit as st


def apply_style():
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

    :root {
        --brand-50:  #eff6ff;
        --brand-100: #dbeafe;
        --brand-200: #bfdbfe;
        --brand-500: #3b82f6;
        --brand-600: #2563eb;
        --brand-700: #1d4ed8;

        --gray-0:   #ffffff;
        --gray-25:  #fcfdff;
        --gray-50:  #f8fafc;
        --gray-100: #f1f5f9;
        --gray-150: #eef2f7;
        --gray-200: #e2e8f0;
        --gray-300: #cbd5e1;
        --gray-400: #94a3b8;
        --gray-500: #64748b;
        --gray-600: #475569;
        --gray-700: #334155;
        --gray-800: #1e293b;
        --gray-900: #0f172a;

        --success-bg: #f0fdf4;
        --success-text: #166534;
        --success-border: #bbf7d0;

        --warning-bg: #fffbeb;
        --warning-text: #92400e;
        --warning-border: #fde68a;

        --error-bg: #fff1f2;
        --error-text: #9f1239;
        --error-border: #fecdd3;

        --info-bg: #eff6ff;
        --info-text: #1e40af;
        --info-border: #bfdbfe;

        --shadow-sm: 0 1px 3px rgba(15,23,42,0.05), 0 1px 2px rgba(15,23,42,0.03);
        --shadow-md: 0 6px 18px rgba(15,23,42,0.06), 0 2px 6px rgba(15,23,42,0.04);
        --shadow-lg: 0 16px 40px rgba(15,23,42,0.10), 0 4px 10px rgba(15,23,42,0.06);

        --r-sm: 8px;
        --r-md: 12px;
        --r-lg: 16px;
        --r-xl: 20px;
    }

    /* GLOBAL */
    html, body, .stApp {
        font-family: 'DM Sans', sans-serif;
        background: linear-gradient(180deg, #f8fafc 0%, #f4f7fb 100%);
        color: var(--gray-800);
    }

    h1, h2, h3, h4, h5, h6 {
        font-family: 'DM Sans', sans-serif;
        color: var(--gray-900) !important;
        letter-spacing: -0.02em;
        line-height: 1.2;
        margin-bottom: 0.25rem;
    }

    label {
        font-family: 'DM Sans', sans-serif;
        color: var(--gray-700) !important;
        font-weight: 600 !important;
        font-size: 0.875rem !important;
    }

    p, span, div {
        color: var(--gray-700);
    }

    .block-container {
        padding: 1.8rem 2.2rem 2.8rem !important;
        max-width: 1380px !important;
    }

    /* HIDE CHROME */
    #MainMenu, footer, header {
        display: none !important;
    }

    [data-testid="stSidebarNav"],
    section[data-testid="stSidebarNav"] {
        display: none !important;
    }

    /* MAIN CONTAINERS */
    div[data-testid="stVerticalBlockBorderWrapper"] {
        background: var(--gray-0) !important;
        border: 1px solid var(--gray-200) !important;
        border-radius: var(--r-lg) !important;
        box-shadow: var(--shadow-sm) !important;
    }

    /* BUTTONS */
    .stButton > button {
        font-family: 'DM Sans', sans-serif !important;
        font-weight: 600 !important;
        font-size: 0.875rem !important;
        border-radius: var(--r-md) !important;
        padding: 0.58rem 1.15rem !important;
        transition: all 0.16s ease !important;
        cursor: pointer !important;
        letter-spacing: -0.01em !important;
    }

    .stButton > button[kind="primary"] {
        background: var(--brand-600) !important;
        color: #ffffff !important;
        border: 1px solid var(--brand-700) !important;
        box-shadow: 0 2px 8px rgba(37,99,235,0.18) !important;
    }

    .stButton > button[kind="primary"]:hover {
        background: var(--brand-700) !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 6px 14px rgba(37,99,235,0.20) !important;
    }

    .stButton > button:not([kind="primary"]) {
        background: #ffffff !important;
        color: var(--gray-700) !important;
        border: 1px solid var(--gray-200) !important;
        box-shadow: none !important;
    }

    .stButton > button:not([kind="primary"]):hover {
        background: var(--gray-50) !important;
        border-color: var(--gray-300) !important;
    }

    /* INPUTS */
    .stTextInput input,
    .stNumberInput input,
    .stTextArea textarea {
        font-family: 'DM Sans', sans-serif !important;
        background: #ffffff !important;
        color: var(--gray-800) !important;
        border: 1px solid var(--gray-200) !important;
        border-radius: var(--r-md) !important;
        font-size: 0.9rem !important;
    }

    .stTextInput input:focus,
    .stNumberInput input:focus,
    .stTextArea textarea:focus {
        border-color: var(--brand-500) !important;
        box-shadow: 0 0 0 3px rgba(59,130,246,0.10) !important;
    }

    ::placeholder {
        color: var(--gray-400) !important;
    }

    /* SELECT */
    div[data-baseweb="select"] > div {
        background: #ffffff !important;
        border: 1px solid var(--gray-200) !important;
        border-radius: var(--r-md) !important;
        font-family: 'DM Sans', sans-serif !important;
        font-size: 0.9rem !important;
        color: var(--gray-800) !important;
        min-height: 42px !important;
    }

    div[data-baseweb="select"] > div:focus-within {
        border-color: var(--brand-500) !important;
        box-shadow: 0 0 0 3px rgba(59,130,246,0.10) !important;
    }

    /* SIDEBAR LIGHT */
    section[data-testid="stSidebar"] {
        background: #ffffff !important;
        border-right: 1px solid #e2e8f0 !important;
        padding-top: 0 !important;
    }

    section[data-testid="stSidebar"] > div:first-child {
        padding-top: 0 !important;
    }

    section[data-testid="stSidebar"] * {
        color: #334155 !important;
    }

    /* CARDS */
    .card, .stCard {
        background: #ffffff;
        border: 1px solid var(--gray-200);
        border-radius: var(--r-lg);
        padding: 1.2rem 1.4rem;
        box-shadow: var(--shadow-sm);
        margin-bottom: 0.75rem;
    }

    .card-elevated {
        background: #ffffff;
        border: 1px solid var(--gray-200);
        border-radius: var(--r-xl);
        padding: 1.45rem;
        box-shadow: var(--shadow-md);
    }

    /* KPI CARD */
    .kpi-card {
        background: #ffffff;
        border: 1px solid var(--gray-200);
        border-radius: var(--r-lg);
        padding: 1.2rem 1.4rem;
        box-shadow: var(--shadow-sm);
        position: relative;
        overflow: hidden;
    }

    .kpi-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--brand-600), var(--brand-200));
        border-radius: 3px 3px 0 0;
    }

    .kpi-label {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--gray-500);
        margin-bottom: 0.4rem;
    }

    .kpi-value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--gray-900);
        line-height: 1;
        letter-spacing: -0.03em;
    }

    .kpi-sub {
        font-size: 0.78rem;
        color: var(--gray-500);
        margin-top: 0.35rem;
    }

    /* BADGES */
    .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.2rem 0.65rem;
        border-radius: 9999px;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .badge-success { background: var(--success-bg); color: var(--success-text); border: 1px solid var(--success-border); }
    .badge-warning { background: var(--warning-bg); color: var(--warning-text); border: 1px solid var(--warning-border); }
    .badge-error   { background: var(--error-bg); color: var(--error-text); border: 1px solid var(--error-border); }
    .badge-info    { background: var(--info-bg); color: var(--info-text); border: 1px solid var(--info-border); }
    .badge-gray    { background: var(--gray-100); color: var(--gray-600); border: 1px solid var(--gray-200); }

    /* STATUS DOT */
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .status-ok      { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.18); }
    .status-warning { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.18); }
    .status-error   { background: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.18); }
    .status-info    { background: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.18); }

    /* DATAFRAME */
    [data-testid="stDataFrame"] {
        border: 1px solid var(--gray-200);
        border-radius: var(--r-lg);
        overflow: hidden;
        background: #ffffff;
    }

    .dataframe {
        width: 100% !important;
        border: 1px solid var(--gray-200) !important;
        border-radius: var(--r-lg) !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        overflow: hidden !important;
        font-size: 0.875rem !important;
        font-family: 'DM Sans', sans-serif !important;
    }

    .dataframe thead tr th {
        background: var(--gray-50) !important;
        color: var(--gray-600) !important;
        font-weight: 600 !important;
        font-size: 0.75rem !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
        padding: 0.75rem 1rem !important;
        border-bottom: 1px solid var(--gray-200) !important;
    }

    .dataframe tbody tr td {
        color: var(--gray-700) !important;
        padding: 0.75rem 1rem !important;
        border-bottom: 1px solid var(--gray-100) !important;
    }

    .dataframe tbody tr:hover td {
        background: var(--gray-50) !important;
    }

    /* PAGE HEADER */
    .page-header {
        margin-bottom: 2rem;
        padding-bottom: 1.25rem;
        border-bottom: 1px solid var(--gray-200);
    }

    .page-title {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--gray-900);
        letter-spacing: -0.03em;
        line-height: 1.2;
        margin: 0;
    }

    .page-subtitle {
        font-size: 0.92rem;
        color: var(--gray-500);
        margin-top: 0.3rem;
        font-weight: 400;
    }

    /* TABS */
    .stTabs [data-baseweb="tab-list"] {
        background: var(--gray-100) !important;
        border-radius: var(--r-lg) !important;
        padding: 4px !important;
        gap: 2px !important;
        border: none !important;
    }

    .stTabs [data-baseweb="tab"] {
        border-radius: var(--r-md) !important;
        font-weight: 600 !important;
        font-size: 0.875rem !important;
        color: var(--gray-600) !important;
        background: transparent !important;
        border: none !important;
        padding: 0.45rem 1rem !important;
        transition: all 0.15s !important;
    }

    .stTabs [aria-selected="true"] {
        background: #ffffff !important;
        color: var(--gray-900) !important;
        box-shadow: var(--shadow-sm) !important;
    }

    /* METRIC */
    [data-testid="metric-container"] {
        background: #ffffff;
        border: 1px solid var(--gray-200);
        border-radius: var(--r-lg);
        padding: 1rem 1.25rem;
        box-shadow: var(--shadow-sm);
    }

    [data-testid="metric-container"] label {
        font-size: 0.72rem !important;
        font-weight: 700 !important;
        letter-spacing: 0.06em !important;
        text-transform: uppercase !important;
        color: var(--gray-500) !important;
    }

    [data-testid="stMetricValue"] {
        font-size: 1.75rem !important;
        font-weight: 700 !important;
        color: var(--gray-900) !important;
        letter-spacing: -0.03em !important;
    }

    /* ALERT / INFO BOXES */
    [data-testid="stAlert"] {
        border-radius: 14px !important;
    }

    /* SCROLLBAR */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--gray-100); border-radius: 3px; }
    ::-webkit-scrollbar-thumb { background: var(--gray-300); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--gray-400); }

    /* DROPDOWN */
    div[data-baseweb="popover"],
    div[data-baseweb="popover"] * {
        background: #ffffff !important;
        color: #0f172a !important;
    }

    div[data-baseweb="menu"] {
        background: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 10px !important;
        box-shadow: 0 4px 16px rgba(15,23,42,0.10) !important;
    }

    div[data-baseweb="menu"] ul {
        background: #ffffff !important;
        padding: 4px !important;
    }

    div[data-baseweb="menu"] li {
        background: #ffffff !important;
        color: #334155 !important;
        border-radius: 6px !important;
        font-size: 0.875rem !important;
        padding: 0.45rem 0.75rem !important;
    }

    div[data-baseweb="menu"] li:hover,
    div[data-baseweb="menu"] li[aria-selected="true"] {
        background: #f1f5f9 !important;
        color: #0f172a !important;
    }

    div[data-baseweb="menu"] li[data-highlighted="true"] {
        background: #eff6ff !important;
        color: #1d4ed8 !important;
    }

    /* LOGIN PAGE */
    .login-wrap {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f0f4ff 0%, #f8fafc 60%, #e8f4fd 100%);
    }

    .login-card {
        background: #ffffff;
        border: 1px solid var(--gray-200);
        border-radius: var(--r-xl);
        padding: 2.5rem;
        box-shadow: var(--shadow-lg);
        width: 100%;
        max-width: 420px;
    }

    /* MONO */
    code, .mono {
        font-family: 'DM Mono', monospace;
        background: var(--gray-100);
        border-radius: 4px;
        padding: 0.1em 0.4em;
        font-size: 0.8em;
        color: var(--gray-700);
    }
    </style>
    """, unsafe_allow_html=True)


def hide_sidebar():
    st.markdown("""
    <style>
    section[data-testid="stSidebar"] { display: none !important; }
    div[data-testid="stAppViewContainer"] { margin-left: 0 !important; }
    </style>
    """, unsafe_allow_html=True)


def role_badge(role: str) -> str:
    badges = {
        "super_admin": ("badge-error", "Super Admin"),
        "admin": ("badge-warning", "Admin"),
        "db_admin": ("badge-warning", "DB Admin"),
        "consultant": ("badge-info", "Consultant"),
        "user": ("badge-success", "Utilisateur"),
    }
    cls, label = badges.get((role or "").lower(), ("badge-gray", role or "—"))
    return f'<span class="badge {cls}">{label}</span>'


def get_status_indicator(status: str) -> str:
    s = (status or "").lower()
    if s in ("ok", "up", "online", "active"):
        return "status-ok"
    if s in ("warning", "warn"):
        return "status-warning"
    if s in ("critical", "down", "error"):
        return "status-error"
    return "status-info"


def get_badge(kind: str) -> str:
    k = (kind or "").lower()
    if k in ("success", "ok", "up", "active"):
        return "badge-success"
    if k in ("warning", "warn", "beta"):
        return "badge-warning"
    if k in ("error", "critical", "inactive"):
        return "badge-error"
    return "badge-info"