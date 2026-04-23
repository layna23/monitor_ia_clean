import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
} from "recharts";
import api from "../api/client";

function getDbTypeCode(db) {
  return String(
    db?.db_type?.code ||
      db?.db_type_code ||
      db?.type_code ||
      db?.db_type_name ||
      db?.type_name ||
      db?.db_type_id ||
      ""
  )
    .trim()
    .toUpperCase();
}

function isOracleDb(db) {
  const dbType = getDbTypeCode(db);
  const dbName = String(db?.db_name || "").trim().toUpperCase();
  const dbTypeId = Number(db?.db_type_id);

  return (
    dbType === "ORACLE" ||
    dbTypeId === 1 ||
    dbName.includes("ORCL") ||
    dbName.includes("ORACLE") ||
    dbName.includes("19C") ||
    dbName.includes("SCHEMA")
  );
}

function formatHistoryLabel(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeSeverity(value) {
  return String(value || "INFO").trim().toUpperCase();
}

function getMetricSeverity(metric) {
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

function KpiCard({ label, value, sub, accent }) {
  return (
    <div style={{ ...styles.kpiCard, borderTop: `4px solid ${accent}` }}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiSub}>{sub}</div>
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeaderRow}>
        <div>
          <div style={styles.cardTitle}>{title}</div>
          {subtitle ? <div style={styles.cardSubtitle}>{subtitle}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function InfoMini({ label, value, fullWidth = false }) {
  return (
    <div
      style={{
        ...styles.infoMini,
        gridColumn: fullWidth ? "1 / -1" : "auto",
      }}
    >
      <div style={styles.infoMiniLabel}>{label}</div>
      <div style={styles.infoMiniValue}>{value}</div>
    </div>
  );
}

function EmptyBox({ message }) {
  return <div style={styles.emptyBox}>{message}</div>;
}

function SingleMetricChartCard({ title, metric, chartData }) {
  const status = metric ? getMetricSeverity(metric) : "INFO";
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
          <LineChart data={chartData}>
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
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                fontSize: 12,
                boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
              activeDot={{ r: 6 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="warn_threshold"
              stroke="#f59e0b"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="crit_threshold"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function MetricTag({ text, variant = "critical" }) {
  const style =
    variant === "warning"
      ? styles.alertMetricTagWarning
      : styles.alertMetricTagCritical;

  return <span style={style}>{text}</span>;
}

function GlobalPerformanceChart({ data }) {
  if (!data.length) {
    return <EmptyBox message="Aucune donnée globale CPU / RAM / DB Time disponible." />;
  }

  return (
    <div>
      <div style={styles.globalLegendWrap}>
        <span
          style={{
            ...styles.legendPill,
            color: "#ef4444",
            borderColor: "#fecaca",
            background: "#fff5f5",
          }}
        >
          <span style={{ ...styles.legendDot, background: "#ef4444" }} />
          CPU
        </span>

        <span
          style={{
            ...styles.legendPill,
            color: "#7c3aed",
            borderColor: "#ddd6fe",
            background: "#faf5ff",
          }}
        >
          <span style={{ ...styles.legendDot, background: "#7c3aed" }} />
          RAM
        </span>

        <span
          style={{
            ...styles.legendPill,
            color: "#2563eb",
            borderColor: "#bfdbfe",
            background: "#eff6ff",
          }}
        >
          <span style={{ ...styles.legendDot, background: "#2563eb" }} />
          DB Time
        </span>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbe3ef" />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            stroke="#94a3b8"
            minTickGap={24}
          />

          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#64748b" }}
            stroke="#94a3b8"
            width={56}
            tickFormatter={(value) => `${value}%`}
          />

          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              fontSize: 12,
              boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
            }}
            formatter={(value, name, props) => {
              const payload = props?.payload || {};

              if (name === "cpu_normalized") {
                return [`${payload.cpu_avg ?? "—"} % (${value}%)`, "CPU moyen"];
              }

              if (name === "ram_normalized") {
                return [`${payload.ram_avg ?? "—"} MB (${value}%)`, "RAM moyenne"];
              }

              if (name === "db_time_normalized") {
                return [`${payload.db_time_avg ?? "—"} ms (${value}%)`, "DB Time moyen"];
              }

              return [value, name];
            }}
            labelFormatter={(label) => `Date : ${label}`}
          />

          <Legend />

          <Line
            type="monotone"
            dataKey="cpu_normalized"
            name="CPU moyen"
            stroke="#ef4444"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
            connectNulls
          />

          <Line
            type="monotone"
            dataKey="ram_normalized"
            name="RAM moyenne"
            stroke="#7c3aed"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
            connectNulls
          />

          <Line
            type="monotone"
            dataKey="db_time_normalized"
            name="DB Time moyen"
            stroke="#2563eb"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
            connectNulls
          />

          <Brush
            dataKey="label"
            height={24}
            stroke="#94a3b8"
            travellerWidth={10}
          />
        </LineChart>
      </ResponsiveContainer>

      <div style={styles.globalChartNote}>
        Les courbes sont <strong>normalisées de 0 à 100%</strong> pour comparer
        visuellement CPU, RAM et DB Time sur toutes les bases Oracle collectées.
      </div>
    </div>
  );
}

export default function Accueil() {
  const [backendOk, setBackendOk] = useState(false);
  const [targetDbs, setTargetDbs] = useState([]);
  const [metricDefs, setMetricDefs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [selectedDbId, setSelectedDbId] = useState(null);
  const [selectedDbOverview, setSelectedDbOverview] = useState(null);
  const [selectedDbHistory, setSelectedDbHistory] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const [globalHistoryLoading, setGlobalHistoryLoading] = useState(false);
  const [allOracleHistories, setAllOracleHistories] = useState([]);

  useEffect(() => {
    const chargerDonnees = async () => {
      setChargement(true);
      setErreur("");

      try {
        const [hcRes, targetDbsRes, metricDefsRes] = await Promise.all([
          api.get("/health"),
          api.get("/target-dbs/"),
          api.get("/metric-defs/"),
        ]);

        const dbs = Array.isArray(targetDbsRes.data) ? targetDbsRes.data : [];

        setBackendOk(hcRes?.data?.status === "ok");
        setTargetDbs(dbs);
        setMetricDefs(Array.isArray(metricDefsRes.data) ? metricDefsRes.data : []);
      } catch (err) {
        console.error(err);
        setErreur("Erreur lors du chargement des données.");
      } finally {
        setChargement(false);
      }
    };

    chargerDonnees();
  }, []);

  const backendLabel = backendOk ? "En ligne" : "Hors ligne";

  const activeDbs = useMemo(() => {
    return targetDbs.filter((db) => Number(db.is_active || 0) === 1);
  }, [targetDbs]);

  const oracleBases = useMemo(() => {
    return activeDbs.filter((db) => isOracleDb(db));
  }, [activeDbs]);

  useEffect(() => {
    if (!selectedDbId && oracleBases.length > 0) {
      const local19c = oracleBases.find(
        (db) => String(db.db_name || "").toUpperCase() === "LOCAL_19C"
      );

      if (local19c) {
        setSelectedDbId(local19c.db_id);
        return;
      }

      setSelectedDbId(oracleBases[0].db_id);
    }
  }, [oracleBases, selectedDbId]);

  useEffect(() => {
    if (!selectedDbId) return;

    const chargerVisualisation = async () => {
      setMetricsLoading(true);

      try {
        const [overviewRes, historyRes] = await Promise.all([
          api.get(`/target-dbs/${selectedDbId}/overview`),
          api.get(`/target-dbs/${selectedDbId}/metrics-history?limit=120`),
        ]);

        setSelectedDbOverview(overviewRes?.data || null);
        setSelectedDbHistory(Array.isArray(historyRes?.data) ? historyRes.data : []);
      } catch (err) {
        console.error(err);
        setSelectedDbOverview(null);
        setSelectedDbHistory([]);
      } finally {
        setMetricsLoading(false);
      }
    };

    chargerVisualisation();
  }, [selectedDbId]);

  useEffect(() => {
    if (!oracleBases.length) {
      setAllOracleHistories([]);
      return;
    }

    const chargerToutesLesHistoriques = async () => {
      setGlobalHistoryLoading(true);

      try {
        const responses = await Promise.all(
          oracleBases.map((db) =>
            api
              .get(`/target-dbs/${db.db_id}/metrics-history?limit=120`)
              .then((res) => ({
                db_id: db.db_id,
                db_name: db.db_name,
                rows: Array.isArray(res?.data) ? res.data : [],
              }))
              .catch(() => ({
                db_id: db.db_id,
                db_name: db.db_name,
                rows: [],
              }))
          )
        );

        setAllOracleHistories(responses);
      } catch (err) {
        console.error(err);
        setAllOracleHistories([]);
      } finally {
        setGlobalHistoryLoading(false);
      }
    };

    chargerToutesLesHistoriques();
  }, [oracleBases]);

  const activeMetrics = metricDefs.filter((m) => Number(m.is_active || 0) === 1).length;

  const EXCLUDED_METRICS = useMemo(
    () => new Set(["DB_STATUS", "DB_INFO", "LOCKED_OBJECTS", "TOP_SQL"]),
    []
  );

  const selectedLatestMetrics = useMemo(() => {
    const metrics = Array.isArray(selectedDbOverview?.latest_metrics)
      ? selectedDbOverview.latest_metrics
      : [];

    return metrics.filter(
      (metric) => !EXCLUDED_METRICS.has(String(metric.metric_code || "").toUpperCase())
    );
  }, [selectedDbOverview, EXCLUDED_METRICS]);

  const historyByMetric = useMemo(() => {
    const grouped = {};

    selectedDbHistory.forEach((row) => {
      const code = String(row.metric_code || "").toUpperCase();
      if (!code || EXCLUDED_METRICS.has(code)) return;

      if (!grouped[code]) grouped[code] = [];

      grouped[code].push({
        label: formatHistoryLabel(row.collected_at),
        value: row.value_number,
        warn_threshold: row.warn_threshold,
        crit_threshold: row.crit_threshold,
      });
    });

    return grouped;
  }, [selectedDbHistory, EXCLUDED_METRICS]);

  const globalPerformanceData = useMemo(() => {
    const IMPORTANT_CODES = new Set(["CPU_USAGE", "RAM_USAGE", "DB_TIME"]);
    const merged = {};

    allOracleHistories.forEach((dbItem) => {
      const rows = Array.isArray(dbItem?.rows) ? dbItem.rows : [];

      rows.forEach((row) => {
        const code = String(row.metric_code || "").toUpperCase();
        if (!IMPORTANT_CODES.has(code)) return;

        const collectedAt = row.collected_at;
        const numericValue = Number(row.value_number);

        if (!collectedAt || Number.isNaN(numericValue)) return;

        if (!merged[collectedAt]) {
          merged[collectedAt] = {
            label: formatHistoryLabel(collectedAt),
            sortKey: new Date(collectedAt).getTime() || 0,
            cpu_values: [],
            ram_values: [],
            db_time_values: [],
          };
        }

        if (code === "CPU_USAGE") merged[collectedAt].cpu_values.push(numericValue);
        if (code === "RAM_USAGE") merged[collectedAt].ram_values.push(numericValue);
        if (code === "DB_TIME") merged[collectedAt].db_time_values.push(numericValue);
      });
    });

    const avg = (arr) => {
      if (!arr.length) return null;
      return Number((arr.reduce((sum, v) => sum + v, 0) / arr.length).toFixed(2));
    };

    const normalizeSeries = (items, key) => {
      const values = items
        .map((item) => item[key])
        .filter((v) => v !== null && v !== undefined && !Number.isNaN(v));

      if (!values.length) {
        return items.map((item) => ({ ...item, [`${key}_normalized`]: null }));
      }

      const min = Math.min(...values);
      const max = Math.max(...values);

      return items.map((item) => {
        const value = item[key];

        if (value === null || value === undefined || Number.isNaN(value)) {
          return { ...item, [`${key}_normalized`]: null };
        }

        if (max === min) {
          return { ...item, [`${key}_normalized`]: 50 };
        }

        const normalized = ((value - min) / (max - min)) * 100;

        return {
          ...item,
          [`${key}_normalized`]: Number(normalized.toFixed(2)),
        };
      });
    };

    let result = Object.values(merged)
      .map((item) => ({
        label: item.label,
        sortKey: item.sortKey,
        cpu_avg: avg(item.cpu_values),
        ram_avg: avg(item.ram_values),
        db_time_avg: avg(item.db_time_values),
      }))
      .sort((a, b) => a.sortKey - b.sortKey);

    result = normalizeSeries(result, "cpu_avg");
    result = normalizeSeries(result, "ram_avg");
    result = normalizeSeries(result, "db_time_avg");

    return result.map((item) => ({
      ...item,
      cpu_normalized: item.cpu_avg_normalized,
      ram_normalized: item.ram_avg_normalized,
      db_time_normalized: item.db_time_avg_normalized,
    }));
  }, [allOracleHistories]);

  const metricCharts = useMemo(() => {
    return selectedLatestMetrics
      .filter((metric) => {
        const code = String(metric.metric_code || "").toUpperCase();
        const chartData = historyByMetric[code] || [];
        if (!chartData.length) return false;

        return chartData.some(
          (row) =>
            row.value !== null &&
            row.value !== undefined &&
            !Number.isNaN(Number(row.value))
        );
      })
      .sort((a, b) =>
        String(a.metric_code || "").localeCompare(String(b.metric_code || ""))
      );
  }, [selectedLatestMetrics, historyByMetric]);

  const selectedDb = useMemo(() => {
    return oracleBases.find((db) => String(db.db_id) === String(selectedDbId)) || null;
  }, [oracleBases, selectedDbId]);

  const selectedDbCriticalMetrics = useMemo(() => {
    return selectedLatestMetrics
      .filter((metric) => getMetricSeverity(metric) === "CRITICAL")
      .map((metric) => String(metric.metric_code || "").toUpperCase());
  }, [selectedLatestMetrics]);

  const selectedDbWarningMetrics = useMemo(() => {
    return selectedLatestMetrics
      .filter((metric) => getMetricSeverity(metric) === "WARNING")
      .map((metric) => String(metric.metric_code || "").toUpperCase());
  }, [selectedLatestMetrics]);

  if (chargement) {
    return (
      <div style={styles.page}>
        <h1 style={styles.title}>Vue d&apos;ensemble</h1>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Vue d&apos;ensemble</h1>
          <p style={styles.subtitle}>
            Monitoring assisté par IA · Backend : {backendLabel}
          </p>
        </div>
        <span style={styles.liveBadge}>Live</span>
      </div>

      {erreur && <div style={styles.errorBox}>{erreur}</div>}

      <div style={styles.kpiGrid}>
        <KpiCard
          label="BASES ACTIVES"
          value={String(oracleBases.length)}
          sub="bases Oracle actives affichées"
          accent="#2563eb"
        />
        <KpiCard
          label="MÉTRIQUES ACTIVES"
          value={String(activeMetrics)}
          sub={`sur ${metricDefs.length} configurées`}
          accent="#7c3aed"
        />
      </div>

      <div style={styles.stackLayout}>
        <Card
          title="Analyse globale de la performance"
          subtitle="CPU, RAM et DB Time pour l’ensemble des bases Oracle collectées"
        >
          {globalHistoryLoading ? (
            <div style={styles.loadingInline}>
              Chargement du graphique global...
            </div>
          ) : (
            <GlobalPerformanceChart data={globalPerformanceData} />
          )}
        </Card>

        <Card title="Choisir une base">
          {oracleBases.length === 0 ? (
            <EmptyBox message="Aucune base Oracle active trouvée." />
          ) : (
            <div style={styles.dbSelectorBlock}>
              <div style={styles.selectorLabel}>Base sélectionnée</div>
              <select
                style={styles.dbSelect}
                value={selectedDbId || ""}
                onChange={(e) => setSelectedDbId(Number(e.target.value))}
              >
                {oracleBases.map((db) => (
                  <option key={db.db_id} value={db.db_id}>
                    {`${db.db_name || "—"} | ${db.host || "—"}:${db.port || "—"}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Card>

        <Card
          title="Info de la base"
          subtitle={
            selectedDb
              ? `Informations générales de ${selectedDb.db_name || "la base sélectionnée"}`
              : ""
          }
        >
          {!selectedDbId ? (
            <EmptyBox message="Sélectionnez une base." />
          ) : metricsLoading ? (
            <div style={styles.loadingInline}>Chargement des informations de la base...</div>
          ) : (
            <div style={styles.selectedDbInfoGridLarge}>
              <InfoMini
                label="Nom de la base"
                value={selectedDbOverview?.db_name || selectedDb?.db_name || "—"}
              />
              <InfoMini
                label="Host"
                value={selectedDbOverview?.host || selectedDb?.host || "localhost"}
              />
              <InfoMini
                label="Port"
                value={String(selectedDbOverview?.port || selectedDb?.port || "—")}
              />
              <InfoMini
                label="Service"
                value={selectedDbOverview?.service_name || "—"}
              />
              <InfoMini label="SID" value={selectedDbOverview?.sid || "—"} />
              <InfoMini
                label="Dernière collecte"
                value={
                  selectedDb?.last_collect_at
                    ? new Date(selectedDb.last_collect_at).toLocaleString("fr-FR")
                    : "Non disponible"
                }
              />
              <InfoMini label="Type" value="Oracle" />
              <InfoMini
                label="Base affichée"
                value={selectedDbOverview?.db_name || selectedDb?.db_name || "—"}
              />
            </div>
          )}
        </Card>

        <Card
          title="Métriques critiques et warning"
          subtitle={
            selectedDb
              ? `État actuel des métriques sensibles de ${selectedDb.db_name || "la base"}`
              : ""
          }
        >
          {!selectedDbId ? (
            <EmptyBox message="Sélectionnez une base." />
          ) : metricsLoading ? (
            <div style={styles.loadingInline}>Chargement des alertes de la base...</div>
          ) : (
            <div style={styles.alertsSelectedGrid}>
              <div style={styles.alertBox}>
                <div style={styles.alertBoxTitleCritical}>Critiques</div>
                <div style={styles.alertTagsWrap}>
                  {selectedDbCriticalMetrics.length === 0 ? (
                    <span style={styles.compactEmpty}>Aucune</span>
                  ) : (
                    selectedDbCriticalMetrics.map((metric) => (
                      <MetricTag
                        key={`critical-${metric}`}
                        text={metric}
                        variant="critical"
                      />
                    ))
                  )}
                </div>
              </div>

              <div style={styles.alertBox}>
                <div style={styles.alertBoxTitleWarning}>Warnings</div>
                <div style={styles.alertTagsWrap}>
                  {selectedDbWarningMetrics.length === 0 ? (
                    <span style={styles.compactEmpty}>Aucune</span>
                  ) : (
                    selectedDbWarningMetrics.map((metric) => (
                      <MetricTag
                        key={`warning-${metric}`}
                        text={metric}
                        variant="warning"
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card
          title="Métriques actuelles"
          subtitle={
            selectedDb
              ? `Toutes les métriques collectées de ${selectedDb.db_name || "la base"}`
              : ""
          }
        >
          {!selectedDbId ? (
            <EmptyBox message="Sélectionnez une base." />
          ) : metricsLoading ? (
            <div style={styles.loadingInline}>Chargement des métriques...</div>
          ) : selectedLatestMetrics.length === 0 ? (
            <EmptyBox message="Aucune métrique disponible pour cette base." />
          ) : (
            <div style={styles.metricsTableWrap}>
              <table style={styles.metricsTable}>
                <thead>
                  <tr>
                    <th style={styles.metricsTh}>METRIC</th>
                    <th style={styles.metricsTh}>VALUE</th>
                    <th style={styles.metricsTh}>SEVERITY</th>
                    <th style={styles.metricsTh}>WARNING</th>
                    <th style={styles.metricsTh}>CRITIQUE</th>
                    <th style={styles.metricsTh}>FRÉQUENCE</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedLatestMetrics.map((metric, index) => {
                    const sev = getMetricSeverity(metric);
                    const sevStyle = getMetricStatusStyle(sev);

                    return (
                      <tr
                        key={`${metric.metric_id || metric.metric_code}-${index}`}
                        style={index % 2 === 0 ? styles.rowEven : styles.rowOdd}
                      >
                        <td style={styles.metricsTdStrong}>
                          {metric.metric_code || "—"}
                        </td>
                        <td style={styles.metricsTd}>
                          {metric.value_text ?? metric.value_number ?? "—"}
                        </td>
                        <td style={styles.metricsTd}>
                          <span
                            style={{
                              ...styles.statusBadge,
                              background: sevStyle.bg,
                              color: sevStyle.color,
                              borderColor: sevStyle.border,
                            }}
                          >
                            {sev}
                          </span>
                        </td>
                        <td style={styles.metricsTd}>
                          {metric.warn_threshold ?? "—"}
                        </td>
                        <td style={styles.metricsTd}>
                          {metric.crit_threshold ?? "—"}
                        </td>
                        <td style={styles.metricsTd}>
                          {metric.frequency_sec ? `${metric.frequency_sec}s` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="Graphiques des métriques"
          subtitle="Historique détaillé des métriques numériques disponibles pour la base sélectionnée"
        >
          {!selectedDbId ? (
            <EmptyBox message="Sélectionnez une base." />
          ) : metricsLoading ? (
            <div style={styles.loadingInline}>Chargement des graphiques...</div>
          ) : metricCharts.length === 0 ? (
            <EmptyBox message="Aucun graphique métrique disponible pour cette base." />
          ) : (
            <div style={styles.chartGrid}>
              {metricCharts.map((metric) => {
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
        </Card>
      </div>
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

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
  },

  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 800,
  },

  subtitle: {
    margin: "8px 0 0 0",
    color: "#64748b",
    fontSize: 16,
  },

  liveBadge: {
    background: "#eff6ff",
    color: "#2563eb",
    border: "1px solid #bfdbfe",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },

  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
    marginBottom: 24,
  },

  kpiCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: "18px 20px",
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },

  kpiLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: "#94a3b8",
    marginBottom: 8,
  },

  kpiValue: {
    fontSize: 30,
    fontWeight: 800,
    lineHeight: 1.1,
  },

  kpiSub: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 6,
  },

  stackLayout: {
    display: "grid",
    gap: 20,
    marginTop: 20,
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },

  cardHeaderRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#334155",
  },

  cardSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#94a3b8",
  },

  emptyBox: {
    textAlign: "center",
    padding: "28px 16px",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    color: "#94a3b8",
  },

  dbSelectorBlock: {
    maxWidth: 520,
  },

  selectorLabel: {
    fontSize: 15,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 10,
  },

  dbSelect: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    outline: "none",
  },

  infoMini: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "10px 12px",
  },

  infoMiniLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginBottom: 5,
  },

  infoMiniValue: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
    wordBreak: "break-word",
  },

  statusBadge: {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid",
    display: "inline-block",
    whiteSpace: "nowrap",
  },

  selectedDbInfoGridLarge: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
  },

  alertsSelectedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },

  alertBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 16,
  },

  alertBoxTitleCritical: {
    fontSize: 16,
    fontWeight: 800,
    color: "#b91c1c",
    marginBottom: 12,
  },

  alertBoxTitleWarning: {
    fontSize: 16,
    fontWeight: 800,
    color: "#b45309",
    marginBottom: 12,
  },

  alertTagsWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  compactEmpty: {
    fontSize: 13,
    color: "#94a3b8",
  },

  alertMetricTagCritical: {
    background: "#fff1f2",
    color: "#9f1239",
    border: "1px solid #fecdd3",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
  },

  alertMetricTagWarning: {
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
  },

  metricsTableWrap: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    overflow: "hidden",
  },

  metricsTable: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#ffffff",
  },

  metricsTh: {
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    padding: "16px 18px",
    textAlign: "left",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },

  metricsTd: {
    padding: "16px 18px",
    borderBottom: "1px solid #eef2f7",
    fontSize: 14,
    color: "#334155",
    verticalAlign: "middle",
  },

  metricsTdStrong: {
    padding: "16px 18px",
    borderBottom: "1px solid #eef2f7",
    fontSize: 14,
    color: "#0f172a",
    fontWeight: 800,
    verticalAlign: "middle",
  },

  rowEven: {
    background: "#ffffff",
  },

  rowOdd: {
    background: "#fcfdff",
  },

  loadingInline: {
    padding: "18px 0",
    color: "#64748b",
    fontWeight: 600,
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

  emptyBoxSmall: {
    textAlign: "center",
    padding: "18px 12px",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    color: "#94a3b8",
  },

  globalLegendWrap: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 16,
  },

  legendPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 700,
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    display: "inline-block",
  },

  globalChartNote: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.6,
  },
};