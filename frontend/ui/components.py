import streamlit as st
from ui.style import get_status_indicator, get_badge


def render_kpi_card(title, value, subtitle=None, col=None, accent_color="#0057FF", icon=None):
    icon_html = f'<div style="font-size:1.5rem; margin-bottom:0.5rem;">{icon}</div>' if icon else ''
    card_html = f"""
    <div class="kpi-card" style="--kpi-accent:{accent_color};">
        <div style="
            position:absolute; top:0; left:0; right:0; height:3px;
            background: linear-gradient(90deg, {accent_color} 0%, {accent_color}99 100%);
            border-radius:14px 14px 0 0;
        "></div>
        {icon_html}
        <div class="kpi-label">{title}</div>
        <div class="kpi-value">{value}</div>
        {f'<div class="kpi-sub">{subtitle}</div>' if subtitle else ''}
    </div>
    """
    if col:
        with col:
            st.markdown(card_html, unsafe_allow_html=True)
    else:
        st.markdown(card_html, unsafe_allow_html=True)


def render_db_status(db_name, db_type, status, metrics=None):
    indicator_class = get_status_indicator(status)
    status_labels = {
        "up":      ("En ligne",   "#00875A", "#E3FCEF"),
        "down":    ("Hors ligne", "#C0392B", "#FEE2E2"),
        "warning": ("Attention",  "#B45309", "#FEF3C7"),
    }
    label, color, bg = status_labels.get((status or "").lower(), (status, "#718096", "#EDF2F7"))

    dot_colors = {
        "status-ok":      "#00875A",
        "status-warning": "#F59E0B",
        "status-error":   "#C0392B",
        "status-info":    "#1A56DB",
    }
    dot_color = dot_colors.get(indicator_class, "#A0AEC0")

    html = f"""
    <div style="
        background:#FFFFFF; border:1px solid #EDF2F7; border-radius:10px;
        padding:0.85rem 1rem; margin-bottom:0.5rem;
        display:flex; justify-content:space-between; align-items:center;
        box-shadow:0 1px 3px rgba(10,14,26,.05);
    ">
        <div style="display:flex; align-items:center; gap:10px;">
            <div style="
                width:9px; height:9px; border-radius:50%; flex-shrink:0;
                background:{dot_color};
                box-shadow:0 0 0 3px {dot_color}22;
            "></div>
            <div>
                <div style="font-weight:600; font-size:0.875rem; color:#0A0E1A;">{db_name}</div>
                <div style="font-size:0.75rem; color:#A0AEC0; margin-top:1px;">{db_type}</div>
            </div>
        </div>
        <div style="
            font-size:0.75rem; font-weight:600;
            color:{color}; background:{bg};
            padding:0.2rem 0.6rem; border-radius:999px;
        ">
            {metrics if metrics else label}
        </div>
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)


def render_alert(level, title, message, time=None):
    level_map = {
        "critical": ("#C0392B", "#FEE2E2", "CRITIQUE", "critical"),
        "warning":  ("#B45309", "#FEF3C7", "WARNING",  "warning"),
        "info":     ("#1A56DB", "#EBF5FF", "INFO",     "info"),
        "success":  ("#00875A", "#E3FCEF", "OK",       ""),
    }
    color, bg, badge_text, css_class = level_map.get(
        (level or "").lower(),
        ("#718096", "#EDF2F7", level.upper(), "")
    )

    html = f"""
    <div class="alert-card {css_class}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
            <div style="font-weight:600; font-size:0.875rem; color:#0A0E1A; line-height:1.3;">{title}</div>
            <span style="
                font-size:0.65rem; font-weight:700; letter-spacing:0.05em;
                color:{color}; background:{bg};
                padding:0.2rem 0.55rem; border-radius:999px;
                white-space:nowrap; flex-shrink:0;
            ">{badge_text}</span>
        </div>
        <div style="color:#718096; font-size:0.82rem; margin-top:0.35rem; line-height:1.4;">{message}</div>
        {f'<div style="color:#A0AEC0; font-size:0.75rem; margin-top:0.4rem;">{time}</div>' if time else ''}
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)


def render_db_type_card(db: dict, col=None):
    status = (db.get("status") or "").upper()
    if   status == "ACTIVE":   badge = '<span class="badge badge-success">ACTIF</span>'
    elif status == "BETA":     badge = '<span class="badge badge-warning">BETA</span>'
    elif status in ("INACTIVE","DISABLED"): badge = '<span class="badge badge-error">INACTIF</span>'
    else: badge = f'<span class="badge badge-info">{status or "—"}</span>'

    html = (
        f'<div class="stCard">'
        f'  <div class="dbTypeHeader">'
        f'    <div>'
        f'      <div class="dbTypeTitle">{db.get("name") or "-"}</div>'
        f'      <div class="dbTypeSub">Code: <b>{db.get("code") or "-"}</b> · ID: {db.get("db_type_id") or "-"}</div>'
        f'    </div>'
        f'    <div>{badge}</div>'
        f'  </div>'
        f'  <div class="dbTypeGrid">'
        f'    <div class="dbTypeBox">'
        f'      <div class="dbTypeLabel">VERSION</div>'
        f'      <div class="dbTypeValue">{db.get("version") or "-"}</div>'
        f'    </div>'
        f'    <div class="dbTypeBox">'
        f'      <div class="dbTypeLabel">DRIVER</div>'
        f'      <div class="dbTypeValue">{db.get("driver") or "-"}</div>'
        f'    </div>'
        f'  </div>'
        f'  <div class="dbTypeDesc">{db.get("description") or "Aucune description"}</div>'
        f'</div>'
    )
    if col:
        with col:
            st.markdown(html, unsafe_allow_html=True)
    else:
        st.markdown(html, unsafe_allow_html=True)


def render_section_card(title: str, subtitle: str = None):
    """Renders an inline card header (open div — must close with st.markdown('</div>', unsafe_allow_html=True))"""
    st.markdown(f"""
    <div class="stCard">
        <div style="margin-bottom:1rem;">
            <div style="font-weight:700; font-size:1rem; color:#0A0E1A;">{title}</div>
            {f'<div style="color:#A0AEC0; font-size:0.82rem; margin-top:0.2rem;">{subtitle}</div>' if subtitle else ''}
        </div>
        <div style="border-top:1px solid #EDF2F7; margin-bottom:1rem;"></div>
    """, unsafe_allow_html=True)


def render_empty_state(icon: str, message: str, hint: str = None):
    st.markdown(f"""
    <div style="
        text-align:center; padding:3rem 1rem;
        background:#F7FAFC; border:1px dashed #CBD5E0;
        border-radius:12px;
    ">
        <div style="font-size:2.5rem; margin-bottom:0.75rem;">{icon}</div>
        <div style="font-weight:600; color:#4A5568; font-size:0.95rem;">{message}</div>
        {f'<div style="color:#A0AEC0; font-size:0.82rem; margin-top:0.4rem;">{hint}</div>' if hint else ''}
    </div>
    """, unsafe_allow_html=True)