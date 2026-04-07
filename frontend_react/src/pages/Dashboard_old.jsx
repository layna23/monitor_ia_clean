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
  BarChart,
  Bar,
  Cell,
} from "recharts";

const API_BASE = "http://127.0.0.1:8000";

const C = {
  blue: "#3b82f6",
  green: "#10b981",
  red: "#ef4444",
  orange: "#f59e0b",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  gray: "#94a3b8",
  rose: "#9f1239",
  slate: "#475569",
};

const EXCLUDED_MAIN_METRICS = [
  "CPU_USAGE",
  "RAM_USAGE",
  "MEMORY_USAGE",
  "SGA_USAGE",
  "PGA_USAGE",
];

const COMBINED_ORACLE_METRIC_KEY = "__SESSIONS_COMPARISON__";

function matchesAllowedDb(name) {
  const n = String(name || "").trim().toUpperCase();
  return (
    n === "LOCAL_ORCL" ||
    n === "LOCAL_19C" ||
    n === "LOCAL_ORCL_3" ||
    n === "LOCAL_ORCL_22" ||
    n === "ORCL_TEST" ||
    n === "ORCL_TEST_1" ||
    n === "ORCL_TEST_2" ||
    n.startsWith("ORCL_TEST") ||
    n === "MY SQL" ||
    n === "MYSQL" ||
    n.startsWith("MY_SQL")
  );
}

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

function isMysqlDb(db) {
  const dbType = getDbTypeCode(db);
  const dbName = String(db?.db_name || "").trim().toUpperCase();
  const dbTypeId = Number(db?.db_type_id);

  return (
    dbType === "MYSQL" ||
    dbName === "MY SQL" ||
    dbName === "MYSQL" ||
    dbName.startsWith("MY_SQL") ||
    dbTypeId === 2
  );
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
    dbName.includes("19C")
  );
}

function prettifyMetricLabel(code) {
  const value = String(code || "").trim().toUpperCase();

  const map = {
    THREADS_CONNECTED: "Threads connectés",
    THREADS_RUNNING: "Threads actifs",
    QUESTIONS: "Questions",
    UPTIME: "Uptime",
    SLOW_QUERIES: "Requêtes lentes",
    ACTIVE_SESSIONS: "Sessions actives",
    SESSION_COUNT: "Nombre de sessions",
    "TOTAL SESSIONS": "Total sessions",
    ACTIVE_TRANSACTIONS: "Transactions actives",
    LOCKED_OBJECTS: "Objets verrouillés",
    CPU_USED_SESSION: "CPU session",
    INSTANCE_UPTIME_HOURS: "Uptime instance (h)",
    DB_STATUS: "Statut base",
    DB_INFO: "Informations base",
  };

  return map[value] || value;
}

function formatCompactNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("fr-FR");
}

