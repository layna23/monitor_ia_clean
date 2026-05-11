import { useEffect, useState } from "react";
import {
  analyzeMultiPhv,
  analyzeSinglePlan,
  chatSqlAnalysis,
  getChatHistory,
} from "../../services/aiApi";

export default function AiAnalysisPanel({
  selectedScript,
  selectedPhv,
  planText,
  fetchPlanForPhv,
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState("");

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadHistoryForSql(sqlId) {
    if (!sqlId) return;

    try {
      setHistoryLoading(true);

      const data = await getChatHistory(sqlId);

      if (data?.success && Array.isArray(data.messages)) {
        const formattedMessages = data.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        setChatMessages(formattedMessages);
      }
    } catch (e) {
      console.error("Erreur chargement historique chatbot:", e);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    setAiResult(null);
    setAiError("");
    setChatMessages([]);
    setChatInput("");

    if (selectedScript?.sql_id) {
      loadHistoryForSql(selectedScript.sql_id);
    }
  }, [selectedScript?.sql_id]);

  async function handleAnalyzeIA() {
    if (!selectedScript?.sql_id || !selectedScript?.sql_content) {
      setAiError("Sélectionnez une requête SQL avant de lancer l’analyse IA.");
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");
      setAiResult(null);

      const existingHistory = chatMessages.length > 0 ? chatMessages : [];

      const phvList = Array.isArray(selectedScript.phv_list)
        ? selectedScript.phv_list
        : [];

      if (phvList.length > 1) {
        const plans = [];

        for (const phv of phvList) {
          const plan = await fetchPlanForPhv(selectedScript.sql_id, phv, true);

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

        setAiResult({ ...result, plans });

        if (!existingHistory.length) {
          setChatMessages([
            {
              role: "assistant",
              content:
                "J’ai terminé l’analyse multi-PHV. Vous pouvez me poser des questions sur le choix du meilleur PHV, les différences entre les plans ou les recommandations SQL.",
            },
          ]);
        }

        return;
      }

      const result = await analyzeSinglePlan({
        sql_id: selectedScript.sql_id,
        sql: selectedScript.sql_content,
        phv: selectedPhv,
        plan: planText,
      });

      setAiResult({
        ...result,
        plans: [{ phv: selectedPhv, plan: planText }],
      });

      if (!existingHistory.length) {
        setChatMessages([
          {
            role: "assistant",
            content:
              "J’ai terminé l’analyse du plan sélectionné. Vous pouvez me poser des questions sur le plan, les index, les risques ou les optimisations possibles.",
          },
        ]);
      }
    } catch (e) {
      setAiError(e.message || "Erreur lors de l’analyse IA.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSendChatMessage() {
    const question = chatInput.trim();

    if (!question) return;

    if (!aiResult) {
      setAiError("Lancez d’abord une analyse IA avant de discuter avec le chatbot.");
      return;
    }

    const newMessages = [...chatMessages, { role: "user", content: question }];

    try {
      setChatInput("");
      setChatMessages(newMessages);
      setChatLoading(true);
      setAiError("");

      const result = await chatSqlAnalysis({
        sql_id: selectedScript?.sql_id,
        sql: selectedScript?.sql_content,
        selected_phv: selectedPhv,
        best_phv: aiResult?.best_phv,
        analysis: aiResult?.analysis,
        plans: aiResult?.plans || [],
        messages: newMessages,
      });

      setChatMessages([
        ...newMessages,
        { role: "assistant", content: result.answer },
      ]);
    } catch (e) {
      setAiError(e.message || "Erreur chatbot IA.");
    } finally {
      setChatLoading(false);
    }
  }

  function handleChatKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChatMessage();
    }
  }

  return (
    <div style={styles.aiWrapper}>
      <div style={styles.aiHeader}>
        <div>
          <div style={styles.titleRow}>
            <h2 style={styles.title}>Analyse IA SQL</h2>

            {aiResult?.mode ? (
              <span style={styles.modeBadge}>
                {aiResult.mode === "multi_phv" ? "Multi PHV" : "Plan unique"}
              </span>
            ) : (
              <span style={styles.readyBadge}>Prêt</span>
            )}
          </div>

          <p style={styles.subtitle}>
            Analyse intelligente du plan d’exécution, sélection du meilleur PHV et discussion avec l’IA.
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
          {aiLoading ? "Analyse..." : "Analyser IA"}
        </button>
      </div>

      <div style={styles.metaGrid}>
        <InfoCard label="SQL_ID" value={selectedScript?.sql_id || "—"} />
        <InfoCard label="PHV" value={selectedPhv || "—"} />
        <InfoCard label="Nombre PHV" value={selectedScript?.phv_list?.length || 0} />
        <InfoCard
          label="Mode"
          value={
            selectedScript?.phv_list?.length > 1 ? "Comparaison" : "Plan unique"
          }
        />
      </div>

      {historyLoading && (
        <div style={styles.loadingBox}>Chargement de l’historique...</div>
      )}

      {aiError && <div style={styles.errorBox}>{aiError}</div>}

      {aiLoading && <div style={styles.loadingBox}>Analyse IA en cours...</div>}

      {aiResult && (
        <>
          <div style={styles.resultPanel}>
            <div style={styles.resultTop}>
              <div style={styles.resultTitle}>Résultat de l’analyse IA</div>

              {aiResult.best_phv && (
                <div style={styles.bestPhvBox}>
                  <span>BEST PHV </span>
                  <strong>{aiResult.best_phv}</strong>
                </div>
              )}
            </div>

            <pre style={styles.analysisText}>{aiResult.analysis}</pre>
          </div>

          <div style={styles.chatPanel}>
            <div style={styles.chatHeader}>
              <div style={styles.chatTitle}>Chatbot IA DBA</div>
              <div style={styles.chatSubtitle}>
                Historique chargé automatiquement par SQL_ID.
              </div>
            </div>

            <div style={styles.chatMessages}>
              {chatMessages.map((msg, index) => (
                <div
                  key={`${msg.role}-${index}`}
                  style={{
                    ...styles.messageRow,
                    justifyContent:
                      msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      ...styles.messageBubble,
                      ...(msg.role === "user"
                        ? styles.userBubble
                        : styles.assistantBubble),
                    }}
                  >
                    <div style={styles.messageText}>{msg.content}</div>
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div style={styles.messageRow}>
                  <div style={{ ...styles.messageBubble, ...styles.assistantBubble }}>
                    <div style={styles.messageText}>Réflexion en cours...</div>
                  </div>
                </div>
              )}
            </div>

            <div style={styles.chatInputBox}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Posez une question sur l’analyse ou le choix du PHV..."
                style={styles.chatInput}
              />

              <button
                type="button"
                onClick={handleSendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  ...styles.sendButton,
                  opacity: chatLoading || !chatInput.trim() ? 0.6 : 1,
                }}
              >
                Envoyer
              </button>
            </div>
          </div>
        </>
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
    gap: 16,
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
    margin: 0,
  },

  subtitle: {
    fontSize: 13,
    color: "#64748b",
    margin: "6px 0 0",
  },

  readyBadge: {
    background: "#e0f2fe",
    padding: "4px 10px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 800,
    color: "#0369a1",
  },

  modeBadge: {
    background: "#dcfce7",
    padding: "4px 10px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 800,
    color: "#166534",
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
    border: "1px solid #e2e8f0",
  },

  infoLabel: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 4,
  },

  infoValue: {
    fontWeight: "bold",
    color: "#0f172a",
  },

  errorBox: {
    background: "#fee2e2",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    color: "#991b1b",
    fontWeight: 700,
  },

  loadingBox: {
    background: "#eff6ff",
    padding: 10,
    borderRadius: 10,
    color: "#1d4ed8",
    fontWeight: 700,
    marginBottom: 10,
  },

  resultPanel: {
    marginTop: 10,
    border: "1px solid #dbeafe",
    borderRadius: 12,
    overflow: "hidden",
  },

  resultTop: {
    display: "flex",
    justifyContent: "space-between",
    padding: 10,
    background: "#f1f5f9",
    gap: 12,
  },

  resultTitle: {
    fontWeight: "bold",
    color: "#0f172a",
  },

  bestPhvBox: {
    background: "#dcfce7",
    padding: "5px 10px",
    borderRadius: 10,
    color: "#166534",
    fontSize: 12,
  },

  analysisText: {
    padding: 15,
    whiteSpace: "pre-wrap",
    fontSize: 13,
    margin: 0,
    color: "#0f172a",
    lineHeight: 1.6,
  },

  chatPanel: {
    marginTop: 18,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    overflow: "hidden",
    background: "#ffffff",
  },

  chatHeader: {
    padding: "14px 16px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
  },

  chatTitle: {
    fontWeight: 900,
    color: "#1e3a8a",
    fontSize: 16,
  },

  chatSubtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },

  chatMessages: {
    padding: 16,
    minHeight: 260,
    maxHeight: 520,
    overflowY: "auto",
    background: "#f8fafc",
  },

  messageRow: {
    display: "flex",
    marginBottom: 12,
  },

  messageBubble: {
    maxWidth: "78%",
    borderRadius: 16,
    padding: "10px 12px",
    boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
  },

  userBubble: {
    background: "#2563eb",
    color: "#ffffff",
    borderTopRightRadius: 4,
  },

  assistantBubble: {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
    borderTopLeftRadius: 4,
  },

  messageText: {
    whiteSpace: "pre-wrap",
    fontSize: 13,
    lineHeight: 1.6,
  },

  chatInputBox: {
    display: "flex",
    gap: 10,
    padding: 12,
    borderTop: "1px solid #e2e8f0",
    background: "#ffffff",
  },

  chatInput: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    resize: "vertical",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: 10,
    fontSize: 13,
    outline: "none",
  },

  sendButton: {
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    padding: "0 18px",
    fontWeight: 900,
    cursor: "pointer",
  },
};