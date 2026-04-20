import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

export default function TestDB() {
  const [targets, setTargets] = useState([]);
  const [dbTypeMap, setDbTypeMap] = useState({});
  const [selectedDbId, setSelectedDbId] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [lastTestName, setLastTestName] = useState("");
  const [lastTestType, setLastTestType] = useState("");
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  async function loadTargets() {
    try {
      const res = await api.get("/target-dbs/?only_active=true");
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      console.error("Erreur chargement target-dbs:", e);
      return [];
    }
  }

  async function loadDbTypes() {
    try {
      const res = await api.get("/db-types/");
      const data = Array.isArray(res.data) ? res.data : [];
      const map = {};
      data.forEach((d) => {
        if (d?.db_type_id != null) {
          map[Number(d.db_type_id)] = String(d.code || "").toUpperCase();
        }
      });
      return map;
    } catch (e) {
      console.error("Erreur chargement db-types:", e);
      return {};
    }
  }

  function latencyLabel(ms) {
    if (ms === null || ms === undefined) return "—";
    return `${ms} ms`;
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError("");

      try {
        const [targetsData, dbTypesData] = await Promise.all([
          loadTargets(),
          loadDbTypes(),
        ]);

        setTargets(targetsData);
        setDbTypeMap(dbTypesData);

        if (targetsData.length > 0) {
          setSelectedDbId((prev) =>
            prev && targetsData.some((t) => String(t.db_id) === String(prev))
              ? prev
              : String(targetsData[0].db_id)
          );
        } else {
          setSelectedDbId("");
        }
      } catch (e) {
        console.error(e);
        setError("Erreur lors du chargement des données.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [refreshKey]);

  const selected = useMemo(() => {
    return targets.find((t) => String(t.db_id) === String(selectedDbId)) || null;
  }, [targets, selectedDbId]);

async function handleTestConnection() {
  if (!selected) return;

  const dbTypeId = selected.db_type_id;
  const dbTypeCode = dbTypeId ? dbTypeMap[Number(dbTypeId)] || "" : "";

  if (!dbTypeCode) {
    setError(
      "Impossible de déterminer le type BD. Vérifiez la configuration dans Types BD."
    );
    return;
  }

  const payload = {
    db_id: selected.db_id,
    db_name: selected.db_name,
    db_type: dbTypeCode,
    host: selected.host,
    port: selected.port,
    service: selected.service_name || selected.sid,
    username: selected.username,
    password: selected.password || selected.password_enc || "",
  };

  setTesting(true);
  setError("");

  try {
    const res = await api.post("/db-test/", payload);
    const result = res?.data ?? null;

    if (!result) {
      setError(
        "Impossible de joindre le backend. Vérifiez que l'API FastAPI est démarrée."
      );
      return;
    }

    setLastResult(result);
    setLastTestName(selected.db_name || "");
    setLastTestType(dbTypeCode);
  } catch (e) {
    console.error("Erreur test connexion:", e);
    setError(
      "Impossible de joindre le backend. Vérifiez que l'API FastAPI est démarrée."
    );
  } finally {
    setTesting(false);
  }
}

  function handleRefresh() {
    setLastResult(null);
    setLastTestName("");
    setLastTestType("");
    setError("");
    setRefreshKey((k) => k + 1);
  }

  if (loading) {
    return <div style={styles.page}>Chargement...</div>;
  }

  if (!targets.length) {
    return (
      <div style={styles.page}>
        <PageHeader
          title="Test de Connexion"
          subtitle="Vérifiez la connectivité et récupérez les informations de vos bases cibles"
        />

        <div style={styles.emptyState}>
          <div style={styles.emptyStateTitle}>Aucune base cible configurée</div>
          <div style={styles.emptyStateText}>
            Ajoutez d'abord une base dans <b>Config BD</b> avant de tester.
          </div>
        </div>
      </div>
    );
  }

  const success = !!lastResult?.success;
  const version = lastResult?.version || "—";
  const openMode = lastResult?.open_mode || "—";
  const logMode = lastResult?.log_mode || "—";
  const latencyMs = lastResult?.latency_ms;
  const errorMsg = !success ? lastResult?.message : null;

  let statusColors = {
    bg: "#f0fdf4",
    border: "#bbf7d0",
    color: "#166534",
    title: "Connexion réussie",
  };

  if (lastResult && !success) {
    statusColors = {
      bg: "#fff1f2",
      border: "#fecdd3",
      color: "#9f1239",
      title: "Connexion échouée",
    };
  }

  const dbTypeId = selected?.db_type_id;
  const dbTypeCode = dbTypeId ? dbTypeMap[Number(dbTypeId)] || "—" : "—";

  const infoItems = [
    ["Base", selected?.db_name || "—"],
    ["Type BD", dbTypeCode],
    ["Host", String(selected?.host || "—")],
    ["Port", String(selected?.port || "—")],
    ["Service/SID", String(selected?.service_name || selected?.sid || "—")],
    ["Utilisateur", String(selected?.username || "—")],
  ];

  return (
    <div style={styles.page}>
      <PageHeader
        title="Test de Connexion"
        subtitle="Vérifiez la connectivité et récupérez les informations de vos bases cibles"
      />

      {error ? <ErrorBox text={error} /> : null}

      <FieldLabel text="Base cible" />

      <div style={styles.topBar}>
        <div style={{ flex: 2.5 }}>
          <select
            style={styles.select}
            value={selectedDbId}
            onChange={(e) => setSelectedDbId(e.target.value)}
          >
            {targets.map((t) => (
              <option key={t.db_id} value={t.db_id}>
                {(t.db_name || "").trim()} · {t.host}:{t.port}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1.4 }}>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={handleTestConnection}
            disabled={!selected || testing}
          >
            {testing ? "Test en cours..." : "Tester la connexion"}
          </button>
        </div>

        <div style={{ flex: 1 }}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={handleRefresh}
          >
            Rafraîchir
          </button>
        </div>

        <div style={{ flex: 4 }} />
      </div>

      {selected ? (
        <div style={styles.infoCard}>
          {infoItems.map(([label, value]) => (
            <div key={label}>
              <div style={styles.infoLabel}>{label}</div>
              <div style={styles.infoValue}>{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {lastResult ? (
        <>
          <div
            style={{
              ...styles.resultBanner,
              background: statusColors.bg,
              border: `1px solid ${statusColors.border}`,
            }}
          >
            <div>
              <div
                style={{
                  ...styles.resultTitle,
                  color: statusColors.color,
                }}
              >
                {statusColors.title} — {lastTestName} ({lastTestType})
              </div>
              <div
                style={{
                  ...styles.resultSub,
                  color: statusColors.color,
                }}
              >
                Temps de réponse : {latencyLabel(latencyMs)}
              </div>
            </div>
          </div>

          {success ? (
            <>
              <div style={styles.grid3}>
                <MetricCard label="VERSION DU SGBD" value={version} accent="#3b82f6" />
                <MetricCard label="MODE D'OUVERTURE" value={openMode} accent="#8b5cf6" />
                <MetricCard label="MODE ARCHIVAGE" value={logMode} accent="#f59e0b" />
              </div>

              <div style={{ height: 20 }} />

              <div style={styles.sectionMiniTitle}>Détails complets</div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <tbody>
                    {[
                      ["Base", lastTestName],
                      ["Type BD", lastTestType],
                      ["Version", version],
                      ["Mode", openMode],
                      ["Archivage", logMode],
                      ["Latence", latencyLabel(latencyMs)],
                      ["Statut", "OK"],
                    ].map(([k, v], i) => (
                      <tr
                        key={k}
                        style={{
                          background: i % 2 === 0 ? "#f8fafc" : "#ffffff",
                        }}
                      >
                        <td style={styles.tdLabel}>{k}</td>
                        <td style={styles.tdValue}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              {errorMsg ? (
                <div style={styles.errorDetailsBox}>
                  <div style={styles.errorDetailsTitle}>Détail de l'erreur</div>
                  <pre style={styles.errorPre}>{errorMsg}</pre>
                </div>
              ) : null}

              <InfoBox text="Vérifiez que la base est démarrée, que host/port/service sont corrects et que l'utilisateur a les droits de connexion." />
            </>
          )}
        </>
      ) : (
        <div style={styles.emptyActionBox}>
          <div style={styles.emptyActionTitle}>
            Sélectionnez une base et cliquez sur <b>Tester la connexion</b>
          </div>
          <div style={styles.emptyActionText}>
            Affichera la version du SGBD, le mode d'ouverture et le mode d'archivage.
          </div>
        </div>
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

function FieldLabel({ text }) {
  return <div style={styles.fieldLabel}>{text}</div>;
}

function MetricCard({ label, value, accent }) {
  return (
    <div style={styles.metricCard}>
      <div style={{ ...styles.metricTopline, background: accent }} />
      <div style={styles.metricCardLabel}>{label}</div>
      <div style={styles.metricCardValue}>{value}</div>
    </div>
  );
}

function ErrorBox({ text }) {
  return <div style={styles.errorBox}>{text}</div>;
}

function InfoBox({ text }) {
  return <div style={styles.infoBox}>{text}</div>;
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#94a3b8",
    marginBottom: 8,
  },
  topBar: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  select: {
    width: "100%",
    padding: "0.85rem 0.95rem",
    borderRadius: 12,
    border: "1.5px solid #e4e9f2",
    background: "#fff",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
  },
  primaryButton: {
    width: "100%",
    padding: "0.85rem 1rem",
    borderRadius: 12,
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    width: "100%",
    padding: "0.85rem 1rem",
    borderRadius: 12,
    border: "1px solid #dbe4f0",
    background: "#ffffff",
    color: "#334155",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  infoCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "1rem 1.5rem",
    margin: "0.75rem 0 1.25rem",
    display: "flex",
    flexWrap: "wrap",
    gap: "2rem",
  },
  infoLabel: {
    fontSize: "0.65rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#94a3b8",
  },
  infoValue: {
    fontWeight: 600,
    color: "#0f172a",
    fontSize: "0.88rem",
    marginTop: 2,
  },
  resultBanner: {
    borderRadius: 12,
    padding: "0.9rem 1.25rem",
    marginBottom: "1.25rem",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  resultTitle: {
    fontWeight: 700,
    fontSize: "1rem",
  },
  resultSub: {
    fontSize: "0.82rem",
    opacity: 0.8,
    marginTop: "0.1rem",
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
  },
  metricCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "1.25rem 1.5rem",
    boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
    position: "relative",
    overflow: "hidden",
  },
  metricTopline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: "3px 3px 0 0",
  },
  metricCardLabel: {
    fontSize: "0.65rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#94a3b8",
    marginBottom: "0.4rem",
  },
  metricCardValue: {
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "#0f172a",
    lineHeight: 1.4,
  },
  sectionMiniTitle: {
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#94a3b8",
    margin: "1.25rem 0 0.5rem",
  },
  tableWrap: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tdLabel: {
    padding: "0.6rem 1rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#64748b",
    width: 150,
    borderBottom: "1px solid #f1f5f9",
  },
  tdValue: {
    padding: "0.6rem 1rem",
    fontSize: "0.85rem",
    color: "#1e293b",
    borderBottom: "1px solid #f1f5f9",
  },
  errorDetailsBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: 10,
    padding: "1rem",
    marginBottom: "1rem",
  },
  errorDetailsTitle: {
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#9f1239",
    marginBottom: "0.5rem",
  },
  errorPre: {
    fontSize: "0.82rem",
    color: "#7f1d1d",
    whiteSpace: "pre-wrap",
    margin: 0,
  },
  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: 12,
    padding: "1rem 1.1rem",
    color: "#9f1239",
    fontWeight: 800,
    marginBottom: 16,
  },
  infoBox: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: "1rem 1.1rem",
    color: "#1d4ed8",
    fontWeight: 700,
  },
  emptyState: {
    textAlign: "center",
    padding: "4rem",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 16,
    marginTop: "2rem",
  },
  emptyStateTitle: {
    fontWeight: 700,
    fontSize: "1.1rem",
    color: "#334155",
  },
  emptyStateText: {
    color: "#94a3b8",
    marginTop: "0.4rem",
    fontSize: "0.9rem",
  },
  emptyActionBox: {
    textAlign: "center",
    padding: "3rem 2rem",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    marginTop: "1rem",
  },
  emptyActionTitle: {
    fontWeight: 600,
    color: "#64748b",
    fontSize: "0.95rem",
  },
  emptyActionText: {
    color: "#94a3b8",
    fontSize: "0.82rem",
    marginTop: "0.4rem",
  },
};