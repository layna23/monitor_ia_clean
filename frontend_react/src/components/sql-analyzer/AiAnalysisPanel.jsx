import { useState } from "react";
import { analyzeMultiPhv, analyzeSinglePlan } from "../../services/aiApi";

export default function AiAnalysisPanel({
  selectedScript,
  selectedPhv,
  planText,
  fetchPlanForPhv,
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState("");

  async function handleAnalyzeIA() {
    if (!selectedScript?.sql_id || !selectedScript?.sql_content) {
      setAiError("Sélectionnez une requête SQL avant de lancer l’analyse IA.");
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");
      setAiResult(null);

      const phvList = Array.isArray(selectedScript.phv_list)
        ? selectedScript.phv_list
        : [];

      // 🔥 MULTI PHV
      if (phvList.length > 1) {
        const plans = [];

        for (const phv of phvList) {
          const plan = await fetchPlanForPhv(
            selectedScript.sql_id,
            phv,
            true
          );

          plans.push({
            phv,
            buffer_gets: selectedScript.buffer_gets,
            disk_reads: selectedScript.disk_reads,
            executions: selectedScript.executions,
            elapsed_time: selectedScript.elapsed_time_sec,
            cpu_time: selectedScript.cpu_time_sec,
            plan,
          });
        }

        const result = await analyzeMultiPhv({
          sql_id: selectedScript.sql_id,
          sql: selectedScript.sql_content,
          plans,
        });

        setAiResult(result);
        return;
      }

      // 🔥 SINGLE PLAN
      const result = await analyzeSinglePlan({
        sql_id: selectedScript.sql_id,
        sql: selectedScript.sql_content,
        phv: selectedPhv,
        plan: planText,
      });

      setAiResult(result);
    } catch (e) {
      setAiError(e.message || "Erreur lors de l’analyse IA.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div style={styles.aiWrapper}>
      {/* HEADER */}
      <div style={styles.aiHeader}>
        <div>
          <div style={styles.titleRow}>
            <h2 style={styles.title}>Analyse IA SQL</h2>

            {aiResult?.mode ? (
              <span style={styles.modeBadge}>
                {aiResult.mode === "multi_phv"
                  ? "Multi PHV"
                  : "Plan unique"}
              </span>
            ) : (
              <span style={styles.readyBadge}>Prêt</span>
            )}
          </div>

          <p style={styles.subtitle}>
            Analyse intelligente du plan d’exécution et sélection du meilleur PHV.
          </p>
        </div>

        <button
          style={{
            ...styles.aiButton,
            ...(aiLoading ? styles.aiButtonLoading : {}),
          }}
          onClick={handleAnalyzeIA}
          disabled={aiLoading}
        >
          {aiLoading ? (
            <>
              <span style={styles.spinner} />
              Analyse...
            </>
          ) : (
            "Analyser IA"
          )}
        </button>
      </div>

      {/* INFOS */}
      <div style={styles.metaGrid}>
        <InfoCard label="SQL_ID" value={selectedScript?.sql_id || "—"} />
        <InfoCard label="PHV" value={selectedPhv || "—"} />
        <InfoCard
          label="Nombre PHV"
          value={selectedScript?.phv_list?.length || 0}
        />
        <InfoCard
          label="Mode"
          value={
            selectedScript?.phv_list?.length > 1
              ? "Comparaison"
              : "Plan unique"
          }
        />
      </div>

      {/* ERROR */}
      {aiError && <div style={styles.errorBox}>{aiError}</div>}

      {/* LOADING */}
      {aiLoading && (
        <div style={styles.loadingBox}>Analyse IA en cours...</div>
      )}

      {/* RESULT */}
      {aiResult && (
        <div style={styles.resultPanel}>
          <div style={styles.resultTop}>
            <div>
              <div style={styles.resultTitle}>
                Résultat de l’analyse IA
              </div>
            </div>

            {aiResult.best_phv && (
              <div style={styles.bestPhvBox}>
                <span>BEST PHV</span>
                <strong>{aiResult.best_phv}</strong>
              </div>
            )}
          </div>

          <pre style={styles.analysisText}>
            {aiResult.analysis}
          </pre>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div style={styles.infoCard}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

const styles = {
  aiWrapper: {
    background: "#ffffff",
    border: "1px solid #dbeafe",
    borderRadius: 20,
    padding: 20,
  },

  aiHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  titleRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },

  title: {
    fontSize: 20,
    fontWeight: 900,
    color: "#1e3a8a",
  },

  subtitle: {
    fontSize: 13,
    color: "#64748b",
  },

  readyBadge: {
    background: "#e0f2fe",
    padding: "4px 10px",
    borderRadius: 10,
  },

  modeBadge: {
    background: "#dcfce7",
    padding: "4px 10px",
    borderRadius: 10,
  },

  aiButton: {
    background: "#2563eb",
    color: "white",
    padding: "10px 20px",
    borderRadius: 12,
    border: "none",
    fontWeight: "bold",
    cursor: "pointer",
  },

  aiButtonLoading: {
    opacity: 0.6,
  },

  spinner: {
    width: 14,
    height: 14,
    border: "2px solid white",
    borderTop: "2px solid transparent",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin 1s linear infinite",
  },

  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 10,
    marginBottom: 20,
  },

  infoCard: {
    background: "#f8fafc",
    padding: 10,
    borderRadius: 10,
  },

  infoLabel: {
    fontSize: 11,
    color: "#64748b",
  },

  infoValue: {
    fontWeight: "bold",
  },

  errorBox: {
    background: "#fee2e2",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },

  loadingBox: {
    background: "#eff6ff",
    padding: 10,
    borderRadius: 10,
  },

  resultPanel: {
    marginTop: 10,
    border: "1px solid #dbeafe",
    borderRadius: 12,
  },

  resultTop: {
    display: "flex",
    justifyContent: "space-between",
    padding: 10,
    background: "#f1f5f9",
  },

  resultTitle: {
    fontWeight: "bold",
  },

  bestPhvBox: {
    background: "#dcfce7",
    padding: "5px 10px",
    borderRadius: 10,
  },

  analysisText: {
    padding: 15,
    whiteSpace: "pre-wrap",
    fontSize: 13,
  },
};