import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { SectionCard, InfoBox } from "./DashboardCommon";

const C = {
  blue: "#3b82f6",
  green: "#10b981",
};

export default function DashboardCurrentValues({
  selectedDbIsMysql,
  selectedDbName,
  latestMetricValuesChart,
  prettifyMetricLabel,
}) {
  return (
    <SectionCard>
      <div style={styles.cardTitle}>
        {selectedDbIsMysql
          ? `Valeurs actuelles des métriques MySQL — ${selectedDbName}`
          : `Valeurs actuelles des métriques Oracle — ${selectedDbName}`}
      </div>

      {latestMetricValuesChart.length ? (
        <div style={{ width: "100%", height: 340 }}>
          <ResponsiveContainer>
            <BarChart
              data={latestMetricValuesChart}
              layout="vertical"
              margin={{ top: 8, right: 28, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#64748b" }}
                stroke="#94a3b8"
              />
              <YAxis
                dataKey="full_label"
                type="category"
                width={260}
                tick={{ fontSize: 11, fill: "#334155" }}
                stroke="#94a3b8"
              />
              <Tooltip
                formatter={(value, name, props) => [
                  value,
                  prettifyMetricLabel(props?.payload?.metric_code || "Valeur actuelle"),
                ]}
                labelFormatter={(label) => label}
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                }}
              />
              <Bar dataKey="value_number" radius={[0, 8, 8, 0]}>
                {latestMetricValuesChart.map((entry, index) => (
                  <Cell
                    key={`cell-current-${index}`}
                    fill={index === 0 ? C.blue : C.green}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <InfoBox text="Aucune valeur actuelle disponible." />
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
};