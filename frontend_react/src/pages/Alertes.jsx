import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

export default function Alertes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [alertsData, setAlertsData] = useState([]);
  const [targetDbsData, setTargetDbsData] = useState([]);
  const [metricDefsData, setMetricDefsData] = useState([]);

  const [dbFilter, setDbFilter] = useState("Toutes");
  const [metricFilter, setMetricFilter] = useState("Toutes");
  const [severityFilter, setSeverityFilter] = useState("Toutes");
  const [statusFilter, setStatusFilter] = useState("Tous");

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

        const [alertsRes, targetDbsRes, metricDefsRes] = await Promise.all([
          apiGet("/alerts/", []),
          apiGet("/target-dbs/", []),
          apiGet("/metric-defs/", []),
        ]);

        setAlertsData(Array.isArray(alertsRes) ? alertsRes : []);
        setTargetDbsData(Array.isArray(targetDbsRes) ? targetDbsRes : []);
        setMetricDefsData(Array.isArray(metricDefsRes) ? metricDefsRes : []);
      } catch {
        setError("Impossible de charger les alertes.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);

    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  const dbMap = useMemo(() => {
    const map = {};
    targetDbsData.forEach((db) => {
      if (db?.db_id != null) {
        map[String(db.db_id)] = db.db_name || String(db.db_id);
      }
    });
    return map;
  }, [targetDbsData]);

  const metricMap = useMemo(() => {
    const map = {};
    metricDefsData.forEach((m) => {
      if (m?.metric_id != null) {
        map[String(m.metric_id)] = m.metric_code || String(m.metric_id);
      }
    });
    return map;
  }, [metricDefsData]);

  const alertsEnriched = useMemo(() => {
    return alertsData.map((a) => ({
      ...a,
      db_name:
        a?.db_id != null ? dbMap[String(a.db_id)] || String(a.db_id) : "—",
      metric_code:
        a?.metric_id != null
          ? metricMap[String(a.metric_id)] || String(a.metric_id)
          : "—",
      created_at_fmt: formatDateTime(a.created_at),
      updated_at_fmt: formatDateTime(a.updated_at),
      closed_at_fmt: formatDateTime(a.closed_at),
    }));
  }, [alertsData, dbMap, metricMap]);

  const totalAlerts = alertsEnriched.length;
  const openAlerts = alertsEnriched.filter(
    (a) => String(a.status || "").toUpperCase() === "OPEN"
  ).length;
  const resolvedAlerts = alertsEnriched.filter((a) =>
    ["RESOLVED", "CLOSED"].includes(String(a.status || "").toUpperCase())
  ).length;
  const criticalAlerts = alertsEnriched.filter(
    (a) => String(a.severity || "").toUpperCase() === "CRITICAL"
  ).length;
  const warningAlerts = alertsEnriched.filter(
    (a) => String(a.severity || "").toUpperCase() === "WARNING"
  ).length;

  const dbOptions = useMemo(() => {
    const items = [...new Set(alertsEnriched.map((a) => String(a.db_name || "")).filter(Boolean))];
    return ["Toutes", ...items.sort()];
  }, [alertsEnriched]);

  const metricOptions = useMemo(() => {
    const items = [...new Set(alertsEnriched.map((a) => String(a.metric_code || "")).filter(Boolean))];
    return ["Toutes", ...items.sort()];
  }, [alertsEnriched]);

  const severityOptions = useMemo(() => {
    const items = [...new Set(alertsEnriched.map((a) => String(a.severity || "")).filter(Boolean))];
    return ["Toutes", ...items.sort()];
  }, [alertsEnriched]);

  const statusOptions = useMemo(() => {
    const items = [...new Set(alertsEnriched.map((a) => String(a.status || "")).filter(Boolean))];
    return ["Tous", ...items.sort()];
  }, [alertsEnriched]);

  const filteredAlerts = useMemo(() => {
    let data = [...alertsEnriched];

    if (dbFilter !== "Toutes") {
      data = data.filter((a) => a.db_name === dbFilter);
    }
    if (metricFilter !== "Toutes") {
      data = data.filter((a) => a.metric_code === metricFilter);
    }
    if (severityFilter !== "Toutes") {
      data = data.filter((a) => String(a.severity || "") === severityFilter);
    }
    if (statusFilter !== "Tous") {
      data = data.filter((a) => String(a.status || "") === statusFilter);
    }

    data.sort((a, b) => Number(b.alert_id || 0) - Number(a.alert_id || 0));
    return data;
  }, [alertsEnriched, dbFilter, metricFilter, severityFilter, statusFilter]);

  const openFilteredAlerts = useMemo(() => {
    return filteredAlerts.filter(
      (a) => String(a.status || "").toUpperCase() === "OPEN"
    );
  }, [filteredAlerts]);

  const criticalFilteredAlerts = useMemo(() => {
    let data = alertsEnriched.filter(
      (a) => String(a.severity || "").toUpperCase() === "CRITICAL"
    );

    if (dbFilter !== "Toutes") {
      data = data.filter((a) => a.db_name === dbFilter);
    }
    if (metricFilter !== "Toutes") {
      data = data.filter((a) => a.metric_code === metricFilter);
    }
    if (statusFilter !== "Tous") {
      data = data.filter((a) => String(a.status || "") === statusFilter);
    }

    data.sort((a, b) => Number(b.alert_id || 0) - Number(a.alert_id || 0));
    return data;
  }, [alertsEnriched, dbFilter, metricFilter, statusFilter]);

  const resolvedFilteredAlerts = useMemo(() => {
    let data = alertsEnriched.filter((a) =>
      ["RESOLVED", "CLOSED"].includes(String(a.status || "").toUpperCase())
    );

    if (dbFilter !== "Toutes") {
      data = data.filter((a) => a.db_name === dbFilter);
    }
    if (metricFilter !== "Toutes") {
      data = data.filter((a) => a.metric_code === metricFilter);
    }
    if (severityFilter !== "Toutes") {
      data = data.filter((a) => String(a.severity || "") === severityFilter);
    }

    data.sort((a, b) => Number(b.alert_id || 0) - Number(a.alert_id || 0));
    return data;
  }, [alertsEnriched, dbFilter, metricFilter, severityFilter]);

  if (loading) {
    return (
      <div style={styles.page}>
        <PageHeader
          title="Alertes de Monitoring"
          subtitle="Suivi des alertes ouvertes, critiques et résolues"
        />
        <InfoBox text="Chargement..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <PageHeader
          title="Alertes de Monitoring"
          subtitle="Suivi des alertes ouvertes, critiques et résolues"
        />
        <ErrorBox text={error} />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Alertes de Monitoring"
        subtitle="Suivi des alertes ouvertes, critiques et résolues"
      />

      <div style={styles.kpiGrid}>
        <KpiCard icon="" label="TOTAL ALERTES" value={totalAlerts} accent="#64748b" />
        <KpiCard icon="" label="ALERTES OUVERTES" value={openAlerts} accent="#ef4444" />
        <KpiCard icon="" label="RÉSOLUES" value={resolvedAlerts} accent="#10b981" />
        <KpiCard icon="" label="CRITIQUES" value={criticalAlerts} accent="#9f1239" />
        <KpiCard icon="" label="WARNING" value={warningAlerts} accent="#f59e0b" />
      </div>

      <div style={{ height: 16 }} />

      <SectionCard>
        <SectionTitle icon="🔍" text="FILTRES" />

        <div style={styles.filtersGrid}>
          <select value={dbFilter} onChange={(e) => setDbFilter(e.target.value)} style={styles.select}>
            {dbOptions.map((opt) => (
              <option key={opt}>{opt}</option>
            ))}
          </select>

          <select
            value={metricFilter}
            onChange={(e) => setMetricFilter(e.target.value)}
            style={styles.select}
          >
            {metricOptions.map((opt) => (
              <option key={opt}>{opt}</option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={styles.select}
          >
            {severityOptions.map((opt) => (
              <option key={opt}>{opt}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.select}
          >
            {statusOptions.map((opt) => (
              <option key={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard>
        <SectionTitle icon="" text="ALERTES OUVERTES" />

        {filteredAlerts.length === 0 ? (
          <EmptyState icon="" message="Aucune alerte trouvée." />
        ) : openFilteredAlerts.length === 0 ? (
          <SuccessBox text=" Aucune alerte ouverte pour les filtres sélectionnés." />
        ) : (
          <>
            <CountBox
              text={` ${openFilteredAlerts.length} alerte(s) ouverte(s)`}
              tone="danger"
            />
            <div style={{ marginTop: 12 }}>
              <DataTable
                columns={[
                  "alert_id",
                  "db_name",
                  "metric_code",
                  "severity",
                  "status",
                  "last_value",
                  "title",
                  "details",
                  "created_at",
                  "updated_at",
                ]}
                rows={openFilteredAlerts.map((a) => ({
                  alert_id: a.alert_id,
                  db_name: a.db_name,
                  metric_code: a.metric_code,
                  severity: a.severity,
                  status: a.status,
                  last_value: a.last_value,
                  title: a.title,
                  details: a.details,
                  created_at: a.created_at_fmt,
                  updated_at: a.updated_at_fmt,
                }))}
              />
            </div>
          </>
        )}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard>
        <SectionTitle icon="📋" text="HISTORIQUE DES ALERTES" />

        {filteredAlerts.length === 0 ? (
          <EmptyState icon="📋" message="Aucune alerte disponible." />
        ) : (
          <DataTable
            columns={[
              "alert_id",
              "db_name",
              "metric_code",
              "severity",
              "status",
              "last_value",
              "title",
              "details",
              "created_at",
              "updated_at",
              "closed_at",
            ]}
            rows={filteredAlerts.map((a) => ({
              alert_id: a.alert_id,
              db_name: a.db_name,
              metric_code: a.metric_code,
              severity: a.severity,
              status: a.status,
              last_value: a.last_value,
              title: a.title,
              details: a.details,
              created_at: a.created_at_fmt,
              updated_at: a.updated_at_fmt,
              closed_at: a.closed_at_fmt,
            }))}
          />
        )}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard>
        <SectionTitle icon="" text="ALERTES CRITIQUES" />

        {alertsEnriched.length === 0 ? (
          <EmptyState icon="" message="Aucune donnée critique disponible." />
        ) : criticalFilteredAlerts.length === 0 ? (
          <SuccessBox text=" Aucune alerte critique pour les filtres sélectionnés." />
        ) : (
          <>
            <CountBox
              text={` ${criticalFilteredAlerts.length} alerte(s) critique(s)`}
              tone="danger"
            />
            <div style={{ marginTop: 12 }}>
              <DataTable
                columns={[
                  "alert_id",
                  "db_name",
                  "metric_code",
                  "severity",
                  "status",
                  "last_value",
                  "title",
                  "details",
                  "created_at",
                  "updated_at",
                ]}
                rows={criticalFilteredAlerts.map((a) => ({
                  alert_id: a.alert_id,
                  db_name: a.db_name,
                  metric_code: a.metric_code,
                  severity: a.severity,
                  status: a.status,
                  last_value: a.last_value,
                  title: a.title,
                  details: a.details,
                  created_at: a.created_at_fmt,
                  updated_at: a.updated_at_fmt,
                }))}
              />
            </div>
          </>
        )}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard>
        <SectionTitle icon="✅" text="ALERTES RÉSOLUES" />

        {alertsEnriched.length === 0 ? (
          <EmptyState icon="✅" message="Aucune donnée résolue disponible." />
        ) : resolvedFilteredAlerts.length === 0 ? (
          <EmptyState icon="✅" message="Aucune alerte résolue pour les filtres sélectionnés." />
        ) : (
          <>
            <CountBox
              text={`✅ ${resolvedFilteredAlerts.length} alerte(s) résolue(s)`}
              tone="success"
            />
            <div style={{ marginTop: 12 }}>
              <DataTable
                columns={[
                  "alert_id",
                  "db_name",
                  "metric_code",
                  "severity",
                  "status",
                  "last_value",
                  "title",
                  "details",
                  "created_at",
                  "updated_at",
                  "closed_at",
                ]}
                rows={resolvedFilteredAlerts.map((a) => ({
                  alert_id: a.alert_id,
                  db_name: a.db_name,
                  metric_code: a.metric_code,
                  severity: a.severity,
                  status: a.status,
                  last_value: a.last_value,
                  title: a.title,
                  details: a.details,
                  created_at: a.created_at_fmt,
                  updated_at: a.updated_at_fmt,
                  closed_at: a.closed_at_fmt,
                }))}
              />
            </div>
          </>
        )}
      </SectionCard>
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

function SectionTitle({ icon, text }) {
  return (
    <div style={styles.sectionTitle}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function KpiCard({ icon, label, value, accent }) {
  return (
    <div style={styles.kpiCard}>
      <div
        style={{
          position: "absolute",
          inset: "0 auto auto 0",
          width: "100%",
          height: 4,
          background: accent,
        }}
      />
      <div style={styles.kpiIcon}>{icon}</div>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div style={styles.emptyState}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      {message}
    </div>
  );
}

function InfoBox({ text }) {
  return <div style={styles.infoBox}>{text}</div>;
}

function ErrorBox({ text }) {
  return <div style={styles.errorBox}>{text}</div>;
}

function SuccessBox({ text }) {
  return <div style={styles.successBox}>{text}</div>;
}

function CountBox({ text, tone }) {
  const isSuccess = tone === "success";
  return (
    <div
      style={{
        background: isSuccess ? "#f0fdf4" : "#fff1f2",
        border: `1px solid ${isSuccess ? "#bbf7d0" : "#fecdd3"}`,
        borderRadius: 10,
        padding: "0.65rem 1rem",
        fontSize: 13,
        fontWeight: 700,
        color: isSuccess ? "#166534" : "#9f1239",
      }}
    >
      {text}
    </div>
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
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "0.05em",
    marginBottom: 16,
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 14,
  },

  kpiCard: {
    position: "relative",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: "1rem 1rem 1.05rem",
    boxShadow: "0 6px 18px rgba(15,23,42,0.05)",
    overflow: "hidden",
  },

  kpiIcon: {
    fontSize: 20,
    marginBottom: 6,
  },

  kpiLabel: {
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#94a3b8",
    marginBottom: 6,
  },

  kpiValue: {
    fontSize: 24,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.03em",
  },

  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
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
    boxSizing: "border-box",
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
    color: "#94a3b8",
    borderBottom: "1px solid #e2e8f0",
    fontWeight: 800,
    whiteSpace: "nowrap",
    letterSpacing: "0.05em",
  },

  td: {
    padding: "12px 14px",
    borderBottom: "1px solid #eef2f7",
    color: "#334155",
    verticalAlign: "top",
    whiteSpace: "nowrap",
  },

  rowEven: {
    background: "#ffffff",
  },

  rowOdd: {
    background: "#fcfdff",
  },

  emptyState: {
    textAlign: "center",
    padding: "2rem",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 10,
    color: "#94a3b8",
    fontSize: 14,
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

  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    padding: "0.85rem 1rem",
    fontSize: 14,
    fontWeight: 700,
    color: "#166534",
  },
};