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

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function AiAnalysis() {
  const [dbs, setDbs] = useState([]);
  const [selectedDbId, setSelectedDbId] = useState("");
  const [selectedDbName, setSelectedDbName] = useState("");

  const [analysis, setAnalysis] = useState("");
  const [loadingDbs, setLoadingDbs] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const risk = useMemo(() => getRiskFromText(analysis), [analysis]);

  async function loadChatHistory(dbId) {
    if (!dbId) return;

    try {
      setHistoryLoading(true);

      const historyKey = `DB_ANALYSIS_${dbId}`;
      const res = await fetch(`${API_BASE}/ai/chat-history/${historyKey}`);
      const data = await parseJsonSafe(res);

      if (data?.success && Array.isArray(data.messages)) {
        const formatted = data.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        setChatMessages(formatted);
      }
    } catch (e) {
      console.error("Erreur historique chatbot:", e);
    } finally {
      setHistoryLoading(false);
    }
  }

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
          rows.find(
            (db) => String(db.db_name || "").toUpperCase() === "LOCAL_19C"
          ) ||
          rows[0];

        if (defaultDb) {
          const id = String(defaultDb.db_id);
          setSelectedDbId(id);
          setSelectedDbName(defaultDb.db_name || `Base ${defaultDb.db_id}`);
          loadChatHistory(id);
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
    setChatInput("");
    setChatMessages([]);

    loadChatHistory(value);
  }

  async function runAnalysis() {
    if (!selectedDbId) {
      setError("Veuillez sélectionner une base.");
      return;
    }

    setLoadingAnalysis(true);
    setError("");
    setAnalysis("");
    setChatInput("");

    try {
      const res = await fetch(`${API_BASE}/ai/analyze-db/${selectedDbId}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await parseJsonSafe(res);

      if (!res.ok) {
        throw new Error(data?.detail || "Erreur analyse IA.");
      }

      const resultText = data?.analysis || "";
      setAnalysis(resultText);

      if (!chatMessages.length) {
        setChatMessages([
          {
            role: "assistant",
            content:
              "J’ai terminé l’analyse de la base. Vous pouvez me poser des questions sur les anomalies, les métriques, les causes possibles, les risques ou les étapes de playbook proposées.",
          },
        ]);
      }
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    } finally {
      setLoadingAnalysis(false);
    }
  }

  async function sendChatMessage() {
    const question = chatInput.trim();

    if (!question) return;

    if (!analysis) {
      setError("Lancez d’abord l’analyse IA avant de discuter avec le chatbot.");
      return;
    }

    const newMessages = [
      ...chatMessages,
      {
        role: "user",
        content: question,
      },
    ];

    try {
      setChatInput("");
      setChatMessages(newMessages);
      setChatLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/ai/chat-db-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          db_id: selectedDbId,
          db_name: selectedDbName,
          analysis,
          messages: newMessages,
        }),
      });

      const data = await parseJsonSafe(res);

      if (!res.ok) {
        throw new Error(data?.detail || "Erreur chatbot IA.");
      }

      setChatMessages([
        ...newMessages,
        {
          role: "assistant",
          content: data?.answer || "",
        },
      ]);
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    } finally {
      setChatLoading(false);
    }
  }

  function handleChatKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
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
          <div style={styles.selectedInfo}>
            Base sélectionnée : <strong>{selectedDbName}</strong>
          </div>
        ) : null}
      </div>

      {historyLoading ? (
        <div style={styles.loadingBox}>Chargement de l’historique du chatbot...</div>
      ) : null}

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
        <>
          <div style={styles.resultBox}>
            <h2 style={styles.resultTitle}>Résultat de l’analyse IA</h2>
            <pre style={styles.resultContent}>{analysis}</pre>
          </div>

          <div style={styles.chatPanel}>
            <div style={styles.chatHeader}>
              <div style={styles.chatTitle}>Chatbot IA DBA</div>
              <div style={styles.chatSubtitle}>
                Historique chargé automatiquement par base.
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

              {chatLoading ? (
                <div style={styles.messageRow}>
                  <div style={{ ...styles.messageBubble, ...styles.assistantBubble }}>
                    <div style={styles.messageText}>Réflexion en cours...</div>
                  </div>
                </div>
              ) : null}
            </div>

            <div style={styles.chatInputBox}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Posez une question sur l’analyse IA..."
                style={styles.chatInput}
              />

              <button
                type="button"
                onClick={sendChatMessage}
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
    gridTemplateColumns: "1fr 240px",
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
    marginBottom: 16,
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

  chatPanel: {
    marginTop: 20,
    background: "#ffffff",
    border: "1px solid #dbe4f0",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },

  chatHeader: {
    padding: "16px 20px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
  },

  chatTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#1e3a8a",
  },

  chatSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
  },

  chatMessages: {
    minHeight: 260,
    maxHeight: 520,
    overflowY: "auto",
    padding: 18,
    background: "#f8fafc",
  },

  messageRow: {
    display: "flex",
    marginBottom: 12,
  },

  messageBubble: {
    maxWidth: "78%",
    borderRadius: 16,
    padding: "11px 14px",
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
    fontSize: 14,
    lineHeight: 1.65,
  },

  chatInputBox: {
    display: "flex",
    gap: 12,
    padding: 14,
    borderTop: "1px solid #e2e8f0",
    background: "#ffffff",
  },

  chatInput: {
    flex: 1,
    minHeight: 54,
    maxHeight: 130,
    resize: "vertical",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    outline: "none",
  },

  sendButton: {
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: 14,
    padding: "0 22px",
    fontWeight: 900,
    cursor: "pointer",
  },
};