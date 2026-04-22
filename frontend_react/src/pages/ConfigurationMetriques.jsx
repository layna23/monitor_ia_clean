import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

const EMPTY_FORM = {
  metric_code: "",
  db_type_id: "",
  unit: "",
  frequency_sec: 300,
  warn_threshold: "",
  crit_threshold: "",
  is_active: true,
  sql_query: "",
};

export default function ConfigurationMetriques() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dbTypes, setDbTypes] = useState([]);
  const [metricDefs, setMetricDefs] = useState([]);

  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [search, setSearch] = useState("");
  const [dbFilter, setDbFilter] = useState("Tous");
  const [actifFilter, setActifFilter] = useState("Tous");
  const [selectedMetricId, setSelectedMetricId] = useState("");

  const [message, setMessage] = useState({ type: "", text: "" });
  const [showSqlPreview, setShowSqlPreview] = useState(false);

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

  async function apiPost(endpoint, payload) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Erreur POST");
    return res.json();
  }

  async function apiPut(endpoint, payload) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Erreur PUT");
    return res.json();
  }

  async function apiDelete(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Erreur DELETE");
    return true;
  }

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [dbTypesRes, metricDefsRes] = await Promise.all([
        apiGet("/db-types/", []),
        apiGet("/metric-defs/", []),
      ]);

      setDbTypes(Array.isArray(dbTypesRes) ? dbTypesRes : []);
      setMetricDefs(Array.isArray(metricDefsRes) ? metricDefsRes : []);
    } catch {
      setError("Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const dbTypeMap = useMemo(() => {
    const map = {};
    dbTypes.forEach((d) => {
      if (d?.db_type_id != null) {
        map[Number(d.db_type_id)] = (d.name || "").trim();
      }
    });
    return map;
  }, [dbTypes]);

  const dbTypeIds = useMemo(() => {
    return Object.keys(dbTypeMap).map(Number).sort((a, b) => a - b);
  }, [dbTypeMap]);

  function safeFloat(v) {
    if (v == null) return null;
    const s = String(v).trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  }

  function classifySqlSource(sqlQuery) {
    if (!sqlQuery) return "AUTRE";

    const sqlUpper = String(sqlQuery).toUpperCase();

    const oracleMarkers = ["V$", "GV$", "DBA_", "ALL_", "USER_", "DUAL"];
    const dbmonMarkers = [
      "METRIC_RUNS",
      "METRIC_VALUES",
      "METRIC_DEFS",
      "TARGET_DBS",
      "ALERTS",
      "DBMON.",
    ];

    if (oracleMarkers.some((marker) => sqlUpper.includes(marker))) return "ORACLE";
    if (dbmonMarkers.some((marker) => sqlUpper.includes(marker))) return "DBMON";
    return "AUTRE";
  }

  function getSourceBadgeStyle(source) {
    const s = String(source || "").toUpperCase();
    const stylesMap = {
      ORACLE: {
        bg: "#eff6ff",
        color: "#1d4ed8",
        border: "#bfdbfe",
      },
      DBMON: {
        bg: "#fef3c7",
        color: "#92400e",
        border: "#fcd34d",
      },
      AUTRE: {
        bg: "#f1f5f9",
        color: "#475569",
        border: "#cbd5e1",
      },
    };
    return stylesMap[s] || stylesMap.AUTRE;
  }

  function resetForm() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowSqlPreview(false);
  }

  function fillForm(row) {
    setEditId(row.metric_id);
    setForm({
      metric_code: row.metric_code || "",
      db_type_id:
        row.db_type_id != null && row.db_type_id !== ""
          ? String(row.db_type_id)
          : "",
      unit: row.unit || "",
      frequency_sec: Number(row.frequency_sec || 300),
      warn_threshold:
        row.warn_threshold == null ? "" : String(row.warn_threshold),
      crit_threshold:
        row.crit_threshold == null ? "" : String(row.crit_threshold),
      is_active: Number(row.is_active ?? 1) === 1,
      sql_query: row.sql_query || "",
    });
    setShowSqlPreview(false);
  }

  const actionLabel = editId != null ? "MODIFIER UNE MÉTRIQUE" : "CRÉER UNE MÉTRIQUE";

  const sqlSource = classifySqlSource(form.sql_query);
  const sqlSourceStyle = getSourceBadgeStyle(sqlSource);

  const rows = useMemo(() => {
    return metricDefs.map((m) => {
      const did =
        m?.db_type_id != null && m?.db_type_id !== ""
          ? Number(m.db_type_id)
          : null;

      return {
        ...m,
        type_bd: did != null ? dbTypeMap[did] || String(did) : "—",
        actif: Number(m.is_active || 0) === 1 ? "Oui" : "Non",
        source_sql: classifySqlSource(m.sql_query),
      };
    });
  }, [metricDefs, dbTypeMap]);

  const filteredRows = useMemo(() => {
    let view = [...rows];

    if (search.trim()) {
      const qq = search.trim().toLowerCase();
      view = view.filter((r) => {
        return ["metric_code", "sql_query", "unit", "type_bd", "source_sql"].some(
          (col) => String(r[col] ?? "").toLowerCase().includes(qq)
        );
      });
    }

    if (dbFilter !== "Tous") {
      view = view.filter((r) => r.type_bd === dbFilter);
    }

    if (actifFilter !== "Tous") {
      view = view.filter((r) => r.actif === actifFilter);
    }

    view.sort((a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || ""))
    );

    return view;
  }, [rows, search, dbFilter, actifFilter]);

  useEffect(() => {
    if (filteredRows.length > 0) {
      const exists = filteredRows.some(
        (r) => String(r.metric_id) === String(selectedMetricId)
      );
      if (!selectedMetricId || !exists) {
        setSelectedMetricId(String(filteredRows[0].metric_id));
      }
    } else {
      setSelectedMetricId("");
    }
  }, [filteredRows, selectedMetricId]);

  const selectedRow =
    metricDefs.find((r) => String(r.metric_id) === String(selectedMetricId)) || null;

  async function handleSave() {
    setMessage({ type: "", text: "" });

    const payload = {
      metric_code: form.metric_code.trim(),
      db_type_id: form.db_type_id ? Number(form.db_type_id) : null,
      unit: form.unit.trim() || null,
      frequency_sec: Number(form.frequency_sec),
      warn_threshold: safeFloat(form.warn_threshold),
      crit_threshold: safeFloat(form.crit_threshold),
      is_active: form.is_active ? 1 : 0,
      sql_query: form.sql_query.trim(),
    };

    if (!payload.metric_code) {
      setMessage({ type: "error", text: "Code métrique obligatoire." });
      return;
    }
    if (payload.db_type_id == null) {
      setMessage({ type: "error", text: "Type BD obligatoire." });
      return;
    }
    if (!payload.sql_query) {
      setMessage({ type: "error", text: "Requête SQL obligatoire." });
      return;
    }

    try {
      if (editId != null) {
        await apiPut(`/metric-defs/${editId}`, payload);
        setMessage({ type: "success", text: "Métrique modifiée ✅" });
      } else {
        await apiPost("/metric-defs/", payload);
        setMessage({ type: "success", text: "Métrique créée ✅" });
      }

      resetForm();
      await loadData();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la sauvegarde." });
    }
  }

  function handleTestQuery() {
    setMessage({ type: "", text: "" });
    if (!form.sql_query.trim()) {
      setMessage({ type: "warning", text: "Renseigne une requête SQL." });
      setShowSqlPreview(false);
      return;
    }
    setShowSqlPreview(true);
  }

  async function handleDelete() {
    if (!selectedMetricId) return;

    try {
      await apiDelete(`/metric-defs/${Number(selectedMetricId)}`);
      setMessage({ type: "success", text: "Supprimée ✅" });

      if (editId != null && String(editId) === String(selectedMetricId)) {
        resetForm();
      }

      await loadData();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression." });
    }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <PageHeader
          title="Définition des Métriques"
          subtitle="Chaque métrique = type BD · requête SQL · seuils · fréquence"
        />
        <InfoBox text="Chargement..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <PageHeader
          title="Définition des Métriques"
          subtitle="Chaque métrique = type BD · requête SQL · seuils · fréquence"
        />
        <ErrorBox text={error} />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Définition des Métriques"
        subtitle="Chaque métrique = type BD · requête SQL · seuils · fréquence"
      />

      {message.text ? (
        <div style={{ marginBottom: 16 }}>
          {message.type === "success" && <SuccessBox text={message.text} />}
          {message.type === "error" && <ErrorBox text={message.text} />}
          {message.type === "warning" && <WarningBox text={message.text} />}
        </div>
      ) : null}

      <SectionCard>
        <SectionTitle icon="📐" text={actionLabel} />

        <div style={styles.formGridTop}>
          <div>
            <FieldLabel text="Code métrique *" />
            <input
              type="text"
              value={form.metric_code}
              maxLength={50}
              placeholder="ex: CPU_USAGE"
              onChange={(e) =>
                setForm((prev) => ({ ...prev, metric_code: e.target.value }))
              }
              style={styles.input}
            />
          </div>

          <div>
            <FieldLabel text="Type BD *" />
            <select
              value={form.db_type_id}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, db_type_id: e.target.value }))
              }
              style={styles.select}
            >
              {dbTypeIds.length === 0 ? (
                <option value="">Aucun Type BD</option>
              ) : (
                dbTypeIds.map((id) => (
                  <option key={id} value={String(id)}>
                    {dbTypeMap[id]}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <FieldLabel text="Fréquence (sec)" />
            <input
              type="number"
              min={1}
              value={form.frequency_sec}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  frequency_sec: Number(e.target.value || 1),
                }))
              }
              style={styles.input}
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <FieldLabel text="Requête SQL *" />
          <textarea
            value={form.sql_query}
            rows={8}
            placeholder="SELECT metric_value FROM v$sysstat WHERE ..."
            onChange={(e) =>
              setForm((prev) => ({ ...prev, sql_query: e.target.value }))
            }
            style={styles.textarea}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <span
            style={{
              ...styles.badge,
              background: sqlSourceStyle.bg,
              color: sqlSourceStyle.color,
              border: `1px solid ${sqlSourceStyle.border}`,
            }}
          >
            {sqlSource}
          </span>
        </div>

        <div style={styles.formGridBottom}>
          <div>
            <FieldLabel text="Unité" />
            <input
              type="text"
              value={form.unit}
              maxLength={30}
              placeholder="%, count, ms…"
              onChange={(e) =>
                setForm((prev) => ({ ...prev, unit: e.target.value }))
              }
              style={styles.input}
            />
          </div>

          <div>
            <FieldLabel text="Seuil WARNING" />
            <input
              type="text"
              value={form.warn_threshold}
              placeholder="ex: 80"
              onChange={(e) =>
                setForm((prev) => ({ ...prev, warn_threshold: e.target.value }))
              }
              style={styles.input}
            />
          </div>

          <div>
            <FieldLabel text="Seuil CRITICAL" />
            <input
              type="text"
              value={form.crit_threshold}
              placeholder="ex: 95"
              onChange={(e) =>
                setForm((prev) => ({ ...prev, crit_threshold: e.target.value }))
              }
              style={styles.input}
            />
          </div>

          <div>
            <FieldLabel text="Actif" />
            <select
              value={form.is_active ? "Oui" : "Non"}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  is_active: e.target.value === "Oui",
                }))
              }
              style={styles.select}
            >
              <option>Oui</option>
              <option>Non</option>
            </select>
          </div>
        </div>

        <div style={styles.buttonRow}>
          <button onClick={handleSave} style={styles.primaryButton}>
            💾 Sauvegarder
          </button>
          <button onClick={handleTestQuery} style={styles.secondaryButton}>
            ▶ Tester la requête
          </button>
          <button onClick={resetForm} style={styles.secondaryButton}>
            🧹 Réinitialiser
          </button>
        </div>

        {showSqlPreview && form.sql_query.trim() ? (
          <div style={{ marginTop: 16 }}>
            <div style={styles.previewTitle}>Aperçu (12 premières lignes) :</div>
            <pre style={styles.sqlPreview}>
              {form.sql_query.trim().split("\n").slice(0, 12).join("\n")}
            </pre>
          </div>
        ) : null}
      </SectionCard>

      <div style={{ height: 18 }} />

      <SectionCard>
        <SectionTitle icon="📌" text="MÉTRIQUES CONFIGURÉES" />

        {rows.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>📐</div>
            Aucune métrique configurée.
          </div>
        ) : (
          <>
            <div style={styles.filtersGrid}>
              <input
                type="text"
                value={search}
                placeholder="Rechercher (code / SQL / unité)"
                onChange={(e) => setSearch(e.target.value)}
                style={styles.input}
              />

              <select
                value={dbFilter}
                onChange={(e) => setDbFilter(e.target.value)}
                style={styles.select}
              >
                <option>Tous</option>
                {dbTypeIds.map((id) => (
                  <option key={id}>{dbTypeMap[id]}</option>
                ))}
              </select>

              <select
                value={actifFilter}
                onChange={(e) => setActifFilter(e.target.value)}
                style={styles.select}
              >
                <option>Tous</option>
                <option>Oui</option>
                <option>Non</option>
              </select>
            </div>

            <div style={{ marginTop: 16 }}>
              <DataTable
                columns={[
                  "ID",
                  "CODE",
                  "TYPE BD",
                  "SOURCE SQL",
                  "UNITÉ",
                  "FRÉQ.(S)",
                  "WARN",
                  "CRIT",
                  "ACTIF",
                  "CRÉÉ LE",
                ]}
                rows={filteredRows.map((r) => ({
                  ID: `#${r.metric_id}`,
                  CODE: r.metric_code ?? "—",
                  "TYPE BD": r.type_bd ?? "—",
                  "SOURCE SQL": r.source_sql ?? "—",
                  "UNITÉ": r.unit || "—",
                  "FRÉQ.(S)": r.frequency_sec ?? "—",
                  WARN:
                    r.warn_threshold == null || String(r.warn_threshold) === ""
                      ? "—"
                      : String(r.warn_threshold),
                  CRIT:
                    r.crit_threshold == null || String(r.crit_threshold) === ""
                      ? "—"
                      : String(r.crit_threshold),
                  ACTIF: r.actif ?? "—",
                  "CRÉÉ LE": String(r.created_at || "").slice(0, 10) || "—",
                }))}
              />
            </div>

            <div style={styles.separator} />

            {filteredRows.length > 0 ? (
              <>
                <div style={styles.actionGrid}>
                  <div>
                    <select
                      value={selectedMetricId}
                      onChange={(e) => setSelectedMetricId(e.target.value)}
                      style={styles.select}
                    >
                      {filteredRows.map((r) => (
                        <option key={r.metric_id} value={String(r.metric_id)}>
                          {`#${r.metric_id} — ${r.metric_code || ""}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => selectedRow && fillForm(selectedRow)}
                    style={styles.secondaryButton}
                  >
                     Modifier
                  </button>

                  <button onClick={handleDelete} style={styles.dangerButton}>
                     Supprimer
                  </button>
                </div>

                {selectedRow ? (
                  <div style={{ marginTop: 14 }}>
                    {(() => {
                      const source = classifySqlSource(selectedRow.sql_query);
                      const badgeStyle = getSourceBadgeStyle(source);
                      return (
                        <>
                          <span
                            style={{
                              ...styles.badge,
                              background: badgeStyle.bg,
                              color: badgeStyle.color,
                              border: `1px solid ${badgeStyle.border}`,
                            }}
                          >
                            {source}
                          </span>
                          {selectedRow.sql_query?.trim() ? (
                            <pre style={{ ...styles.sqlPreview, marginTop: 12 }}>
                              {selectedRow.sql_query}
                            </pre>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                ) : null}
              </>
            ) : null}
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

function FieldLabel({ text }) {
  return <div style={styles.label}>{text}</div>;
}

function InfoBox({ text }) {
  return <div style={styles.infoBox}>{text}</div>;
}

function SuccessBox({ text }) {
  return <div style={styles.successBox}>{text}</div>;
}

function ErrorBox({ text }) {
  return <div style={styles.errorBox}>{text}</div>;
}

function WarningBox({ text }) {
  return <div style={styles.warningBox}>{text}</div>;
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

  label: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 8,
  },

  input: {
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

  textarea: {
    width: "100%",
    padding: "1rem",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },

  badge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.05em",
  },

  formGridTop: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1.3fr 1fr",
    gap: 16,
  },

  formGridBottom: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1.1fr 1.1fr 1fr",
    gap: 16,
    marginTop: 16,
  },

  buttonRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 18,
  },

  primaryButton: {
    border: "none",
    borderRadius: 14,
    padding: "0.85rem 1.1rem",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "0.85rem 1.1rem",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },

  dangerButton: {
    border: "1px solid #fecdd3",
    borderRadius: 14,
    padding: "0.85rem 1.1rem",
    background: "#fff1f2",
    color: "#9f1239",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },

  previewTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#475569",
    marginBottom: 8,
  },

  sqlPreview: {
    margin: 0,
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#0f172a",
    color: "#e2e8f0",
    fontSize: 13,
    lineHeight: 1.5,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
  },

  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "2.2fr 2.2fr 1.2fr",
    gap: 12,
  },

  separator: {
    borderTop: "1px solid #e2e8f0",
    margin: "18px 0 14px",
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns: "2.5fr 1.1fr 1.1fr",
    gap: 12,
    alignItems: "center",
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

  infoBox: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "1rem 1.1rem",
    color: "#334155",
  },

  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 14,
    padding: "1rem 1.1rem",
    color: "#166534",
    fontWeight: 800,
  },

  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: 14,
    padding: "1rem 1.1rem",
    color: "#9f1239",
    fontWeight: 800,
  },

  warningBox: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 14,
    padding: "1rem 1.1rem",
    color: "#92400e",
    fontWeight: 800,
  },

  emptyState: {
    textAlign: "center",
    padding: "2.5rem",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    color: "#94a3b8",
    fontSize: 14,
  },
};