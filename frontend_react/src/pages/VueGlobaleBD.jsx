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
} from "recharts";

const API_BASE = "http://127.0.0.1:8000";

const COLORS = {
  blue: "#3b82f6",
  green: "#10b981",
  red: "#ef4444",
  orange: "#f59e0b",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  gray: "#94a3b8",
  rose: "#9f1239",
};

export default function VueGlobaleBD() {
  const [targetDbs, setTargetDbs] = useState([]);
  const [selectedDbId, setSelectedDbId] = useState("");
  const [overview, setOverview] = useState(null);
  const [alertsAll, setAlertsAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [openedInfoKey, setOpenedInfoKey] = useState(null);

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

  function firstNotEmpty(...values) {
    for (const v of values) {
      if (v === null || v === undefined) continue;
      if (typeof v === "string" && !v.trim()) continue;
      return v;
    }
    return null;
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

  function classifySqlSource(sqlQuery) {
    if (!sqlQuery) return "none";
    const sqlUpper = String(sqlQuery).toUpperCase();

    const oracleMarkers = ["V$", "DBA_", "ALL_", "USER_", "GV$", "DUAL"];
    const internalMarkers = [
      "METRIC_RUNS",
      "METRIC_VALUES",
      "METRIC_DEFS",
      "TARGET_DBS",
      "ALERTS",
      "DBMON.",
    ];

    if (oracleMarkers.some((m) => sqlUpper.includes(m))) return "oracle";
    if (internalMarkers.some((m) => sqlUpper.includes(m))) return "dbmon";
    return "other";
  }

  function getBackendKpiMeta(data, key) {
    const metaRoot = data?.indicator_meta || data?.kpi_meta || {};
    return typeof metaRoot === "object" && metaRoot ? metaRoot[key] || {} : {};
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

      const [dbs, alerts] = await Promise.all([
        apiGet("/target-dbs/", []),
        apiGet("/alerts/", []),
      ]);

      const dbList = Array.isArray(dbs) ? dbs : [];
      setTargetDbs(dbList);
      setAlertsAll(Array.isArray(alerts) ? alerts : []);

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
      const res = await apiGet(`/target-dbs/${selectedDbId}/overview`, null);
      setOverview(res);
      setLoadingOverview(false);
    }

    loadOverview();
  }, [selectedDbId]);

  const latestMetrics = useMemo(() => {
    return Array.isArray(overview?.latest_metrics) ? overview.latest_metrics : [];
  }, [overview]);

  const alertsDb = useMemo(() => {
    return alertsAll.filter((a) => Number(a.db_id) === Number(selectedDbId));
  }, [alertsAll, selectedDbId]);

  const openAlerts = useMemo(() => {
    return alertsDb.filter((a) => String(a.status || "").toUpperCase() === "OPEN");
  }, [alertsDb]);

  const criticalOpenAlerts = useMemo(() => {
    return openAlerts.filter((a) => String(a.severity || "").toUpperCase() === "CRITICAL");
  }, [openAlerts]);

  const latestMetricsTable = useMemo(() => {
    return latestMetrics.map((m) => ({
      metric_code: m.metric_code,
      value:
        m.value_number !== null && m.value_number !== undefined
          ? String(m.value_number)
          : String(m.value_text ?? "-"),
      severity: String(m.severity ?? "-"),
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
    const rankMap = { CRITICAL: 3, WARNING: 2, INFO: 1, OK: 0 };

    return latestMetrics
      .map((m) => ({
        metric_code: m.metric_code,
        value:
          m.value_number !== null && m.value_number !== undefined
            ? String(m.value_number)
            : String(m.value_text ?? "-"),
        severity: String(m.severity ?? "-"),
        collected_at: formatDateTime(m.collected_at),
        collected_at_raw: safeDate(m.collected_at),
        severity_rank: rankMap[String(m.severity || "").toUpperCase()] ?? 0,
      }))
      .sort((a, b) => {
        if (b.severity_rank !== a.severity_rank) return b.severity_rank - a.severity_rank;
        const aTime = a.collected_at_raw ? a.collected_at_raw.getTime() : 0;
        const bTime = b.collected_at_raw ? b.collected_at_raw.getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 8);
  }, [latestMetrics]);

  const alertsDbTable = useMemo(() => {
    return [...alertsDb]
      .map((a) => ({
        alert_id: a.alert_id,
        severity: String(a.severity ?? "-"),
        status: String(a.status ?? "-"),
        title: String(a.title ?? "-"),
        last_value: String(a.last_value ?? "-"),
        created_at: formatDateTime(a.created_at),
        created_at_raw: safeDate(a.created_at),
      }))
      .sort((a, b) => {
        const aTime = a.created_at_raw ? a.created_at_raw.getTime() : 0;
        const bTime = b.created_at_raw ? b.created_at_raw.getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 10);
  }, [alertsDb]);

  const dbStatusMetric = getMetricObj(latestMetrics, "DB_STATUS");
  const activeSessionsMetric = getMetricObj(latestMetrics, "ACTIVE_SESSIONS");
  const activeTxMetric = getMetricObj(latestMetrics, "ACTIVE_TRANSACTIONS");
  const cpuMetric = getMetricObj(latestMetrics, "CPU_USED_SESSION");
  const uptimeMetric = getMetricObj(latestMetrics, "INSTANCE_UPTIME_HOURS");

  const dbStatusValue = getMetricValue(latestMetrics, "DB_STATUS");
  const activeSessionsValue = getMetricValue(latestMetrics, "ACTIVE_SESSIONS");
  const activeTxValue = getMetricValue(latestMetrics, "ACTIVE_TRANSACTIONS");
  const cpuValue = getMetricValue(latestMetrics, "CPU_USED_SESSION");
  const uptimeValue = getMetricValue(latestMetrics, "INSTANCE_UPTIME_HOURS");

  const dbStatusInfo = buildMetricInfo(
    dbStatusMetric,
    "État courant de la base Oracle.",
    "Valeur directe issue de la métrique DB_STATUS."
  );

  const activeSessionsInfo = buildMetricInfo(
    activeSessionsMetric,
    "Nombre de sessions actives actuellement sur la base.",
    "Comptage des sessions Oracle actives."
  );

  const activeTxInfo = buildMetricInfo(
    activeTxMetric,
    "Nombre de transactions actives au moment de la collecte.",
    "Comptage des transactions actives au moment de la collecte."
  );

  const cpuInfo = buildMetricInfo(
    cpuMetric,
    "Consommation CPU observée pour les sessions au moment de la collecte.",
    "Valeur directe issue de la métrique CPU_USED_SESSION."
  );

  const uptimeInfo = buildMetricInfo(
    uptimeMetric,
    "Temps de fonctionnement de l'instance en heures.",
    "Valeur directe issue de la métrique INSTANCE_UPTIME_HOURS."
  );

  const selectedInfoBlock = useMemo(() => {
    const map = {
      db_status: { title: "DB STATUS", info: dbStatusInfo },
      active_sessions: { title: "ACTIVE SESSIONS", info: activeSessionsInfo },
      active_transactions: { title: "ACTIVE TRANSACTIONS", info: activeTxInfo },
      cpu_used_session: { title: "CPU USED SESSION", info: cpuInfo },
      uptime_h: { title: "UPTIME (H)", info: uptimeInfo },
    };

    return openedInfoKey ? map[openedInfoKey] || null : null;
  }, [
    openedInfoKey,
    dbStatusInfo,
    activeSessionsInfo,
    activeTxInfo,
    cpuInfo,
    uptimeInfo,
  ]);

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
            Vision synthétique d&apos;une base surveillée : état, métriques, alertes et santé globale
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
                </div>
              </div>

              <div style={styles.heroRight}>
                <div
                  style={{
                    ...styles.statusChip,
                    background: overview.is_active === 1 ? "#dcfce7" : "#fee2e2",
                    color: overview.is_active === 1 ? "#166534" : "#991b1b",
                    borderColor: overview.is_active === 1 ? "#bbf7d0" : "#fecaca",
                  }}
                >
                  {overview.is_active === 1 ? "● ACTIVE" : "● INACTIVE"}
                </div>
              </div>
            </div>
          </div>

          <div style={styles.kpiGridFive}>
            <KpiCard
              label="DB STATUS"
              value={String(dbStatusValue.value)}
              accent={COLORS.blue}
              clickable
              active={openedInfoKey === "db_status"}
              onClick={() => handleInfoToggle("db_status")}
            />
            <KpiCard
              label="ACTIVE SESSIONS"
              value={String(activeSessionsValue.value)}
              accent={
                String(activeSessionsValue.severity).toUpperCase() === "CRITICAL"
                  ? COLORS.red
                  : COLORS.green
              }
              clickable
              active={openedInfoKey === "active_sessions"}
              onClick={() => handleInfoToggle("active_sessions")}
            />
            <KpiCard
              label="ACTIVE TRANSACTIONS"
              value={String(activeTxValue.value)}
              accent={
                String(activeTxValue.severity).toUpperCase() === "WARNING"
                  ? COLORS.orange
                  : COLORS.blue
              }
              clickable
              active={openedInfoKey === "active_transactions"}
              onClick={() => handleInfoToggle("active_transactions")}
            />
            <KpiCard
              label="CPU USED SESSION"
              value={String(cpuValue.value)}
              accent={COLORS.purple}
              clickable
              active={openedInfoKey === "cpu_used_session"}
              onClick={() => handleInfoToggle("cpu_used_session")}
            />
            <KpiCard
              label="UPTIME (H)"
              value={String(uptimeValue.value)}
              accent={COLORS.cyan}
              clickable
              active={openedInfoKey === "uptime_h"}
              onClick={() => handleInfoToggle("uptime_h")}
            />
          </div>

          <div style={{ height: 12 }} />

          <div style={styles.card}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>🧠</span>
              <span style={styles.sectionTitle}>Explication de l’indicateur sélectionné</span>
            </div>

            <p style={styles.sectionDesc}>
              Cliquez sur une carte KPI en haut pour afficher uniquement son explication.
            </p>

            {selectedInfoBlock ? (
              <InfoDetailsCard
                title={selectedInfoBlock.title}
                info={selectedInfoBlock.info}
              />
            ) : (
              <div style={styles.infoBox}>
                Sélectionnez une carte KPI pour voir son explication.
              </div>
            )}
          </div>

          <div style={{ height: 12 }} />

          <div style={styles.grid2}>
            <div style={styles.card}>
              <div style={styles.cardTitle}>Dernières métriques</div>
              {latestMetricsTable.length ? (
                <DataTable
                  columns={["metric_code", "value", "severity", "collected_at"]}
                  rows={latestMetricsTable}
                />
              ) : (
                <div style={styles.infoBox}>Aucune métrique disponible.</div>
              )}
            </div>

            <div style={styles.card}>
              <div style={styles.cardTitle}>Valeurs numériques</div>
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
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={styles.card}>
            <div style={styles.cardTitle}>Métriques sensibles</div>
            {sensitiveMetrics.length ? (
              <DataTable
                columns={["metric_code", "value", "severity", "collected_at"]}
                rows={sensitiveMetrics}
              />
            ) : (
              <div style={styles.infoBox}>Aucune métrique sensible disponible.</div>
            )}
          </div>

          <div style={{ height: 12 }} />

          <div style={styles.card}>
            <div style={styles.cardTitle}>Alertes de la base</div>

            <div style={styles.alertKpiRow}>
              <MiniMetric label="Total alertes" value={alertsDb.length} />
              <MiniMetric label="Ouvertes" value={openAlerts.length} />
              <MiniMetric label="Critiques ouvertes" value={criticalOpenAlerts.length} />
            </div>

            {alertsDbTable.length ? (
              <DataTable
                columns={["alert_id", "severity", "status", "title", "last_value", "created_at"]}
                rows={alertsDbTable}
              />
            ) : (
              <div style={styles.successBox}>Aucune alerte enregistrée pour cette base.</div>
            )}
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

function InfoDetailsCard({ title, info }) {
  const sqlTitle = getSqlTitleLocal(info?.sql_query);
  const sqlHint = getSqlHintLocal(info?.sql_query);

  return (
    <div style={styles.infoDetailsCard}>
      <div style={styles.infoDetailsTitle}>{title}</div>

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
                  {row[col] != null && row[col] !== "" ? String(row[col]) : "—"}
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
    return "Cette requête interroge la base interne DBMON, pas la base Oracle cible.";
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
  kpiGridFive: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
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
  cardTitle: {
    marginTop: 0,
    marginBottom: 16,
    fontSize: 13,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "#64748b",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  sectionIcon: {
    fontSize: 22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#0f172a",
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
  infoBox: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: "14px 16px",
    color: "#1d4ed8",
    fontWeight: 700,
  },
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: "14px 16px",
    color: "#166534",
    fontWeight: 800,
  },
  alertKpiRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    marginBottom: 14,
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
};