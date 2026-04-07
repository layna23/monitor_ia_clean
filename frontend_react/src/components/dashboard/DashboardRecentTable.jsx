import { SectionCard } from "./DashboardCommon";

export default function DashboardRecentTable({ recentRows, prettifyMetricLabel }) {
  return (
    <SectionCard>
      <div style={styles.title}>Dernières valeurs collectées</div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Métrique</th>
            <th style={styles.th}>Valeur</th>
            <th style={styles.th}>Date</th>
          </tr>
        </thead>

        <tbody>
          {recentRows.length === 0 ? (
            <tr>
              <td colSpan="3" style={styles.empty}>
                Aucune donnée
              </td>
            </tr>
          ) : (
            recentRows.map((row, index) => (
              <tr key={index} style={styles.tr}>
                <td style={styles.td}>
                  {prettifyMetricLabel
                    ? prettifyMetricLabel(row.metric_code)
                    : row.metric_code}
                </td>

                <td style={styles.tdValue}>{row.value}</td>

                <td style={styles.tdDate}>{row.date}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </SectionCard>
  );
}

const styles = {
  title: {
    fontSize: "0.9rem",
    fontWeight: 800,
    marginBottom: "10px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "10px",
    borderBottom: "2px solid #e2e8f0",
    fontSize: "0.8rem",
    color: "#64748b",
    textTransform: "uppercase",
  },

  td: {
    padding: "10px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: "0.85rem",
  },

  tdValue: {
    padding: "10px",
    borderBottom: "1px solid #e2e8f0",
    fontWeight: 700,
  },

  tdDate: {
    padding: "10px",
    borderBottom: "1px solid #e2e8f0",
    color: "#64748b",
  },

  tr: {
    transition: "0.2s",
  },

  empty: {
    textAlign: "center",
    padding: "20px",
    color: "#94a3b8",
  },
};