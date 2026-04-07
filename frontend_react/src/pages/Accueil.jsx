import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const COMPARISON_OPTIONS = [
  { key: "CPU", label: "CPU Oracle ↔ THREADS_RUNNING MySQL" },
  {
    key: "SESSIONS",
    label: "ACTIVE_SESSIONS Oracle ↔ THREADS_CONNECTED MySQL",
  },
];

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
    dbTypeId === 21 ||
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

export default function Accueil() {
  const [backendOk, setBackendOk] = useState(false);
  const [targetDbs, setTargetDbs] = useState([]);
  const [metricDefs, setMetricDefs] = useState([]);
  const [alertsData, setAlertsData] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [selectedDbId, setSelectedDbId] = useState(null);
  const [selectedDbOverview, setSelectedDbOverview] = useState(null);
  const [selectedDbHistory, setSelectedDbHistory] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [comparisonMetric, setComparisonMetric] = useState("CPU");
  const [allHistoryByDb, setAllHistoryByDb] = useState({});
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const chargerDonnees = async () => {
      setChargement(true);
      setErreur("");

      try {
        const [hcRes, targetDbsRes, metricDefsRes, alertsRes] = await Promise.all([
          api.get("/health"),
          api.get("/target-dbs/"),
          api.get("/metric-defs/"),
          api.get("/alerts/"),
        ]);

        const dbs = Array.isArray(targetDbsRes.data) ? targetDbsRes.data : [];
        setBackendOk(hcRes?.data?.status === "ok");
        setTargetDbs(dbs);
        setMetricDefs(Array.isArray(metricDefsRes.data) ? metricDefsRes.data : []);
        setAlertsData(Array.isArray(alertsRes.data) ? alertsRes.data : []);
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

  const mysqlBases = useMemo(() => {
    return activeDbs.filter((db) => isMysqlDb(db));
  }, [activeDbs]);

  useEffect(() => {
    if (!selectedDbId && activeDbs.length > 0) {
      const local19c = activeDbs.find(
        (db) => String(db.db_name || "").toUpperCase() === "LOCAL_19C"
      );
      if (local19c) {
        setSelectedDbId(local19c.db_id);
        return;
      }

      setSelectedDbId(activeDbs[0].db_id);
    }
  }, [activeDbs, selectedDbId]);

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
    if (!activeDbs.length) return;

    const chargerComparaison = async () => {
      setComparisonLoading(true);

      try {
        const results = await Promise.all(
          activeDbs.map(async (db) => {
            try {
              const res = await api.get(`/target-dbs/${db.db_id}/metrics-history?limit=120`);
              return {
                dbId: String(db.db_id),
                rows: Array.isArray(res?.data) ? res.data : [],
              };
            } catch (err) {
              console.error(`Erreur historique DB ${db.db_id}`, err);
              return {
                dbId: String(db.db_id),
                rows: [],
              };
            }
          })
        );

        const map = {};
        results.forEach((item) => {
          map[item.dbId] = item.rows;
        });
        setAllHistoryByDb(map);
      } finally {
        setComparisonLoading(false);
      }
    };

    chargerComparaison();
  }, [activeDbs]);

  const activeMetrics = metricDefs.filter((m) => Number(m.is_active || 0) === 1).length;

  const openAlertsByDb = useMemo(() => {
    const counts = {};
    alertsData.forEach((a) => {
      if (String(a.status || "").toUpperCase() === "OPEN") {
        const dbId = String(a.db_id || "");
        counts[dbId] = (counts[dbId] || 0) + 1;
      }
    });
    return counts;
  }, [alertsData]);

  const criticalAlertsByDb = useMemo(() => {
    const counts = {};
    alertsData.forEach((a) => {
      if (
        String(a.status || "").toUpperCase() === "OPEN" &&
        String(a.severity || "").toUpperCase() === "CRITICAL"
      ) {
        const dbId = String(a.db_id || "");
        counts[dbId] = (counts[dbId] || 0) + 1;
      }
    });
    return counts;
  }, [alertsData]);

  const getDbStatus = (dbId) => {
    const critical = criticalAlertsByDb[String(dbId)] || 0;
    const open = openAlertsByDb[String(dbId)] || 0;

    if (critical > 0) return "CRITICAL";
    if (open > 0) return "WARNING";
    return "OK";
  };

  const historyByMetric = useMemo(() => {
    const grouped = {};

    selectedDbHistory.forEach((row) => {
      const code = String(row.metric_code || "").toUpperCase();

      if (
        code === "DB_STATUS" ||
        code === "DB_INFO" ||
        code === "CPU_USAGE" ||
        code === "CPU_USED_SESSION" ||
        code === "CPU_USED_BY_SESSION" ||
        code === "RAM_USAGE" ||
        code === "MEMORY_USAGE" ||
        code === "SGA_USAGE" ||
        code === "PGA_USAGE"
      ) {
        return;
      }

      if (!grouped[code]) grouped[code] = [];

      grouped[code].push({
        label: formatHistoryLabel(row.collected_at),
        value: row.value_number,
        warn_threshold: row.warn_threshold,
        crit_threshold: row.crit_threshold,
      });
    });

    return grouped;
  }, [selectedDbHistory]);

  const selectedLatestMetrics = useMemo(() => {
    return Array.isArray(selectedDbOverview?.latest_metrics)
      ? selectedDbOverview.latest_metrics
      : [];
  }, [selectedDbOverview]);

  const metricCharts = useMemo(() => {
    const excludedCodes = [
      "DB_STATUS",
      "DB_INFO",
      "CPU_USAGE",
      "CPU_USED_SESSION",
      "CPU_USED_BY_SESSION",
      "RAM_USAGE",
      "MEMORY_USAGE",
      "SGA_USAGE",
      "PGA_USAGE",
    ];

    return selectedLatestMetrics
      .filter((metric) => {
        const code = String(metric.metric_code || "").toUpperCase();
        return !excludedCodes.includes(code) && (historyByMetric[code]?.length || 0) > 0;
      })
      .sort((a, b) =>
        String(a.metric_code || "").localeCompare(String(b.metric_code || ""))
      );
  }, [selectedLatestMetrics, historyByMetric]);

  const comparisonDbTargets = useMemo(() => {
    const preferredOracle =
      oracleBases.find((db) => String(db.db_name || "").toUpperCase() === "LOCAL_19C") ||
      oracleBases[0] ||
      null;

    const preferredMysql =
      mysqlBases.find((db) => String(db.db_name || "").toUpperCase() === "MY SQL") ||
      mysqlBases[0] ||
      null;

    return {
      oracle: preferredOracle,
      mysql: preferredMysql,
    };
  }, [oracleBases, mysqlBases]);

  const comparisonChartMeta = useMemo(() => {
    const oracleDb = comparisonDbTargets.oracle;
    const mysqlDb = comparisonDbTargets.mysql;

    if (!oracleDb || !mysqlDb) {
      return {
        data: [],
        title: "Comparaison inter-bases",
        oracleLabel: oracleDb?.db_name || "Oracle",
        mysqlLabel: mysqlDb?.db_name || "MySQL",
      };
    }

    const oracleRows = Array.isArray(allHistoryByDb[String(oracleDb.db_id)])
      ? allHistoryByDb[String(oracleDb.db_id)]
      : [];
    const mysqlRows = Array.isArray(allHistoryByDb[String(mysqlDb.db_id)])
      ? allHistoryByDb[String(mysqlDb.db_id)]
      : [];

    let oracleMetricCodes = [];
    let mysqlMetricCodes = [];
    let title = "";

    if (comparisonMetric === "CPU") {
      oracleMetricCodes = ["CPU_USED_SESSION"];
      mysqlMetricCodes = ["THREADS_RUNNING"];
      title = "Comparaison CPU Oracle / Threads Running MySQL";
    } else {
      oracleMetricCodes = ["ACTIVE_SESSIONS"];
      mysqlMetricCodes = ["THREADS_CONNECTED"];
      title = "Comparaison Active Sessions Oracle / Threads Connected MySQL";
    }

    const oraclePrepared = oracleRows
      .filter((row) => oracleMetricCodes.includes(String(row.metric_code || "").toUpperCase()))
      .map((row) => ({
        timestamp: row.collected_at ? new Date(row.collected_at).getTime() : null,
        value: Number(row.value_number),
      }))
      .filter((row) => row.timestamp && Number.isFinite(row.value))
      .sort((a, b) => a.timestamp - b.timestamp);

    const mysqlPrepared = mysqlRows
      .filter((row) => mysqlMetricCodes.includes(String(row.metric_code || "").toUpperCase()))
      .map((row) => ({
        timestamp: row.collected_at ? new Date(row.collected_at).getTime() : null,
        value: Number(row.value_number),
      }))
      .filter((row) => row.timestamp && Number.isFinite(row.value))
      .sort((a, b) => a.timestamp - b.timestamp);

    const oracleReduced = oraclePrepared.slice(-40);
    const mysqlReduced = mysqlPrepared.slice(-40);

    const allTimestamps = Array.from(
      new Set([
        ...oracleReduced.map((item) => item.timestamp),
        ...mysqlReduced.map((item) => item.timestamp),
      ])
    ).sort((a, b) => a - b);

    let lastOracle = null;
    let lastMysql = null;

    const oracleMap = new Map(oracleReduced.map((item) => [item.timestamp, item.value]));
    const mysqlMap = new Map(mysqlReduced.map((item) => [item.timestamp, item.value]));

    const merged = allTimestamps.map((ts) => {
      if (oracleMap.has(ts)) lastOracle = oracleMap.get(ts);
      if (mysqlMap.has(ts)) lastMysql = mysqlMap.get(ts);

      return {
        label: formatHistoryLabel(ts),
        oracle: lastOracle,
        mysql: lastMysql,
      };
    });

    return {
      data: merged.slice(-30),
      title,
      oracleLabel: `${oracleDb.db_name || "Oracle"} (CPU_USED_SESSION${
        comparisonMetric === "CPU" ? "" : ""
      })`,
      mysqlLabel:
        comparisonMetric === "CPU"
          ? `${mysqlDb.db_name || "MySQL"} (THREADS_RUNNING)`
          : `${mysqlDb.db_name || "MySQL"} (THREADS_CONNECTED)`,
    };
  }, [allHistoryByDb, comparisonDbTargets, comparisonMetric]);

  const displayedOracleLabel = useMemo(() => {
    const oracleDb = comparisonDbTargets.oracle;
    if (!oracleDb) return "Oracle";

    return comparisonMetric === "CPU"
      ? `${oracleDb.db_name || "Oracle"} (CPU_USED_SESSION)`
      : `${oracleDb.db_name || "Oracle"} (ACTIVE_SESSIONS)`;
  }, [comparisonDbTargets, comparisonMetric]);

  const displayedMysqlLabel = useMemo(() => {
    const mysqlDb = comparisonDbTargets.mysql;
    if (!mysqlDb) return "MySQL";

    return comparisonMetric === "CPU"
      ? `${mysqlDb.db_name || "MySQL"} (THREADS_RUNNING)`
      : `${mysqlDb.db_name || "MySQL"} (THREADS_CONNECTED)`;
  }, [comparisonDbTargets, comparisonMetric]);

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
          value={String(activeDbs.length)}
          sub="bases actives affichées"
          accent="#2563eb"
        />
        <KpiCard
          label="MÉTRIQUES ACTIVES"
          value={String(activeMetrics)}
          sub={`sur ${metricDefs.length} configurées`}
          accent="#7c3aed"
        />
      </div>

      <Card title="COMPARAISON INTER-BASES">
        <div style={styles.compareHeader}>
          <div>
            <div style={styles.compareTitle}>{comparisonChartMeta.title}</div>
            <div style={styles.compareSub}>
              Oracle : <strong>{displayedOracleLabel}</strong> · MySQL :{" "}
              <strong>{displayedMysqlLabel}</strong>
            </div>
          </div>

          <div style={styles.compareTabs}>
            {COMPARISON_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setComparisonMetric(opt.key)}
                style={{
                  ...styles.compareTab,
                  ...(comparisonMetric === opt.key ? styles.compareTabActive : {}),
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {comparisonLoading ? (
          <div style={styles.loadingInline}>Chargement de la comparaison...</div>
        ) : comparisonChartMeta.data.length === 0 ? (
          <EmptyBox message="Pas assez de données pour afficher la comparaison inter-bases." />
        ) : (
          <div style={styles.compareChartWrap}>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={comparisonChartMeta.data}>
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
                  width={48}
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
                  dataKey="oracle"
                  name={displayedOracleLabel}
                  stroke="#2563eb"
                  strokeWidth={2.8}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="mysql"
                  name={displayedMysqlLabel}
                  stroke="#10b981"
                  strokeWidth={2.8}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div style={styles.stackLayout}>
        <Card title="BASES SURVEILLÉES">
          {activeDbs.length === 0 ? (
            <EmptyBox message="Aucune base active trouvée." />
          ) : (
            <div style={styles.dbCardGrid}>
              {activeDbs.map((db) => {
                const status = getDbStatus(db.db_id);
                const statusStyles = getStatusStyles(status);
                const alertsCount = openAlertsByDb[String(db.db_id)] || 0;
                const isSelected = String(selectedDbId) === String(db.db_id);

                return (
                  <div
                    key={db.db_id}
                    style={{
                      ...styles.dbCard,
                      ...(isSelected ? styles.dbCardSelected : {}),
                    }}
                    onClick={() => setSelectedDbId(db.db_id)}
                    onDoubleClick={() => navigate(`/bases/${db.db_id}`)}
                  >
                    <div style={styles.dbCardTop}>
                      <div style={styles.dbMain}>
                        <div style={styles.dbNameRow}>
                          <span
                            style={{
                              ...styles.dot,
                              background: statusStyles.dotColor,
                              boxShadow: `0 0 0 4px ${statusStyles.dotColor}22`,
                            }}
                          />
                          <div style={styles.dbName}>{db.db_name || "—"}</div>
                        </div>

                        <div style={styles.dbHost}>{db.host || "—"}</div>
                      </div>
                    </div>

                    <div style={styles.dbMetaGrid}>
                      <InfoMini
                        label="Type"
                        value={isMysqlDb(db) ? "MySQL" : isOracleDb(db) ? "Oracle" : "—"}
                      />
                      <InfoMini label="Port" value={String(db.port || "—")} />
                      <InfoMini
                        label="Statut"
                        value={
                          <span
                            style={{
                              ...styles.statusBadge,
                              background: statusStyles.badgeBg,
                              borderColor: statusStyles.badgeBorder,
                              color: statusStyles.badgeColor,
                            }}
                          >
                            {statusStyles.label}
                          </span>
                        }
                      />
                      <InfoMini label="Alertes ouvertes" value={String(alertsCount)} />
                      <InfoMini
                        label="Dernière collecte"
                        value={
                          db.last_collect_at
                            ? new Date(db.last_collect_at).toLocaleString("fr-FR")
                            : "Non disponible"
                        }
                        fullWidth
                      />
                    </div>

                    <div style={styles.dbFooter}>
                      <span style={styles.dbFooterText}>
                        1 clic = visualiser · 2 clics = ouvrir le détail
                      </span>
                      <span style={styles.dbArrow}>›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="DÉTAIL DE LA BASE SÉLECTIONNÉE">
          {!selectedDbId ? (
            <EmptyBox message="Sélectionnez une base." />
          ) : metricsLoading ? (
            <div style={styles.loadingInline}>Chargement des métriques...</div>
          ) : (
            <>
              <div style={styles.selectedDbBlock}>
                <div style={styles.selectedDbLabel}>Nom de la base</div>
                <div style={styles.selectedDbMainName}>
                  {selectedDbOverview?.db_name || "Base sélectionnée"}
                </div>
                <div style={styles.selectedDbSubline}>
                  {selectedDbOverview?.host || "localhost"}
                  {selectedDbOverview?.port ? ` : ${selectedDbOverview.port}` : ""}
                  {selectedDbOverview?.service_name
                    ? ` · ${selectedDbOverview.service_name}`
                    : ""}
                </div>
              </div>

              <div style={styles.selectedDbInfoGrid}>
                <InfoMini
                  label="Type"
                  value={
                    selectedDbOverview
                      ? isMysqlDb(selectedDbOverview)
                        ? "MySQL"
                        : isOracleDb(selectedDbOverview)
                        ? "Oracle"
                        : "—"
                      : "—"
                  }
                />
                <InfoMini
                  label="Host"
                  value={selectedDbOverview?.host || "localhost"}
                />
                <InfoMini
                  label="Port"
                  value={String(selectedDbOverview?.port || "—")}
                />
                <InfoMini
                  label="Service"
                  value={selectedDbOverview?.service_name || "—"}
                />
              </div>

              <div style={styles.selectedDbHeader}>
                <div style={styles.selectedDbTitle}>
                  Historique des métriques de{" "}
                  <span style={styles.selectedDbName}>
                    {selectedDbOverview?.db_name || "—"}
                  </span>
                </div>
                <button
                  style={styles.openDetailBtn}
                  onClick={() => navigate(`/bases/${selectedDbId}`)}
                >
                  Ouvrir le détail
                </button>
              </div>

              {metricCharts.length === 0 ? (
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
            </>
          )}
        </Card>
      </div>
    </div>
  );
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

function Card({ title, children }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
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
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="warn_threshold"
              stroke="#f59e0b"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="crit_threshold"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function EmptyBox({ message }) {
  return <div style={styles.emptyBox}>{message}</div>;
}

function getMetricStatus(metric) {
  const value = Number(metric?.value_number);
  const warn = Number(metric?.warn_threshold);
  const crit = Number(metric?.crit_threshold);

  if (!Number.isFinite(value)) {
    return String(metric?.severity || "INFO").toUpperCase();
  }

  if (Number.isFinite(crit) && value >= crit) return "CRITICAL";
  if (Number.isFinite(warn) && value >= warn) return "WARNING";
  return "OK";
}

function getMetricStatusStyle(status) {
  switch (status) {
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
    default:
      return {
        bg: "#f8fafc",
        color: "#475569",
        border: "#e2e8f0",
      };
  }
}

function getStatusStyles(status) {
  switch (status) {
    case "CRITICAL":
      return {
        dotColor: "#ef4444",
        label: "Critical",
        badgeBg: "#fff1f2",
        badgeColor: "#9f1239",
        badgeBorder: "#fecdd3",
      };
    case "WARNING":
      return {
        dotColor: "#f59e0b",
        label: "Warning",
        badgeBg: "#fffbeb",
        badgeColor: "#92400e",
        badgeBorder: "#fde68a",
      };
    default:
      return {
        dotColor: "#22c55e",
        label: "OK",
        badgeBg: "#f0fdf4",
        badgeColor: "#166534",
        badgeBorder: "#bbf7d0",
      };
  }
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

  cardTitle: {
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 14,
    color: "#334155",
  },

  emptyBox: {
    textAlign: "center",
    padding: "28px 16px",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    color: "#94a3b8",
  },

  dbCardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
  },

  dbCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 18,
    cursor: "pointer",
    transition: "all 0.18s ease",
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },

  dbCardSelected: {
    border: "1px solid #bfdbfe",
    boxShadow: "0 12px 28px rgba(37,99,235,0.10)",
    background: "#f8fbff",
  },

  dbCardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 16,
  },

  dbMain: {
    minWidth: 0,
  },

  dbNameRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  dbName: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    wordBreak: "break-word",
  },

  dbHost: {
    fontSize: 15,
    color: "#64748b",
    paddingLeft: 20,
  },

  dbMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
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

  dbFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTop: "1px solid #f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  dbFooterText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },

  dbArrow: {
    fontSize: 24,
    fontWeight: 700,
    color: "#94a3b8",
    lineHeight: 1,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
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

  selectedDbBlock: {
    background: "#f8fbff",
    border: "1px solid #dbeafe",
    borderRadius: 16,
    padding: "18px 20px",
    marginBottom: 16,
  },

  selectedDbLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 8,
  },

  selectedDbMainName: {
    fontSize: 28,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
  },

  selectedDbSubline: {
    fontSize: 15,
    color: "#64748b",
  },

  selectedDbInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 18,
  },

  selectedDbHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 16,
  },

  selectedDbTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#334155",
  },

  selectedDbName: {
    color: "#0f172a",
  },

  openDetailBtn: {
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
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

  compareHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },

  compareTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 4,
  },

  compareSub: {
    fontSize: 14,
    color: "#64748b",
  },

  compareTabs: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  compareTab: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },

  compareTabActive: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  },

  compareChartWrap: {
    width: "100%",
    height: 340,
  },
};