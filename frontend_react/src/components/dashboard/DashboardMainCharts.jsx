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
                  />

                  <Tooltip
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                    }}
                  />

                  <Legend
                    wrapperStyle={{
                      fontSize: 12,
                      color: "#334155",
                      paddingTop: 10,
                    }}
                  />

                  {mainChartLines.map((line) => (
                    <Line
                      key={line.key}
                      type="monotone"
                      dataKey={line.key}
                      name={line.name}
                      stroke={line.stroke}
                      strokeWidth={2.8}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls
                      strokeDasharray={line.strokeDasharray || "0"}
                    />
                  ))}
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
};