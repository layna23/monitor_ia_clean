import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
  Cell,
  LineChart,
  Line,
} from "recharts";

const API_BASE = "http://127.0.0.1:8000";

const COLORS = {
  blue: "#3b82f6",
  green: "#10b981",
  red: "#ef4444",
  orange: "#f59e0b",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  pink: "#ec4899",
};

export default function VueGlobaleBD() {
  const [targetDbs, setTargetDbs] = useState([]);
  const [selectedDbId, setSelectedDbId] = useState("");
  const [overview, setOverview] = useState(null);
  const [alertsAll, setAlertsAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [openedInfoKey, setOpenedInfoKey] = useState(null);

  const [metricDefs, setMetricDefs] = useState([]);
  const [metricRuns, setMetricRuns] = useState([]);
  const [metricValues, setMetricValues] = useState([]);
  const [dbTypes, setDbTypes] = useState([]);

  const [selectedChartMetric, setSelectedChartMetric] = useState("");

  const [openSections, setOpenSections] = useState({
    explanation: true,
    latestMetrics: true,
    numericValues: true,
    sensitiveMetrics: true,
    evolution: true,
    runs: true,
    configuredMetrics: true,
  });

  async function apiGet(endpoint, defaultValue = null) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      return data ?? defaultValue;
    } catch (e) {
      console.error("API ERROR:", e);
      return defaultValue;
    }
  }

  function toggleSection(key) {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function safeDate(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDateTime(value) {
    const d = safeDate(value);
    if (!d) return "-";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function formatAxisDate(value) {
    const d = value instanceof Date ? value : safeDate(value);
    if (!d) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  }

  function formatUptimeSmart(hoursValue) {
    const n = Number(hoursValue);

    if (!Number.isFinite(n) || n < 0) {
      return String(hoursValue ?? "-");
    }

    const totalMinutes = Math.round(n * 60);

    if (totalMinutes < 60) {
      return `${totalMinutes} min`;
    }

    const totalHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (totalHours < 24) {
      if (minutes === 0) return `${totalHours} h`;
      return `${totalHours} h ${minutes} min`;
    }

    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;

    if (remainingHours === 0 && minutes === 0) {
      return `${days} j`;
    }

    if (minutes === 0) {
      return `${days} j ${remainingHours} h`;
    }

    return `${days} j ${remainingHours} h ${minutes} min`;
  }

  function formatPercentValue(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? "-");
    return `${n} %`;
  }

  function firstNotEmpty(...values) {
    for (const v of values) {
      if (v === null || v === undefined) continue;
      if (typeof v === "string" && !v.trim()) continue;
      return v;
    }
    return null;
  }

  function normalizeSeverity(value) {
    return String(value || "INFO").trim().toUpperCase();
  }

  function getMetricObj(latestMetrics, code) {
    return (
      latestMetrics.find(
        (m) => String(m.metric_code || "").toUpperCase() === String(code).toUpperCase()
      ) || null
    );
  }

  function getMetricValue(latestMetrics, code) {
    const m = getMetricObj(latestMetrics, code);
    if (!m) {
      return { value: "-", severity: "-", collected_at: null };
    }
    return {
      value:
        m.value_number !== null && m.value_number !== undefined
          ? m.value_number
          : m.value_text ?? "-",
      severity: m.severity ?? "-",
      collected_at: m.collected_at ?? null,
    };
  }

  function buildMetricInfo(metricObj, fallbackDefinition, fallbackCalculation) {
    if (!metricObj) {
      return {
        definition: fallbackDefinition,
        calculation: fallbackCalculation,
        sql_query: null,
        collected_at: null,
        severity: null,
        warn: null,
        crit: null,
        freq: null,
        unit: null,
      };
    }

    return {
      definition: firstNotEmpty(
        metricObj.definition,
        metricObj.description,
        metricObj.metric_description,
        fallbackDefinition
      ),
      calculation: firstNotEmpty(
        metricObj.calculation,
        metricObj.formula,
        metricObj.logic,
        metricObj.explain_text,
        fallbackCalculation
      ),
      sql_query: firstNotEmpty(metricObj.sql_query, metricObj.query, metricObj.sql),
      collected_at: metricObj.collected_at,
      severity: metricObj.severity,
      warn: metricObj.warn_threshold,
      crit: metricObj.crit_threshold,
      freq: metricObj.frequency_sec,
      unit: metricObj.unit,
    };
  }

  function handleInfoToggle(key) {
    setOpenedInfoKey((prev) => (prev === key ? null : key));
  }

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [dbs, alerts, defs, runs, values, types] = await Promise.all([
        apiGet("/target-dbs/", []),
        apiGet("/alerts/", []),
        apiGet("/metric-defs/", []),
        apiGet("/metric-runs/", []),
        apiGet("/metric-values/", []),
        apiGet("/db-types/", []),
      ]);

      const dbList = Array.isArray(dbs) ? dbs : [];
      setTargetDbs(dbList);
      setAlertsAll(Array.isArray(alerts) ? alerts : []);
      setMetricDefs(Array.isArray(defs) ? defs : []);
      setMetricRuns(Array.isArray(runs) ? runs : []);
      setMetricValues(Array.isArray(values) ? values : []);
      setDbTypes(Array.isArray(types) ? types : []);

      if (dbList.length > 0) {
        setSelectedDbId(String(dbList[0].db_id));
      }

      setLoading(false);
    }

    load();
  }, []);

  useEffect(() => {
    if (!selectedDbId) return;

    async function loadOverview() {
      setLoadingOverview(true);
      setOpenedInfoKey(null);
      const res = await apiGet(`/target-dbs/${selectedDbId}/overview`, null);
      setOverview(res);
      setLoadingOverview(false);
    }

    loadOverview();
  }, [selectedDbId]);

  const selectedDb = useMemo(() => {
    return targetDbs.find((db) => String(db.db_id) === String(selectedDbId)) || null;
  }, [targetDbs, selectedDbId]);

  const latestMetrics = useMemo(() => {
    return Array.isArray(overview?.latest_metrics) ? overview.latest_metrics : [];
  }, [overview]);

  const dbTypeName = String(overview?.db_type_name || "").toUpperCase();
  const isMySQL = dbTypeName === "MYSQL";
  const archiveModeValue = overview?.archive_mode || "-";

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

  const alertsDb = useMemo(() => {
    return alertsAll.filter((a) => Number(a.db_id) === Number(selectedDbId));
  }, [alertsAll, selectedDbId]);

  const openAlerts = useMemo(() => {
    return alertsDb.filter((a) => String(a.status || "").toUpperCase() === "OPEN");
  }, [alertsDb]);

  const latestMetricsTable = useMemo(() => {
    return latestMetrics.map((m) => ({
      metric_code: m.metric_code,
      value:
        m.value_number !== null && m.value_number !== undefined
          ? String(m.value_number)
          : String(m.value_text ?? "-"),
      severity: normalizeSeverity(m.severity),
      collected_at: formatDateTime(m.collected_at),
      collected_at_raw: safeDate(m.collected_at),
    }));
  }, [latestMetrics]);

  const numericMetrics = useMemo(() => {
    return latestMetrics
      .filter((m) => m.value_number !== null && m.value_number !== undefined)
      .map((m) => ({
        metric_code: m.metric_code,
        value_number: Number(m.value_number),
      }))
      .filter((m) => Number.isFinite(m.value_number))
      .sort((a, b) => a.value_number - b.value_number);
  }, [latestMetrics]);

  const sensitiveMetrics = useMemo(() => {
    return latestMetrics
      .filter((m) => {
        const severity = normalizeSeverity(m.severity);
        const code = String(m.metric_code || "").toUpperCase();
        if (code === "DB_INFO") return false;
        return severity === "CRITICAL" || severity === "WARNING";
      })
      .map((m) => ({
        metric_code: m.metric_code,
        value:
          m.value_number !== null && m.value_number !== undefined
            ? String(m.value_number)
            : String(m.value_text ?? "-"),
        severity: normalizeSeverity(m.severity),
        collected_at: formatDateTime(m.collected_at),
        collected_at_raw: safeDate(m.collected_at),
      }))
      .sort((a, b) => {
        const rankMap = { CRITICAL: 2, WARNING: 1 };
        const rankDiff = (rankMap[b.severity] || 0) - (rankMap[a.severity] || 0);
        if (rankDiff !== 0) return rankDiff;

        const aTime = a.collected_at_raw ? a.collected_at_raw.getTime() : 0;
        const bTime = b.collected_at_raw ? b.collected_at_raw.getTime() : 0;
        return bTime - aTime;
      });
  }, [latestMetrics]);

  const dbRuns = useMemo(() => {
    if (!selectedDb) return [];
    return metricRuns.filter((r) => String(r.db_id) === String(selectedDb.db_id));
  }, [metricRuns, selectedDb]);

  const dbValues = useMemo(() => {
    if (!selectedDb) return [];
    return metricValues.filter((v) => String(v.db_id) === String(selectedDb.db_id));
  }, [metricValues, selectedDb]);

  const globalStatus = useMemo(() => {
    if (!selectedDb) return "INACTIF";

    const isActive = Number(selectedDb.is_active || 0) === 1;
    if (!isActive) return "INACTIF";

    const severities = latestMetrics
      .map((m) => normalizeSeverity(m.severity))
      .filter(Boolean);

    if (severities.includes("CRITICAL")) return "CRITICAL";
    if (severities.includes("WARNING")) return "WARNING";
    if (severities.includes("OK")) return "OK";
    if (severities.includes("INFO")) return "INFO";

    return "OK";
  }, [selectedDb, latestMetrics]);

  const compatibleMetrics = useMemo(() => {
    if (!selectedDb) return [];
    return metricDefs.filter(
      (m) =>
        String(m.db_type_id) === String(selectedDb.db_type_id) &&
        Number(m.is_active || 0) === 1
    );
  }, [metricDefs, selectedDb]);

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
        collected_at_full: formatDateTime(v.collected_at_obj),
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

  const dbStatusMetric = getMetricObj(latestMetrics, "DB_STATUS");
  const activeSessionsMetric = getMetricObj(latestMetrics, "ACTIVE_SESSIONS");
  const activeTxMetric = getMetricObj(latestMetrics, "ACTIVE_TRANSACTIONS");
  const cpuUsedSessionMetric = getMetricObj(latestMetrics, "CPU_USED_SESSION");
  const uptimeMetric = getMetricObj(latestMetrics, "INSTANCE_UPTIME_HOURS");
  const cpuUsageMetric = getMetricObj(latestMetrics, "CPU_USAGE");
  const ramUsageMetric = getMetricObj(latestMetrics, "RAM_USAGE");
  const threadsConnectedMetric = getMetricObj(latestMetrics, "THREADS_CONNECTED");
  const threadsRunningMetric = getMetricObj(latestMetrics, "THREADS_RUNNING");

  const dbStatusValue = getMetricValue(latestMetrics, "DB_STATUS");
  const activeSessionsValue = getMetricValue(latestMetrics, "ACTIVE_SESSIONS");
  const activeTxValue = getMetricValue(latestMetrics, "ACTIVE_TRANSACTIONS");
  const cpuUsedSessionValue = getMetricValue(latestMetrics, "CPU_USED_SESSION");
  const uptimeValue = getMetricValue(latestMetrics, "INSTANCE_UPTIME_HOURS");
  const cpuUsageValue = getMetricValue(latestMetrics, "CPU_USAGE");
  const ramUsageValue = getMetricValue(latestMetrics, "RAM_USAGE");
  const threadsConnectedValue = getMetricValue(latestMetrics, "THREADS_CONNECTED");
  const threadsRunningValue = getMetricValue(latestMetrics, "THREADS_RUNNING");

  const dbStatusInfo = buildMetricInfo(
    dbStatusMetric,
    "État courant de la base.",
    "Valeur directe issue de la métrique DB_STATUS."
  );

  const activeSessionsInfo = buildMetricInfo(
    activeSessionsMetric,
    "Nombre de sessions actives actuellement sur la base Oracle.",
    "Comptage des sessions Oracle actives."
  );

  const activeTxInfo = buildMetricInfo(
    activeTxMetric,
    "Nombre de transactions actives au moment de la collecte.",
    "Comptage des transactions actives au moment de la collecte."
  );

  const cpuUsedSessionInfo = buildMetricInfo(
    cpuUsedSessionMetric,
    "Consommation CPU observée pour les sessions au moment de la collecte.",
    "Valeur directe issue de la métrique CPU_USED_SESSION."
  );

  const uptimeInfo = buildMetricInfo(
    uptimeMetric,
    "Temps de fonctionnement de l'instance depuis son démarrage.",
    "Valeur directe issue de la métrique INSTANCE_UPTIME_HOURS."
  );

  const cpuUsageInfo = buildMetricInfo(
    cpuUsageMetric,
    "Pourcentage global d’utilisation CPU de la machine ou de l’instance surveillée.",
    "Valeur exprimée en pourcentage de charge CPU."
  );

  const ramUsageInfo = buildMetricInfo(
    ramUsageMetric,
    "Pourcentage global d’utilisation mémoire RAM de la machine ou de l’instance surveillée.",
    "Valeur exprimée en pourcentage d’occupation mémoire."
  );

  const threadsConnectedInfo = buildMetricInfo(
    threadsConnectedMetric,
    "Nombre total de threads actuellement connectés sur MySQL.",
    "Valeur issue de performance_schema.global_status pour Threads_connected."
  );

  const threadsRunningInfo = buildMetricInfo(
    threadsRunningMetric,
    "Nombre de threads MySQL actuellement en cours d'exécution.",
    "Valeur issue de performance_schema.global_status pour Threads_running."
  );

  const kpiCards = useMemo(() => {
    if (isMySQL) {
      return [
        {
          key: "threads_connected",
          label: "THREADS CONNECTED",
          value: String(threadsConnectedValue.value),
          accent:
            normalizeSeverity(threadsConnectedValue.severity) === "CRITICAL"
              ? COLORS.red
              : COLORS.blue,
        },
        {
          key: "threads_running",
          label: "THREADS RUNNING",
          value: String(threadsRunningValue.value),
          accent:
            normalizeSeverity(threadsRunningValue.severity) === "CRITICAL"
              ? COLORS.red
              : COLORS.green,
        },
        {
          key: "cpu_usage",
          label: "CPU USAGE",
          value: formatPercentValue(cpuUsageValue.value),
          accent:
            normalizeSeverity(cpuUsageValue.severity) === "CRITICAL"
              ? COLORS.red
              : normalizeSeverity(cpuUsageValue.severity) === "WARNING"
              ? COLORS.orange
              : COLORS.purple,
        },
        {
          key: "ram_usage",
          label: "RAM USAGE",
          value: formatPercentValue(ramUsageValue.value),
          accent:
            normalizeSeverity(ramUsageValue.severity) === "CRITICAL"
              ? COLORS.red
              : normalizeSeverity(ramUsageValue.severity) === "WARNING"
              ? COLORS.orange
              : COLORS.pink,
        },
      ];
    }

    return [
      {
        key: "db_status",
        label: "DB STATUS",
        value: String(dbStatusValue.value),
        accent:
          normalizeSeverity(dbStatusValue.severity) === "CRITICAL"
            ? COLORS.red
            : normalizeSeverity(dbStatusValue.severity) === "WARNING"
            ? COLORS.orange
            : normalizeSeverity(dbStatusValue.severity) === "INFO"
            ? COLORS.cyan
            : COLORS.blue,
      },
      {
        key: "active_sessions",
        label: "ACTIVE SESSIONS",
        value: String(activeSessionsValue.value),
        accent:
          normalizeSeverity(activeSessionsValue.severity) === "CRITICAL"
            ? COLORS.red
            : normalizeSeverity(activeSessionsValue.severity) === "WARNING"
            ? COLORS.orange
            : COLORS.green,
      },
      {
        key: "active_transactions",
        label: "ACTIVE TRANSACTIONS",
        value: String(activeTxValue.value),
        accent:
          normalizeSeverity(activeTxValue.severity) === "CRITICAL"
            ? COLORS.red
            : normalizeSeverity(activeTxValue.severity) === "WARNING"
            ? COLORS.orange
            : COLORS.blue,
      },
      {
        key: "cpu_used_session",
        label: "CPU USED SESSION",
        value: String(cpuUsedSessionValue.value),
        accent:
          normalizeSeverity(cpuUsedSessionValue.severity) === "CRITICAL"
            ? COLORS.red
            : normalizeSeverity(cpuUsedSessionValue.severity) === "WARNING"
            ? COLORS.orange
            : COLORS.purple,
      },
      {
        key: "uptime_h",
        label: "UPTIME",
        value: formatUptimeSmart(uptimeValue.value),
        accent:
          normalizeSeverity(uptimeValue.severity) === "CRITICAL"
            ? COLORS.red
            : normalizeSeverity(uptimeValue.severity) === "WARNING"
            ? COLORS.orange
            : COLORS.cyan,
      },
      {
        key: "cpu_usage",
        label: "CPU USAGE",
        value: formatPercentValue(cpuUsageValue.value),
        accent:
          normalizeSeverity(cpuUsageValue.severity) === "CRITICAL"
            ? COLORS.red
            : normalizeSeverity(cpuUsageValue.severity) === "WARNING"
            ? COLORS.orange
            : COLORS.purple,
      },
      {
        key: "ram_usage",
        label: "RAM USAGE",
        value: formatPercentValue(ramUsageValue.value),
        accent:
          normalizeSeverity(ramUsageValue.severity) === "CRITICAL"
            ? COLORS.red
            : normalizeSeverity(ramUsageValue.severity) === "WARNING"
            ? COLORS.orange
            : COLORS.pink,
      },
    ];
  }, [
    isMySQL,
    dbStatusValue,
    activeSessionsValue,
    activeTxValue,
    cpuUsedSessionValue,
    uptimeValue,
    cpuUsageValue,
    ramUsageValue,
    threadsConnectedValue,
    threadsRunningValue,
  ]);

  const selectedInfoBlock = useMemo(() => {
    const oracleMap = {
      db_status: { title: "DB STATUS", info: dbStatusInfo },
      active_sessions: { title: "ACTIVE SESSIONS", info: activeSessionsInfo },
      active_transactions: { title: "ACTIVE TRANSACTIONS", info: activeTxInfo },
      cpu_used_session: { title: "CPU USED SESSION", info: cpuUsedSessionInfo },
      uptime_h: { title: "UPTIME", info: uptimeInfo },
      cpu_usage: { title: "CPU USAGE", info: cpuUsageInfo },
      ram_usage: { title: "RAM USAGE", info: ramUsageInfo },
    };

    const mysqlMap = {
      threads_connected: {
        title: "THREADS CONNECTED",
        info: threadsConnectedInfo,
      },
      threads_running: {
        title: "THREADS RUNNING",
        info: threadsRunningInfo,
      },
      cpu_usage: { title: "CPU USAGE", info: cpuUsageInfo },
      ram_usage: { title: "RAM USAGE", info: ramUsageInfo },
    };

    const map = isMySQL ? mysqlMap : oracleMap;
    return openedInfoKey ? map[openedInfoKey] || null : null;
  }, [
    openedInfoKey,
    isMySQL,
    dbStatusInfo,
    activeSessionsInfo,
    activeTxInfo,
    cpuUsedSessionInfo,
    uptimeInfo,
    cpuUsageInfo,
    ramUsageInfo,
    threadsConnectedInfo,
    threadsRunningInfo,
  ]);

  const statusColor =
    globalStatus === "CRITICAL"
      ? "#991b1b"
      : globalStatus === "WARNING"
      ? "#92400e"
      : globalStatus === "OK"
      ? "#166534"
      : globalStatus === "INFO"
      ? "#1e40af"
      : "#475569";

  const statusBg =
    globalStatus === "CRITICAL"
      ? "#fee2e2"
      : globalStatus === "WARNING"
      ? "#fffbeb"
      : globalStatus === "OK"
      ? "#dcfce7"
      : globalStatus === "INFO"
      ? "#eff6ff"
      : "#f1f5f9";

  const statusBorder =
    globalStatus === "CRITICAL"
      ? "#fecaca"
      : globalStatus === "WARNING"
      ? "#fde68a"
      : globalStatus === "OK"
      ? "#bbf7d0"
      : globalStatus === "INFO"
      ? "#bfdbfe"
      : "#e2e8f0";

  if (loading) {
    return <div style={styles.page}>Chargement...</div>;
  }

  if (!targetDbs.length) {
    return <div style={styles.page}>Aucune base disponible.</div>;
  }

  if (!overview && !loadingOverview) {
    return <div style={styles.page}>Impossible de charger la vue globale.</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerTop}>
        <div>
          <h1 style={styles.pageTitle}>Vue globale de la base</h1>
          <p style={styles.pageSubtitle}>
            Vision synthétique d&apos;une base surveillée : état, métriques et santé globale
          </p>
        </div>
      </div>

      <div style={styles.selectWrap}>
        <label style={styles.selectLabel}>Choisir une base</label>
        <select
          value={selectedDbId}
          onChange={(e) => setSelectedDbId(e.target.value)}
          style={styles.select}
        >
          {targetDbs.map((db) => (
            <option key={db.db_id} value={db.db_id}>
              {db.db_name} | {db.host}:{db.port}
            </option>
          ))}
        </select>
      </div>

      {overview ? (
        <>
          <div style={styles.heroCard}>
            <div style={styles.heroRow}>
              <div>
                <div style={styles.heroTitle}>{overview.db_name}</div>
                <div style={styles.heroMetaWrap}>
                  <span style={styles.metaChip}>
                    <b style={styles.metaChipLabel}>Host</b> {overview.host}
                  </span>
                  <span style={styles.metaChip}>
                    <b style={styles.metaChipLabel}>Port</b> {overview.port}
                  </span>
                  <span style={styles.metaChip}>
                    <b style={styles.metaChipLabel}>Service</b> {overview.service_name || "-"}
                  </span>
                  <span style={styles.metaChip}>
                    <b style={styles.metaChipLabel}>SID</b> {overview.sid || "-"}
                  </span>
                  <span style={styles.metaChip}>
                    <b style={styles.metaChipLabel}>Type</b> {overview.db_type_name || "-"}
                  </span>
                  <span style={styles.metaChip}>
                    <b style={styles.metaChipLabel}>User</b> {overview.username || "-"}
                  </span>
                  <span style={styles.metaChip}>
                    <b style={styles.metaChipLabel}>Mode archivage</b> {archiveModeValue}
                  </span>
                </div>
              </div>

              <div style={styles.heroRight}>
                <div
                  style={{
                    ...styles.statusChip,
                    background: statusBg,
                    color: statusColor,
                    borderColor: statusBorder,
                  }}
                >
                  ● {globalStatus}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              ...styles.kpiGridDynamic,
              gridTemplateColumns: isMySQL ? "repeat(4, 1fr)" : "repeat(4, 1fr)",
            }}
          >
            {kpiCards.map((card) => (
              <KpiCard
                key={card.key}
                label={card.label}
                value={card.value}
                accent={card.accent}
                clickable
                active={openedInfoKey === card.key}
                onClick={() => handleInfoToggle(card.key)}
              />
            ))}
          </div>

          <div style={{ height: 12 }} />

          <CollapsibleCard
            title="Explication de l’indicateur sélectionné"
            isOpen={openSections.explanation}
            onToggle={() => toggleSection("explanation")}
          >
            <p style={styles.sectionDesc}>
              Cliquez sur une carte KPI en haut pour afficher uniquement son explication.
            </p>

            {selectedInfoBlock ? (
              <InfoDetailsCard
                title={selectedInfoBlock.title}
                info={selectedInfoBlock.info}
                rawValue={
                  openedInfoKey === "uptime_h"
                    ? `${uptimeValue.value ?? "-"} h`
                    : openedInfoKey === "cpu_usage"
                    ? formatPercentValue(cpuUsageValue.value)
                    : openedInfoKey === "ram_usage"
                    ? formatPercentValue(ramUsageValue.value)
                    : null
                }
              />
            ) : (
              <div style={styles.infoBox}>
                Sélectionnez une carte KPI pour voir son explication.
              </div>
            )}
          </CollapsibleCard>

          <div style={{ height: 12 }} />

          <div style={styles.grid2}>
            <CollapsibleCard
              title="Dernières métriques"
              isOpen={openSections.latestMetrics}
              onToggle={() => toggleSection("latestMetrics")}
            >
              {latestMetricsTable.length ? (
                <DataTable
                  columns={["metric_code", "value", "severity", "collected_at"]}
                  rows={latestMetricsTable}
                />
              ) : (
                <div style={styles.infoBox}>Aucune métrique disponible.</div>
              )}
            </CollapsibleCard>

            <CollapsibleCard
              title="Valeurs numériques"
              isOpen={openSections.numericValues}
              onToggle={() => toggleSection("numericValues")}
            >
              {numericMetrics.length ? (
                <div style={{ width: "100%", height: 360 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={numericMetrics}
                      layout="vertical"
                      margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        stroke="#94a3b8"
                      />
                      <YAxis
                        dataKey="metric_code"
                        type="category"
                        width={180}
                        tick={{ fontSize: 11, fill: "#334155" }}
                        stroke="#94a3b8"
                      />
                      <Tooltip formatter={(value) => [value, "Valeur"]} contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="value_number" radius={[0, 8, 8, 0]}>
                        {numericMetrics.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === numericMetrics.length - 1 ? "#2563eb" : "#60a5fa"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={styles.infoBox}>Aucune métrique numérique.</div>
              )}
            </CollapsibleCard>
          </div>

          <div style={{ height: 12 }} />

          <CollapsibleCard
            title="Métriques sensibles"
            isOpen={openSections.sensitiveMetrics}
            onToggle={() => toggleSection("sensitiveMetrics")}
          >
            {sensitiveMetrics.length ? (
              <DataTable
                columns={["metric_code", "value", "severity", "collected_at"]}
                rows={sensitiveMetrics}
              />
            ) : (
              <div style={styles.infoBox}>
                Aucune métrique sensible. Toutes les métriques sont OK ou INFO.
              </div>
            )}
          </CollapsibleCard>

          <div style={{ height: 16 }} />

          <div style={styles.monitoringHeader}>
            <div style={styles.monitoringTitle}>Monitoring détaillé</div>
            <div style={styles.monitoringSubtitle}>
              Historique, exécutions et configuration de monitoring
            </div>
          </div>

          <div style={{ height: 12 }} />

          <CollapsibleCard
            title="Évolution des métriques"
            isOpen={openSections.evolution}
            onToggle={() => toggleSection("evolution")}
          >
            <div style={styles.chartTopRow}>
              <div style={styles.chartHint}>
                Sélectionnez une métrique numérique pour afficher son évolution.
              </div>

              {chartMetricOptions.length > 0 ? (
                <select
                  value={selectedChartMetric}
                  onChange={(e) => setSelectedChartMetric(e.target.value)}
                  style={styles.chartSelect}
                >
                  {chartMetricOptions.map((metric) => (
                    <option key={metric} value={metric}>
                      {metric}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {!chartData.length ? (
              <div style={styles.infoBox}>Aucune valeur numérique disponible.</div>
            ) : (
              <>
                <div style={styles.chartStatsRow}>
                  <MiniMetric label="Métrique" value={selectedChartMetric || "-"} />
                  <MiniMetric label="Dernière valeur" value={chartStats?.last ?? "-"} />
                  <MiniMetric label="Min" value={chartStats?.min ?? "-"} />
                  <MiniMetric label="Max" value={chartStats?.max ?? "-"} />
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
          </CollapsibleCard>

          <div style={{ height: 12 }} />

          <div style={styles.grid2Single}>
            <CollapsibleCard
              title="Historique des runs"
              isOpen={openSections.runs}
              onToggle={() => toggleSection("runs")}
            >
              {!dbRuns.length ? (
                <div style={styles.infoBox}>Aucun run pour cette base.</div>
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
                      started_at: formatDateTime(r.started_at),
                      ended_at: formatDateTime(r.ended_at),
                    }))
                    .sort((a, b) => Number(b.run_id || 0) - Number(a.run_id || 0))
                    .slice(0, 20)}
                />
              )}
            </CollapsibleCard>

            <CollapsibleCard
              title="Métriques configurées"
              isOpen={openSections.configuredMetrics}
              onToggle={() => toggleSection("configuredMetrics")}
            >
              {!compatibleMetrics.length ? (
                <div style={styles.infoBox}>Aucune métrique active pour ce type de base.</div>
              ) : (
                compatibleMetrics.map((m) => (
                  <div key={m.metric_id} style={styles.metricRow}>
                    <div>
                      <div style={styles.metricCode}>{m.metric_code || "—"}</div>
                      <div style={styles.metricFreq}>
                        Fréquence : {m.frequency_sec ?? "—"} s
                      </div>
                      <div style={styles.metricDbType}>
                        Type : {dbTypeMap[String(m.db_type_id)] || "—"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {m.warn_threshold !== null && m.warn_threshold !== undefined ? (
                        <span style={styles.warnChip}>⚠ WARNING : {m.warn_threshold}</span>
                      ) : null}
                      {m.crit_threshold !== null && m.crit_threshold !== undefined ? (
                        <span style={styles.critChip}>🔴 CRITICAL : {m.crit_threshold}</span>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CollapsibleCard>
          </div>
        </>
      ) : (
        <div style={styles.infoBox}>Chargement de la vue globale...</div>
      )}
    </div>
  );
}

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
};

function CollapsibleCard({ title, isOpen, onToggle, children }) {
  return (
    <div style={styles.card}>
      <button type="button" onClick={onToggle} style={styles.collapseButton}>
        <span style={styles.collapseTitle}>{title}</span>
        <span style={styles.collapseIcon}>{isOpen ? "−" : "+"}</span>
      </button>

      {isOpen ? <div style={{ marginTop: 16 }}>{children}</div> : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  subtitle = "",
  clickable = false,
  active = false,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.kpiCard,
        ...(clickable ? styles.kpiCardClickable : {}),
        ...(active ? styles.kpiCardActive : {}),
        textAlign: "left",
        width: "100%",
      }}
    >
      <div style={{ ...styles.kpiTopline, background: accent }} />
      <div style={styles.kpiLabel}>{label}</div>
      <div style={styles.kpiValue}>{value}</div>
      {subtitle ? <div style={styles.kpiSub}>{subtitle}</div> : null}
      {clickable ? (
        <div style={styles.kpiHint}>
          {active ? "Cliquer pour masquer l’explication" : "Cliquer pour voir l’explication"}
        </div>
      ) : null}
    </button>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div style={styles.miniMetric}>
      <div style={styles.miniMetricLabel}>{label}</div>
      <div style={styles.miniMetricValue}>{value}</div>
    </div>
  );
}

function InfoDetailsCard({ title, info, rawValue = null }) {
  const sqlTitle = getSqlTitleLocal(info?.sql_query);
  const sqlHint = getSqlHintLocal(info?.sql_query);

  return (
    <div style={styles.infoDetailsCard}>
      <div style={styles.infoDetailsTitle}>{title}</div>

      {rawValue ? (
        <div style={{ ...styles.explainCard, borderLeftColor: "#10b981" }}>
          <div style={styles.explainLabel}>Valeur affichée</div>
          <div style={styles.explainText}>{rawValue}</div>
        </div>
      ) : null}

      <div style={{ ...styles.explainCard, borderLeftColor: "#3b82f6" }}>
        <div style={styles.explainLabel}>Définition</div>
        <div style={styles.explainText}>{info?.definition || "-"}</div>
      </div>

      <div style={{ ...styles.explainCard, borderLeftColor: "#8b5cf6" }}>
        <div style={styles.explainLabel}>Calcul / logique</div>
        <div style={styles.explainText}>{info?.calculation || "-"}</div>
      </div>

      <div style={styles.infoMetaGrid}>
        {info?.severity ? (
          <div>
            <div style={styles.metaTitle}>Sévérité</div>
            <SeverityBadge severity={info.severity} />
          </div>
        ) : null}

        {info?.collected_at ? (
          <div>
            <div style={styles.metaTitle}>Dernière collecte</div>
            <div style={styles.metaValue}>{formatDateTimeLocal(info.collected_at)}</div>
          </div>
        ) : null}

        {info?.freq !== null && info?.freq !== undefined ? (
          <div>
            <div style={styles.metaTitle}>Fréquence</div>
            <div style={styles.metaValue}>{info.freq} sec</div>
          </div>
        ) : null}
      </div>

      {info?.warn !== null || info?.crit !== null ? (
        <div style={{ marginTop: 10 }}>
          <div style={styles.metaTitle}>Seuils de monitoring</div>
          <div style={styles.thresholdRow}>
            {info?.warn !== null && info?.warn !== undefined ? (
              <span style={styles.warnChip}>⚠️ WARNING : {info.warn}</span>
            ) : null}
            {info?.crit !== null && info?.crit !== undefined ? (
              <span style={styles.critChip}>🔴 CRITICAL : {info.crit}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {info?.unit ? (
        <div style={{ marginTop: 10 }}>
          <span style={styles.metaTitle}>Unité : </span>
          <code style={styles.codeInline}>{info.unit}</code>
        </div>
      ) : null}

      {info?.sql_query ? (
        <div style={{ marginTop: 12 }}>
          {sqlTitle ? <div style={styles.sqlTitle}>{sqlTitle}</div> : null}
          {sqlHint ? <div style={styles.sqlHint}>{sqlHint}</div> : null}
          <pre style={styles.sqlBlock}>{info.sql_query}</pre>
        </div>
      ) : (
        <div style={styles.sqlHint}>SQL non disponible (calcul applicatif)</div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }) {
  const s = String(severity || "").toUpperCase();
  const conf = {
    OK: {
      background: "#f0fdf4",
      color: "#166534",
      borderColor: "#bbf7d0",
    },
    WARNING: {
      background: "#fffbeb",
      color: "#92400e",
      borderColor: "#fde68a",
    },
    CRITICAL: {
      background: "#fff1f2",
      color: "#9f1239",
      borderColor: "#fecdd3",
    },
    INFO: {
      background: "#eff6ff",
      color: "#1e40af",
      borderColor: "#bfdbfe",
    },
    OPEN: {
      background: "#fff1f2",
      color: "#9f1239",
      borderColor: "#fecdd3",
    },
    FAILED: {
      background: "#fff1f2",
      color: "#9f1239",
      borderColor: "#fecdd3",
    },
    SUCCESS: {
      background: "#f0fdf4",
      color: "#166534",
      borderColor: "#bbf7d0",
    },
    RESOLVED: {
      background: "#f8fafc",
      color: "#475569",
      borderColor: "#cbd5e1",
    },
  };

  const style = conf[s] || {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };

  return (
    <span
      style={{
        ...styles.sevBadge,
        background: style.background,
        color: style.color,
        borderColor: style.borderColor,
      }}
    >
      {s || "—"}
    </span>
  );
}

function DataTable({ columns, rows }) {
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
                  {col === "severity" || col === "status" ? (
                    <SeverityBadge severity={row[col]} />
                  ) : row[col] != null && row[col] !== "" ? (
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

function formatDateTimeLocal(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value || "-");
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getSqlTitleLocal(sqlQuery) {
  if (!sqlQuery) return null;
  const sqlUpper = String(sqlQuery).toUpperCase();

  if (["V$", "DBA_", "ALL_", "USER_", "GV$", "DUAL"].some((m) => sqlUpper.includes(m))) {
    return "Requête SQL Oracle (collecte réelle)";
  }
  if (
    ["METRIC_RUNS", "METRIC_VALUES", "METRIC_DEFS", "TARGET_DBS", "ALERTS", "DBMON."].some((m) =>
      sqlUpper.includes(m)
    )
  ) {
    return "Requête SQL interne DBMON (base de monitoring)";
  }
  if (sqlUpper.includes("PERFORMANCE_SCHEMA") || sqlUpper.includes("THREADS_")) {
    return "Requête SQL MySQL (collecte réelle)";
  }
  return "Requête SQL utilisée";
}

function getSqlHintLocal(sqlQuery) {
  if (!sqlQuery) return null;
  const sqlUpper = String(sqlQuery).toUpperCase();

  if (["V$", "DBA_", "ALL_", "USER_", "GV$", "DUAL"].some((m) => sqlUpper.includes(m))) {
    return "Cette requête est exécutée sur la base Oracle cible surveillée.";
  }
  if (
    ["METRIC_RUNS", "METRIC_VALUES", "METRIC_DEFS", "TARGET_DBS", "ALERTS", "DBMON."].some((m) =>
      sqlUpper.includes(m)
    )
  ) {
    return "Cette requête interroge la base interne DBMON, pas la base cible.";
  }
  if (sqlUpper.includes("PERFORMANCE_SCHEMA") || sqlUpper.includes("THREADS_")) {
    return "Cette requête est exécutée sur la base MySQL cible surveillée.";
  }
  return "Cette requête est utilisée par l'application pour calculer ou présenter l'indicateur.";
}

const styles = {
  page: {
    padding: 24,
    background: "#f8fafc",
    minHeight: "100vh",
    color: "#0f172a",
  },
  headerTop: {
    marginBottom: 16,
  },
  pageTitle: {
    margin: 0,
    fontSize: 32,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  pageSubtitle: {
    margin: "8px 0 0 0",
    fontSize: 15,
    color: "#64748b",
  },
  selectWrap: {
    marginBottom: 18,
  },
  selectLabel: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 8,
  },
  select: {
    padding: "11px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 14,
    minWidth: 320,
    color: "#0f172a",
  },
  heroCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: "20px 24px",
    boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
    marginBottom: 18,
  },
  heroRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 16,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  heroMetaWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  metaChip: {
    background: "#f1f5f9",
    borderRadius: 8,
    padding: "4px 10px",
    fontSize: 13,
    color: "#64748b",
  },
  metaChipLabel: {
    color: "#334155",
  },
  heroRight: {
    textAlign: "right",
  },
  statusChip: {
    display: "inline-block",
    padding: "6px 14px",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: "0.06em",
    border: "1px solid",
  },
  kpiGridDynamic: {
    display: "grid",
    gap: 16,
    marginBottom: 16,
  },
  kpiCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "16px 18px",
    boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
    position: "relative",
    overflow: "hidden",
    minHeight: 118,
  },
  kpiCardClickable: {
    cursor: "pointer",
    transition: "all 0.18s ease",
  },
  kpiCardActive: {
    transform: "translateY(-2px)",
    boxShadow: "0 10px 24px rgba(37,99,235,0.10)",
    border: "1px solid #bfdbfe",
    background: "#f8fbff",
  },
  kpiTopline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: "3px 3px 0 0",
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    color: "#94a3b8",
    marginTop: 8,
    marginBottom: 10,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.1,
  },
  kpiSub: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 6,
  },
  kpiHint: {
    marginTop: 10,
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },
  card: {
    background: "#fff",
    padding: 20,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  },
  sectionDesc: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 0,
    marginBottom: 14,
  },
  infoDetailsCard: {
    border: "1px solid #dbeafe",
    background: "#ffffff",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
  },
  infoDetailsTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#1d4ed8",
    marginBottom: 14,
  },
  explainCard: {
    background: "#f8fafc",
    borderLeft: "3px solid",
    borderRadius: "0 8px 8px 0",
    padding: "12px 14px",
    marginBottom: 10,
  },
  explainLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "#94a3b8",
    marginBottom: 4,
  },
  explainText: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 1.6,
  },
  infoMetaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
    marginTop: 6,
  },
  metaTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 6,
  },
  metaValue: {
    fontSize: 14,
    color: "#0f172a",
  },
  sevBadge: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.06em",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid",
    display: "inline-block",
  },
  thresholdRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  warnChip: {
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
    padding: "4px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    display: "inline-block",
  },
  critChip: {
    background: "#fff1f2",
    color: "#9f1239",
    border: "1px solid #fecdd3",
    padding: "4px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    display: "inline-block",
  },
  codeInline: {
    background: "#f1f5f9",
    borderRadius: 6,
    padding: "2px 6px",
  },
  sqlTitle: {
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
  },
  sqlHint: {
    color: "#64748b",
    marginBottom: 8,
    fontSize: 14,
  },
  sqlBlock: {
    margin: 0,
    background: "#0f172a",
    color: "#e2e8f0",
    padding: 14,
    borderRadius: 12,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    fontSize: 13,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1.35fr 1.05fr",
    gap: 16,
  },
  grid2Single: {
    display: "grid",
    gap: 16,
  },
  infoBox: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: "14px 16px",
    color: "#1d4ed8",
    fontWeight: 700,
  },
  miniMetric: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "12px 14px",
  },
  miniMetricLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 700,
    marginBottom: 6,
  },
  miniMetricValue: {
    fontSize: 24,
    fontWeight: 800,
    color: "#0f172a",
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid #e4e9f2",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#fff",
  },
  th: {
    background: "#f1f5fb",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "#8fa0bb",
    padding: "10px 12px",
    borderBottom: "1px solid #e4e9f2",
    textAlign: "left",
  },
  td: {
    fontSize: 13,
    color: "#0d1b2a",
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5fb",
    textAlign: "left",
  },
  rowEven: {
    background: "#ffffff",
  },
  rowOdd: {
    background: "#fbfdff",
  },
  monitoringHeader: {
    marginTop: 6,
    marginBottom: 2,
  },
  monitoringTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  monitoringSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  chartTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  chartHint: {
    fontSize: 13,
    color: "#64748b",
  },
  chartSelect: {
    minWidth: 240,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 14,
    color: "#0f172a",
  },
  chartStatsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 14,
  },
  metricRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "0.9rem 0",
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
  metricDbType: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
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
  collapseTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
  },
  collapseIcon: {
    width: 30,
    height: 30,
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
};