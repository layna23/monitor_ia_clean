import { NavLink } from "react-router-dom";

const menuGroups = [
  {
    group: null,
    items: [{ label: "Accueil", path: "/accueil" }],
  },
  {
    group: "PARAMÉTRAGE",
    items: [
      { label: "Types de bases", path: "/db-types" },
      { label: "Configuration des bases", path: "/config-bd" },
      { label: "Configuration des métriques", path: "/configuration-metriques" },
      { label: "Test connexion DB", path: "/test-db" },
    ],
  },
  {
    group: "MONITORING",
    items: [
      { label: "Dashboard", path: "/dashboard" },
      { label: "Vue globale des bases", path: "/vue-globale-bd" },
      { label: "Alertes", path: "/alertes" },
      { label: "Analyseur SQL", path: "/analyseur-sql" },
      { label: "Diagnostic IA", path: null, soon: true },
    ],
  },
  {
    group: "UTILISATEURS",
    items: [
      { label: "Rôles", path: "/roles" },
      { label: "Utilisateurs", path: "/utilisateurs" },
    ],
  },
];

export default function BarreLaterale() {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.logoWrap}>
        <div style={styles.logoBadge}>DB</div>
        <div>
          <div style={styles.logoTitle}>DB Monitor</div>
          <div style={styles.logoSub}>Monitoring IA</div>
        </div>
      </div>

      <div style={styles.divider} />

      <nav style={styles.nav}>
        {menuGroups.map((group, gi) => (
          <div key={gi} style={styles.groupBlock}>
            {group.group && <div style={styles.groupLabel}>{group.group}</div>}

            {group.items.map((item) => {
              if (item.soon) {
                return (
                  <div key={item.label} style={styles.soonLink}>
                    <span style={styles.linkLabel}>{item.label}</span>
                    <span style={styles.soonBadge}>Bientôt</span>
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={({ isActive }) => ({
                    ...styles.link,
                    ...(isActive ? styles.activeLink : {}),
                  })}
                >
                  {item.label}
                </NavLink>
              );
            })}

            {gi < menuGroups.length - 1 && <div style={styles.groupDivider} />}
          </div>
        ))}
      </nav>

      <div style={styles.footer}>
        <div style={styles.divider} />
        <button style={styles.logoutBtn}>Déconnexion</button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 260,
    minHeight: "100vh",
    background: "#ffffff",
    borderRight: "1px solid #e2e8f0",
    padding: "20px 14px 16px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "4px 8px 16px",
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "#2563eb",
    color: "#fff",
    fontSize: 13,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    letterSpacing: "-0.02em",
  },
  logoTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  logoSub: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 600,
    marginTop: 1,
  },
  divider: {
    borderTop: "1px solid #e2e8f0",
    marginBottom: 10,
  },
  nav: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },
  groupBlock: {
    display: "flex",
    flexDirection: "column",
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "10px 10px 6px",
  },
  groupDivider: {
    borderTop: "1px solid #f1f5f9",
    margin: "6px 0",
  },
  link: {
    display: "flex",
    alignItems: "center",
    color: "#475569",
    textDecoration: "none",
    padding: "9px 10px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
  },
  activeLink: {
    background: "#eff6ff",
    color: "#2563eb",
    fontWeight: 700,
  },
  soonLink: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "#94a3b8",
    padding: "9px 10px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    cursor: "default",
  },
  linkLabel: {
    flex: 1,
  },
  soonBadge: {
    background: "#f1f5f9",
    color: "#94a3b8",
    border: "1px solid #e2e8f0",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 8px",
    flexShrink: 0,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 4,
  },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    background: "none",
    border: "none",
    padding: "9px 10px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    color: "#ef4444",
    cursor: "pointer",
    textAlign: "left",
  },
};