import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import api from "../api/client";

function CustomMetricTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload || {};

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        fontSize: 12,
        boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
        padding: 12,
        minWidth: 170,
      }}
    >
      <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
        {label || "-"}
      </div>

      <div style={{ color: "#ef4444", marginBottom: 8 }}>
        crit_threshold : {row.crit_threshold ?? "—"}
      </div>

      <div style={{ color: "#2563eb", marginBottom: 8 }}>
        value : {row.value ?? "—"}
      </div>

      <div style={{ color: "#f59e0b" }}>
        warn_threshold : {row.warn_threshold ?? "—"}
      </div>
    </div>
  );
}

function normalizeSeverity(value) {
  return String(value || "INFO").trim().toUpperCase();
}

function getMetricStatus(metric) {
  return normalizeSeverity(metric?.severity || "INFO");
}

function getMetricStatusStyle(status) {
  switch (normalizeSeverity(status)) {
    case "CRITICAL":
      return {
        bg: "#fff1f2",
        color: "#9f1239",
        border: "#fecdd3",
      };
    case "WARNING":
      return {
        bg: "#fffbeb",
        color: "#92400e",
        border: "#fde68a",
      };
    case "OK":
      return {
        bg: "#f0fdf4",
        color: "#166534",
        border: "#bbf7d0",
      };
    case "INFO":
      return {
        bg: "#eff6ff",
        color: "#1e40af",
        border: "#bfdbfe",
      };
    default:
      return {
        bg: "#f8fafc",
        color: "#475569",
        border: "#e2e8f0",
      };
  }
}

function CollapsibleSection({
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
}) {
  return (
    <div style={styles.sectionCard}>
      <div style={styles.sectionHeaderClickable} onClick={onToggle}>
        <div>
          <div style={styles.sectionTitle}>{title}</div>
          {subtitle ? <div style={styles.sectionSubtitle}>{subtitle}</div> : null}
        </div>
        <span style={styles.sectionChevron}>{isOpen ? "▾" : "▸"}</span>
      </div>
      {isOpen ? <div style={styles.sectionContent}>{children}</div> : null}
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div style={styles.infoCard}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value || "—"}</div>
    </div>
  );
}

function EmptyBox({ message }) {
  return <div style={styles.emptyBox}>{message}</div>;
}

