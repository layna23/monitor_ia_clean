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

      // 👉 BOUTON PREFECT
      {
        label: "Prefect UI",
        path: "http://127.0.0.1:4200",
        external: true,
      },
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
              // 🔵 LIEN EXTERNE (PREFECT)
              if (item.external) {
                return (
                  <a
                    key={item.label}
                    href={item.path}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.prefectLink}
                  >
                    <span>{item.label}</span>
                    <span style={styles.prefectBadge}>Ouvrir</span>
                  </a>
                );
              }

              // 🔵 LIEN NORMAL
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
    display: "flex",
    flexDirection: "column",
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
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  logoTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#0f172a",
  },

  logoSub: {
    fontSize: 11,
    color: "#94a3b8",
  },

  divider: {
    borderTop: "1px solid #e2e8f0",
    marginBottom: 10,
  },

  nav: {
    flex: 1,
  },

  groupLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#94a3b8",
    padding: "10px 10px 6px",
  },

  groupDivider: {
    borderTop: "1px solid #f1f5f9",
    margin: "6px 0",
  },

  link: {
    display: "flex",
    padding: "10px",
    borderRadius: 10,
    color: "#475569",
    textDecoration: "none",
  },

  activeLink: {
    background: "#eff6ff",
    color: "#2563eb",
    fontWeight: 700,
  },

  // 🔥 STYLE PREFECT
  prefectLink: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px",
    borderRadius: 12,
    marginTop: 6,
    background: "#eef4ff",
    border: "1px solid #dbeafe",
    color: "#1e3a8a",
    textDecoration: "none",
    fontWeight: 600,
  },

  prefectBadge: {
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 999,
    background: "#fff",
    border: "1px solid #cbd5e1",
    color: "#334155",
  },

  footer: {
    marginTop: "auto",
  },

  logoutBtn: {
    width: "100%",
    padding: "10px",
    border: "none",
    background: "none",
    color: "#ef4444",
    cursor: "pointer",
  },
};