export default function Dashboard() {
  const [targetDbs, setTargetDbs] = useState([]);
  const [metricDefs, setMetricDefs] = useState([]);
  const [alertsData, setAlertsData] = useState([]);
  const [metricRuns, setMetricRuns] = useState([]);
  const [metricValues, setMetricValues] = useState([]);

  const [selectedPeriod, setSelectedPeriod] = useState("7j");
  const [latestMetrics, setLatestMetrics] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState(COMBINED_ORACLE_METRIC_KEY);
  const [selectedDbId, setSelectedDbId] = useState("");

  const [oracleSessionsData, setOracleSessionsData] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsStatusFilter, setSessionsStatusFilter] = useState("ALL");

  const [topSqlData, setTopSqlData] = useState(null);
  const [topSqlLoading, setTopSqlLoading] = useState(false);
  const [excludeDbmonTopSql, setExcludeDbmonTopSql] = useState(false);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  async function apiGet(endpoint, defaultValue = null) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`Erreur API ${endpoint}:`, res.status, text);
        throw new Error(`GET ${endpoint} failed with ${res.status}`);
      }

      const data = await res.json();
      return data ?? defaultValue;
    } catch (e) {
      console.error(`Erreur fetch ${endpoint}:`, e);
      return defaultValue;
    }
  }

  async function getLatestMetricValues() {
    return await apiGet("/metric-values/latest", []);
  }

  async function getOracleSessions(dbId) {
    return await apiGet(`/oracle-sessions/${dbId}`, null);
  }

  async function getOracleTopSql(dbId, excludeDbmon = false) {
    return await apiGet(
      `/collector/oracle-top-sql/${dbId}?exclude_dbmon=${excludeDbmon}`,
      null
    );
  }

  function safeDate(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDateTime(value) {
    const d = safeDate(value);
    if (!d) return String(value || "-");
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function formatChartDateTime(value) {
    const d = safeDate(value);
    if (!d) return String(value || "-");
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}:${pad(d.getSeconds())}`;
  }

  function filterByPeriod(items, periodKey, dateField = "collected_at") {
    if (!Array.isArray(items) || periodKey === "all") return items;

    const now = Date.now();
    const deltas = {
      "24h": 24 * 60 * 60 * 1000,
      "7j": 7 * 24 * 60 * 60 * 1000,
      "30j": 30 * 24 * 60 * 60 * 1000,
    };

    const delta = deltas[periodKey];
    if (!delta) return items;

    return items.filter((item) => {
      const d = safeDate(item?.[dateField]);
      return d ? now - d.getTime() <= delta : false;
    });
  }

  useEffect(() => {
    async function loadAll() {
      try {
        setLoading(true);

        const [dbs, defs, alerts, runs, values, latest] = await Promise.all([
          apiGet("/target-dbs/", []),
          apiGet("/metric-defs/", []),
          apiGet("/alerts/", []),
          apiGet("/metric-runs/", []),
          apiGet("/metric-values/", []),
          getLatestMetricValues(),
        ]);

        setTargetDbs(Array.isArray(dbs) ? dbs : []);
        setMetricDefs(Array.isArray(defs) ? defs : []);
        setAlertsData(Array.isArray(alerts) ? alerts : []);
        setMetricRuns(Array.isArray(runs) ? runs : []);
        setMetricValues(Array.isArray(values) ? values : []);
        setLatestMetrics(Array.isArray(latest) ? latest : []);
      } catch {
        setMessage({ type: "error", text: "Erreur lors du chargement du dashboard." });
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  const allowedDbs = useMemo(() => {
    const rows = targetDbs.filter((db) => matchesAllowedDb(db.db_name));

    rows.sort((a, b) => {
      const aName = String(a.db_name || "").toUpperCase();
      const bName = String(b.db_name || "").toUpperCase();

      if (aName === "LOCAL_19C") return -1;
      if (bName === "LOCAL_19C") return 1;

      if (aName === "LOCAL_ORCL") return -1;
      if (bName === "LOCAL_ORCL") return 1;

      if (aName === "MY SQL" || aName === "MYSQL") return 1;
      if (bName === "MY SQL" || bName === "MYSQL") return -1;

      return aName.localeCompare(bName);
    });

    return rows;
  }, [targetDbs]);

  useEffect(() => {
    if (!allowedDbs.length) return;

    setSelectedDbId((prev) => {
      if (prev && allowedDbs.some((db) => String(db.db_id) === String(prev))) {
        return prev;
      }

      const local19c = allowedDbs.find(
        (db) => String(db.db_name || "").toUpperCase() === "LOCAL_19C"
      );
      if (local19c) return String(local19c.db_id);

      const localOrcl = allowedDbs.find(
        (db) => String(db.db_name || "").toUpperCase() === "LOCAL_ORCL"
      );
      if (localOrcl) return String(localOrcl.db_id);

      return String(allowedDbs[0].db_id);
    });
  }, [allowedDbs]);

  const metricMap = useMemo(() => {
    const map = {};
    metricDefs.forEach((m) => {
      map[String(m.metric_id)] = m.metric_code || "?";
    });
    return map;
  }, [metricDefs]);

  const dbMap = useMemo(() => {
    const map = {};
    targetDbs.forEach((d) => {
      map[String(d.db_id)] = d.db_name || "?";
    });
    return map;
  }, [targetDbs]);

  const selectedDb = useMemo(() => {
    return allowedDbs.find((db) => String(db.db_id) === String(selectedDbId)) || null;
  }, [allowedDbs, selectedDbId]);

  const selectedDbName = selectedDb?.db_name || "-";
  const selectedDbIsMysql = isMysqlDb(selectedDb);
  const selectedDbIsOracle = !!selectedDb && !selectedDbIsMysql && isOracleDb(selectedDb);

  useEffect(() => {
    async function loadSessions() {
      if (!selectedDbId || !selectedDbIsOracle) {
        setOracleSessionsData(null);
        return;
      }

      setSessionsLoading(true);
      const data = await getOracleSessions(selectedDbId);
      setOracleSessionsData(data || null);
      setSessionsLoading(false);
    }

    loadSessions();
  }, [selectedDbId, selectedDbIsOracle]);

  useEffect(() => {
    async function loadTopSql() {
      if (!selectedDbId || !selectedDbIsOracle) {
        setTopSqlData(null);
        return;
      }

      setTopSqlLoading(true);
      const data = await getOracleTopSql(selectedDbId, excludeDbmonTopSql);
      setTopSqlData(data || null);
      setTopSqlLoading(false);
    }

    loadTopSql();
  }, [selectedDbId, excludeDbmonTopSql, selectedDbIsOracle]);

  const metricValuesPrepared = useMemo(() => {
    return metricValues
      .map((v) => ({
        ...v,
        metric_code: metricMap[String(v.metric_id)] || "?",
        db_name:
          v.db_name ||
          dbMap[String(v.db_id)] ||
          targetDbs.find((db) => String(db.db_id) === String(v.db_id))?.db_name ||
          "?",
      }))
      .filter((v) => matchesAllowedDb(v.db_name));
  }, [metricValues, metricMap, dbMap, targetDbs]);

  const filteredMetricValuesAllBases = useMemo(() => {
    return filterByPeriod(metricValuesPrepared, selectedPeriod, "collected_at");
  }, [metricValuesPrepared, selectedPeriod]);

  const filteredMetricValuesSelectedDb = useMemo(() => {
    return filteredMetricValuesAllBases.filter(
      (r) => String(r.db_id) === String(selectedDbId)
    );
  }, [filteredMetricValuesAllBases, selectedDbId]);

  const numericMetricValuesSelectedDb = useMemo(() => {
    return filteredMetricValuesSelectedDb
      .filter((v) => v.value_number !== null && v.value_number !== undefined)
      .map((v) => ({
        ...v,
        value_number_num: Number(v.value_number),
        collected_at_date: safeDate(v.collected_at),
      }))
      .filter((v) => v.collected_at_date && Number.isFinite(v.value_number_num))
      .sort((a, b) => a.collected_at_date - b.collected_at_date);
  }, [filteredMetricValuesSelectedDb]);

  const allMetrics = useMemo(() => {
    const metrics = Array.from(
      new Set(
        numericMetricValuesSelectedDb
          .map((v) => String(v.metric_code || "").trim())
          .filter(
            (code) =>
              code &&
              code !== "?" &&
              code !== "DB_STATUS" &&
              code !== "DB_INFO" &&
              !EXCLUDED_MAIN_METRICS.includes(code.toUpperCase())
          )
      )
    ).sort();

    if (selectedDbIsOracle) {
      return [COMBINED_ORACLE_METRIC_KEY, ...metrics];
    }

    return metrics;
  }, [numericMetricValuesSelectedDb, selectedDbIsOracle]);

  useEffect(() => {
    if (!allMetrics.length) {
      setSelectedMetric(selectedDbIsOracle ? COMBINED_ORACLE_METRIC_KEY : "");
      return;
    }

    setSelectedMetric((prev) => {
      if (prev && allMetrics.includes(prev)) return prev;
      return selectedDbIsOracle ? COMBINED_ORACLE_METRIC_KEY : allMetrics[0];
    });
  }, [allMetrics, selectedDbIsOracle]);

  const mainChartMeta = useMemo(() => {
    if (!selectedMetric || !selectedDbId) {
      return { data: [], hasEnoughPoints: false, lines: [] };
    }

    if (selectedDbIsOracle && selectedMetric === COMBINED_ORACLE_METRIC_KEY) {
      const rows = numericMetricValuesSelectedDb.filter((r) =>
        ["ACTIVE_SESSIONS", "SESSION_COUNT"].includes(String(r.metric_code || "").toUpperCase())
      );

      if (!rows.length) {
        return { data: [], hasEnoughPoints: false, lines: [] };
      }

      const grouped = {};

      rows.forEach((r) => {
        const timestamp = r.collected_at_date.getTime();
        const key = String(timestamp);

        if (!grouped[key]) {
          grouped[key] = {
            time: formatChartDateTime(r.collected_at_date),
            timestamp,
          };
        }

        grouped[key]["ACTIVE_SESSIONS"] =
          String(r.metric_code).toUpperCase() === "ACTIVE_SESSIONS"
            ? r.value_number_num
            : grouped[key]["ACTIVE_SESSIONS"];

        grouped[key]["SESSION_COUNT"] =
          String(r.metric_code).toUpperCase() === "SESSION_COUNT"
            ? r.value_number_num
            : grouped[key]["SESSION_COUNT"];
      });

      const data = Object.values(grouped)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-80);

      const lines = [
        data.some((row) => row.ACTIVE_SESSIONS !== undefined)
          ? {
              key: "ACTIVE_SESSIONS",
              name: `${selectedDbName} - ACTIVE_SESSIONS`,
              stroke: C.blue,
              strokeDasharray: "0",
            }
          : null,
        data.some((row) => row.SESSION_COUNT !== undefined)
          ? {
              key: "SESSION_COUNT",
              name: `${selectedDbName} - SESSION_COUNT`,
              stroke: C.green,
              strokeDasharray: "6 4",
            }
          : null,
      ].filter(Boolean);

      return {
        data,
        hasEnoughPoints: data.length >= 2,
        lines,
      };
    }

    const rows = numericMetricValuesSelectedDb.filter((r) => r.metric_code === selectedMetric);

    if (!rows.length) {
      return { data: [], hasEnoughPoints: false, lines: [] };
    }

    const data = rows
      .map((r) => ({
        time: formatChartDateTime(r.collected_at_date),
        timestamp: r.collected_at_date.getTime(),
        value: r.value_number_num,
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-80);

    return {
      data,
      hasEnoughPoints: data.length >= 2,
      lines: [
        {
          key: "value",
          name: `${selectedDbName} - ${selectedMetric}`,
          stroke: C.blue,
          strokeDasharray: "0",
        },
      ],
    };
  }, [numericMetricValuesSelectedDb, selectedMetric, selectedDbId, selectedDbName, selectedDbIsOracle]);

  const mainLineData = mainChartMeta.data;
  const mainChartLines = mainChartMeta.lines;
  const hasEnoughMainChartPoints = mainChartMeta.hasEnoughPoints;

  const latestMetricValuesChart = useMemo(() => {
    const rows = (Array.isArray(latestMetrics) ? latestMetrics : [])
      .map((item) => {
        const metric_code = item?.metric_code || item?.metric_name || "?";
        const db_name =
          item?.db_name ||
          dbMap[String(item?.db_id)] ||
          targetDbs.find((db) => String(db.db_id) === String(item?.db_id))?.db_name ||
          "?";

        const value =
          item?.value_number !== null && item?.value_number !== undefined
            ? Number(item.value_number)
            : null;

        return {
          ...item,
          metric_code,
          db_name,
          value_number_num: value,
        };
      })
      .filter(
        (item) =>
          String(item.db_name || "").toUpperCase() === String(selectedDbName).toUpperCase() &&
          item.value_number_num !== null &&
          Number.isFinite(item.value_number_num)
      );

    const preferredOrderOracle = [
      "ACTIVE_SESSIONS",
      "SESSION_COUNT",
      "TOTAL SESSIONS",
      "ACTIVE_TRANSACTIONS",
      "LOCKED_OBJECTS",
      "CPU_USED_SESSION",
      "INSTANCE_UPTIME_HOURS",
      "DB_STATUS",
      "TEST_METRIC_02",
    ];

    const preferredOrderMysql = [
      "THREADS_CONNECTED",
      "THREADS_RUNNING",
      "QUESTIONS",
      "UPTIME",
      "SLOW_QUERIES",
    ];

    const preferredOrder = selectedDbIsMysql ? preferredOrderMysql : preferredOrderOracle;

    const sortedRows = rows.sort((a, b) => {
      const ia = preferredOrder.indexOf(a.metric_code);
      const ib = preferredOrder.indexOf(b.metric_code);

      if (ia === -1 && ib === -1) return a.metric_code.localeCompare(b.metric_code);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    return sortedRows.slice(0, 10).map((r) => ({
      metric_code: r.metric_code,
      value_number: r.value_number_num,
      db_name: r.db_name,
      full_label: `${prettifyMetricLabel(r.metric_code)} (${r.db_name})`,
    }));
  }, [latestMetrics, dbMap, selectedDbName, targetDbs, selectedDbIsMysql]);

  const topRecentValues = useMemo(() => {
    const rows = filteredMetricValuesSelectedDb
      .filter((v) => v.value_number !== null && v.value_number !== undefined)
      .map((v) => ({
        ...v,
        value_number_num: Number(v.value_number),
        collected_at_date: safeDate(v.collected_at),
      }))
      .filter(
        (v) =>
          v.collected_at_date &&
          Number.isFinite(v.value_number_num) &&
          v.value_number_num >= 0
      );

    const latestByMetric = {};
    rows
      .sort((a, b) => a.collected_at_date - b.collected_at_date)
      .forEach((r) => {
        latestByMetric[r.metric_code] = r;
      });

    return Object.values(latestByMetric)
      .sort((a, b) => b.value_number_num - a.value_number_num)
      .slice(0, 8)
      .map((r) => ({
        metric_code: prettifyMetricLabel(r.metric_code),
        value_number: r.value_number_num,
      }));
  }, [filteredMetricValuesSelectedDb]);

  const selectedDbLatestRows = useMemo(() => {
    return (Array.isArray(latestMetrics) ? latestMetrics : [])
      .map((item) => ({
        ...item,
        metric_code: item?.metric_code || item?.metric_name || "?",
        db_name:
          item?.db_name ||
          dbMap[String(item?.db_id)] ||
          targetDbs.find((db) => String(db.db_id) === String(item?.db_id))?.db_name ||
          "?",
      }))
      .filter(
        (item) =>
          String(item.db_name || "").toUpperCase() === String(selectedDbName).toUpperCase()
      );
  }, [latestMetrics, dbMap, targetDbs, selectedDbName]);

  const summaryCards = useMemo(() => {
    function getMetricValue(code) {
      const found = selectedDbLatestRows.find((r) => r.metric_code === code);
      if (!found) return null;

      if (found.value_number !== null && found.value_number !== undefined) {
        const n = Number(found.value_number);
        return Number.isFinite(n) ? n : null;
      }

      return found.value_text ?? null;
    }

    if (selectedDbIsMysql) {
      return [
        { label: "Threads connectés", value: getMetricValue("THREADS_CONNECTED") ?? "-" },
        { label: "Threads actifs", value: getMetricValue("THREADS_RUNNING") ?? "-" },
        { label: "Questions", value: getMetricValue("QUESTIONS") ?? "-" },
        { label: "Requêtes lentes", value: getMetricValue("SLOW_QUERIES") ?? "-" },
      ];
    }

    return [
      { label: "Sessions actives", value: getMetricValue("ACTIVE_SESSIONS") ?? "-" },
      {
        label: "Total sessions",
        value: getMetricValue("TOTAL SESSIONS") ?? getMetricValue("SESSION_COUNT") ?? "-",
      },
      { label: "Transactions actives", value: getMetricValue("ACTIVE_TRANSACTIONS") ?? "-" },
      { label: "Objets verrouillés", value: getMetricValue("LOCKED_OBJECTS") ?? "-" },
    ];
  }, [selectedDbLatestRows, selectedDbIsMysql]);

  const mysqlDetailCards = useMemo(() => {
    function getMetricValue(code) {
      const found = selectedDbLatestRows.find((r) => r.metric_code === code);
      if (!found) return null;

      if (found.value_number !== null && found.value_number !== undefined) {
        const n = Number(found.value_number);
        return Number.isFinite(n) ? n : null;
      }

      return found.value_text ?? null;
    }

    return [
      { label: "Base", value: selectedDbName || "-" },
      { label: "Type", value: "MySQL" },
      { label: "Threads connectés", value: getMetricValue("THREADS_CONNECTED") ?? "-" },
      { label: "Threads actifs", value: getMetricValue("THREADS_RUNNING") ?? "-" },
      { label: "Questions", value: getMetricValue("QUESTIONS") ?? "-" },
      { label: "Uptime", value: getMetricValue("UPTIME") ?? "-" },
      { label: "Requêtes lentes", value: getMetricValue("SLOW_QUERIES") ?? "-" },
      { label: "Période", value: selectedPeriod },
    ];
  }, [selectedDbLatestRows, selectedDbName, selectedPeriod]);

  const mysqlLatestTableRows = useMemo(() => {
    return selectedDbLatestRows
      .map((row) => ({
        metric_code: row.metric_code,
        metric_label: prettifyMetricLabel(row.metric_code),
        value:
          row.value_number !== null && row.value_number !== undefined
            ? formatCompactNumber(row.value_number)
            : row.value_text ?? "-",
        collected_at: formatDateTime(row.collected_at || row.created_at || row.updated_at),
      }))
      .sort((a, b) => a.metric_label.localeCompare(b.metric_label));
  }, [selectedDbLatestRows]);

  const filteredOracleSessionsRows = useMemo(() => {
    const rows = Array.isArray(oracleSessionsData?.sessions) ? oracleSessionsData.sessions : [];
    if (sessionsStatusFilter === "ALL") return rows;
    return rows.filter(
      (s) => String(s.status || "").toUpperCase() === sessionsStatusFilter.toUpperCase()
    );
  }, [oracleSessionsData, sessionsStatusFilter]);

  const chartTitle = useMemo(() => {
    if (selectedDbIsOracle && selectedMetric === COMBINED_ORACLE_METRIC_KEY) {
      return `${selectedDbName} - ACTIVE_SESSIONS + SESSION_COUNT`;
    }
    return `${selectedDbName} - ${prettifyMetricLabel(selectedMetric)}`;
  }, [selectedMetric, selectedDbName, selectedDbIsOracle]);

  if (loading) {
    return <div style={styles.page}>Chargement...</div>;
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Dashboard Analytics"
        subtitle="Visualisation des métriques, alertes et performances des bases surveillées"
      />

      {message.text ? (
        <div style={{ marginBottom: 16 }}>
          {message.type === "error" && <ErrorBox text={message.text} />}
        </div>
      ) : null}

      <div style={styles.sectionTitleMain}>DB Monitor — Vue globale</div>
      <div style={styles.sectionSubMain}>
        Analyse consolidée des bases surveillées. Tous les blocs changent selon la base sélectionnée.
      </div>

      <div style={styles.topLayout}>
        <SectionCard>
          <div style={styles.cardTitle}>Filtres</div>

          <FieldLabel text="Base surveillée" />
          <SingleSelectList
            options={allowedDbs.map((db) => ({
              value: String(db.db_id),
              label: db.db_name || `DB ${db.db_id}`,
            }))}
            selected={String(selectedDbId)}
            onChange={setSelectedDbId}
          />

          <div style={{ height: 12 }} />

          <FieldLabel text="Période" />
          <div style={styles.pills}>
            {[
              { key: "24h", label: "24 h" },
              { key: "7j", label: "7 jours" },
              { key: "30j", label: "30 jours" },
              { key: "all", label: "Tout" },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setSelectedPeriod(p.key)}
                style={{
                  ...styles.pill,
                  ...(selectedPeriod === p.key ? styles.pillActive : {}),
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <div style={styles.cardTitle}>
            {selectedDbIsMysql
              ? "Évolution des métriques MySQL collectées"
              : "Évolution des métriques Oracle collectées"}
          </div>

          {allMetrics.length ? (
            <>
              <FieldLabel text="Métriques à afficher" />
              <MetricSelectList
                options={allMetrics}
                selected={selectedMetric}
                onChange={setSelectedMetric}
                specialLabelMap={{
                  [COMBINED_ORACLE_METRIC_KEY]: "ACTIVE_SESSIONS + SESSION_COUNT",
                }}
              />

              <div style={{ width: "100%", height: 380, marginTop: 12 }}>
                {!selectedMetric ? (
                  <InfoBox text="Sélectionnez une métrique." />
                ) : !mainLineData.length ? (
                  <InfoBox text="Aucune donnée disponible pour les filtres choisis." />
                ) : !hasEnoughMainChartPoints ? (
                  <InfoBox text="Pas assez de points collectés pour afficher une tendance." />
                ) : (
                  <ResponsiveContainer>
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
                          strokeDasharray={line.strokeDasharray}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div style={styles.chartCaption}>
                Métrique affichée : <strong>{chartTitle}</strong>
              </div>
            </>
          ) : (
            <InfoBox text="Aucune donnée disponible." />
          )}
        </SectionCard>
      </div>

      <div style={{ height: 18 }} />

      <div style={styles.sectionTitleMain}>
        {selectedDbIsMysql ? "Résumé métriques MySQL" : "Résumé sessions Oracle"}
      </div>
      <div style={styles.sectionSubMain}>
        Vue synthétique pour la base sélectionnée : <strong>{selectedDbName}</strong>.
      </div>

      <SectionCard>
        <div style={styles.grid2}>
          {summaryCards.map((card) => (
            <MetricBox key={card.label} label={card.label} value={card.value} />
          ))}
        </div>
      </SectionCard>

      <div style={{ height: 12 }} />

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

      <div style={{ height: 12 }} />

      <SectionCard>
        <div style={styles.cardTitle}>
          {selectedDbIsMysql
            ? `Top valeurs MySQL récentes — ${selectedDbName}`
            : `Top valeurs Oracle récentes — ${selectedDbName}`}
        </div>
        {topRecentValues.length ? (
          <div style={{ width: "100%", height: 340 }}>
            <ResponsiveContainer>
              <BarChart
                data={topRecentValues}
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
                  dataKey="metric_code"
                  type="category"
                  width={240}
                  tick={{ fontSize: 11, fill: "#334155" }}
                  stroke="#94a3b8"
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
                <Bar dataKey="value_number" radius={[0, 8, 8, 0]}>
                  {topRecentValues.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? C.gray : C.green}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <InfoBox text="Aucune valeur récente disponible." />
        )}
      </SectionCard>

      {selectedDbIsOracle ? (
        <>
          <div style={{ height: 18 }} />

          <div style={styles.sectionTitleMain}>Sessions Oracle ouvertes</div>
          <div style={styles.sectionSubMain}>
            Visualisation détaillée des sessions utilisateur ouvertes sur la base sélectionnée :{" "}
            <strong>{selectedDbName}</strong>.
          </div>

          <SectionCard>
            <div style={styles.grid2}>
              <div>
                <FieldLabel text="Base choisie" />
                <select
                  style={styles.select}
                  value={selectedDbId}
                  onChange={(e) => setSelectedDbId(e.target.value)}
                >
                  {allowedDbs.map((db) => (
                    <option key={db.db_id} value={String(db.db_id)}>
                      {db.db_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel text="Filtrer par statut" />
                <select
                  style={styles.select}
                  value={sessionsStatusFilter}
                  onChange={(e) => setSessionsStatusFilter(e.target.value)}
                >
                  <option value="ALL">Toutes</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div style={{ height: 14 }} />

            {sessionsLoading ? (
              <InfoBox text="Chargement des sessions Oracle..." />
            ) : !oracleSessionsData ? (
              <InfoBox text="Aucune donnée de session disponible." />
            ) : (
              <>
                <div style={styles.grid3}>
                  <MetricBox label="Base" value={oracleSessionsData.db_name || "-"} />
                  <MetricBox label="Sessions ouvertes" value={oracleSessionsData.count ?? 0} />
                  <MetricBox label="Sessions actives" value={oracleSessionsData.active_count ?? 0} />
                </div>

                <div style={{ height: 12 }} />

                <div style={styles.grid3}>
                  <MetricBox
                    label="Sessions inactives"
                    value={oracleSessionsData.inactive_count ?? 0}
                  />
                  <MetricBox label="Filtre actif" value={sessionsStatusFilter} />
                  <MetricBox label="Lignes affichées" value={filteredOracleSessionsRows.length} />
                </div>

                <div style={{ height: 14 }} />

                {filteredOracleSessionsRows.length ? (
                  <CollapsibleTable
                    title="Tableau des sessions Oracle"
                    count={filteredOracleSessionsRows.length}
                    defaultOpen={false}
                  >
                    <SessionTable
                      rows={filteredOracleSessionsRows.map((s) => ({
                        sid: s.sid,
                        "serial#": s["serial#"],
                        username: s.username,
                        osuser: s.osuser,
                        machine: s.machine,
                        program: s.program,
                        status: s.status,
                        event: s.event,
                        sql_id: s.sql_id,
                        logon_time: formatDateTime(s.logon_time),
                      }))}
                    />
                  </CollapsibleTable>
                ) : (
                  <InfoBox text="Aucune session à afficher pour ce filtre." />
                )}
              </>
            )}
          </SectionCard>

          <div style={{ height: 18 }} />

          <div style={styles.sectionTitleMain}>Top 10 requêtes SQL</div>
          <div style={styles.sectionSubMain}>
            Requêtes SQL les plus intensives détectées sur la base Oracle sélectionnée.
          </div>

          <SectionCard>
            <div style={styles.grid2}>
              <div>
                <FieldLabel text="Base sélectionnée" />
                <select
                  style={styles.select}
                  value={selectedDbId}
                  onChange={(e) => setSelectedDbId(e.target.value)}
                >
                  {allowedDbs.map((db) => (
                    <option key={db.db_id} value={String(db.db_id)}>
                      {db.db_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel text="Mode d'affichage" />
                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={excludeDbmonTopSql}
                    onChange={(e) => setExcludeDbmonTopSql(e.target.checked)}
                  />
                  <span>
                    Exclure les requêtes du schéma <strong>DBMON</strong>
                  </span>
                </label>
              </div>
            </div>

            <div style={{ height: 14 }} />

            {topSqlLoading ? (
              <InfoBox text="Chargement du Top 10 SQL..." />
            ) : !topSqlData ? (
              <InfoBox text="Aucune donnée Top SQL disponible." />
            ) : (
              <>
                <div style={styles.grid4}>
                  <MetricBox label="Base" value={topSqlData.db_name || "-"} />
                  <MetricBox label="Requêtes trouvées" value={topSqlData.count ?? 0} />
                  <MetricBox
                    label="Exclude DBMON"
                    value={topSqlData.exclude_dbmon ? "Oui" : "Non"}
                  />
                  <MetricBox
                    label="Schémas exclus"
                    value={
                      Array.isArray(topSqlData.excluded_schemas)
                        ? topSqlData.excluded_schemas.join(", ")
                        : "-"
                    }
                  />
                </div>

                <div style={{ height: 16 }} />

                {Array.isArray(topSqlData.queries) && topSqlData.queries.length ? (
                  <CollapsibleTable
                    title="Tableau Top 10 requêtes SQL"
                    count={topSqlData.queries.length}
                    defaultOpen={true}
                  >
                    <TopSqlModernTable rows={topSqlData.queries} />
                  </CollapsibleTable>
                ) : (
                  <InfoBox text="Aucune requête SQL à afficher pour ce filtre." />
                )}
              </>
            )}
          </SectionCard>
        </>
      ) : (
        <>
          <div style={{ height: 18 }} />

          <div style={styles.sectionTitleMain}>Analyse MySQL avancée</div>
          <div style={styles.sectionSubMain}>
            Monitoring détaillé des performances MySQL pour la base sélectionnée :{" "}
            <strong>{selectedDbName}</strong>.
          </div>

          <SectionCard>
            <div style={styles.grid4}>
              {mysqlDetailCards.map((card) => (
                <MetricBox key={card.label} label={card.label} value={card.value} />
              ))}
            </div>
          </SectionCard>

          <div style={{ height: 12 }} />

          <SectionCard>
            <div style={styles.cardTitle}>État MySQL</div>
            <div style={styles.mysqlHealthGrid}>
              <HealthCard
                title="Connexions"
                value={summaryCards[0]?.value}
                state={Number(summaryCards[0]?.value) > 100 ? "warning" : "good"}
                subtitle="Nombre actuel de threads connectés"
              />
              <HealthCard
                title="Activité"
                value={summaryCards[1]?.value}
                state={Number(summaryCards[1]?.value) > 20 ? "warning" : "good"}
                subtitle="Threads en cours d'exécution"
              />
              <HealthCard
                title="Charge requêtes"
                value={summaryCards[2]?.value}
                state="info"
                subtitle="Nombre de questions observées"
              />
              <HealthCard
                title="Slow queries"
                value={summaryCards[3]?.value}
                state={Number(summaryCards[3]?.value) > 0 ? "warning" : "good"}
                subtitle="Requêtes lentes détectées"
              />
            </div>
          </SectionCard>

          <div style={{ height: 12 }} />

          <SectionCard>
            <div style={styles.cardTitle}>Dernières métriques MySQL</div>
            {mysqlLatestTableRows.length ? (
              <CollapsibleTable
                title="Tableau des métriques MySQL"
                count={mysqlLatestTableRows.length}
                defaultOpen={true}
              >
                <MysqlMetricTable rows={mysqlLatestTableRows} />
              </CollapsibleTable>
            ) : (
              <InfoBox text="Aucune métrique MySQL disponible." />
            )}
          </SectionCard>
        </>
      )}
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

function FieldLabel({ text }) {
  return <div style={styles.fieldLabel}>{text}</div>;
}

function CollapsibleTable({ title, defaultOpen = false, children, count }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={styles.collapsibleWrap}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={styles.collapsibleButton}
      >
        <span>
          {open ? "▼" : "▶"} {title}
          {count !== undefined ? ` (${count})` : ""}
        </span>
        <span style={styles.collapsibleHint}>{open ? "Fermer" : "Ouvrir"}</span>
      </button>

      {open ? <div style={styles.collapsibleContent}>{children}</div> : null}
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div style={styles.metricBox}>
      <div style={styles.metricBoxLabel}>{label}</div>
      <div style={styles.metricBoxValue}>{String(value ?? "-")}</div>
    </div>
  );
}

function HealthCard({ title, value, subtitle, state = "info" }) {
  const palette = {
    good: {
      background: "#ecfdf5",
      border: "#a7f3d0",
      value: "#065f46",
      badgeBg: "#d1fae5",
      badgeColor: "#065f46",
      badgeText: "Stable",
    },
    warning: {
      background: "#fff7ed",
      border: "#fdba74",
      value: "#9a3412",
      badgeBg: "#fed7aa",
      badgeColor: "#9a3412",
      badgeText: "À surveiller",
    },
    info: {
      background: "#eff6ff",
      border: "#bfdbfe",
      value: "#1d4ed8",
      badgeBg: "#dbeafe",
      badgeColor: "#1d4ed8",
      badgeText: "Info",
    },
  };

  const p = palette[state] || palette.info;

  return (
    <div
      style={{
        background: p.background,
        border: `1px solid ${p.border}`,
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={styles.healthCardTop}>
        <div style={styles.healthCardTitle}>{title}</div>
        <span
          style={{
            ...styles.healthBadge,
            background: p.badgeBg,
            color: p.badgeColor,
          }}
        >
          {p.badgeText}
        </span>
      </div>
      <div style={{ ...styles.healthCardValue, color: p.value }}>{String(value ?? "-")}</div>
      <div style={styles.healthCardSubtitle}>{subtitle}</div>
    </div>
  );
}

function ErrorBox({ text }) {
  return <div style={styles.errorBox}>{text}</div>;
}

function InfoBox({ text }) {
  return <div style={styles.infoBox}>{text}</div>;
}

function SingleSelectList({ options, selected, onChange }) {
  return (
    <div style={styles.singleSelectBox}>
      {options.map((option) => {
        const active = String(selected) === String(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(String(option.value))}
            style={{
              ...styles.dbOption,
              ...(active ? styles.dbOptionActive : {}),
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MetricSelectList({ options, selected, onChange, specialLabelMap = {} }) {
  return (
    <div style={styles.multiSelectBox}>
      {options.map((option) => {
        const active = selected === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            style={{
              ...styles.multiOption,
              ...(active ? styles.multiOptionActive : {}),
            }}
          >
            {specialLabelMap[option] || prettifyMetricLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

function TopSqlModernTable({ rows }) {
  function formatNumberLocal(value) {
    if (value === null || value === undefined || value === "") return "-";
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return n.toLocaleString("fr-FR");
  }

  function truncateSqlLocal(sql, max = 110) {
    if (!sql) return "SQL non disponible";
    const clean = String(sql).replace(/\s+/g, " ").trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max)}...`;
  }

  function formatDateTimeLocal(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function getStatusBadgeStyle(status) {
    const s = String(status || "").toUpperCase();

    if (s === "EN COURS" || s === "ACTIVE" || s === "RUNNING") {
      return {
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #bbf7d0",
      };
    }

    return {
      background: "#f1f5f9",
      color: "#475569",
      border: "1px solid #e2e8f0",
    };
  }

  return (
    <div style={styles.topSqlWrap}>
      <table style={styles.topSqlTable}>
        <thead>
          <tr>
            <th style={styles.topSqlTh}>SQL_ID</th>
            <th style={styles.topSqlTh}>Schéma</th>
            <th style={styles.topSqlTh}>Extrait SQL</th>
            <th style={styles.topSqlThCenter}>Exécutions</th>
            <th style={styles.topSqlThCenter}>Elapsed (s)</th>
            <th style={styles.topSqlThCenter}>CPU (s)</th>
            <th style={styles.topSqlThCenter}>Buffer Gets</th>
            <th style={styles.topSqlThCenter}>Disk Reads</th>
            <th style={styles.topSqlThCenter}>Dernière activité</th>
            <th style={styles.topSqlThCenter}>Statut</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={`${row.sql_id || "sql"}-${idx}`}
              style={idx % 2 === 0 ? styles.topSqlRowEven : styles.topSqlRowOdd}
            >
              <td style={styles.topSqlTd}>
                <span style={styles.sqlIdBadge}>{row.sql_id || "-"}</span>
              </td>

              <td style={styles.topSqlTd}>
                <span
                  style={{
                    ...styles.schemaBadge,
                    ...(String(row.parsing_schema_name || "").toUpperCase() === "DBMON"
                      ? styles.schemaBadgeBlue
                      : styles.schemaBadgeGray),
                  }}
                >
                  {row.parsing_schema_name || "-"}
                </span>
              </td>

              <td style={styles.topSqlTd}>
                <details style={styles.sqlDetails}>
                  <summary style={styles.sqlSummary}>
                    {truncateSqlLocal(row.sql_text, 110)}
                  </summary>
                  <pre style={styles.sqlExpandedBlock}>
                    {row.sql_text || "SQL non disponible"}
                  </pre>
                </details>
              </td>

              <td style={styles.topSqlTdCenter}>{formatNumberLocal(row.executions)}</td>
              <td style={styles.topSqlTdCenter}>
                {formatNumberLocal(row.elapsed_time_sec ?? row.elapsed_time)}
              </td>
              <td style={styles.topSqlTdCenter}>
                {formatNumberLocal(row.cpu_time_sec ?? row.cpu_time)}
              </td>
              <td style={styles.topSqlTdCenter}>{formatNumberLocal(row.buffer_gets)}</td>
              <td style={styles.topSqlTdCenter}>{formatNumberLocal(row.disk_reads)}</td>
              <td style={styles.topSqlTdCenter}>
                {formatDateTimeLocal(row.last_active_time)}
              </td>
              <td style={styles.topSqlTdCenter}>
                <span
                  style={{
                    ...styles.runningStatusBadge,
                    ...getStatusBadgeStyle(row.running_status),
                  }}
                >
                  {row.running_status || "INCONNU"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionTable({ rows }) {
  const columns = [
    "sid",
    "serial#",
    "username",
    "osuser",
    "machine",
    "program",
    "status",
    "event",
    "sql_id",
    "logon_time",
  ];

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
          {rows.map((row, idx) => {
            const status = String(row.status || "").toUpperCase();
            const rowStyle =
              status === "ACTIVE"
                ? styles.sessionRowActive
                : idx % 2 === 0
                ? styles.rowEven
                : styles.rowOdd;

            return (
              <tr key={idx} style={rowStyle}>
                {columns.map((col) => (
                  <td key={col} style={styles.td}>
                    {col === "status" ? (
                      <span
                        style={{
                          ...styles.statusBadge,
                          ...(status === "ACTIVE"
                            ? styles.statusBadgeActive
                            : styles.statusBadgeInactive),
                        }}
                      >
                        {row[col] != null && row[col] !== "" ? String(row[col]) : "—"}
                      </span>
                    ) : row[col] != null && row[col] !== "" ? (
                      String(row[col])
                    ) : (
                      "—"
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MysqlMetricTable({ rows }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Code</th>
            <th style={styles.th}>Libellé</th>
            <th style={styles.th}>Valeur</th>
            <th style={styles.th}>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.metric_code}-${idx}`} style={idx % 2 === 0 ? styles.rowEven : styles.rowOdd}>
              <td style={styles.td}>{row.metric_code}</td>
              <td style={styles.td}>{row.metric_label}</td>
              <td style={styles.td}>{row.value}</td>
              <td style={styles.td}>{row.collected_at}</td>
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
    background: "#f6f8fc",
    minHeight: "100vh",
    color: "#0f172a",
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: 900,
    marginBottom: 6,
    letterSpacing: "-0.02em",
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  sectionTitleMain: {
    fontSize: "1.6rem",
    fontWeight: 800,
    color: "#0f172a",
    marginTop: "0.2rem",
    marginBottom: "0.15rem",
    letterSpacing: "-0.02em",
  },
  sectionSubMain: {
    fontSize: "0.92rem",
    color: "#64748b",
    marginBottom: "1rem",
  },
  topLayout: {
    display: "grid",
    gridTemplateColumns: "1fr 2.8fr",
    gap: 16,
  },
  card: {
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 8,
  },
  chartCaption: {
    marginTop: 8,
    fontSize: 13,
    color: "#475569",
  },
  singleSelectBox: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  dbOption: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    borderRadius: 12,
    padding: "0.95rem 1rem",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  dbOptionActive: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    boxShadow: "0 0 0 1px rgba(59,130,246,0.08) inset",
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
  pills: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    borderRadius: 999,
    padding: "0.45rem 0.8rem",
    fontSize: 13,
    cursor: "pointer",
  },
  pillActive: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontWeight: 700,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
  },
  grid4: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: 12,
  },
  metricBox: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 14,
  },
  metricBoxLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 700,
    marginBottom: 6,
  },
  metricBoxValue: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
  },
  select: {
    width: "100%",
    padding: "0.75rem 0.9rem",
    borderRadius: 12,
    border: "1.5px solid #e4e9f2",
    background: "#fff",
    fontSize: 14,
    boxSizing: "border-box",
  },
  checkboxRow: {
    width: "100%",
    minHeight: 48,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0.75rem 0.9rem",
    borderRadius: 12,
    border: "1.5px solid #e4e9f2",
    background: "#fff",
    boxSizing: "border-box",
    fontSize: 14,
    color: "#334155",
  },
  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: 12,
    padding: "1rem 1.1rem",
    color: "#9f1239",
    fontWeight: 800,
  },
  infoBox: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: "1rem 1.1rem",
    color: "#1d4ed8",
    fontWeight: 700,
  },
  collapsibleWrap: {
    border: "1px solid #dbe4f0",
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
  },
  collapsibleButton: {
    width: "100%",
    border: "none",
    background: "#f8fafc",
    padding: "0.9rem 1rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    cursor: "pointer",
    textAlign: "left",
  },
  collapsibleHint: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
  },
  collapsibleContent: {
    padding: 0,
    background: "#fff",
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
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "#8fa0bb",
    padding: "0.65rem 0.9rem",
    borderBottom: "1px solid #e4e9f2",
    textAlign: "left",
  },
  td: {
    fontSize: "0.8rem",
    color: "#0d1b2a",
    padding: "0.55rem 0.9rem",
    borderBottom: "1px solid #f1f5fb",
    textAlign: "left",
    verticalAlign: "top",
  },
  rowEven: {
    background: "#ffffff",
  },
  rowOdd: {
    background: "#fbfdff",
  },
  sessionRowActive: {
    background: "#f0fdf4",
  },
  statusBadge: {
    display: "inline-block",
    borderRadius: 999,
    padding: "0.18rem 0.55rem",
    fontSize: 12,
    fontWeight: 800,
  },
  statusBadgeActive: {
    background: "#dcfce7",
    color: "#166534",
  },
  statusBadgeInactive: {
    background: "#e2e8f0",
    color: "#334155",
  },
  topSqlWrap: {
    width: "100%",
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    background: "#ffffff",
  },
  topSqlTable: {
    width: "100%",
    minWidth: 1450,
    borderCollapse: "separate",
    borderSpacing: 0,
    background: "#ffffff",
  },
  topSqlTh: {
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: "0.9rem 1rem",
    textAlign: "left",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    zIndex: 1,
    whiteSpace: "nowrap",
  },
  topSqlThCenter: {
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: "0.9rem 1rem",
    textAlign: "center",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    zIndex: 1,
    whiteSpace: "nowrap",
  },
  topSqlRowEven: {
    background: "#ffffff",
  },
  topSqlRowOdd: {
    background: "#fbfdff",
  },
  topSqlTd: {
    padding: "0.95rem 1rem",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "top",
    fontSize: 13,
    color: "#0f172a",
  },
  topSqlTdCenter: {
    padding: "0.95rem 1rem",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "middle",
    textAlign: "center",
    fontSize: 13,
    color: "#0f172a",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  sqlIdBadge: {
    display: "inline-block",
    padding: "0.28rem 0.62rem",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#4338ca",
    border: "1px solid #c7d2fe",
    fontSize: 12,
    fontWeight: 800,
    fontFamily: "monospace",
  },
  schemaBadge: {
    display: "inline-block",
    padding: "0.28rem 0.62rem",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },
  schemaBadgeBlue: {
    background: "#dbeafe",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  },
  schemaBadgeGray: {
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
  },
  sqlDetails: {
    width: "100%",
  },
  sqlSummary: {
    cursor: "pointer",
    listStyle: "none",
    color: "#0f172a",
    lineHeight: 1.45,
    fontFamily: "monospace",
    fontSize: 12,
    outline: "none",
  },
  sqlExpandedBlock: {
    marginTop: 10,
    marginBottom: 0,
    padding: 12,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily: "monospace",
  },
  runningStatusBadge: {
    display: "inline-block",
    padding: "0.3rem 0.65rem",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    minWidth: 88,
  },
  mysqlHealthGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: 12,
  },
  healthCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  healthCardTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
  },
  healthBadge: {
    display: "inline-block",
    padding: "0.22rem 0.55rem",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
  },
  healthCardValue: {
    fontSize: 24,
    fontWeight: 900,
    marginBottom: 6,
  },
  healthCardSubtitle: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.4,
  },
};