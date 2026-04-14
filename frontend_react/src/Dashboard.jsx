import { useEffect, useMemo, useState } from "react";
import DashboardHeader from "./components/dashboard/DashboardHeader";
import DashboardFilters from "./components/dashboard/DashboardFilters";
import DashboardMainCharts from "./components/dashboard/DashboardMainCharts";
import DashboardSummary from "./components/dashboard/DashboardSummary";
import DashboardCurrentValues from "./components/dashboard/DashboardCurrentValues";
import DashboardRecentTable from "./components/dashboard/DashboardRecentTable";
import DashboardOracleTopSql from "./components/dashboard/DashboardOracleTopSql";
import DashboardOracleSessions from "./components/dashboard/DashboardOracleSessions";

const API_BASE = "http://127.0.0.1:8000";
const COMBINED_ORACLE_METRIC_KEY = "__SESSIONS_COMPARISON__";

const EXCLUDED_MAIN_METRICS = [
  "CPU_USAGE",
  "RAM_USAGE",
  "MEMORY_USAGE",
  "SGA_USAGE",
  "PGA_USAGE",
];

const C = {
  blue: "#3b82f6",
  green: "#10b981",
};

function safeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatChartDateTime(value) {
  const d = safeDate(value);
  if (!d) return "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
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
    TOTAL_SESSIONS: "Total sessions",
    "TOTAL SESSIONS": "Total sessions",
    ACTIVE_TRANSACTIONS: "Transactions actives",
    LOCKED_OBJECTS: "Objets verrouillés",
    CPU_USED_SESSION: "CPU session",
    INSTANCE_UPTIME_HOURS: "Uptime instance (h)",
    DB_STATUS: "Statut base",
    DB_INFO: "Informations base",
    TEST_METRIC_02: "Test metric 02",
    CPU_USAGE: "CPU usage",
    RAM_USAGE: "RAM usage",
  };

  return map[value] || value || "-";
}

function isMysqlDb(db) {
  const dbName = String(db?.db_name || "").toUpperCase();
  const dbTypeName = String(db?.db_type_name || "").toUpperCase();
  return dbName.includes("MYSQL") || dbTypeName.includes("MYSQL");
}

