import { useMemo, useState, useEffect } from "react";
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

function cleanLabel(label) {
  if (!label) return "";
  return String(label).replace(/\s*\(.*?\)\s*/g, "").trim();
}

function normalizeMetricCode(metricCode) {
  return String(metricCode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function getMetricCategory(metricCode) {
  const code = normalizeMetricCode(metricCode);

  if (
    [
      "CPU_USAGE",
      "CPU_USED_SESSION",
      "THREADS_RUNNING",
      "QUESTIONS",
      "SLOW_QUERIES",
      "INSTANCE_UPTIME_HOURS",
      "UPTIME",
    ].includes(code)
  ) {
    return "Performance";
  }

  if (
    [
      "ACTIVE_SESSIONS",
      "SESSION_COUNT",
      "TOTAL_SESSIONS",
      "THREADS_CONNECTED",
    ].includes(code)
  ) {
    return "Sessions";
  }

  if (["ACTIVE_TRANSACTIONS", "LOCKED_OBJECTS"].includes(code)) {
    return "Transactions";
  }

  if (
    [
      "RAM_USAGE",
      "MEMORY_USAGE",
      "SGA_USAGE",
      "PGA_USAGE",
      "RATIO_DES_TRIS_EN_MEMOIRE",
      "SORTS_MEMORY_RATIO",
    ].includes(code)
  ) {
    return "Mémoire";
  }

  return null;
}

export default function DashboardCurrentValues({
  selectedDbIsMysql,
  selectedDbName,
  latestMetricValuesChart,
  prettifyMetricLabel,
}) {
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const cleanedData = useMemo(() => {
    return (latestMetricValuesChart || [])
      .map((item) => {
        const category = getMetricCategory(item.metric_code);

        return {
          ...item,
          metric_code_normalized: normalizeMetricCode(item.metric_code),
          clean_label: cleanLabel(item.full_label),
          category,
          value_number_num: Number(item.value_number),
        };
      })
      .filter((item) => item.category !== null)
      .filter((item) => Number.isFinite(item.value_number_num));
  }, [latestMetricValuesChart]);

  const availableCategories = useMemo(() => {
    const ordered = ["Performance", "Sessions", "Transactions", "Mémoire"];

    return ordered.filter((category) =>
      cleanedData.some((item) => item.category === category)
    );
  }, [cleanedData]);

  useEffect(() => {
    if (selectedCategory === "ALL") return;

    const stillExists = availableCategories.includes(selectedCategory);
    if (!stillExists) {
      setSelectedCategory("ALL");
    }
  }, [availableCategories, selectedCategory]);

  const filteredData = useMemo(() => {
    if (selectedCategory === "ALL") return cleanedData;

    return cleanedData.filter((item) => item.category === selectedCategory);
  }, [cleanedData, selectedCategory]);

  return (
    <SectionCard>
      <div style={styles.headerRow}>
        <div style={styles.cardTitle}>
          {selectedDbIsMysql
            ? `Valeurs actuelles des métriques MySQL — ${selectedDbName}`
            : `Valeurs actuelles des métriques Oracle — ${selectedDbName}`}
        </div>

        <div style={styles.filterWrap}>
          <label style={styles.filterLabel}>Catégorie</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={styles.select}
          >
            <option value="ALL">Toutes</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredData.length ? (
        <div
          style={{
            width: "100%",
            height: Math.min(320, Math.max(120, filteredData.length * 45)),
          }}
        >
          <ResponsiveContainer>
            <BarChart
              data={filteredData}
              layout="vertical"
              margin={{ top: 8, right: 20, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#64748b" }}
                stroke="#94a3b8"
              />

              <YAxis
                dataKey="clean_label"
                type="category"
                width={180}
                interval={0}
                tick={{ fontSize: 11, fill: "#334155" }}
                stroke="#94a3b8"
              />

              <Tooltip
                formatter={(value, name, props) => [
                  value,
                  prettifyMetricLabel(
                    props?.payload?.metric_code || "Valeur actuelle"
                  ),
                ]}
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                }}
              />

              <Bar dataKey="value_number_num" radius={[0, 8, 8, 0]}>
                {filteredData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index % 2 === 0 ? C.blue : C.green}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <InfoBox text="Aucune métrique disponible pour cette catégorie." />
      )}
    </SectionCard>
  );
}

const styles = {
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "0.75rem",
  },
  cardTitle: {
    fontSize: "0.8rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "#64748b",
  },
  filterWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  filterLabel: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#334155",
  },
  select: {
    padding: "8px 12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: "13px",
    color: "#0f172a",
    minWidth: "170px",
  },
};