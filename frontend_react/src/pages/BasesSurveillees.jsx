import { useEffect, useMemo, useState } from "react";
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

const API_BASE = "http://127.0.0.1:8000";

export default function BasesSurveillees() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [targetDbs, setTargetDbs] = useState([]);
  const [metricDefs, setMetricDefs] = useState([]);
  const [alertsData, setAlertsData] = useState([]);
  const [metricRuns, setMetricRuns] = useState([]);
  const [metricValues, setMetricValues] = useState([]);
  const [dbTypes, setDbTypes] = useState([]);

  const [selectedDbId, setSelectedDbId] = useState("");
  const [selectedChartMetric, setSelectedChartMetric] = useState("");

  const [openSections, setOpenSections] = useState({
    currentMetrics: true,
    chart: true,
    runs: false,
    openAlerts: true,
    configuredMetrics: false,
    alertHistory: false,
  });

  async function apiGet(endpoint, defaultValue = []) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`);
      if (!res.ok) throw new Error(`Erreur API ${endpoint}`);
      const data = await res.json();
      return data ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [
          targetDbsRes,
          metricDefsRes,
          alertsRes,
          metricRunsRes,
          metricValuesRes,
          dbTypesRes,
        ] = await Promise.all([
          apiGet("/target-dbs/", []),
          apiGet("/metric-defs/", []),
          apiGet("/alerts/", []),
          apiGet("/metric-runs/", []),
          apiGet("/metric-values/", []),
          apiGet("/db-types/", []),
        ]);

        setTargetDbs(targetDbsRes);
        setMetricDefs(metricDefsRes);
        setAlertsData(alertsRes);
        setMetricRuns(metricRunsRes);
        setMetricValues(metricValuesRes);
        setDbTypes(dbTypesRes);

        if (targetDbsRes.length > 0) {
          setSelectedDbId(String(targetDbsRes[0].db_id));
        }
      } catch {
        setError("Impossible de charger les données.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function toggleSection(sectionKey) {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  }

  const metricMap = useMemo(() => {
    const map = {};
    metricDefs.forEach((m) => {
      map[String(m.metric_id)] = m.metric_code || "?";
    });
    return map;
  }, [metricDefs]);

  const dbTypeMap = useMemo(() => {
    const map = {};
    dbTypes.forEach((d) => {
      map[String(d.db_type_id)] = d.name || "?";
    });
    return map;
  }, [dbTypes]);

  const selectedDb = useMemo(() => {
    return targetDbs.find((db) => String(db.db_id) === String(selectedDbId)) || null;
  }, [targetDbs, selectedDbId]);

  const dbRuns = useMemo(() => {
    if (!selectedDb) return [];
    return metricRuns.filter((r) => String(r.db_id) === String(selectedDb.db_id));
  }, [metricRuns, selectedDb]);

  const dbValues = useMemo(() => {
    if (!selectedDb) return [];
    return metricValues.filter((v) => String(v.db_id) === String(selectedDb.db_id));
  }, [metricValues, selectedDb]);

  const dbAlerts = useMemo(() => {
    if (!selectedDb) return [];
    return alertsData.filter((a) => String(a.db_id) === String(selectedDb.db_id));
  }, [alertsData, selectedDb]);

  const dbAlertsOpen = useMemo(() => {
    return dbAlerts.filter((a) => String(a.status || "").toUpperCase() === "OPEN");
  }, [dbAlerts]);

  const globalStatus = useMemo(() => {
    if (!selectedDb) return "INACTIF";

    const isActive = Number(selectedDb.is_active || 0) === 1;
    const hasCritical = dbAlertsOpen.some(
      (a) => String(a.severity || "").toUpperCase() === "CRITICAL"
    );
    const hasWarning = dbAlertsOpen.some(
      (a) => String(a.severity || "").toUpperCase() === "WARNING"
    );

    if (hasCritical) return "CRITICAL";
    if (hasWarning) return "WARNING";
    if (isActive) return "OK";
    return "INACTIF";
  }, [selectedDb, dbAlertsOpen]);

  const compatibleMetrics = useMemo(() => {
    if (!selectedDb) return [];
    return metricDefs.filter(
      (m) =>
        String(m.db_type_id) === String(selectedDb.db_type_id) &&
        Number(m.is_active || 0) === 1
    );
  }, [metricDefs, selectedDb]);

  function severityStyle(sev) {
    const s = String(sev || "").toUpperCase();
    if (s === "CRITICAL") {
      return { bg: "#fff1f2", border: "#fecdd3", color: "#9f1239" };
    }
    if (s === "WARNING") {
      return { bg: "#fffbeb", border: "#fde68a", color: "#92400e" };
    }
    if (s === "OK") {
      return { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" };
    }
    return { bg: "#f8fafc", border: "#e2e8f0", color: "#475569" };
  }

  function statusBadgeConfig(status) {
    const s = String(status || "").toUpperCase();
    const cfg = {
      OPEN: { bg: "#fff1f2", border: "#fecdd3", color: "#9f1239" },
      ACK: { bg: "#fffbeb", border: "#fde68a", color: "#92400e" },
      RESOLVED: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
      CLOSED: { bg: "#f8fafc", border: "#e2e8f0", color: "#64748b" },
      SUCCESS: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
      FAILED: { bg: "#fff1f2", border: "#fecdd3", color: "#9f1239" },
      CRITICAL: { bg: "#fff1f2", border: "#fecdd3", color: "#9f1239" },
      WARNING: { bg: "#fffbeb", border: "#fde68a", color: "#92400e" },
      OK: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
      INACTIF: { bg: "#f8fafc", border: "#e2e8f0", color: "#64748b" },
      INFO: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    };
    return cfg[s] || { bg: "#f8fafc", border: "#e2e8f0", color: "#64748b" };
  }

  function safeDate(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDate(value, withSeconds = true) {
    const d = value instanceof Date ? value : safeDate(value);
    if (!d) return "—";
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return withSeconds
      ? `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
      : `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  function formatAxisDate(value) {
    const d = value instanceof Date ? value : safeDate(value);
    if (!d) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  }

  const numericValuesPrepared = useMemo(() => {
    return dbValues
      .filter((v) => v.value_number !== null && v.value_number !== undefined && v.collected_at)
      .map((v) => ({
        ...v,
        metric_code: metricMap[String(v.metric_id)] || "?",
        collected_at_obj: new Date(v.collected_at),
        value_number_num: Number(v.value_number),
      }))
      .filter(
        (v) =>
          !Number.isNaN(v.collected_at_obj.getTime()) && Number.isFinite(v.value_number_num)
      )
      .sort((a, b) => a.collected_at_obj - b.collected_at_obj);
  }, [dbValues, metricMap]);

  const chartMetricOptions = useMemo(() => {
    return [...new Set(numericValuesPrepared.map((v) => v.metric_code))].sort();
  }, [numericValuesPrepared]);

  useEffect(() => {
    if (chartMetricOptions.length > 0) {
      setSelectedChartMetric((prev) =>
        prev && chartMetricOptions.includes(prev) ? prev : chartMetricOptions[0]
      );
    } else {
      setSelectedChartMetric("");
    }
  }, [chartMetricOptions]);

  const chartData = useMemo(() => {
    if (!selectedChartMetric) return [];

    return numericValuesPrepared
      .filter((v) => v.metric_code === selectedChartMetric)
      .map((v) => ({
        collected_at: v.collected_at_obj,
        collected_at_label: formatAxisDate(v.collected_at_obj),
        collected_at_full: formatDate(v.collected_at_obj, true),
        value: v.value_number_num,
      }))
      .slice(-60);
  }, [numericValuesPrepared, selectedChartMetric]);

  const chartStats = useMemo(() => {
    if (!chartData.length) return null;
    const values = chartData.map((x) => x.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      last: values[values.length - 1],
    };
  }, [chartData]);

  const openDbAlertsSorted = useMemo(() => {
    return [...dbAlertsOpen].sort((a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || ""))
    );
  }, [dbAlertsOpen]);

  const currentMetricsRows = useMemo(() => {
    const latestByMetric = {};

    dbValues.forEach((v) => {
      const key = String(v.metric_id || "");
      const currentDate = safeDate(v.collected_at);
      const savedDate = latestByMetric[key] ? safeDate(latestByMetric[key].collected_at) : null;

      if (!latestByMetric[key]) {
        latestByMetric[key] = v;
        return;
      }

      if (currentDate && savedDate && currentDate > savedDate) {
        latestByMetric[key] = v;
      }
    });

    return Object.values(latestByMetric)
      .map((v) => {
        const metricCode = metricMap[String(v.metric_id)] || "?";
        const severity = String(v.severity || "INFO").toUpperCase();
        const displayValue =
          v.value_number !== null && v.value_number !== undefined
            ? String(v.value_number)
            : v.value_text || "—";

        return {
          metric_code: metricCode,
          value: displayValue,
          severity,
          collected_at: formatDate(v.collected_at),
        };
      })
      .sort((a, b) => String(a.metric_code).localeCompare(String(b.metric_code)));
  }, [dbValues, metricMap]);

  if (loading) {
    return (
      <div style={styles.page}>
        <PageHeader
          title="Bases Surveillées"
          subtitle="Vue détaillée par base — métriques, alertes, historique des collectes"
        />
        <InfoBox text="Chargement des données..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <PageHeader
          title="Bases Surveillées"
          subtitle="Vue détaillée par base — métriques, alertes, historique des collectes"
        />
        <ErrorBox text={error} />
      </div>
    );
  }

  if (!targetDbs.length) {
    return (
      <div style={styles.page}>
        <PageHeader
          title="Bases Surveillées"
          subtitle="Vue détaillée par base — métriques, alertes, historique des collectes"
        />
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#334155" }}>
            Aucune base configurée
          </div>
          <div style={{ color: "#94a3b8", marginTop: 8 }}>
            Ajoutez une base dans <b>Config BD</b> d&apos;abord.
          </div>
        </div>
      </div>
    );
  }

  const statusCfg = statusBadgeConfig(globalStatus);
  const dotColor =
    globalStatus === "CRITICAL"
      ? "#ef4444"
      : globalStatus === "WARNING"
      ? "#f59e0b"
      : globalStatus === "OK"
      ? "#22c55e"
      : "#94a3b8";

  return (
    <div style={styles.page}>
      <PageHeader
        title="Bases Surveillées"
        subtitle="Vue détaillée par base — métriques, alertes, historique des collectes"
      />

      <SectionCard>
        <SectionTitle text="SÉLECTIONNER UNE BASE" />
        <div style={styles.selectRow}>
          <div style={{ flex: 2, minWidth: 280 }}>
            <select
              value={selectedDbId}
              onChange={(e) => setSelectedDbId(e.target.value)}
              style={styles.select}
            >
              {targetDbs.map((db) => (
                <option key={db.db_id} value={String(db.db_id)}>
                  {`${db.db_name || "?"} · ${db.host || ""}:${db.port || ""}`}
                </option>
              ))}
            </select>
          </div>

          {selectedDb && (
            <div style={{ flex: 3, minWidth: 320 }}>
              <div style={styles.dbInfoRow}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: dotColor,
                      display: "inline-block",
                      boxShadow: `0 0 0 4px ${dotColor}22`,
                    }}
                  />
                  <span
                    style={{
                      background: statusCfg.bg,
                      border: `1px solid ${statusCfg.border}`,
                      color: statusCfg.color,
                      padding: "0.28rem 0.8rem",
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {globalStatus}
                  </span>
                </div>

                <MetaItem label="Nom" value={selectedDb.db_name || "—"} />
                <MetaItem label="Type" value={dbTypeMap[String(selectedDb.db_type_id)] || "—"} />
                <MetaItem label="Service" value={selectedDb.service_name || "—"} />
                <MetaItem label="User" value={selectedDb.username || "—"} />
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      <div style={{ height: 18 }} />

      <div style={styles.contentGrid}>
        <div style={styles.leftColumn}>
          <CollapsibleSection
            title="MÉTRIQUES ACTUELLES"
            isOpen={openSections.currentMetrics}
            onToggle={() => toggleSection("currentMetrics")}
          >
            {!currentMetricsRows.length ? (
              <EmptyMini text="Aucune métrique disponible." />
            ) : (
              <DataTable
                columns={["metric_code", "value", "severity", "collected_at"]}
                rows={currentMetricsRows}
                severityColumn="severity"
              />
            )}
          </CollapsibleSection>

          <div style={{ height: 18 }} />

          <CollapsibleSection
            title="ÉVOLUTION DES MÉTRIQUES"
            isOpen={openSections.chart}
            onToggle={() => toggleSection("chart")}
          >
            <div style={styles.chartHeader}>
              <div />
              {chartMetricOptions.length > 0 ? (
                <div style={styles.chartControls}>
                  <select
                    value={selectedChartMetric}
                    onChange={(e) => setSelectedChartMetric(e.target.value)}
                    style={styles.selectSmall}
                  >
                    {chartMetricOptions.map((metric) => (
                      <option key={metric} value={metric}>
                        {metric}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            {!chartData.length ? (
              <EmptyMini text="Aucune valeur numérique disponible." />
            ) : (
              <>
                <div style={styles.chartMetaRow}>
                  <MiniStat label="Métrique" value={selectedChartMetric || "—"} />
                  <MiniStat label="Dernière valeur" value={chartStats?.last ?? "—"} />
                  <MiniStat label="Min" value={chartStats?.min ?? "—"} />
                  <MiniStat label="Max" value={chartStats?.max ?? "—"} />
                </div>

                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 20, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" />
                      <XAxis
                        dataKey="collected_at_label"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        stroke="#94a3b8"
                        minTickGap={24}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        stroke="#94a3b8"
                        width={52}
                        allowDecimals={false}
                      />
                      <Tooltip
                        formatter={(value) => [value, selectedChartMetric || "Valeur"]}
                        labelFormatter={(label, payload) =>
                          payload?.[0]?.payload?.collected_at_full || label
                        }
                        contentStyle={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                          fontSize: 12,
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          fontSize: 12,
                          color: "#334155",
                          paddingTop: 10,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name={selectedChartMetric || "Valeur"}
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CollapsibleSection>

          <div style={{ height: 18 }} />

          <CollapsibleSection
            title="HISTORIQUE DES RUNS"
            isOpen={openSections.runs}
            onToggle={() => toggleSection("runs")}
          >
            {!dbRuns.length ? (
              <EmptyMini text="Aucun run pour cette base." />
            ) : (
              <DataTable
                columns={[
                  "run_id",
                  "metric_code",
                  "status",
                  "duration_ms",
                  "started_at",
                  "ended_at",
                  "error_message",
                ]}
                rows={[...dbRuns]
                  .map((r) => ({
                    ...r,
                    metric_code: metricMap[String(r.metric_id)] || "?",
                    started_at: formatDate(r.started_at),
                    ended_at: formatDate(r.ended_at),
                  }))
                  .sort((a, b) => Number(b.run_id || 0) - Number(a.run_id || 0))
                  .slice(0, 20)}
                severityColumn="status"
              />
            )}
          </CollapsibleSection>
        </div>

        <div style={styles.rightColumn}>
          <CollapsibleSection
            title="ALERTES OUVERTES"
            isOpen={openSections.openAlerts}
            onToggle={() => toggleSection("openAlerts")}
          >
            {!openDbAlertsSorted.length ? (
              <div style={styles.successBox}>Aucune alerte ouverte</div>
            ) : (
              openDbAlertsSorted.slice(0, 6).map((a) => {
                const sevStyle = severityStyle(a.severity);
                const met = metricMap[String(a.metric_id)] || "—";
                const title = a.title || met;
                const detail = a.details || a.last_value || "";
                const created = formatDate(a.created_at, false);

                return (
                  <div
                    key={a.alert_id}
                    style={{
                      background: sevStyle.bg,
                      border: `1px solid ${sevStyle.border}`,
                      borderRadius: 14,
                      padding: "0.85rem 0.95rem",
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: sevStyle.color,
                          marginBottom: 4,
                        }}
                      >
                        {String(title).slice(0, 40)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: sevStyle.color,
                          opacity: 0.78,
                        }}
                      >
                        {met} · {created}
                      </div>
                      {detail ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: sevStyle.color,
                            opacity: 0.9,
                            marginTop: 6,
                          }}
                        >
                          {String(detail).slice(0, 65)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </CollapsibleSection>

          <div style={{ height: 18 }} />

          <CollapsibleSection
            title="MÉTRIQUES CONFIGURÉES"
            isOpen={openSections.configuredMetrics}
            onToggle={() => toggleSection("configuredMetrics")}
          >
            {!compatibleMetrics.length ? (
              <EmptyMini text="Aucune métrique active pour ce type de base." />
            ) : (
              compatibleMetrics.map((m) => (
                <div key={m.metric_id} style={styles.metricRow}>
                  <div>
                    <div style={styles.metricCode}>{m.metric_code || "—"}</div>
                    <div style={styles.metricFreq}>Fréquence : {m.frequency_sec ?? "—"} s</div>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {m.warn_threshold !== null && m.warn_threshold !== undefined && (
                      <Badge bg="#fffbeb" border="#fde68a" color="#92400e">
                        W:{m.warn_threshold}
                      </Badge>
                    )}
                    {m.crit_threshold !== null && m.crit_threshold !== undefined && (
                      <Badge bg="#fff1f2" border="#fecdd3" color="#9f1239">
                        C:{m.crit_threshold}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </CollapsibleSection>

          <div style={{ height: 18 }} />

          <CollapsibleSection
            title="HISTORIQUE ALERTES"
            isOpen={openSections.alertHistory}
            onToggle={() => toggleSection("alertHistory")}
          >
            {!dbAlerts.length ? (
              <EmptyMini text="Aucune alerte pour cette base." />
            ) : (
              <DataTable
                columns={[
                  "alert_id",
                  "metric_code",
                  "severity",
                  "status",
                  "last_value",
                  "created_at",
                ]}
                rows={[...dbAlerts]
                  .map((a) => ({
                    ...a,
                    metric_code: metricMap[String(a.metric_id)] || "?",
                    created_at: formatDate(a.created_at, false),
                  }))
                  .sort((a, b) => Number(b.alert_id || 0) - Number(a.alert_id || 0))
                  .slice(0, 10)}
                severityColumn="severity"
              />
            )}
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={styles.pageTitle}>{title}</div>
      <div style={styles.pageSubtitle}>{subtitle}</div>
    </div>
  );
}

function SectionCard({ children }) {
  return <div style={styles.card}>{children}</div>;
}

function SectionTitle({ text }) {
  return <div style={styles.sectionTitle}>{text}</div>;
}

function CollapsibleSection({ title, isOpen, onToggle, children }) {
  return (
    <SectionCard>
      <button type="button" onClick={onToggle} style={styles.collapseButton}>
        <div style={styles.collapseLeft}>
          <span style={styles.sectionTitle}>{title}</span>
        </div>
        <span style={styles.collapseIcon}>{isOpen ? "−" : "+"}</span>
      </button>

      {isOpen ? <div style={styles.collapseContent}>{children}</div> : null}
    </SectionCard>
  );
}

function MetaItem({ label, value }) {
  return (
    <div style={styles.metaItem}>
      <span style={styles.metaLabel}>{label} :</span> {value}
    </div>
  );
}

function Badge({ bg, border, color, children }) {
  return (
    <span
      style={{
        background: bg,
        border: `1px solid ${border}`,
        color,
        padding: "0.15rem 0.5rem",
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={styles.miniStat}>
      <div style={styles.miniStatLabel}>{label}</div>
      <div style={styles.miniStatValue}>{String(value ?? "—")}</div>
    </div>
  );
}

function EmptyMini({ text }) {
  return <div style={styles.emptyMini}>{text}</div>;
}

function InfoBox({ text }) {
  return <div style={styles.infoBox}>{text}</div>;
}

function ErrorBox({ text }) {
  return <div style={styles.errorBox}>{text}</div>;
}

function SeverityBadge({ value }) {
  const s = String(value || "").toUpperCase();
  const stylesMap = {
    CRITICAL: { bg: "#fff1f2", border: "#fecdd3", color: "#9f1239" },
    WARNING: { bg: "#fffbeb", border: "#fde68a", color: "#92400e" },
    OK: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
    INFO: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    OPEN: { bg: "#fff1f2", border: "#fecdd3", color: "#9f1239" },
    SUCCESS: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
    FAILED: { bg: "#fff1f2", border: "#fecdd3", color: "#9f1239" },
  };

  const cfg = stylesMap[s] || { bg: "#f8fafc", border: "#e2e8f0", color: "#475569" };

  return (
    <span
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        padding: "0.22rem 0.55rem",
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 800,
        display: "inline-block",
        whiteSpace: "nowrap",
      }}
    >
      {s || "—"}
    </span>
  );
}

function DataTable({ columns, rows, severityColumn }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} style={styles.th}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} style={idx % 2 === 0 ? styles.rowEven : styles.rowOdd}>
              {columns.map((col) => (
                <td key={col} style={styles.td}>
                  {col === severityColumn ? (
                    <SeverityBadge value={row[col]} />
                  ) : row[col] !== null && row[col] !== undefined && row[col] !== "" ? (
                    String(row[col])
                  ) : (
                    "—"
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  page: {
    padding: 24,
    background: "#f8fafc",
    minHeight: "100vh",
  },

  pageTitle: {
    fontSize: 30,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 6,
    letterSpacing: "-0.02em",
  },

  pageSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "0.05em",
    margin: 0,
  },

  collapseButton: {
    width: "100%",
    background: "transparent",
    border: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    cursor: "pointer",
    textAlign: "left",
  },

  collapseLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  collapseIcon: {
    width: 28,
    height: 28,
    borderRadius: 9999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#334155",
    fontWeight: 900,
    fontSize: 18,
    lineHeight: 1,
    flexShrink: 0,
  },

  collapseContent: {
    marginTop: 16,
  },

  selectRow: {
    display: "flex",
    gap: 18,
    flexWrap: "wrap",
    alignItems: "center",
  },

  select: {
    width: "100%",
    padding: "0.85rem 1rem",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
  },

  selectSmall: {
    minWidth: 220,
    padding: "0.7rem 0.9rem",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 13,
    color: "#0f172a",
    outline: "none",
  },

  dbInfoRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },

  metaItem: {
    fontSize: 12.5,
    color: "#64748b",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: "0.45rem 0.7rem",
    borderRadius: 12,
  },

  metaLabel: {
    color: "#334155",
    fontWeight: 800,
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 3fr) minmax(320px, 2fr)",
    gap: 18,
    alignItems: "start",
  },

  leftColumn: {
    minWidth: 0,
  },

  rightColumn: {
    minWidth: 0,
  },

  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 8,
  },

  chartControls: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  chartMetaRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 14,
  },

  miniStat: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "0.75rem 0.9rem",
  },

  miniStatLabel: {
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#94a3b8",
    marginBottom: 6,
  },

  miniStatValue: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
  },

  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 14,
    padding: "1rem",
    textAlign: "center",
    fontSize: 13,
    fontWeight: 800,
    color: "#166534",
  },

  metricRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "0.7rem 0",
    borderBottom: "1px solid #f1f5f9",
  },

  metricCode: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
  },

  metricFreq: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },

  emptyMini: {
    textAlign: "center",
    padding: "2rem",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    color: "#94a3b8",
    fontSize: 13,
  },

  infoBox: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "1rem 1.1rem",
    color: "#334155",
  },

  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: 14,
    padding: "1rem 1.1rem",
    color: "#9f1239",
    fontWeight: 800,
  },

  emptyState: {
    textAlign: "center",
    padding: "4rem",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 16,
    marginTop: "2rem",
  },

  tableWrap: {
    overflowX: "auto",
    border: "1px solid #eef2f7",
    borderRadius: 14,
  },

  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    fontSize: 13,
    background: "#fff",
  },

  th: {
    textAlign: "left",
    padding: "12px 14px",
    background: "#f8fafc",
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
    fontWeight: 800,
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
  },

  td: {
    padding: "12px 14px",
    borderBottom: "1px solid #eef2f7",
    color: "#0f172a",
    verticalAlign: "top",
    whiteSpace: "nowrap",
  },

  rowEven: {
    background: "#ffffff",
  },

  rowOdd: {
    background: "#fcfdff",
  },
};