export default function Dashboard() {
  const [targetDbs, setTargetDbs] = useState([]);
  const [metricDefs, setMetricDefs] = useState([]);
  const [metricValues, setMetricValues] = useState([]);
  const [latestMetrics, setLatestMetrics] = useState([]);

  const [selectedDbId, setSelectedDbId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("7j");
  const [selectedMetric, setSelectedMetric] = useState(COMBINED_ORACLE_METRIC_KEY);
  const [loading, setLoading] = useState(true);

  const [topSqlData, setTopSqlData] = useState(null);
  const [topSqlLoading, setTopSqlLoading] = useState(false);
  const [excludeDbmonTopSql, setExcludeDbmonTopSql] = useState(false);

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

  async function getOracleTopSql(dbId, excludeDbmon = false) {
    return await apiGet(
      `/collector/oracle-top-sql/${dbId}?exclude_dbmon=${excludeDbmon}`,
      null
    );
  }

  useEffect(() => {
    async function load() {
      try {
        const [dbs, defs, values, latest] = await Promise.all([
          apiGet("/target-dbs/", []),
          apiGet("/metric-defs/", []),
          apiGet("/metric-values/", []),
          apiGet("/metric-values/latest", []),
        ]);

        const dbRows = Array.isArray(dbs) ? dbs : [];

        setTargetDbs(dbRows);
        setMetricDefs(Array.isArray(defs) ? defs : []);
        setMetricValues(Array.isArray(values) ? values : []);
        setLatestMetrics(Array.isArray(latest) ? latest : []);

        if (dbRows.length > 0) {
          const local19c =
            dbRows.find(
              (db) => String(db.db_name || "").trim().toUpperCase() === "LOCAL_19C"
            ) || dbRows[0];

          setSelectedDbId(String(local19c.db_id));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const selectedDb = useMemo(() => {
    return targetDbs.find((db) => String(db.db_id) === String(selectedDbId)) || null;
  }, [targetDbs, selectedDbId]);

  const selectedDbName = selectedDb?.db_name || "-";
  const selectedDbIsMysql = isMysqlDb(selectedDb);
  const selectedDbIsOracle = !!selectedDb && !selectedDbIsMysql;

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

  const metricMap = useMemo(() => {
    const map = {};
    metricDefs.forEach((m) => {
      map[String(m.metric_id)] = m.metric_code || "-";
    });
    return map;
  }, [metricDefs]);

  const filteredMetricValuesSelectedDb = useMemo(() => {
    return metricValues
      .filter((v) => String(v.db_id) === String(selectedDbId))
      .map((v) => ({
        ...v,
        metric_code: v.metric_code || metricMap[String(v.metric_id)] || "-",
        value_number_num: Number(v.value_number),
        collected_at_date: safeDate(v.collected_at),
      }))
      .filter((v) => v.collected_at_date && Number.isFinite(v.value_number_num))
      .sort((a, b) => a.collected_at_date - b.collected_at_date);
  }, [metricValues, selectedDbId, metricMap]);

  const allMetrics = useMemo(() => {
    const metrics = Array.from(
      new Set(
        filteredMetricValuesSelectedDb
          .map((v) => String(v.metric_code || "").trim())
          .filter(
            (code) =>
              code &&
              code !== "-" &&
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
  }, [filteredMetricValuesSelectedDb, selectedDbIsOracle]);

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
    if (!selectedDbId || !selectedMetric) {
      return { data: [], lines: [], hasEnoughPoints: false };
    }

    if (selectedDbIsOracle && selectedMetric === COMBINED_ORACLE_METRIC_KEY) {
      const rows = filteredMetricValuesSelectedDb.filter((r) =>
        ["ACTIVE_SESSIONS", "SESSION_COUNT"].includes(
          String(r.metric_code || "").toUpperCase()
        )
      );

      if (!rows.length) {
        return { data: [], lines: [], hasEnoughPoints: false };
      }

      const grouped = {};

      rows.forEach((r) => {
        const timestamp = r.collected_at_date.getTime();
        const key = String(timestamp);

        if (!grouped[key]) {
          grouped[key] = {
            time: formatChartDateTime(r.collected_at_date),
            timestamp,
            ACTIVE_SESSIONS: null,
            SESSION_COUNT: null,
          };
        }

        const metricCode = String(r.metric_code || "").toUpperCase();

        if (metricCode === "ACTIVE_SESSIONS") {
          grouped[key].ACTIVE_SESSIONS = r.value_number_num;
        }

        if (metricCode === "SESSION_COUNT") {
          grouped[key].SESSION_COUNT = r.value_number_num;
        }
      });

      let lastSessionCount = null;

      const data = Object.values(grouped)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((row) => {
          if (row.SESSION_COUNT === null) {
            row.SESSION_COUNT = lastSessionCount;
          } else {
            lastSessionCount = row.SESSION_COUNT;
          }
          return row;
        })
        .slice(-80);

      const lines = [
        data.some((row) => row.ACTIVE_SESSIONS !== null && row.ACTIVE_SESSIONS !== undefined)
          ? {
              key: "ACTIVE_SESSIONS",
              name: `${selectedDbName} - ACTIVE_SESSIONS`,
              stroke: C.blue,
              strokeDasharray: "0",
            }
          : null,
        data.some((row) => row.SESSION_COUNT !== null && row.SESSION_COUNT !== undefined)
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
        lines,
        hasEnoughPoints: data.length >= 2,
      };
    }

    const rows = filteredMetricValuesSelectedDb.filter(
      (r) => String(r.metric_code) === String(selectedMetric)
    );

    if (!rows.length) {
      return { data: [], lines: [], hasEnoughPoints: false };
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
      lines: [
        {
          key: "value",
          name: `${selectedDbName} - ${selectedMetric}`,
          stroke: C.blue,
          strokeDasharray: "0",
        },
      ],
      hasEnoughPoints: data.length >= 2,
    };
  }, [
    filteredMetricValuesSelectedDb,
    selectedDbId,
    selectedMetric,
    selectedDbIsOracle,
    selectedDbName,
  ]);

  const mainLineData = mainChartMeta.data;
  const mainChartLines = mainChartMeta.lines;
  const hasEnoughMainChartPoints = mainChartMeta.hasEnoughPoints;

  const chartTitle = useMemo(() => {
    if (selectedDbIsOracle && selectedMetric === COMBINED_ORACLE_METRIC_KEY) {
      return `${selectedDbName} - ACTIVE_SESSIONS + SESSION_COUNT`;
    }
    return `${selectedDbName} - ${prettifyMetricLabel(selectedMetric)}`;
  }, [selectedDbIsOracle, selectedMetric, selectedDbName]);

  const summaryCards = useMemo(() => {
    const latestByMetric = {};
    filteredMetricValuesSelectedDb.forEach((row) => {
      latestByMetric[row.metric_code] = row.value_number_num;
    });

    if (selectedDbIsMysql) {
      return [
        { label: "Threads connectés", value: latestByMetric.THREADS_CONNECTED ?? "-" },
        { label: "Threads actifs", value: latestByMetric.THREADS_RUNNING ?? "-" },
        { label: "Questions", value: latestByMetric.QUESTIONS ?? "-" },
        { label: "Requêtes lentes", value: latestByMetric.SLOW_QUERIES ?? "-" },
      ];
    }

    return [
      { label: "Sessions actives", value: latestByMetric.ACTIVE_SESSIONS ?? "-" },
      {
        label: "Total sessions",
        value: latestByMetric.TOTAL_SESSIONS ?? latestByMetric.SESSION_COUNT ?? "-",
      },
      {
        label: "Transactions actives",
        value: latestByMetric.ACTIVE_TRANSACTIONS ?? "-",
      },
      {
        label: "Objets verrouillés",
        value: latestByMetric.LOCKED_OBJECTS ?? "-",
      },
    ];
  }, [filteredMetricValuesSelectedDb, selectedDbIsMysql]);

  const latestMetricValuesChart = useMemo(() => {
    return (Array.isArray(latestMetrics) ? latestMetrics : [])
      .filter((m) => String(m.db_id) === String(selectedDbId))
      .map((m) => {
        const metricCode = m.metric_code || metricMap[String(m.metric_id)] || "-";
        return {
          metric_code: metricCode,
          value_number: Number(m.value_number) || 0,
          full_label: `${prettifyMetricLabel(metricCode)} (${selectedDbName})`,
        };
      });
  }, [latestMetrics, selectedDbId, metricMap, selectedDbName]);

  const recentRows = useMemo(() => {
    return filteredMetricValuesSelectedDb
      .slice(-10)
      .reverse()
      .map((r) => ({
        metric_code: r.metric_code || "-",
        value: r.value_number_num,
        date: formatChartDateTime(r.collected_at_date),
      }));
  }, [filteredMetricValuesSelectedDb]);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 24, background: "#f6f8fc", minHeight: "100vh" }}>
      <DashboardHeader message={{}} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 16,
        }}
      >
        <DashboardFilters
          allowedDbs={targetDbs}
          selectedDbId={selectedDbId}
          setSelectedDbId={setSelectedDbId}
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
        />

        <DashboardMainCharts
          selectedDbName={selectedDbName}
          selectedDbIsMysql={selectedDbIsMysql}
          allMetrics={allMetrics}
          selectedMetric={selectedMetric}
          setSelectedMetric={setSelectedMetric}
          mainLineData={mainLineData}
          mainChartLines={mainChartLines}
          hasEnoughMainChartPoints={hasEnoughMainChartPoints}
          chartTitle={chartTitle}
          prettifyMetricLabel={prettifyMetricLabel}
          combinedOracleMetricKey={COMBINED_ORACLE_METRIC_KEY}
        />
      </div>

      <DashboardSummary
        summaryCards={summaryCards}
        selectedDbIsMysql={selectedDbIsMysql}
        selectedDbName={selectedDbName}
      />

      <div style={{ height: 12 }} />

      <DashboardCurrentValues
        selectedDbIsMysql={selectedDbIsMysql}
        selectedDbName={selectedDbName}
        latestMetricValuesChart={latestMetricValuesChart}
        prettifyMetricLabel={prettifyMetricLabel}
      />

      <div style={{ height: 12 }} />

      <DashboardRecentTable
        recentRows={recentRows}
        prettifyMetricLabel={prettifyMetricLabel}
      />

      {!selectedDbIsMysql ? (
        <>
          <div style={{ height: 12 }} />

          <DashboardOracleSessions
            selectedDbId={selectedDbId}
            selectedDbName={selectedDbName}
          />

          <div style={{ height: 12 }} />

          <DashboardOracleTopSql
            selectedDbId={selectedDbId}
            setSelectedDbId={setSelectedDbId}
            allowedDbs={targetDbs}
            topSqlData={topSqlData}
            topSqlLoading={topSqlLoading}
            excludeDbmonTopSql={excludeDbmonTopSql}
            setExcludeDbmonTopSql={setExcludeDbmonTopSql}
          />
        </>
      ) : null}
    </div>
  );
}