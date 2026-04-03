import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";
const DEFAULT_CATEGORY_OPTIONS = [
  "PERFORMANCE",
  "STOCKAGE",
  "BLOCAGE",
  "SECURITE",
  "OPTIMISATION",
];

export default function AnalyseurSQL() {
  const [targetDbs, setTargetDbs] = useState([]);
  const [sqlScripts, setSqlScripts] = useState([]);

  const [selectedDbId, setSelectedDbId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Toutes");
  const [selectedScriptId, setSelectedScriptId] = useState("");

  const [sqlEditor, setSqlEditor] = useState("");

  const [explainResult, setExplainResult] = useState(null);
  const [executeResult, setExecuteResult] = useState(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const [form, setForm] = useState({
    script_name: "",
    category: DEFAULT_CATEGORY_OPTIONS[0],
    description: "",
    sql_content: "",
    is_active: true,
  });

  const [libSearch, setLibSearch] = useState("");
  const [libCategory, setLibCategory] = useState("Toutes");

  async function apiGet(endpoint, defaultValue = null) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`);
      if (!res.ok) throw new Error("GET error");
      const data = await res.json();
      return data ?? defaultValue;
    } catch (e) {
      console.error(e);
      return defaultValue;
    }
  }

  async function apiPost(endpoint, payload) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("POST error");
    return res.json();
  }

  async function apiPut(endpoint, payload) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("PUT error");
    return res.json();
  }

  async function apiDelete(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("DELETE error");
    return true;
  }

  async function loadData() {
    try {
      setLoading(true);
      const [dbs, scripts] = await Promise.all([
        apiGet("/target-dbs/", []),
        apiGet("/sql-scripts/", []),
      ]);

      const dbList = Array.isArray(dbs) ? dbs : [];
      const scriptList = Array.isArray(scripts) ? scripts : [];

      setTargetDbs(dbList);
      setSqlScripts(scriptList);

      if (dbList.length > 0 && !selectedDbId) {
        setSelectedDbId(String(dbList[0].db_id));
      }
    } catch {
      setMessage({ type: "error", text: "Erreur lors du chargement des données." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const categories = useMemo(() => {
    const fromDb = sqlScripts
      .map((s) => String(s.category || "").toUpperCase())
      .filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORY_OPTIONS, ...fromDb])).sort();
  }, [sqlScripts]);

  const scriptsFiltered = useMemo(() => {
    if (selectedCategory === "Toutes") return sqlScripts;
    return sqlScripts.filter(
      (s) => String(s.category || "").toUpperCase() === selectedCategory
    );
  }, [sqlScripts, selectedCategory]);

  const selectedDb = useMemo(() => {
    return targetDbs.find((d) => String(d.db_id) === String(selectedDbId)) || null;
  }, [targetDbs, selectedDbId]);

  const selectedScript = useMemo(() => {
    return scriptsFiltered.find((s) => String(s.script_id) === String(selectedScriptId)) || null;
  }, [scriptsFiltered, selectedScriptId]);

  useEffect(() => {
    if (!scriptsFiltered.length) {
      setSelectedScriptId("");
      return;
    }

    const exists = scriptsFiltered.some(
      (s) => String(s.script_id) === String(selectedScriptId)
    );

    if (!selectedScriptId || !exists) {
      setSelectedScriptId(String(scriptsFiltered[0].script_id));
    }
  }, [scriptsFiltered, selectedScriptId]);

  useEffect(() => {
    if (selectedScript) {
      setSqlEditor(selectedScript.sql_content || "");
    }
  }, [selectedScriptId]);

  function normalizeCategory(value) {
    const v = String(value || "").trim().toUpperCase();
    return DEFAULT_CATEGORY_OPTIONS.includes(v) ? v : DEFAULT_CATEGORY_OPTIONS[0];
  }

  function costBadge(level) {
    const cfg = {
      LOW: { bg: "#f0fdf4", border: "#86efac", color: "#166534", label: "✅ Faible" },
      MEDIUM: { bg: "#fffbeb", border: "#fcd34d", color: "#92400e", label: "⚠️ Moyen" },
      HIGH: { bg: "#fff7ed", border: "#fb923c", color: "#9a3412", label: "🔶 Élevé" },
      CRITICAL: { bg: "#fff1f2", border: "#fb7185", color: "#9f1239", label: "🔴 Critique" },
      UNKNOWN: { bg: "#f8fafc", border: "#cbd5e1", color: "#475569", label: "❓ Inconnu" },
    };
    const c = cfg[String(level || "").toUpperCase()] || cfg.UNKNOWN;
    return (
      <span
        style={{
          background: c.bg,
          border: `1px solid ${c.border}`,
          color: c.color,
          padding: "0.28rem 0.8rem",
          borderRadius: 9999,
          fontSize: "0.76rem",
          fontWeight: 700,
        }}
      >
        {c.label}
      </span>
    );
  }

  function categoryBadge(cat) {
    const cfg = {
      PERFORMANCE: ["#eff6ff", "#93c5fd", "#1d4ed8"],
      BLOCAGE: ["#fff1f2", "#fda4af", "#9f1239"],
      STOCKAGE: ["#f0fdf4", "#6ee7b7", "#065f46"],
      SECURITE: ["#fdf4ff", "#d8b4fe", "#7e22ce"],
      OPTIMISATION: ["#fffbeb", "#fcd34d", "#92400e"],
    };
    const [bg, border, color] =
      cfg[String(cat || "").toUpperCase()] || ["#f8fafc", "#cbd5e1", "#475569"];

    return (
      <span
        style={{
          background: bg,
          border: `1px solid ${border}`,
          color,
          padding: "0.18rem 0.65rem",
          borderRadius: 9999,
          fontSize: "0.70rem",
          fontWeight: 700,
        }}
      >
        {cat || "—"}
      </span>
    );
  }

  function startNewForm() {
    setShowForm(true);
    setEditMode(false);
    setForm({
      script_name: "",
      category: DEFAULT_CATEGORY_OPTIONS[0],
      description: "",
      sql_content: "",
      is_active: true,
    });
  }

  function loadScriptIntoForm(script) {
    setShowForm(true);
    setEditMode(true);
    setSelectedScriptId(String(script.script_id));
    setForm({
      script_name: script.script_name || "",
      category: script.category || DEFAULT_CATEGORY_OPTIONS[0],
      description: script.description || "",
      sql_content: script.sql_content || "",
      is_active: Number(script.is_active ?? 1) === 1,
    });
  }

  function cancelForm() {
    setShowForm(false);
    setEditMode(false);
    setForm({
      script_name: "",
      category: DEFAULT_CATEGORY_OPTIONS[0],
      description: "",
      sql_content: "",
      is_active: true,
    });
  }

  async function handleSaveScript() {
    setMessage({ type: "", text: "" });

    const payload = {
      script_name: form.script_name.trim(),
      description: form.description.trim() || null,
      category: normalizeCategory(form.category),
      sql_content: form.sql_content.trim(),
      is_active: form.is_active ? 1 : 0,
    };

    if (!payload.script_name) {
      setMessage({ type: "error", text: "Le nom du script est obligatoire." });
      return;
    }

    if (!payload.sql_content) {
      setMessage({ type: "error", text: "Le contenu SQL est obligatoire." });
      return;
    }

    try {
      if (editMode && selectedScriptId) {
        await apiPut(`/sql-scripts/${selectedScriptId}`, payload);
        setMessage({ type: "success", text: "Script modifié avec succès." });
      } else {
        await apiPost("/sql-scripts/", {
          ...payload,
          db_type: "ORACLE",
        });
        setMessage({ type: "success", text: "Script ajouté avec succès." });
      }

      setShowForm(false);
      setEditMode(false);
      await loadData();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de l'enregistrement du script." });
    }
  }

  async function handleDeleteScript() {
    if (!deleteTargetId) return;

    try {
      await apiDelete(`/sql-scripts/${deleteTargetId}`);
      setDeleteTargetId(null);
      setSelectedScriptId("");
      setShowForm(false);
      setEditMode(false);
      setMessage({ type: "success", text: "Script supprimé avec succès." });
      await loadData();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression." });
    }
  }

  async function handleExplain() {
    if (!selectedDb || !sqlEditor.trim()) {
      setMessage({ type: "warning", text: "Sélectionnez une base et un SQL valide." });
      return;
    }

    try {
      setMessage({ type: "", text: "" });
      setExecuteResult(null);

      const result = await apiPost("/sql-analyzer/explain", {
        db_id: selectedDb.db_id,
        sql_content: sqlEditor.trim(),
      });

      if (result && result.success) {
        setExplainResult(result);
      } else {
        setMessage({
          type: "error",
          text: `Erreur plan : ${result?.detail || "Pas de réponse"}`,
        });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur lors de l'analyse du plan." });
    }
  }

  async function handleExecute() {
    if (!selectedDb || !sqlEditor.trim()) {
      setMessage({ type: "warning", text: "Sélectionnez une base et un SQL valide." });
      return;
    }

    try {
      if (!explainResult) {
        setMessage({
          type: "warning",
          text: "⚠️ Recommandé : analysez le plan avant d'exécuter.",
        });
      }

      const result = await apiPost("/sql-analyzer/execute", {
        db_id: selectedDb.db_id,
        sql_content: sqlEditor.trim(),
        max_rows: 200,
      });

      if (result) {
        setExecuteResult(result);
      } else {
        setMessage({ type: "error", text: "Erreur lors de l'exécution." });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur lors de l'exécution." });
    }
  }

  function resetEditor() {
    setExplainResult(null);
    setExecuteResult(null);
    if (selectedScript) {
      setSqlEditor(selectedScript.sql_content || "");
    } else {
      setSqlEditor("");
    }
  }

  const libraryScripts = useMemo(() => {
    let list = [...sqlScripts];

    if (libSearch.trim()) {
      const q = libSearch.trim().toLowerCase();
      list = list.filter(
        (s) =>
          String(s.script_name || "").toLowerCase().includes(q) ||
          String(s.description || "").toLowerCase().includes(q) ||
          String(s.sql_content || "").toLowerCase().includes(q)
      );
    }

    if (libCategory !== "Toutes") {
      list = list.filter(
        (s) => String(s.category || "").toUpperCase() === libCategory
      );
    }

    return list;
  }, [sqlScripts, libSearch, libCategory]);

  if (loading) {
    return <div style={styles.page}>Chargement...</div>;
  }

  if (!targetDbs.length) {
    return (
      <div style={styles.page}>
        <EmptyState
          icon="🗄️"
          title="Aucune base configurée"
          subtitle="Ajoutez une base dans Config BD d'abord."
        />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Analyseur SQL Intelligent"
        subtitle="Sélectionnez une base et un script — analysez le plan d'exécution avant de lancer"
      />

      {message.text ? (
        <div style={{ marginBottom: 16 }}>
          {message.type === "success" && <SuccessBox text={message.text} />}
          {message.type === "error" && <ErrorBox text={message.text} />}
          {message.type === "warning" && <WarningBox text={message.text} />}
        </div>
      ) : null}

      <SectionCard>
        <SectionTitle text="⚙️ SÉLECTION BASE & SCRIPT" />

        <div style={styles.topGrid}>
          <select
            style={styles.select}
            value={selectedDbId}
            onChange={(e) => setSelectedDbId(e.target.value)}
          >
            {targetDbs.map((d) => (
              <option key={d.db_id} value={String(d.db_id)}>
                {`${d.db_name} · ${d.host}`}
              </option>
            ))}
          </select>

          <select
            style={styles.select}
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedScriptId("");
            }}
          >
            <option>Toutes</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          {scriptsFiltered.length ? (
            <select
              style={styles.select}
              value={selectedScriptId}
              onChange={(e) => setSelectedScriptId(e.target.value)}
            >
              {scriptsFiltered.map((s) => (
                <option key={s.script_id} value={String(s.script_id)}>
                  {s.script_name}
                </option>
              ))}
            </select>
          ) : (
            <select style={styles.select} disabled>
              <option>Aucun script disponible</option>
            </select>
          )}

          <button style={styles.primaryButton} onClick={startNewForm}>
            ➕ Nouveau
          </button>
        </div>
      </SectionCard>

      {showForm && (
        <>
          <div style={{ height: 16 }} />
          <SectionCard>
            <SectionTitle
              text={editMode ? "✏️ MODIFIER LE SCRIPT SQL" : "➕ AJOUTER UN SCRIPT SQL"}
            />

            <div style={styles.formGrid2}>
              <div>
                <FieldLabel text="Nom du script" />
                <input
                  style={styles.input}
                  value={form.script_name}
                  placeholder="Ex: Sessions actives Oracle"
                  onChange={(e) =>
                    setForm((p) => ({ ...p, script_name: e.target.value }))
                  }
                />
              </div>

              <div style={styles.checkboxWrap}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, is_active: e.target.checked }))
                    }
                  />
                  Script actif
                </label>
              </div>
            </div>

            <div style={styles.formGrid2b}>
              <div>
                <FieldLabel text="Catégorie" />
                <select
                  style={styles.select}
                  value={form.category}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, category: e.target.value }))
                  }
                >
                  {DEFAULT_CATEGORY_OPTIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel text="Description" />
                <input
                  style={styles.input}
                  value={form.description}
                  placeholder="Description fonctionnelle du script"
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <FieldLabel text="Contenu SQL" />
              <textarea
                style={styles.textarea}
                rows={8}
                value={form.sql_content}
                placeholder="SELECT COUNT(*) FROM v$session ..."
                onChange={(e) =>
                  setForm((p) => ({ ...p, sql_content: e.target.value }))
                }
              />
            </div>

            <div style={styles.buttonRow}>
              <button style={styles.primaryButton} onClick={handleSaveScript}>
                {editMode ? "💾 Enregistrer les modifications" : "💾 Enregistrer"}
              </button>
              <button style={styles.secondaryButton} onClick={cancelForm}>
                ❌ Annuler
              </button>
            </div>
          </SectionCard>
        </>
      )}

      <div style={{ height: 16 }} />

      {selectedScript ? (
        <SectionCard>
          <SectionTitle text="📜 DÉTAIL DU SCRIPT" />

          <div style={styles.detailGrid}>
            <div>
              <div style={styles.scriptTitle}>{selectedScript.script_name}</div>
              <div style={styles.scriptDesc}>{selectedScript.description || "—"}</div>
              <div style={styles.scriptMeta}>
                {categoryBadge(selectedScript.category)}
                <span style={styles.monoTag}>#{selectedScript.script_id}</span>
              </div>
            </div>

            <div style={styles.targetCard}>
              <div style={styles.targetLabel}>BASE CIBLE</div>
              <div style={styles.targetName}>{selectedDb?.db_name}</div>
              <div style={styles.targetHost}>
                {selectedDb?.host}:{selectedDb?.port}
              </div>
              <div style={styles.targetService}>{selectedDb?.service_name}</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <FieldLabel text="SQL (modifiable avant exécution)" />
            <textarea
              style={styles.textarea}
              rows={8}
              value={sqlEditor}
              onChange={(e) => setSqlEditor(e.target.value)}
            />
          </div>

          <div style={styles.actionRow5}>
            <button style={styles.primaryButton} onClick={handleExplain}>
              🔍 Analyser le plan
            </button>
            <button style={styles.secondaryButton} onClick={handleExecute}>
              ▶ Lancer l'exécution
            </button>
            <button style={styles.secondaryButton} onClick={resetEditor}>
              🔄 Réinitialiser
            </button>
            <button
              style={styles.secondaryButton}
              onClick={() => loadScriptIntoForm(selectedScript)}
            >
              ✏️ Modifier
            </button>
            <button
              style={styles.dangerButton}
              onClick={() => setDeleteTargetId(selectedScript.script_id)}
            >
              🗑️ Supprimer
            </button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard>
          <EmptyState
            icon="📄"
            title="Aucun script disponible"
            subtitle="Aucun script disponible pour cette catégorie."
          />
        </SectionCard>
      )}

      {deleteTargetId !== null && (
        <>
          <div style={{ height: 16 }} />
          <SectionCard>
            <SectionTitle text="🗑️ CONFIRMATION DE SUPPRESSION" />
            <div style={styles.deleteConfirm}>
              ⚠️ Vous êtes sur le point de supprimer le script :{" "}
              <strong>
                {sqlScripts.find((s) => s.script_id === deleteTargetId)?.script_name || ""}
              </strong>{" "}
              <span style={styles.monoTag}>
                (ID #{deleteTargetId})
              </span>
            </div>

            <div style={styles.buttonRow}>
              <button style={styles.dangerButton} onClick={handleDeleteScript}>
                ✅ Oui, supprimer
              </button>
              <button
                style={styles.secondaryButton}
                onClick={() => setDeleteTargetId(null)}
              >
                ❌ Annuler suppression
              </button>
            </div>
          </SectionCard>
        </>
      )}

      {explainResult && (
        <>
          <div style={{ height: 16 }} />
          <SectionCard>
            <SectionTitle text="📊 PLAN D'EXÉCUTION" />

            <div style={styles.kpiGrid3}>
              <StatCard label="COÛT TOTAL" value={String(explainResult.total_cost ?? 0)} />
              <div style={styles.statCard}>
                <div style={styles.statLabel}>NIVEAU DE COÛT</div>
                <div style={{ marginTop: 8 }}>
                  {costBadge(explainResult.cost_level || "")}
                </div>
              </div>
              <StatCard
                label="ÉTAPES DU PLAN"
                value={String((explainResult.plan_rows || []).length)}
              />
            </div>

            <div style={{ height: 16 }} />

            {(explainResult.plan_rows || []).length ? (
              <DataTable
                columns={[
                  "plan_step",
                  "cost",
                  "cardinality",
                  "bytes",
                  "cpu_cost",
                  "io_cost",
                  "access_predicates",
                  "filter_predicates",
                ].filter((c) => explainResult.plan_rows?.[0]?.[c] !== undefined)}
                rows={(explainResult.plan_rows || []).map((r) => ({
                  ...r,
                }))}
              />
            ) : (
              <InfoBox text="Aucun détail de plan disponible." />
            )}

            <div style={{ height: 16 }} />

            <div style={styles.aiPanel}>
              <div style={styles.aiHeader}>
                <span style={{ fontSize: 20 }}>🤖</span>
                <span style={styles.aiTitle}>ANALYSE IA — DIAGNOSTIC AUTOMATIQUE</span>
                <span style={styles.aiBadge}>Bientôt</span>
              </div>
              <div style={styles.aiBody}>
                L'IA analysera le plan et vous donnera :
                <ul style={styles.aiList}>
                  <li>Évaluation du coût et des risques</li>
                  <li>Détection de Full Table Scan, index manquants</li>
                  <li>Recommandations d'optimisation</li>
                  <li>Décision suggérée : Lancer / Optimiser / Ne pas lancer</li>
                </ul>
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {executeResult && (
        <>
          <div style={{ height: 16 }} />
          <SectionCard>
            <SectionTitle text="📋 RÉSULTATS DE L'EXÉCUTION" />

            {executeResult.success ? (
              <>
                <div style={styles.successBanner}>
                  ✅ Exécution réussie · {executeResult.row_count || 0} ligne(s) retournée(s) · ⏱{" "}
                  {executeResult.duration_ms || 0} ms
                </div>

                {(executeResult.rows || []).length ? (
                  <DataTable
                    columns={executeResult.columns || []}
                    rows={(executeResult.rows || []).map((row) => {
                      if (Array.isArray(row)) {
                        const obj = {};
                        (executeResult.columns || []).forEach((c, i) => {
                          obj[c] = row[i];
                        });
                        return obj;
                      }
                      return row;
                    })}
                  />
                ) : (
                  <InfoBox text="La requête n'a retourné aucune ligne." />
                )}
              </>
            ) : (
              <>
                <div style={styles.errorBanner}>❌ Exécution échouée</div>
                <pre style={styles.codeBlock}>
                  {String(executeResult.detail || JSON.stringify(executeResult, null, 2))}
                </pre>
              </>
            )}
          </SectionCard>
        </>
      )}

      <div style={{ height: 16 }} />

      <SectionCard>
        <SectionTitle text="📚 BIBLIOTHÈQUE DES SCRIPTS" />

        <div style={styles.libraryFilters}>
          <input
            style={styles.input}
            value={libSearch}
            placeholder="🔎 Rechercher un script par nom, description ou contenu…"
            onChange={(e) => setLibSearch(e.target.value)}
          />
          <select
            style={styles.select}
            value={libCategory}
            onChange={(e) => setLibCategory(e.target.value)}
          >
            <option>Toutes</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        {!libraryScripts.length ? (
          <EmptyState
            icon="📚"
            title="Aucun script trouvé"
            subtitle="Aucun script trouvé pour ces critères."
          />
        ) : (
          <div style={styles.libraryList}>
            <div style={styles.libraryHeader}>
              <div>ID</div>
              <div>NOM</div>
              <div>CATÉGORIE</div>
              <div>DESCRIPTION</div>
            </div>

            {libraryScripts.map((s) => {
              const isActive = Number(s.is_active ?? 1) === 1;
              return (
                <div key={s.script_id} style={styles.libraryRow}>
                  <div style={styles.libraryId}>#{s.script_id}</div>

                  <div>
                    <div style={styles.libraryName}>{s.script_name}</div>
                    <div style={styles.smallMuted}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: isActive ? "#10b981" : "#94a3b8",
                          marginRight: 5,
                          verticalAlign: "middle",
                        }}
                      />
                      {isActive ? "Actif" : "Inactif"}
                    </div>
                  </div>

                  <div>{categoryBadge(s.category)}</div>

                  <div style={styles.libraryDesc}>
                    {String(s.description || "").slice(0, 100)}
                    {String(s.description || "").length > 100 ? "…" : ""}
                  </div>
                </div>
              );
            })}
          </div>
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

function SectionTitle({ text }) {
  return <div style={styles.sectionTitle}>{text}</div>;
}

function SectionCard({ children }) {
  return <div style={styles.card}>{children}</div>;
}

function FieldLabel({ text }) {
  return <div style={styles.label}>{text}</div>;
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>{icon}</div>
      <div style={styles.emptyTitle}>{title}</div>
      <div style={styles.emptySub}>{subtitle}</div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
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

function InfoBox({ text }) {
  return <div style={styles.infoBox}>{text}</div>;
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
    background: "#f6f8fc",
    minHeight: "100vh",
    color: "#0d1b2a",
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: 900,
    color: "#0d1b2a",
    marginBottom: 6,
    letterSpacing: "-0.02em",
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#526077",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e4e9f2",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 2px 8px rgba(13,27,42,0.08)",
  },
  sectionTitle: {
    fontSize: "0.67rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#8fa0bb",
    paddingBottom: 10,
    borderBottom: "1px solid #e4e9f2",
    marginBottom: 14,
  },
  label: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "#526077",
    marginBottom: 6,
  },
  topGrid: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr 2.5fr 1.1fr",
    gap: 12,
    alignItems: "center",
  },
  formGrid2: {
    display: "grid",
    gridTemplateColumns: "2.2fr 1.2fr",
    gap: 16,
    alignItems: "end",
  },
  formGrid2b: {
    display: "grid",
    gridTemplateColumns: "1.1fr 2.6fr",
    gap: 16,
    marginTop: 14,
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 16,
    alignItems: "start",
  },
  libraryFilters: {
    display: "grid",
    gridTemplateColumns: "3fr 1fr",
    gap: 12,
    marginBottom: 16,
  },
  input: {
    width: "100%",
    padding: "0.75rem 0.9rem",
    borderRadius: 12,
    border: "1.5px solid #e4e9f2",
    background: "#fff",
    fontSize: 14,
    boxSizing: "border-box",
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
  textarea: {
    width: "100%",
    padding: "0.9rem",
    borderRadius: 12,
    border: "1.5px solid #e4e9f2",
    background: "#fff",
    fontSize: 13,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    lineHeight: 1.65,
    boxSizing: "border-box",
    resize: "vertical",
  },
  checkboxWrap: {
    display: "flex",
    alignItems: "center",
    minHeight: 48,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: "#334155",
  },
  primaryButton: {
    border: "1.5px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    borderRadius: 12,
    padding: "0.75rem 1rem",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1.5px solid #e4e9f2",
    background: "#fff",
    color: "#0d1b2a",
    borderRadius: 12,
    padding: "0.75rem 1rem",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  dangerButton: {
    border: "1.5px solid #fecdd3",
    background: "#fff1f2",
    color: "#9f1239",
    borderRadius: 12,
    padding: "0.75rem 1rem",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    marginTop: 16,
    flexWrap: "wrap",
  },
  actionRow5: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1.4fr 1.2fr 1.1fr 1fr",
    gap: 12,
    marginTop: 16,
  },
  scriptTitle: {
    fontSize: "1.05rem",
    fontWeight: 700,
    color: "#0d1b2a",
    marginBottom: 6,
  },
  scriptDesc: {
    fontSize: "0.85rem",
    color: "#526077",
    marginBottom: 10,
    lineHeight: 1.5,
  },
  scriptMeta: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  monoTag: {
    fontSize: "0.72rem",
    color: "#8fa0bb",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  targetCard: {
    background: "linear-gradient(135deg, #f6f9ff 0%, #eef3fd 100%)",
    border: "1px solid #d5e3f8",
    borderRadius: 12,
    padding: "0.85rem 1.1rem",
  },
  targetLabel: {
    fontSize: "0.62rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#7ba3d8",
    marginBottom: 6,
  },
  targetName: {
    fontWeight: 700,
    color: "#0d1b2a",
    fontSize: "0.95rem",
    marginBottom: 4,
  },
  targetHost: {
    fontSize: "0.78rem",
    color: "#526077",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  targetService: {
    fontSize: "0.72rem",
    color: "#8fa0bb",
    marginTop: 4,
  },
  deleteConfirm: {
    background: "#fff8f8",
    border: "1.5px dashed #fecdd3",
    borderRadius: 12,
    padding: "1rem 1.25rem",
    color: "#9f1239",
  },
  kpiGrid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
  },
  statCard: {
    background: "#ffffff",
    border: "1px solid #e4e9f2",
    borderRadius: 12,
    padding: "1rem 1.15rem",
    boxShadow: "0 1px 3px rgba(13,27,42,0.06)",
  },
  statLabel: {
    fontSize: "0.62rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#8fa0bb",
    marginBottom: 8,
  },
  statValue: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#0d1b2a",
    lineHeight: 1,
  },
  aiPanel: {
    background: "linear-gradient(135deg, #f0f7ff 0%, #e8f2ff 100%)",
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: "1.1rem 1.3rem",
  },
  aiHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  aiTitle: {
    fontSize: "0.7rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#1e4ea6",
  },
  aiBadge: {
    marginLeft: "auto",
    background: "#dbeafe",
    color: "#1e40af",
    border: "1px solid #bfdbfe",
    padding: "0.1rem 0.55rem",
    borderRadius: 9999,
    fontSize: "0.65rem",
    fontWeight: 700,
  },
  aiBody: {
    fontSize: "0.845rem",
    color: "#1e3a6e",
    lineHeight: 1.7,
  },
  aiList: {
    margin: "0.3rem 0 0 1rem",
    padding: 0,
  },
  successBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    padding: "0.8rem 1rem",
    marginBottom: 14,
    fontSize: "0.86rem",
    fontWeight: 600,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    padding: "0.8rem 1rem",
    marginBottom: 14,
    fontSize: "0.86rem",
    fontWeight: 600,
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
  },
  codeBlock: {
    borderRadius: 12,
    padding: 14,
    background: "#0f172a",
    color: "#e2e8f0",
    fontSize: 13,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
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
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "#8fa0bb",
    padding: "0.65rem 0.9rem",
    borderBottom: "1px solid #e4e9f2",
    textAlign: "left",
  },
  td: {
    fontSize: "0.80rem",
    color: "#0d1b2a",
    padding: "0.55rem 0.9rem",
    borderBottom: "1px solid #f1f5fb",
    textAlign: "left",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  rowEven: {
    background: "#ffffff",
  },
  rowOdd: {
    background: "#fbfdff",
  },
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: "1rem 1.1rem",
    color: "#166534",
    fontWeight: 800,
  },
  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: 12,
    padding: "1rem 1.1rem",
    color: "#9f1239",
    fontWeight: 800,
  },
  warningBox: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 12,
    padding: "1rem 1.1rem",
    color: "#92400e",
    fontWeight: 800,
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
    padding: "3.5rem 2rem",
    background: "#f8fafc",
    border: "1.5px dashed #e4e9f2",
    borderRadius: 16,
    color: "#8fa0bb",
  },
  emptyIcon: {
    fontSize: "2.5rem",
    marginBottom: "0.75rem",
  },
  emptyTitle: {
    fontWeight: 700,
    fontSize: "1.05rem",
    color: "#334155",
    marginBottom: "0.35rem",
  },
  emptySub: {
    fontSize: "0.875rem",
  },
  libraryList: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  libraryHeader: {
    display: "grid",
    gridTemplateColumns: "0.5fr 2.2fr 1.3fr 3fr",
    gap: 12,
    fontSize: "0.65rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#8fa0bb",
    paddingBottom: 10,
    borderBottom: "1px solid #e4e9f2",
  },
  libraryRow: {
    display: "grid",
    gridTemplateColumns: "0.5fr 2.2fr 1.3fr 3fr",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid #f1f5f9",
    alignItems: "start",
  },
  libraryId: {
    fontSize: "0.8rem",
    color: "#8fa0bb",
    fontWeight: 600,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  libraryName: {
    fontSize: "0.875rem",
    fontWeight: 700,
    color: "#0d1b2a",
  },
  smallMuted: {
    color: "#8fa0bb",
    fontSize: "0.75rem",
    fontWeight: 500,
    marginTop: 2,
  },
  libraryDesc: {
    fontSize: "0.82rem",
    color: "#526077",
    lineHeight: 1.45,
  },
};