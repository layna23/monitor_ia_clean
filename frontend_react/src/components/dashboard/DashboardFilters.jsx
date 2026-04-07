export default function DashboardFilters({
  allowedDbs,
  selectedDbId,
  setSelectedDbId,
  selectedPeriod,
  setSelectedPeriod,
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>FILTRES</div>

      <div style={styles.label}>Base surveillée</div>
      <div style={styles.dbList}>
        {allowedDbs.map((db) => {
          const active = String(selectedDbId) === String(db.db_id);

          return (
            <button
              key={db.db_id}
              type="button"
              onClick={() => setSelectedDbId(String(db.db_id))}
              style={{
                ...styles.dbButton,
                ...(active ? styles.dbButtonActive : {}),
              }}
            >
              {db.db_name}
            </button>
          );
        })}
      </div>

      <div style={{ height: 14 }} />

      <div style={styles.label}>Période</div>
      <div style={styles.periodList}>
        {[
          { key: "24h", label: "24 h" },
          { key: "7j", label: "7 jours" },
          { key: "30j", label: "30 jours" },
          { key: "all", label: "Tout" },
        ].map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setSelectedPeriod(p.key)}
            style={{
              ...styles.periodButton,
              ...(selectedPeriod === p.key ? styles.periodButtonActive : {}),
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  card: {
    width: 320,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  },
  cardTitle: {
    fontSize: "0.8rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "#64748b",
    marginBottom: "0.75rem",
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 8,
  },
  dbList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  dbButton: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    borderRadius: 12,
    padding: "0.95rem 1rem",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
  },
  dbButtonActive: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    boxShadow: "0 0 0 1px rgba(59,130,246,0.08) inset",
  },
  periodList: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  periodButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    borderRadius: 999,
    padding: "0.45rem 0.8rem",
    fontSize: 13,
    cursor: "pointer",
  },
  periodButtonActive: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontWeight: 700,
  },
};