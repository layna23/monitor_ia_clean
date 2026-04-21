export default function DashboardFilters({
  allowedDbs,
  selectedDbId,
  setSelectedDbId,
  selectedPeriod,
  setSelectedPeriod,
  allMetrics = [],
  selectedMetric,
  setSelectedMetric,
  prettifyMetricLabel,
  combinedOracleMetricKey,
  selectedDbIsOracle,
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>FILTRES</div>

      <div style={styles.label}>Base surveillée</div>
      <select
        value={selectedDbId}
        onChange={(e) => setSelectedDbId(e.target.value)}
        style={styles.select}
      >
        {allowedDbs.map((db) => (
          <option key={db.db_id} value={String(db.db_id)}>
            {db.db_name} | {db.host}:{db.port}
          </option>
        ))}
      </select>

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

      <div style={{ height: 14 }} />

      <div style={styles.label}>Métrique affichée</div>
      <select
        value={selectedMetric || ""}
        onChange={(e) => setSelectedMetric(e.target.value)}
        style={styles.select}
      >
        {allMetrics.length === 0 ? (
          <option value="">Aucune métrique disponible</option>
        ) : (
          allMetrics.map((metric) => {
            const label =
              selectedDbIsOracle && metric === combinedOracleMetricKey
                ? "Sessions actives + nombre de sessions"
                : prettifyMetricLabel(metric);

            return (
              <option key={metric} value={metric}>
                {label}
              </option>
            );
          })
        )}
      </select>
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
  select: {
    width: "100%",
    padding: "0.95rem 1rem",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 16,
    color: "#0f172a",
    boxSizing: "border-box",
    outline: "none",
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