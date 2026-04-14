import { useEffect, useMemo, useRef, useState } from "react";

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

  const [libSearch, setLibSearch] = useState("");
  const [libCategory, setLibCategory] = useState("Toutes");

  const [zipFile, setZipFile] = useState(null);
  const [importingZip, setImportingZip] = useState(false);
  const fileInputRef = useRef(null);

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

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.detail || data?.message || "POST error");
    }

    return data;
  }

  function inferCategory(metric) {
    const text = `${metric.metric_code || ""} ${metric.sql_query || ""}`.toUpperCase();

    if (
      text.includes("LOCK") ||
      text.includes("WAIT") ||
      text.includes("BLOCK") ||
      text.includes("DEADLOCK")
    ) {
      return "BLOCAGE";
    }

    if (
      text.includes("TABLESPACE") ||
      text.includes("STORAGE") ||
      text.includes("ARCHIVE") ||
      text.includes("DATAFILE") ||
      text.includes("DISK")
    ) {
      return "STOCKAGE";
    }

    if (
      text.includes("USER") ||
      text.includes("ROLE") ||
      text.includes("GRANT") ||
      text.includes("PRIV") ||
      text.includes("AUDIT") ||
      text.includes("SECUR")
    ) {
      return "SECURITE";
    }

    if (
      text.includes("INDEX") ||
      text.includes("PLAN") ||
      text.includes("OPTIM") ||
      text.includes("HINT")
    ) {
      return "OPTIMISATION";
    }

    return "PERFORMANCE";
  }

  function mapMetricToUiScript(metric, currentDbId) {
    const category = inferCategory(metric);

    const descriptionParts = [
      metric.unit ? `Unité: ${metric.unit}` : null,
      metric.frequency_sec ? `Fréquence: ${metric.frequency_sec}s` : null,
      metric.warn_threshold !== null && metric.warn_threshold !== undefined
        ? `Seuil warning: ${metric.warn_threshold}`
        : null,
      metric.crit_threshold !== null && metric.crit_threshold !== undefined
        ? `Seuil critique: ${metric.crit_threshold}`
        : null,
    ].filter(Boolean);

    return {
      script_id: String(metric.metric_id),
      script_name: metric.metric_code || `METRIC_${metric.metric_id}`,
      description: descriptionParts.join(" • ") || "Métrique collectée",
      category,
      db_type: null,
      sql_content: metric.sql_query || "",
      is_active: Number(metric.is_active ?? 1),
      metric_id: metric.metric_id,
      metric_code: metric.metric_code,
      unit: metric.unit,
      frequency_sec: metric.frequency_sec,
      warn_threshold: metric.warn_threshold,
      crit_threshold: metric.crit_threshold,
      db_id: metric.db_id ?? currentDbId ?? null,
      value_id: metric.value_id ?? null,
      value_number: metric.value_number,
      value_text: metric.value_text,
      severity: metric.severity || null,
      collected_at: metric.collected_at || null,
      created_at: metric.created_at || null,
    };
  }

  async function reloadMetricsForSelectedDb() {
    if (!selectedDbId) {
      setSqlScripts([]);
      return;
    }

    const params = new URLSearchParams();
    params.append("db_id", selectedDbId);
    params.append("is_active", "1");

    const metrics = await apiGet(`/sql-analyzer/metrics?${params.toString()}`, []);
    const mapped = Array.isArray(metrics)
      ? metrics.map((m) => mapMetricToUiScript(m, selectedDbId))
      : [];

    setSqlScripts(mapped);
  }

  async function loadData() {
    try {
      setLoading(true);

      const dbs = await apiGet("/target-dbs/", []);
      const dbList = Array.isArray(dbs) ? dbs : [];

      setTargetDbs(dbList);
      setSqlScripts([]);

      if (dbList.length > 0) {
        setSelectedDbId((prev) => (prev ? prev : String(dbList[0].db_id)));
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

  const selectedDb = useMemo(() => {
    return targetDbs.find((d) => String(d.db_id) === String(selectedDbId)) || null;
  }, [targetDbs, selectedDbId]);

  const selectedDbType = useMemo(() => {
    if (!selectedDb) return "";

    const normalize = (value) =>
      String(value || "")
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/[^A-Z0-9]/g, "");

    const candidates = [
      selectedDb.db_type_name,
      selectedDb.db_type,
      selectedDb.name,
      selectedDb.db_name,
      selectedDb.service_name,
      selectedDb.sid,
    ].map(normalize);

    const joined = candidates.join(" ");

    if (joined.includes("MYSQL")) return "MYSQL";
    if (joined.includes("ORACLE") || joined.includes("ORCL")) return "ORACLE";

    return "";
  }, [selectedDb]);

  useEffect(() => {
    if (!selectedDbId) {
      setSqlScripts([]);
      return;
    }

    async function loadMetricsByDb() {
      try {
        setLoading(true);
        await reloadMetricsForSelectedDb();
      } catch (e) {
        console.error(e);
        setSqlScripts([]);
        setMessage({
          type: "error",
          text: "Erreur lors du chargement des métriques SQL.",
        });
      } finally {
        setLoading(false);
      }
    }

    loadMetricsByDb();
  }, [selectedDbId]);

  const categories = useMemo(() => {
    const fromDb = sqlScripts
      .map((s) => String(s.category || "").toUpperCase())
      .filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORY_OPTIONS, ...fromDb])).sort();
  }, [sqlScripts]);

  const scriptsFiltered = useMemo(() => {
    let list = [...sqlScripts];

    if (selectedCategory !== "Toutes") {
      list = list.filter(
        (s) => String(s.category || "").toUpperCase() === selectedCategory
      );
    }

    return list;
  }, [sqlScripts, selectedCategory]);

  const selectedScript = useMemo(() => {
    return (
      scriptsFiltered.find((s) => String(s.script_id) === String(selectedScriptId)) || null
    );
  }, [scriptsFiltered, selectedScriptId]);

  useEffect(() => {
    setSelectedScriptId("");
    setSqlEditor("");
    setExplainResult(null);
    setExecuteResult(null);
    setZipFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [selectedDbId]);

  useEffect(() => {
    if (!scriptsFiltered.length) {
      setSelectedScriptId("");
      setSqlEditor("");
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
    } else {
      setSqlEditor("");
    }
  }, [selectedScript]);

  function formatMetricValue(script) {
    if (script?.value_number !== null && script?.value_number !== undefined) {
      return `${script.value_number}${script.unit ? ` ${script.unit}` : ""}`;
    }
    if (script?.value_text) return script.value_text;
    return "—";
  }

  function formatFileSize(bytes) {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} octets`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  }

  function removeSelectedZip() {
    setZipFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function severityBadge(severity) {
    const cfg = {
      OK: { bg: "#f0fdf4", border: "#86efac", color: "#166534", label: "OK" },
      INFO: { bg: "#eff6ff", border: "#93c5fd", color: "#1d4ed8", label: "INFO" },
      WARNING: { bg: "#fffbeb", border: "#fcd34d", color: "#92400e", label: "WARNING" },
      CRITICAL: { bg: "#fff1f2", border: "#fb7185", color: "#9f1239", label: "CRITICAL" },
      UNKNOWN: { bg: "#f8fafc", border: "#cbd5e1", color: "#475569", label: "—" },
    };

    const c = cfg[String(severity || "").toUpperCase()] || cfg.UNKNOWN;

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

  async function handleImportZip() {
    if (!selectedDbId) {
      setMessage({
        type: "warning",
        text: "Sélectionnez d'abord une base valide.",
      });
      return;
    }

    if (!zipFile) {
      setMessage({
        type: "warning",
        text: "Veuillez sélectionner un fichier ZIP.",
      });
      return;
    }

    try {
      setImportingZip(true);
      setMessage({ type: "", text: "" });

      const formData = new FormData();
      formData.append("db_id", selectedDbId);
      formData.append("file", zipFile);
      formData.append("frequency_sec", "60");
      formData.append("unit", "count");
      formData.append("is_active", "1");

      const res = await fetch(`${API_BASE}/sql-analyzer/import-zip`, {
        method: "POST",
        body: formData,
      });

      const result = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(result?.detail || "Erreur lors de l'import du ZIP.");
      }

      await reloadMetricsForSelectedDb();
      removeSelectedZip();

      const imported = Number(result?.imported || 0);
      const skipped = Number(result?.skipped || 0);

      setMessage({
        type: "success",
        text:
          skipped > 0
            ? `Import ZIP réussi : ${imported} métrique(s) importée(s), ${skipped} ignorée(s).`
            : `Import ZIP réussi : ${imported} métrique(s) importée(s).`,
      });
    } catch (e) {
      setMessage({
        type: "error",
        text: e.message || "Erreur lors de l'import du ZIP.",
      });
    } finally {
      setImportingZip(false);
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
          text: `Erreur plan : ${result?.detail || result?.message || "Pas de réponse"}`,
        });
      }
    } catch (e) {
      setMessage({
        type: "error",
        text: e.message || "Erreur lors de l'analyse du plan.",
      });
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
          text: "Recommandé : analysez le plan avant d'exécuter.",
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
    } catch (e) {
      setMessage({
        type: "error",
        text: e.message || "Erreur lors de l'exécution.",
      });
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

  const planRowsFormatted = useMemo(() => {
    const rows = Array.isArray(explainResult?.plan_rows) ? explainResult.plan_rows : [];
    const totalCpu = rows.reduce((sum, row) => sum + (Number(row.cpu_cost) || 0), 0);

    return rows.map((row) => {
      const rawBytes = Number(row.bytes || 0);
      const rawCpu = Number(row.cpu_cost || 0);

      return {
        plan_step: row.plan_step || "—",
        cost: row.cost ?? "—",
        cardinality:
          row.cardinality !== null && row.cardinality !== undefined
            ? `${row.cardinality} lignes`
            : "—",
        bytes: rawBytes > 0 ? `${(rawBytes / 1024).toFixed(1)} Ko` : "—",
        cpu_cost:
          totalCpu > 0 ? `${((rawCpu / totalCpu) * 100).toFixed(1)} %` : "0 %",
        io_cost: row.io_cost ?? "—",
      };
    });
  }, [explainResult]);

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
        title="Analyseur de scripts SQL"
        subtitle="Scripts issus des métriques collectées — analyse du plan avant exécution"
      />

      {message.text ? (
        <div style={{ marginBottom: 16 }}>
          {message.type === "success" && <SuccessBox text={message.text} />}
          {message.type === "error" && <ErrorBox text={message.text} />}
          {message.type === "warning" && <WarningBox text={message.text} />}
        </div>
      ) : null}

      <SectionCard>
        <SectionTitle text="SÉLECTION BASE & MÉTRIQUE SQL" />

        <div style={styles.topGridSimple}>
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
              <option>Aucune métrique disponible</option>
            </select>
          )}
        </div>

        <div style={styles.importZipCard}>
          <div style={styles.importZipHeader}>
            <div>
              <div style={styles.importZipTitle}>Import en masse par ZIP</div>
              <div style={styles.importZipSub}>
                Ajoutez plusieurs scripts SQL d'un seul coup dans METRIC_DEFS pour la base sélectionnée.
              </div>
            </div>

            <span style={styles.zipBadge}>
              {selectedDbType || "TYPE INCONNU"}
            </span>
          </div>

          <div style={styles.importDropZone}>
            <div style={styles.importDropIcon}>📦</div>
            <div style={styles.importDropText}>
              <div style={styles.importDropMain}>
                Sélectionnez un fichier ZIP contenant vos scripts SQL
              </div>
              <div style={styles.importDropHint}>
                Formats acceptés : .zip
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={(e) => setZipFile(e.target.files?.[0] || null)}
              style={{ display: "none" }}
            />

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => fileInputRef.current?.click()}
              disabled={importingZip}
            >
              Choisir un fichier
            </button>
          </div>

          {zipFile ? (
            <div style={styles.selectedFileCard}>
              <div style={styles.selectedFileLeft}>
                <div style={styles.selectedFileIcon}>🗜️</div>
                <div>
                  <div style={styles.selectedFileName}>{zipFile.name}</div>
                  <div style={styles.selectedFileMeta}>
                    {formatFileSize(zipFile.size)}
                  </div>
                </div>
              </div>

              <div style={styles.selectedFileActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={removeSelectedZip}
                  disabled={importingZip}
                >
                  Supprimer
                </button>

                <button
                  type="button"
                  style={styles.primaryButton}
                  onClick={handleImportZip}
                  disabled={importingZip}
                >
                  {importingZip ? "Import..." : "Importer ZIP"}
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.zipEmptyState}>
              Aucun fichier ZIP sélectionné.
            </div>
          )}
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      {selectedScript ? (
        <SectionCard>
          <SectionTitle text="DÉTAIL DE LA MÉTRIQUE SQL" />

          <div style={styles.detailGrid}>
            <div>
              <div style={styles.scriptTitle}>{selectedScript.script_name}</div>
              <div style={styles.scriptDesc}>{selectedScript.description || "—"}</div>

              <div style={styles.scriptMeta}>
                {categoryBadge(selectedScript.category)}
                <span style={styles.monoTag}>#METRIC-{selectedScript.metric_id}</span>
                <span style={styles.monoTag}>{selectedDbType || "TYPE INCONNU"}</span>
                {severityBadge(selectedScript.severity)}
              </div>
            </div>

            <div style={styles.targetCard}>
              <div style={styles.targetLabel}>BASE CIBLE</div>
              <div style={styles.targetName}>{selectedDb?.db_name}</div>
              <div style={styles.targetHost}>
                {selectedDb?.host}:{selectedDb?.port}
              </div>
              <div style={styles.targetService}>
                {selectedDb?.service_name || selectedDb?.sid || "—"}
              </div>
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

          <div style={styles.actionRow3}>
            <button style={styles.primaryButton} onClick={handleExplain}>
              Analyser le plan
            </button>
            <button style={styles.secondaryButton} onClick={handleExecute}>
              Lancer l'exécution
            </button>
            <button style={styles.secondaryButton} onClick={resetEditor}>
              Réinitialiser
            </button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard>
          <EmptyState
            icon="📄"
            title="Aucune métrique SQL disponible"
            subtitle="Aucune métrique disponible pour cette base et cette catégorie."
          />
        </SectionCard>
      )}

      {explainResult && (
        <>
          <div style={{ height: 16 }} />
          <SectionCard>
            <SectionTitle text="PLAN D'EXÉCUTION" />

            {planRowsFormatted.length ? (
              <DataTable
                columns={[
                  "plan_step",
                  "cost",
                  "cardinality",
                  "bytes",
                  "cpu_cost",
                  "io_cost",
                ]}
                rows={planRowsFormatted}
              />
            ) : (
              <InfoBox text="Aucun détail de plan disponible." />
            )}
          </SectionCard>
        </>
      )}

      {executeResult && (
        <>
          <div style={{ height: 16 }} />
          <SectionCard>
            <SectionTitle text="RÉSULTATS DE L'EXÉCUTION" />

            {executeResult.success ? (
              <>
                <div style={styles.successBanner}>
                  Exécution réussie · {executeResult.row_count || 0} ligne(s) retournée(s) ·{" "}
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
                <div style={styles.errorBanner}>Exécution échouée</div>
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
        <SectionTitle text="BIBLIOTHÈQUE DES MÉTRIQUES SQL" />

        <div style={styles.libraryFilters}>
          <input
            style={styles.input}
            value={libSearch}
            placeholder="Rechercher par code métrique, description ou contenu SQL…"
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
            title="Aucune métrique trouvée"
            subtitle="Aucune métrique trouvée pour ces critères."
          />
        ) : (
          <div style={styles.libraryList}>
            <div style={styles.libraryHeaderExtended}>
              <div>ID</div>
              <div>NOM</div>
              <div>CATÉGORIE</div>
              <div>VALEUR</div>
              <div>SÉVÉRITÉ</div>
              <div>DESCRIPTION</div>
            </div>

            {libraryScripts.map((s) => {
              const isActive = Number(s.is_active ?? 1) === 1;
              return (
                <div key={s.script_id} style={styles.libraryRowExtended}>
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
                  <div style={styles.libraryDesc}>{formatMetricValue(s)}</div>
                  <div>{severityBadge(s.severity)}</div>

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
  const columnLabels = {
    plan_step: "Étape du plan",
    cost: "Coût total",
    cardinality: "Lignes estimées",
    bytes: "Taille estimée (Ko)",
    cpu_cost: "CPU % estimé",
    io_cost: "Coût E/S",
  };

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} style={styles.th}>
                {columnLabels[col] || col}
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
  topGridSimple: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr 2.5fr",
    gap: 12,
    alignItems: "center",
  },
  importZipCard: {
    marginTop: 16,
    borderRadius: 18,
    border: "1px solid #dbe7fb",
    background: "linear-gradient(180deg, #f8fbff 0%, #fdfefe 100%)",
    padding: 18,
    boxShadow: "0 8px 24px rgba(37, 99, 235, 0.06)",
  },
  importZipHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  importZipTitle: {
    fontSize: "1rem",
    fontWeight: 800,
    color: "#0d1b2a",
    marginBottom: 4,
  },
  importZipSub: {
    fontSize: "0.85rem",
    color: "#526077",
    lineHeight: 1.5,
  },
  zipBadge: {
    background: "#e0ecff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: 9999,
    padding: "0.35rem 0.75rem",
    fontSize: "0.72rem",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  importDropZone: {
    border: "1.5px dashed #bfd3f6",
    borderRadius: 16,
    background: "#ffffff",
    padding: "18px 16px",
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: 14,
  },
  importDropIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eff6ff",
    fontSize: "1.4rem",
  },
  importDropText: {
    minWidth: 0,
  },
  importDropMain: {
    fontSize: "0.92rem",
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  },
  importDropHint: {
    fontSize: "0.78rem",
    color: "#64748b",
  },
  selectedFileCard: {
    marginTop: 14,
    borderRadius: 14,
    border: "1px solid #dbe7fb",
    background: "#ffffff",
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  selectedFileLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  selectedFileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.2rem",
    flexShrink: 0,
  },
  selectedFileName: {
    fontSize: "0.9rem",
    fontWeight: 700,
    color: "#0f172a",
    wordBreak: "break-word",
  },
  selectedFileMeta: {
    marginTop: 4,
    fontSize: "0.76rem",
    color: "#64748b",
  },
  selectedFileActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  zipEmptyState: {
    marginTop: 14,
    borderRadius: 12,
    padding: "0.95rem 1rem",
    background: "#f8fafc",
    border: "1px dashed #dbe7fb",
    color: "#64748b",
    fontSize: "0.82rem",
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
  actionRow3: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1.4fr 1.2fr",
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
  libraryHeaderExtended: {
    display: "grid",
    gridTemplateColumns: "0.6fr 2fr 1.2fr 1.2fr 1.1fr 2.5fr",
    gap: 12,
    fontSize: "0.65rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#8fa0bb",
    paddingBottom: 10,
    borderBottom: "1px solid #e4e9f2",
  },
  libraryRowExtended: {
    display: "grid",
    gridTemplateColumns: "0.6fr 2fr 1.2fr 1.2fr 1.1fr 2.5fr",
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
    wordBreak: "break-word",
  },
};