function SingleMetricChartCard({ title, metric, chartData }) {
  const status = metric ? getMetricStatus(metric) : "INFO";
  const statusStyle = getMetricStatusStyle(status);

  return (
    <div style={styles.chartCard}>
      <div style={styles.chartTop}>
        <div style={styles.chartMetricTitle}>{title}</div>
        <span
          style={{
            ...styles.smallMetricBadge,
            background: statusStyle.bg,
            color: statusStyle.color,
            borderColor: statusStyle.border,
          }}
        >
          {metric ? status : "NON DISPONIBLE"}
        </span>
      </div>

      {!metric ? (
        <div style={styles.emptyBoxSmall}>Métrique non disponible</div>
      ) : chartData.length === 0 ? (
        <div style={styles.emptyBoxSmall}>Pas d&apos;historique</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe3ef" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b" }}
              stroke="#94a3b8"
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              stroke="#94a3b8"
              width={42}
            />
            <Tooltip
              cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
              content={(props) => <CustomMetricTooltip {...props} />}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
              activeDot={{ r: 7, strokeWidth: 2, fill: "#ffffff" }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="warn_threshold"
              stroke="#f59e0b"
              strokeWidth={1.5}
              dot={{ r: 3, strokeWidth: 2, fill: "#ffffff" }}
              activeDot={{ r: 6, strokeWidth: 2, fill: "#ffffff" }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="crit_threshold"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={{ r: 3, strokeWidth: 2, fill: "#ffffff" }}
              activeDot={{ r: 6, strokeWidth: 2, fill: "#ffffff" }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function DetailBase() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  const [openSections, setOpenSections] = useState({
    summary: true,
    metrics: true,
    charts: true,
  });

  useEffect(() => {
    if (!id) return;

    const fetchAll = async () => {
      setLoading(true);
      setError("");

      try {
        const [overviewRes, historyRes] = await Promise.all([
          api.get(`/target-dbs/${id}/overview`),
          api.get(`/target-dbs/${id}/metrics-history?limit=150`),
        ]);

        const overviewData = overviewRes?.data || null;
        const historyData = Array.isArray(historyRes?.data) ? historyRes.data : [];

        setOverview(overviewData);
        setHistory(historyData);
      } catch (err) {
        console.error(err);
        setError("Erreur lors du chargement du détail de la base.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [id]);

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const latestMetrics = useMemo(() => {
    return Array.isArray(overview?.latest_metrics) ? overview.latest_metrics : [];
  }, [overview]);

  const importantMetricOrder = [
    "ACTIVE_SESSIONS",
    "SESSION_COUNT",
    "ACTIVE_TRANSACTIONS",
    "LOCKED_OBJECTS",
    "TOTAL_SESSIONS",
    "INSTANCE_UPTIME_HOURS",
    "DB_STATUS",
    "DB_INFO",
    "CPU_USED_SESSION",
    "CPU_USED_BY_SESSION",
    "CPU_USAGE",
    "RAM_USAGE",
    "MEMORY_USAGE",
    "SGA_USAGE",
    "PGA_USAGE",
    "SESSION_UPTIME_HOURS",
    "THREADS_CONNECTED",
    "THREADS_RUNNING",
  ];

  const visibleMetrics = useMemo(() => {
    return [...latestMetrics];
  }, [latestMetrics]);

  const sortedMetrics = useMemo(() => {
    const score = (code) => {
      const normalized = String(code || "").toUpperCase();
      const mapped =
        normalized === "CPU_USED_BY_SESSION" ? "CPU_USED_SESSION" : normalized;
      const idx = importantMetricOrder.indexOf(mapped);
      return idx === -1 ? 999 : idx;
    };

    return [...visibleMetrics].sort((a, b) => {
      const aScore = score(a.metric_code);
      const bScore = score(b.metric_code);

      if (aScore !== bScore) return aScore - bScore;

      return String(a.metric_code || "").localeCompare(String(b.metric_code || ""));
    });
  }, [visibleMetrics]);

  const historyByMetric = useMemo(() => {
    const grouped = {};

    history.forEach((row) => {
      const code = String(row.metric_code || "").toUpperCase();
      if (!code) return;

      if (!grouped[code]) grouped[code] = [];

      grouped[code].push({
        label: row.collected_at
          ? new Date(row.collected_at).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-",
        value: row.value_number,
        warn_threshold: row.warn_threshold,
        crit_threshold: row.crit_threshold,
      });
    });

    return grouped;
  }, [history]);

  const chartMetrics = useMemo(() => {
    const excludedChartCodes = ["DB_STATUS", "DB_INFO"];

    return latestMetrics
      .filter((metric) => {
        const code = String(metric.metric_code || "").toUpperCase();

        if (excludedChartCodes.includes(code)) return false;

        const chartData = historyByMetric[code] || [];
        if (chartData.length === 0) return false;

        const hasNumericValues = chartData.some(
          (row) => row.value !== null && row.value !== undefined && !Number.isNaN(Number(row.value))
        );

        return hasNumericValues;
      })
      .sort((a, b) =>
        String(a.metric_code || "").localeCompare(String(b.metric_code || ""))
      );
  }, [latestMetrics, historyByMetric]);

  const dbStatusMetric = useMemo(() => {
    return latestMetrics.find(
      (m) => String(m.metric_code || "").toUpperCase() === "DB_STATUS"
    );
  }, [latestMetrics]);

  const dbStatus =
    Number(overview?.is_active || 0) === 1
      ? "ACTIVE"
      : String(dbStatusMetric?.value_text || "INACTIVE").toUpperCase();

  const dbStatusStyles =
    dbStatus === "ACTIVE" || dbStatus === "READ WRITE"
      ? {
          bg: "#f0fdf4",
          color: "#166534",
          border: "#bbf7d0",
          dot: "#22c55e",
        }
      : {
          bg: "#fff1f2",
          color: "#9f1239",
          border: "#fecdd3",
          dot: "#ef4444",
        };

  if (!id) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>ID base invalide.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <button onClick={() => navigate("/accueil")} style={styles.backBtn}>
          ← Retour
        </button>
        <div style={styles.loadingBox}>Chargement...</div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div style={styles.page}>
        <button onClick={() => navigate("/accueil")} style={styles.backBtn}>
          ← Retour
        </button>
        <div style={styles.errorBox}>{error || "Base introuvable."}</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <button onClick={() => navigate("/accueil")} style={styles.backBtn}>
          ← Retour
        </button>

        <span
          style={{
            ...styles.statusBadge,
            background: dbStatusStyles.bg,
            color: dbStatusStyles.color,
            borderColor: dbStatusStyles.border,
          }}
        >
          {dbStatus}
        </span>
      </div>

      <div style={styles.heroCard}>
        <div style={styles.heroLeft}>
          <div style={styles.heroLabel}>DÉTAIL DE LA BASE</div>

          <div style={styles.nameRow}>
            <span
              style={{
                ...styles.dot,
                background: dbStatusStyles.dot,
                boxShadow: `0 0 0 5px ${dbStatusStyles.dot}22`,
              }}
            />
            <h1 style={styles.title}>{overview.db_name || "Base"}</h1>
          </div>

          <p style={styles.subtitle}>
            {overview.host || "localhost"}
            {overview.port ? ` : ${overview.port}` : ""}
            {overview.service_name ? ` · ${overview.service_name}` : ""}
          </p>
        </div>
      </div>

      <CollapsibleSection
        title="Info de la base"
        subtitle={`Informations générales de ${overview.db_name || "la base"}`}
        isOpen={openSections.summary}
        onToggle={() => toggleSection("summary")}
      >
        <div style={styles.infoGrid}>
          <InfoCard label="Nom de la base" value={overview.db_name} />
          <InfoCard label="Host" value={overview.host} />
          <InfoCard label="Port" value={String(overview.port ?? "—")} />
          <InfoCard label="Service" value={overview.service_name || "—"} />
          <InfoCard label="SID" value={overview.sid || "—"} />
          <InfoCard
            label="Dernière collecte"
            value={
              overview.last_collect_at
                ? new Date(overview.last_collect_at).toLocaleString("fr-FR")
                : "Non disponible"
            }
          />
        </div>

        <div style={styles.infoGrid}>
          <InfoCard
            label="DB_STATUS"
            value={
              dbStatusMetric
                ? `${dbStatusMetric.value_text || dbStatusMetric.value_number || "—"}`
                : "Non disponible"
            }
          />
          <InfoCard label="Type" value={overview.db_type_name || "—"} />
          <InfoCard label="Base affichée" value={overview.db_name || "—"} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Métriques actuelles"
        subtitle={`Toutes les métriques collectées de ${overview.db_name || "la base"}`}
        isOpen={openSections.metrics}
        onToggle={() => toggleSection("metrics")}
      >
        {sortedMetrics.length === 0 ? (
          <EmptyBox message="Aucune métrique disponible pour cette base." />
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Metric</th>
                  <th style={styles.th}>Value</th>
                  <th style={styles.th}>Severity</th>
                  <th style={styles.th}>Warning</th>
                  <th style={styles.th}>Critique</th>
                  <th style={styles.th}>Fréquence</th>
                </tr>
              </thead>
              <tbody>
                {sortedMetrics.map((metric, index) => {
                  const value =
                    metric.value_number !== null && metric.value_number !== undefined
                      ? metric.value_number
                      : metric.value_text || "—";

                  const status = getMetricStatus(metric);
                  const style = getMetricStatusStyle(status);

                  return (
                    <tr
                      key={metric.metric_id}
                      style={index % 2 === 0 ? styles.rowEven : styles.rowOdd}
                    >
                      <td style={styles.tdStrong}>{metric.metric_code || "—"}</td>
                      <td style={styles.td}>{String(value)}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.metricBadge,
                            background: style.bg,
                            color: style.color,
                            borderColor: style.border,
                          }}
                        >
                          {status}
                        </span>
                      </td>
                      <td style={styles.td}>{metric.warn_threshold ?? "—"}</td>
                      <td style={styles.td}>{metric.crit_threshold ?? "—"}</td>
                      <td style={styles.td}>
                        {metric.frequency_sec ? `${metric.frequency_sec}s` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Graphiques des métriques"
        subtitle="Historique des métriques numériques disponibles"
        isOpen={openSections.charts}
        onToggle={() => toggleSection("charts")}
      >
        {chartMetrics.length === 0 ? (
          <EmptyBox message="Aucun graphique métrique disponible pour cette base." />
        ) : (
          <div style={styles.chartGrid}>
            {chartMetrics.map((metric) => {
              const code = String(metric.metric_code || "").toUpperCase();
              return (
                <SingleMetricChartCard
                  key={metric.metric_id || code}
                  title={metric.metric_code || "Métrique"}
                  metric={metric}
                  chartData={historyByMetric[code] || []}
                />
              );
            })}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "24px",
    color: "#0f172a",
    fontFamily: "Arial, sans-serif",
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },

  backBtn: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
    color: "#334155",
    boxShadow: "0 4px 14px rgba(15,23,42,0.05)",
  },

  statusBadge: {
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid",
    whiteSpace: "nowrap",
  },

  loadingBox: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
    color: "#334155",
    fontWeight: 700,
  },

  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    padding: 16,
    borderRadius: 14,
    fontWeight: 700,
  },

  heroCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
  },

  heroLeft: {
    minWidth: 0,
  },

  heroLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: "#94a3b8",
    marginBottom: 8,
  },

  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  dot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
  },

  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 800,
    wordBreak: "break-word",
  },

  subtitle: {
    margin: "10px 0 0 24px",
    color: "#64748b",
    fontSize: 16,
  },

  sectionCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
    marginBottom: 20,
  },

  sectionHeaderClickable: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    cursor: "pointer",
  },

  sectionChevron: {
    fontSize: 24,
    color: "#64748b",
    fontWeight: 700,
    lineHeight: 1,
  },

  sectionContent: {
    marginTop: 16,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#334155",
    marginBottom: 4,
  },

  sectionSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
    marginBottom: 16,
  },

  infoCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: "18px 20px",
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },

  infoLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: "0.06em",
    marginBottom: 8,
    textTransform: "uppercase",
  },

  infoValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
    wordBreak: "break-word",
    lineHeight: 1.5,
  },

  tableContainer: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    background: "#ffffff",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 760,
  },

  th: {
    textAlign: "left",
    padding: "14px 16px",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "14px 16px",
    borderBottom: "1px solid #eef2f7",
    fontSize: 14,
    color: "#334155",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
  },

  tdStrong: {
    padding: "14px 16px",
    borderBottom: "1px solid #eef2f7",
    fontSize: 14,
    color: "#0f172a",
    fontWeight: 800,
    whiteSpace: "nowrap",
    verticalAlign: "middle",
  },

  rowEven: {
    background: "#ffffff",
  },

  rowOdd: {
    background: "#fcfdff",
  },

  metricBadge: {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid",
    whiteSpace: "nowrap",
    display: "inline-block",
  },

  chartGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },

  chartCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
  },

  chartTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },

  chartMetricTitle: {
    fontWeight: 800,
    fontSize: 15,
    color: "#334155",
    wordBreak: "break-word",
  },

  smallMetricBadge: {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid",
    whiteSpace: "nowrap",
  },

  emptyBox: {
    textAlign: "center",
    padding: "28px 16px",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    color: "#94a3b8",
  },

  emptyBoxSmall: {
    textAlign: "center",
    padding: "18px 12px",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    color: "#94a3b8",
  },
};