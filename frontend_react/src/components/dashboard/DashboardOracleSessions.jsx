import { useEffect, useMemo, useState } from "react";
import { SectionCard, InfoBox } from "./DashboardCommon";

const API_BASE = "http://127.0.0.1:8000";

export default function DashboardOracleSessions({ selectedDbId, selectedDbName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openTable, setOpenTable] = useState(true);

  async function fetchSessions() {
    if (!selectedDbId) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/oracle-sessions/${selectedDbId}`);
      if (!res.ok) throw new Error("Erreur chargement sessions Oracle");

      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("Erreur sessions Oracle:", e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSessions();
  }, [selectedDbId]);

  const activeSessions = useMemo(() => {
    if (!Array.isArray(data?.sessions)) return [];
    return data.sessions.filter(
      (s) => String(s.status || "").toUpperCase() === "ACTIVE"
    );
  }, [data]);

  const inactiveSessions = useMemo(() => {
    if (!Array.isArray(data?.sessions)) return [];
    return data.sessions.filter(
      (s) => String(s.status || "").toUpperCase() === "INACTIVE"
    );
  }, [data]);

  return (
    <SectionCard>
      <div style={styles.headerRow}>
        <div style={styles.title}>
          Sessions Oracle {selectedDbName ? `— ${selectedDbName}` : ""}
        </div>

        <button
          type="button"
          onClick={() => setOpenTable((prev) => !prev)}
          style={styles.toggleBtn}
        >
          {openTable ? "Fermer" : "Ouvrir"}
        </button>
      </div>

      {loading ? (
        <InfoBox text="Chargement des sessions Oracle..." />
      ) : !data ? (
        <InfoBox text="Impossible de charger les sessions Oracle." />
      ) : (
        <>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Sessions actives</div>
              <div style={styles.summaryValue}>{data.active_count ?? 0}</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Sessions inactives</div>
              <div style={styles.summaryValue}>{data.inactive_count ?? 0}</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total sessions</div>
              <div style={styles.summaryValue}>{data.count ?? 0}</div>
            </div>
          </div>

          {openTable && (
            <>
              <div style={{ height: 16 }} />

              <div style={styles.blockTitle}>
                Sessions actives ({activeSessions.length})
              </div>

              {activeSessions.length ? (
                <TableOracleSessions rows={activeSessions} />
              ) : (
                <InfoBox text="Aucune session active." />
              )}

              <div style={{ height: 16 }} />

              <div style={styles.blockTitle}>
                Sessions inactives ({inactiveSessions.length})
              </div>

              {inactiveSessions.length ? (
                <TableOracleSessions rows={inactiveSessions} />
              ) : (
                <InfoBox text="Aucune session inactive." />
              )}
            </>
          )}
        </>
      )}
    </SectionCard>
  );
}

function TableOracleSessions({ rows }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>SID</th>
            <th style={styles.th}>SERIAL</th>
            <th style={styles.th}>USERNAME</th>
            <th style={styles.th}>STATUS</th>
            <th style={styles.th}>EVENT</th>
            <th style={styles.th}>SQL_ID</th>
            <th style={styles.th}>LOGON_TIME</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.sid}-${row.serial}-${index}`}
              style={index % 2 === 0 ? styles.rowEven : styles.rowOdd}
            >
              <td style={styles.td}>{row.sid ?? "-"}</td>
              <td style={styles.td}>{row.serial ?? row["serial#"] ?? "-"}</td>
              <td style={styles.td}>{row.username ?? "-"}</td>

              <td style={styles.td}>
                <span
                  style={{
                    ...styles.badge,
                    ...(String(row.status || "").toUpperCase() === "ACTIVE"
                      ? styles.badgeActive
                      : styles.badgeInactive),
                  }}
                >
                  {row.status ?? "-"}
                </span>
              </td>

              <td style={styles.td}>{row.event ?? "-"}</td>
              <td style={styles.td}>{row.sql_id ?? "-"}</td>
              <td style={styles.td}>{formatDateTime(row.logon_time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value || "-";

  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const styles = {
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: "1rem",
    fontWeight: 800,
  },
  toggleBtn: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    borderRadius: 10,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
  },
  summaryCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
    fontWeight: 700,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: 800,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: 800,
    marginBottom: 10,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 800,
    padding: "12px 10px",
  },
  td: {
    padding: "10px",
    fontSize: 13,
  },
  rowEven: { background: "#ffffff" },
  rowOdd: { background: "#fbfdff" },

  badge: {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid",
  },
  badgeActive: {
    background: "#dcfce7",
    color: "#166534",
    borderColor: "#bbf7d0",
  },
  badgeInactive: {
    background: "#f1f5f9",
    color: "#475569",
    borderColor: "#cbd5e1",
  },
};