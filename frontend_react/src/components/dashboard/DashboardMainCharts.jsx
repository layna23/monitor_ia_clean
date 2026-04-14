import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { SectionCard, FieldLabel, InfoBox } from "./DashboardCommon";

function CustomMainChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div style={styles.tooltipBox}>
      <div style={styles.tooltipLabel}>{label || "-"}</div>

      {payload.map((entry, index) => (
        <div key={`${entry.dataKey}-${index}`} style={styles.tooltipRow}>
          <span
            style={{
              ...styles.tooltipDot,
              background: entry.color || entry.stroke || "#334155",
            }}
          />
          <span style={{ color: entry.color || entry.stroke || "#334155" }}>
            {entry.name} : <strong>{entry.value ?? "-"}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardMainCharts({
  selectedDbIsMysql = false,
  allMetrics = [],
  selectedMetric = "",
  setSelectedMetric = () => {},
  mainLineData = [],
  mainChartLines = [],
  hasEnoughMainChartPoints = false,
  chartTitle = "",
  prettifyMetricLabel = (x) => x,
  combinedOracleMetricKey = "__SESSIONS_COMPARISON__",
}) {
  const isCombinedOracleMetric = selectedMetric === combinedOracleMetricKey;

  return (
    <SectionCard>
      <div style={styles.cardTitle}>
        {selectedDbIsMysql
          ? "Évolution des métriques MySQL collectées"
          : "Évolution des métriques Oracle collectées"}
      </div>

      {allMetrics.length ? (
        <>
          <FieldLabel text="Métriques à afficher" />

          <div style={styles.multiSelectBox}>
            {allMetrics.map((option) => {
              const active = selectedMetric === option;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSelectedMetric(option)}
                  style={{
                    ...styles.multiOption,
                    ...(active ? styles.multiOptionActive : {}),
                  }}
                >
                  {option === combinedOracleMetricKey
                    ? "ACTIVE_SESSIONS + SESSION_COUNT"
                    : prettifyMetricLabel(option)}
                </button>
              );
            })}
          </div>

          <div style={{ width: "100%", height: 380, marginTop: 12 }}>
            {!selectedMetric ? (
              <InfoBox text="Sélectionnez une métrique." />
            ) : !mainLineData.length ? (
              <InfoBox text="Aucune donnée disponible pour les filtres choisis." />
            ) : !hasEnoughMainChartPoints ? (
              <InfoBox text="Pas assez de points collectés pour afficher une tendance." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={mainLineData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    stroke="#94a3b8"
                    minTickGap={26}
                  />

                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    stroke="#94a3b8"
                    width={42}
                    allowDecimals={false}
                  />

                  <Tooltip content={<CustomMainChartTooltip />} />

                  <Legend
                    wrapperStyle={{
                      fontSize: 12,
                      color: "#334155",
                      paddingTop: 10,
                    }}
                  />

                  {mainChartLines.map((line) => {
                    const isActiveSessions = line.key === "ACTIVE_SESSIONS";
                    const isSessionCount = line.key === "SESSION_COUNT";

                    return (
                      <Line
                        key={line.key}
                        type="monotone"
                        dataKey={line.key}
                        name={line.name}
                        stroke={line.stroke}
                        strokeWidth={2.8}
                        dot={isCombinedOracleMetric ? false : { r: 3 }}
                        activeDot={{ r: isActiveSessions ? 5 : 4 }}
                        connectNulls
                        strokeDasharray={isSessionCount ? "6 4" : line.strokeDasharray || "0"}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={styles.chartCaption}>
            Métrique affichée : <strong>{chartTitle || "-"}</strong>
          </div>
        </>
      ) : (
        <InfoBox text="Aucune donnée disponible." />
      )}
    </SectionCard>
  );
}

const styles = {
  cardTitle: {
    fontSize: "0.8rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "#64748b",
    marginBottom: "0.75rem",
  },
  chartCaption: {
    marginTop: 8,
    fontSize: 13,
    color: "#475569",
  },
  multiSelectBox: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  multiOption: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    borderRadius: 999,
    padding: "0.4rem 0.7rem",
    fontSize: 13,
    cursor: "pointer",
  },
  multiOptionActive: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontWeight: 700,
  },
  tooltipBox: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    fontSize: 12,
    boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
    padding: "10px 12px",
  },
  tooltipLabel: {
    marginBottom: 8,
    color: "#475569",
    fontWeight: 700,
  },
  tooltipRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  tooltipDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
};