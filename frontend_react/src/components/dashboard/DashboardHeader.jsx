export default function DashboardHeader({ message }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.title}>Tableau de bord des bases de données</div>
      <div style={styles.subtitle}>
        Visualisation des métriques, alertes et performances des bases surveillées
      </div>

      {message?.text ? (
        <div style={{ marginTop: 12 }}>
          <div style={styles.errorBox}>{message.text}</div>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  wrapper: {
    marginBottom: 22,
  },
  title: {
    fontSize: 30,
    fontWeight: 900,
    marginBottom: 6,
    letterSpacing: "-0.02em",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: 12,
    padding: "1rem 1.1rem",
    color: "#9f1239",
    fontWeight: 800,
  },
};