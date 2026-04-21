import { SectionCard, FieldLabel, MetricBox, InfoBox, CollapsibleTable } from "./DashboardCommon";

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

              <td style={styles.topSqlTdCenter}>
                {formatNumberLocal(row.executions)}
              </td>

              <td style={styles.topSqlTdCenter}>
                {formatNumberLocal(
                  row.elapsed_time_sec ??
                    row.elapsed_time ??
                    row.elapsed_seconds
                )}
              </td>

              <td style={styles.topSqlTdCenter}>
                {formatNumberLocal(
                  row.cpu_time_sec ??
                    row.cpu_time ??
                    row.cpu_seconds
                )}
              </td>

              <td style={styles.topSqlTdCenter}>
                {formatNumberLocal(row.buffer_gets)}
              </td>

              <td style={styles.topSqlTdCenter}>
                {formatNumberLocal(row.disk_reads)}
              </td>

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

export default function DashboardOracleTopSql({
  selectedDbId,
  setSelectedDbId,
  allowedDbs,
  topSqlData,
  topSqlLoading,
  excludeDbmonTopSql,
  setExcludeDbmonTopSql,
}) {
  const queries = Array.isArray(topSqlData?.queries) ? topSqlData.queries : [];

  return (
    <>
      <div style={styles.sectionTitleMain}>
        Top {queries.length} requêtes SQL
      </div>
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
          <InfoBox text="Chargement du Top SQL..." />
        ) : !topSqlData ? (
          <InfoBox text="Aucune donnée Top SQL disponible." />
        ) : (
          <>
            <div style={styles.grid4}>
              <MetricBox label="Base" value={topSqlData.db_name || "-"} />
              <MetricBox label="Requêtes trouvées" value={queries.length} />
            </div>

            <div style={{ height: 16 }} />

            {queries.length ? (
              <CollapsibleTable
                title={`Tableau Top ${queries.length} requêtes SQL`}
                count={queries.length}
                defaultOpen={true}
              >
                <TopSqlModernTable rows={queries} />
              </CollapsibleTable>
            ) : (
              <InfoBox text="Aucune requête SQL à afficher pour ce filtre." />
            )}
          </>
        )}
      </SectionCard>
    </>
  );
}

const styles = {
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
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  grid4: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
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
};