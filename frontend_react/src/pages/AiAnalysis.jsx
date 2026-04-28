import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

function getRiskFromText(text) {
  const upper = String(text || "").toUpperCase();

  if (upper.includes("CRITICAL")) {
    return {
      label: "CRITICAL",
      color: "#991b1b",
      bg: "#fee2e2",
      border: "#fecaca",
    };
  }

  if (upper.includes("WARNING")) {
    return {
      label: "WARNING",
      color: "#92400e",
      bg: "#fef3c7",
      border: "#fde68a",
    };
  }

  return {
    label: "OK",
    color: "#166534",
    bg: "#dcfce7",
    border: "#bbf7d0",
  };
}

export default function AiAnalysis() {
  const [dbs, setDbs] = useState([]);
  const [selectedDbId, setSelectedDbId] = useState("");
  const [selectedDbName, setSelectedDbName] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loadingDbs, setLoadingDbs] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");
  const [validatedPlaybook, setValidatedPlaybook] = useState(false);

  const risk = useMemo(() => getRiskFromText(analysis), [analysis]);
  const hasPlaybook = useMemo(
    () => String(analysis || "").toLowerCase().includes("playbook"),
    [analysis]
  );

  useEffect(() => {
    async function loadDbs() {
      setLoadingDbs(true);
      setError("");

      try {
        const res = await fetch(`${API_BASE}/target-dbs/`);
        const data = await res.json();
        const rows = Array.isArray(data) ? data : [];

        setDbs(rows);

        const params = new URLSearchParams(window.location.search);
        const dbIdFromUrl = params.get("db_id");

        const defaultDb =
          rows.find((db) => String(db.db_id) === String(dbIdFromUrl)) ||
          rows.find((db) => String(db.db_name || "").toUpperCase() === "LOCAL_19C") ||
          rows[0];

        if (defaultDb) {
          setSelectedDbId(String(defaultDb.db_id));
          setSelectedDbName(defaultDb.db_name || `Base ${defaultDb.db_id}`);
        }
      } catch (e) {
        console.error(e);
        setError("Erreur lors du chargement des bases.");
      } finally {
        setLoadingDbs(false);
      }
    }

    loadDbs();
  }, []);

  function handleChangeDb(value) {
    setSelectedDbId(value);
    const found = dbs.find((db) => String(db.db_id) === String(value));
    setSelectedDbName(found?.db_name || `Base ${value}`);
    setAnalysis("");
    setError("");
    setValidatedPlaybook(false);
  }

  async function runAnalysis() {
    if (!selectedDbId) {
      setError("Veuillez sélectionner une base.");
      return;
    }

    setLoadingAnalysis(true);
    setError("");
    setAnalysis("");
    setValidatedPlaybook(false);

    try {
      const res = await fetch(`${API_BASE}/ai/analyze-db/${selectedDbId}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Erreur analyse IA.");
      }

      setAnalysis(data?.analysis || "");
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    } finally {
      setLoadingAnalysis(false);
    }
  }

  function validatePlaybook() {
    setValidatedPlaybook(true);
  }

  if (loadingDbs) {
    return (
      <div style={styles.page}>
        <h1 style={styles.title}>Analyse IA</h1>
        <p style={styles.muted}>Chargement...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Analyse IA</h1>
          <p style={styles.subtitle}>
            Détection des anomalies, anticipation des incidents et recommandations DBA.
          </p>
        </div>

        {analysis ? (
          <div
            style={{
              ...styles.riskBadge,
              background: risk.bg,
              color: risk.color,
              borderColor: risk.border,
            }}
          >
            Risque : {risk.label}
          </div>
        ) : null}
      </div>

      <div style={styles.card}>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>Base à analyser</label>
            <select
              style={styles.select}
              value={selectedDbId}
              onChange={(e) => handleChangeDb(e.target.value)}
            >
              {dbs.map((db) => (
                <option key={db.db_id} value={db.db_id}>
                  {db.db_name || `Base ${db.db_id}`} | {db.host || "localhost"}:
                  {db.port || "—"}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            style={{
              ...styles.button,
              opacity: loadingAnalysis ? 0.7 : 1,
              cursor: loadingAnalysis ? "not-allowed" : "pointer",
            }}
            onClick={runAnalysis}
            disabled={loadingAnalysis}
          >
            {loadingAnalysis ? "Analyse en cours..." : "Lancer l’analyse IA"}
          </button>
        </div>

        {selectedDbName ? (
          <div style={styles.selectedInfo}>Base sélectionnée : {selectedDbName}</div>
        ) : null}
      </div>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      {!analysis && !loadingAnalysis ? (
        <div style={styles.emptyBox}>
          Lance l’analyse IA pour afficher le diagnostic complet de la base.
        </div>
      ) : null}

      {loadingAnalysis ? (
        <div style={styles.loadingBox}>
          Analyse IA en cours avec Groq. Cela peut prendre quelques secondes...
        </div>
      ) : null}

      {analysis ? (
        <div style={styles.resultBox}>
          <h2 style={styles.resultTitle}>Résultat de l’analyse IA</h2>

          <pre style={styles.resultContent}>{analysis}</pre>

          {hasPlaybook ? (
            <div style={styles.playbookValidationBox}>
              <div style={styles.validationTitle}>Validation humaine obligatoire</div>
              <p style={styles.validationText}>
                Les playbooks sont semi-automatisés. Aucune action corrective n’est
                exécutée sans validation de l’utilisateur.
              </p>

              <button
                type="button"
                style={{
                  ...styles.validateButton,
                  ...(validatedPlaybook ? styles.validateButtonDone : {}),
                }}
                onClick={validatePlaybook}
              >
                {validatedPlaybook
                  ? "Playbook validé"
                  : "Valider le playbook recommandé"}
              </button>

              {validatedPlaybook ? (
                <div style={styles.validatedBox}>
                  Playbook validé. Prochaine étape : préparer l’exécution guidée étape
                  par étape.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f6f8fc",
    padding: 24,
    color: "#0f172a",
    fontFamily: "Arial, sans-serif",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 20,
  },

  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 800,
    color: "#1e293b",
  },

  subtitle: {
    margin: "8px 0 0 0",
    fontSize: 15,
    color: "#64748b",
  },

  muted: {
    color: "#64748b",
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
    marginBottom: 16,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 220px",
    gap: 16,
    alignItems: "end",
  },

  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 800,
    color: "#475569",
    marginBottom: 8,
  },

  select: {
    width: "100%",
    padding: "13px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    outline: "none",
  },

  button: {
    height: 48,
    border: "none",
    borderRadius: 14,
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 14,
  },

  selectedInfo: {
    marginTop: 14,
    color: "#475569",
    fontSize: 14,
    fontWeight: 600,
  },

  riskBadge: {
    border: "1px solid",
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    fontWeight: 700,
  },

  emptyBox: {
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    borderRadius: 18,
    padding: 32,
    textAlign: "center",
    color: "#64748b",
    fontWeight: 700,
  },

  loadingBox: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    borderRadius: 18,
    padding: 20,
    fontWeight: 800,
  },

  resultBox: {
    marginTop: 20,
    background: "#ffffff",
    border: "1px solid #dbe4f0",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },

  resultTitle: {
    fontSize: 20,
    fontWeight: 900,
    margin: "0 0 18px 0",
    color: "#1e293b",
  },

  resultContent: {
    whiteSpace: "pre-wrap",
    fontFamily: "Consolas, Monaco, monospace",
    fontSize: 14,
    lineHeight: 1.9,
    color: "#020617",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 20,
    overflowX: "auto",
    margin: 0,
  },

  playbookValidationBox: {
    marginTop: 18,
    padding: 16,
    borderRadius: 14,
    background: "#f8faff",
    border: "1px solid #c7d2fe",
  },

  validationTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#1e3a8a",
    marginBottom: 8,
  },

  validationText: {
    margin: "0 0 14px 0",
    fontSize: 13,
    color: "#475569",
    lineHeight: 1.6,
  },

  validateButton: {
    height: 44,
    border: "none",
    borderRadius: 12,
    padding: "0 16px",
    background: "#4f46e5",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },

  validateButtonDone: {
    background: "#16a34a",
  },

  validatedBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontSize: 13,
    fontWeight: 700,
  },
};