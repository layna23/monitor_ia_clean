import { useEffect, useMemo, useState } from "react";
import AiAnalysisPanel from "../components/sql-analyzer/AiAnalysisPanel";

const API_BASE = "http://127.0.0.1:8000";

export default function AnalyseurSQL() {
  const [targetDbs, setTargetDbs] = useState([]);
  const [topQueries, setTopQueries] = useState([]);

  const [selectedDbId, setSelectedDbId] = useState("");
  const [selectedScriptId, setSelectedScriptId] = useState("");
  const [excludeDbmon, setExcludeDbmon] = useState(false);
  const [sortBy, setSortBy] = useState("elapsed_time");

  const [selectedPhv, setSelectedPhv] = useState(null);
  const [planText, setPlanText] = useState("");

  const [phvTables, setPhvTables] = useState([]);
  const [phvIndexes, setPhvIndexes] = useState([]);
  const [objectDetailsLoading, setObjectDetailsLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [topSqlLoading, setTopSqlLoading] = useState(false);
  const [planTextLoading, setPlanTextLoading] = useState(false);

  const [activeBottomTab, setActiveBottomTab] = useState("plan");
  const [message, setMessage] = useState({ type: "", text: "" });

  async function apiGet(endpoint, defaultValue = null) {
    const res = await fetch(`${API_BASE}${endpoint}`);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.detail || data?.message || "Erreur API");
    }

    return data ?? defaultValue;
  }

  function mapTopQueryToUiScript(row) {
    const phvList = Array.isArray(row.phv_list) ? row.phv_list : [];

    return {
      script_id: String(row.sql_id || Math.random()),
      script_name: row.sql_id || "SQL_ID_INCONNU",
      sql_content: row.sql_text || "",
      sql_id: row.sql_id || null,
      parsing_schema_name: row.parsing_schema_name || null,
      executions: row.executions ?? null,
      elapsed_time_sec: row.elapsed_time_sec ?? null,
      cpu_time_sec: row.cpu_time_sec ?? null,
      buffer_gets: row.buffer_gets ?? null,
      disk_reads: row.disk_reads ?? null,
      last_active_time: row.last_active_time || null,
      phv_count: row.phv_count ?? phvList.length,
      phv_list: phvList,
      has_phv: row.has_phv ?? phvList.length > 0,
      has_multiple_phv: row.has_multiple_phv ?? phvList.length > 1,
      default_phv: row.default_phv ?? (phvList.length ? phvList[0] : null),
    };
  }

  async function loadData() {
    try {
      setLoading(true);

      const dbs = await apiGet("/target-dbs/", []);
      const dbList = Array.isArray(dbs) ? dbs : [];

      setTargetDbs(dbList);
      setTopQueries([]);

      if (dbList.length > 0) {
        setSelectedDbId((prev) => (prev ? prev : String(dbList[0].db_id)));
      }
    } catch (e) {
      setMessage({
        type: "error",
        text: e.message || "Erreur lors du chargement des données.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function reloadTopQueriesForSelectedDb() {
    if (!selectedDbId) {
      setTopQueries([]);
      return;
    }

    try {
      setTopSqlLoading(true);
      setMessage({ type: "", text: "" });

      const params = new URLSearchParams();
      params.append("db_id", selectedDbId);
      params.append("limit", "10");
      params.append("sort_by", sortBy);

      if (excludeDbmon) {
        params.append("exclude_schema", "DBMON");
      }

      const result = await apiGet(
        `/sql-analyzer/top-queries?${params.toString()}`,
        { success: false, queries: [] }
      );

      const mapped = Array.isArray(result?.queries)
        ? result.queries.map(mapTopQueryToUiScript)
        : [];

      setTopQueries(mapped);
    } catch (e) {
      setTopQueries([]);
      setMessage({
        type: "error",
        text: e.message || "Erreur lors du chargement des top requêtes SQL.",
      });
    } finally {
      setTopSqlLoading(false);
    }
  }

  async function fetchObjectDetailsForPhv(sqlId, phv) {
    if (!selectedDbId || !sqlId || phv === null || phv === undefined) {
      setPhvTables([]);
      setPhvIndexes([]);
      return;
    }

    try {
      setObjectDetailsLoading(true);

      const tablesResult = await apiGet(
        `/sql-analyzer/phv-table-details?db_id=${selectedDbId}&sql_id=${encodeURIComponent(
          sqlId
        )}&phv=${encodeURIComponent(phv)}`,
        { success: false, items: [] }
      );

      const indexesResult = await apiGet(
        `/sql-analyzer/phv-index-details?db_id=${selectedDbId}&sql_id=${encodeURIComponent(
          sqlId
        )}&phv=${encodeURIComponent(phv)}`,
        { success: false, items: [] }
      );

      setPhvTables(Array.isArray(tablesResult?.items) ? tablesResult.items : []);
      setPhvIndexes(Array.isArray(indexesResult?.items) ? indexesResult.items : []);
    } catch (e) {
      setPhvTables([]);
      setPhvIndexes([]);
      setMessage({
        type: "error",
        text: e.message || "Erreur récupération détails tables/index PHV.",
      });
    } finally {
      setObjectDetailsLoading(false);
    }
  }

  async function fetchPlanForPhv(sqlId, phv, returnOnly = false) {
    if (!selectedDbId || !sqlId || phv === null || phv === undefined) {
      if (!returnOnly) {
        setPlanText("");
        setPhvTables([]);
        setPhvIndexes([]);
      }
      return "";
    }

    try {
      if (!returnOnly) {
        setPlanTextLoading(true);
        setMessage({ type: "", text: "" });
        setSelectedPhv(phv);
        setPhvTables([]);
        setPhvIndexes([]);
      }

      const result = await apiGet(
        `/sql-analyzer/sql-plan-text?db_id=${selectedDbId}&sql_id=${encodeURIComponent(
          sqlId
        )}&phv=${encodeURIComponent(phv)}&format_value=${encodeURIComponent(
          "TYPICAL"
        )}`,
        { success: false, lines: [], plan_text: "" }
      );

      const text = result?.plan_text || "";

      if (!returnOnly) {
        setPlanText(text);
        await fetchObjectDetailsForPhv(sqlId, phv);
      }

      return text;
    } catch (e) {
      if (!returnOnly) {
        setPlanText("");
        setPhvTables([]);
        setPhvIndexes([]);
        setMessage({
          type: "error",
          text: e.message || "Erreur récupération du plan",
        });
      }

      return "";
    } finally {
      if (!returnOnly) {
        setPlanTextLoading(false);
      }
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
      setTopQueries([]);
      return;
    }

    reloadTopQueriesForSelectedDb();
  }, [selectedDbId, excludeDbmon, sortBy]);

  useEffect(() => {
    setSelectedScriptId("");
    setSelectedPhv(null);
    setPlanText("");
    setPhvTables([]);
    setPhvIndexes([]);
    setActiveBottomTab("plan");
  }, [selectedDbId, excludeDbmon, sortBy]);

  useEffect(() => {
    if (!topQueries.length) {
      setSelectedScriptId("");
      return;
    }

    const exists = topQueries.some(
      (s) => String(s.script_id) === String(selectedScriptId)
    );

    if (!selectedScriptId || !exists) {
      setSelectedScriptId(String(topQueries[0].script_id));
    }
  }, [topQueries, selectedScriptId]);

  const selectedScript = useMemo(() => {
    return (
      topQueries.find((s) => String(s.script_id) === String(selectedScriptId)) ||
      null
    );
  }, [topQueries, selectedScriptId]);

  useEffect(() => {
    if (
      selectedScript?.sql_id &&
      selectedDbType === "ORACLE" &&
      Array.isArray(selectedScript.phv_list) &&
      selectedScript.phv_list.length > 0
    ) {
      const defaultPhv = selectedScript.default_phv ?? selectedScript.phv_list[0];
      setSelectedPhv(defaultPhv);
      fetchPlanForPhv(selectedScript.sql_id, defaultPhv);
    } else {
      setSelectedPhv(null);
      setPlanText("");
      setPhvTables([]);
      setPhvIndexes([]);
    }
  }, [selectedScript?.sql_id, selectedDbId, selectedDbType]);

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") return "—";
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return n.toLocaleString("fr-FR");
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const pad = (n) => String(n).padStart(2, "0");

    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function formatPercent(value) {
    if (value === null || value === undefined || value === "") return "—";

    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);

    return `${n.toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}%`;
  }

  function truncateSql(sql, max = 110) {
    if (!sql) return "SQL non disponible";
    const clean = String(sql).replace(/\s+/g, " ").trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max)}...`;
  }

  async function handleCopyPlan() {
    if (!planText) return;

    try {
      await navigator.clipboard.writeText(planText);
      setMessage({ type: "success", text: "Plan copié dans le presse-papiers." });
    } catch {
      setMessage({ type: "warning", text: "Copie impossible sur ce navigateur." });
    }
  }

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
      <div style={styles.topBar}>
        <div>
          <div style={styles.pageTitle}>SQL Analyzer</div>
          <div style={styles.pageSubtitle}>
            Top 10 requêtes SQL avec PHV et plan d'exécution Oracle
          </div>
        </div>

        <button
          type="button"
          style={styles.refreshButton}
          onClick={reloadTopQueriesForSelectedDb}
        >
          ⟳ Actualiser
        </button>
      </div>

      {message.text ? (
        <div style={{ marginBottom: 16 }}>
          {message.type === "success" && <SuccessBox text={message.text} />}
          {message.type === "error" && <ErrorBox text={message.text} />}
          {message.type === "warning" && <WarningBox text={message.text} />}
        </div>
      ) : null}

      <SectionCard>
        <div style={styles.filterGrid}>
          <div>
            <FieldLabel text="Base sélectionnée" />
            <select
              style={styles.select}
              value={selectedDbId}
              onChange={(e) => setSelectedDbId(e.target.value)}
            >
              {targetDbs.map((d) => (
                <option key={d.db_id} value={String(d.db_id)}>
                  {`${d.db_name} - ${d.host}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel text="Tri" />
            <select
              style={styles.select}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="elapsed_time">Elapsed Time (s)</option>
              <option value="cpu_time">CPU Time (s)</option>
              <option value="buffer_gets">Buffer Gets</option>
              <option value="disk_reads">Disk Reads</option>
              <option value="executions">Executions</option>
            </select>
          </div>

          <div>
            <FieldLabel text="Exclure schéma" />
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={excludeDbmon}
                onChange={(e) => setExcludeDbmon(e.target.checked)}
              />
              <span>Exclure le schéma DBMON</span>
            </label>
          </div>
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard>
        <div style={styles.panelHeaderTitle}>Top 10 requêtes SQL</div>

        {topSqlLoading ? (
          <InfoBox text="Chargement des top requêtes SQL..." />
        ) : !topQueries.length ? (
          <EmptyState
            icon="📄"
            title="Aucune requête SQL disponible"
            subtitle="Aucune requête Oracle avec PHV disponible pour cette base."
          />
        ) : (
          <TopQueryTable
            rows={topQueries}
            selectedScriptId={selectedScriptId}
            selectedPhv={selectedPhv}
            onSelectScript={(id) => {
              setSelectedScriptId(String(id));
              setActiveBottomTab("plan");
            }}
            onSelectPhv={(sqlId, phv) => {
              setActiveBottomTab("plan");
              fetchPlanForPhv(sqlId, phv);
            }}
            formatNumber={formatNumber}
            truncateSql={truncateSql}
            sortBy={sortBy}
          />
        )}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard>
        <div style={styles.tabsHeader}>
          <button
            type="button"
            onClick={() => setActiveBottomTab("plan")}
            style={{
              ...styles.tabButton,
              ...(activeBottomTab === "plan" ? styles.tabButtonActive : {}),
            }}
          >
            Plan d'exécution
          </button>

          <button
            type="button"
            onClick={() => setActiveBottomTab("ai")}
            style={{
              ...styles.tabButton,
              ...(activeBottomTab === "ai" ? styles.tabButtonActive : {}),
            }}
          >
            Analyse IA
          </button>
        </div>

        <div style={styles.separator} />

        {activeBottomTab === "plan" ? (
          <>
            <div style={styles.rightPanelHeader}>
              <div style={styles.panelHeaderTitle}>
                Plan d'exécution Oracle (DBMS_XPLAN)
              </div>

              <div style={styles.planHeaderActions}>
                <div style={styles.planMeta}>
                  <span>SQL_ID</span>
                  <strong>{selectedScript?.sql_id || "—"}</strong>
                  <span>•</span>
                  <span>PHV</span>
                  <strong>
                    {selectedPhv !== null ? formatNumber(selectedPhv) : "—"}
                  </strong>
                </div>

                <button
                  type="button"
                  style={styles.copyButton}
                  onClick={handleCopyPlan}
                  disabled={!planText}
                >
                  Copier le plan
                </button>
              </div>
            </div>

            <div style={styles.separator} />

            {selectedDbType !== "ORACLE" ? (
              <InfoBox text="Le plan Oracle est disponible uniquement pour Oracle." />
            ) : planTextLoading ? (
              <InfoBox text="Chargement du plan texte..." />
            ) : !selectedScript?.sql_id ? (
              <InfoBox text="Sélectionnez une requête pour afficher son plan." />
            ) : selectedPhv === null || selectedPhv === undefined ? (
              <InfoBox text="Sélectionnez un PHV pour afficher le plan." />
            ) : !planText ? (
              <InfoBox text="Aucun plan DBMS_XPLAN retourné pour ce PHV." />
            ) : (
              <>
                <div style={styles.subPanelTitle}>Plan sélectionné</div>
                <pre style={styles.planTextBlock}>{planText}</pre>

                <div style={{ height: 18 }} />

                <PhvTablesPanel
                  rows={phvTables}
                  loading={objectDetailsLoading}
                  formatNumber={formatNumber}
                  formatDateTime={formatDateTime}
                  formatPercent={formatPercent}
                />

                <div style={{ height: 18 }} />

                <PhvIndexesPanel
                  rows={phvIndexes}
                  loading={objectDetailsLoading}
                  formatNumber={formatNumber}
                />
              </>
            )}
          </>
        ) : (
          <AiAnalysisPanel
            selectedScript={selectedScript}
            selectedPhv={selectedPhv}
            planText={planText}
            fetchPlanForPhv={fetchPlanForPhv}
          />
        )}
      </SectionCard>
    </div>
  );
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

function MetricBadge({ sortBy, row, formatNumber }) {
  const labelMap = {
    elapsed_time: "Elapsed",
    cpu_time: "CPU",
    buffer_gets: "Buffer",
    disk_reads: "Disk",
    executions: "Exec",
  };

  const valueMap = {
    elapsed_time: row.elapsed_time_sec,
    cpu_time: row.cpu_time_sec,
    buffer_gets: row.buffer_gets,
    disk_reads: row.disk_reads,
    executions: row.executions,
  };

  return (
    <div style={styles.metricBadge}>
      <span style={styles.metricBadgeLabel}>{labelMap[sortBy] || "Metric"}</span>
      <span style={styles.metricBadgeValue}>{formatNumber(valueMap[sortBy])}</span>
    </div>
  );
}

function TopQueryTable({
  rows,
  selectedScriptId,
  selectedPhv,
  onSelectScript,
  onSelectPhv,
  formatNumber,
  truncateSql,
  sortBy,
}) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>SQL_ID</th>
            <th style={styles.th}>SCHÉMA</th>
            <th style={styles.th}>EXTRAIT SQL</th>
            <th style={styles.th}>PHV</th>
            <th style={styles.th}>MÉTRIQUE</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, idx) => {
            const active = String(selectedScriptId) === String(row.script_id);

            return (
              <tr
                key={`${row.script_id}-${idx}`}
                onClick={() => onSelectScript(row.script_id)}
                style={{
                  ...(idx % 2 === 0 ? styles.rowEven : styles.rowOdd),
                  ...(active ? styles.rowSelected : {}),
                  cursor: "pointer",
                }}
              >
                <td style={styles.td}>
                  <span style={styles.sqlLink}>{row.sql_id || "-"}</span>
                </td>

                <td style={styles.td}>
                  <span style={styles.schemaBadge}>
                    {row.parsing_schema_name || "-"}
                  </span>
                </td>

                <td style={styles.tdSql}>{truncateSql(row.sql_content, 110)}</td>

                <td style={styles.td}>
                  <div style={styles.inlinePhvWrap}>
                    {Array.isArray(row.phv_list) && row.phv_list.length ? (
                      row.phv_list.map((phv) => {
                        const phvActive =
                          active && String(selectedPhv) === String(phv);

                        return (
                          <button
                            key={`${row.sql_id}-${phv}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectScript(row.script_id);
                              onSelectPhv(row.sql_id, phv);
                            }}
                            style={{
                              ...styles.inlinePhvButton,
                              ...(phvActive ? styles.inlinePhvButtonActive : {}),
                            }}
                          >
                            {formatNumber(phv)}
                          </button>
                        );
                      })
                    ) : (
                      "—"
                    )}
                  </div>
                </td>

                <td style={styles.tdCenter}>
                  <MetricBadge
                    sortBy={sortBy}
                    row={row}
                    formatNumber={formatNumber}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PhvTablesPanel({
  rows,
  loading,
  formatNumber,
  formatDateTime,
  formatPercent,
}) {
  if (loading) {
    return <InfoBox text="Chargement des détails des tables du PHV..." />;
  }

  if (!rows.length) {
    return (
      <InfoBox text="Aucune table détectée dans ce PHV ou privilèges insuffisants." />
    );
  }

  return (
    <>
      <div style={styles.subPanelTitle}>Détails des tables du PHV</div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Owner</th>
              <th style={styles.th}>Table</th>
              <th style={styles.th}>Access</th>
              <th style={styles.th}>Rows</th>
              <th style={styles.th}>Blocks</th>
              <th style={styles.th}>Last analyzed</th>
              <th style={styles.th}>Bufferisé</th>
              <th style={styles.th}>Hit ratio</th>
              <th style={styles.th}>Partitionnée</th>
              <th style={styles.th}>Compression</th>
              <th style={styles.th}>Inserts</th>
              <th style={styles.th}>Updates</th>
              <th style={styles.th}>Deletes</th>
              <th style={styles.th}>Nb index</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.owner}-${row.table_name}-${idx}`}>
                <td style={styles.td}>{row.owner || "—"}</td>
                <td style={styles.td}>
                  <strong>{row.table_name || "—"}</strong>
                </td>
                <td style={styles.td}>{row.access_types || "—"}</td>
                <td style={styles.tdCenter}>{formatNumber(row.num_rows)}</td>
                <td style={styles.tdCenter}>{formatNumber(row.blocks)}</td>
                <td style={styles.td}>{formatDateTime(row.last_analyzed)}</td>
                <td style={styles.tdCenter}>{row.bufferise || "—"}</td>
                <td style={styles.tdCenter}>{formatPercent(row.hit_ratio)}</td>
                <td style={styles.tdCenter}>{row.partitioned || "—"}</td>
                <td style={styles.tdCenter}>{row.compression || "—"}</td>
                <td style={styles.tdCenter}>{formatNumber(row.inserts)}</td>
                <td style={styles.tdCenter}>{formatNumber(row.updates)}</td>
                <td style={styles.tdCenter}>{formatNumber(row.deletes)}</td>
                <td style={styles.tdCenter}>{formatNumber(row.nb_indexes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PhvIndexesPanel({ rows, loading, formatNumber }) {
  const [selectedIndex, setSelectedIndex] = useState("ALL");

  const indexOptions = useMemo(() => {
    const uniqueNames = new Set();

    rows.forEach((row) => {
      if (row.index_name) {
        uniqueNames.add(String(row.index_name));
      }
    });

    return Array.from(uniqueNames).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (selectedIndex === "ALL") {
      return rows;
    }

    return rows.filter((row) => String(row.index_name) === String(selectedIndex));
  }, [rows, selectedIndex]);

  useEffect(() => {
    setSelectedIndex("ALL");
  }, [rows]);

  if (loading) {
    return <InfoBox text="Chargement des détails des index du PHV..." />;
  }

  if (!rows.length) {
    return (
      <InfoBox text="Aucun index trouvé pour les tables de ce PHV ou privilèges insuffisants." />
    );
  }

  return (
    <>
      <div style={styles.indexPanelHeader}>
        <div style={styles.subPanelTitle}>Détails des index des tables du PHV</div>

        {indexOptions.length > 1 ? (
          <div style={styles.indexFilterBox}>
            <FieldLabel text="Filtrer par index" />
            <select
              style={styles.indexSelect}
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(e.target.value)}
            >
              <option value="ALL">Tous les index</option>
              {indexOptions.map((indexName) => (
                <option key={indexName} value={indexName}>
                  {indexName}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Owner</th>
              <th style={styles.th}>Table</th>
              <th style={styles.th}>Nb index</th>
              <th style={styles.th}>Index</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Unique</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Rows</th>
              <th style={styles.th}>Distinct keys</th>
              <th style={styles.th}>Blevel</th>
              <th style={styles.th}>Columns</th>
              <th style={styles.th}>Bufferisé</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row, idx) => (
              <tr key={`${row.owner}-${row.table_name}-${row.index_name}-${idx}`}>
                <td style={styles.td}>{row.owner || "—"}</td>
                <td style={styles.td}>{row.table_name || "—"}</td>
                <td style={styles.tdCenter}>{formatNumber(row.nb_indexes)}</td>
                <td style={styles.td}>
                  <strong>{row.index_name || "—"}</strong>
                </td>
                <td style={styles.td}>{row.index_type || "—"}</td>
                <td style={styles.tdCenter}>{row.uniqueness || "—"}</td>
                <td style={styles.tdCenter}>{row.status || "—"}</td>
                <td style={styles.tdCenter}>{formatNumber(row.index_num_rows)}</td>
                <td style={styles.tdCenter}>{formatNumber(row.distinct_keys)}</td>
                <td style={styles.tdCenter}>{formatNumber(row.blevel)}</td>
                <td style={styles.td}>{row.index_columns || "—"}</td>
                <td style={styles.tdCenter}>{row.bufferise || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const styles = {
  page: {
    padding: 20,
    background: "#f3f6fb",
    minHeight: "100vh",
    color: "#14213d",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 900,
    color: "#1e2f5b",
    marginBottom: 6,
    letterSpacing: "-0.02em",
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#6b7a99",
  },
  refreshButton: {
    border: "1px solid #d9e2f2",
    background: "#ffffff",
    color: "#5670a8",
    borderRadius: 10,
    padding: "0.75rem 1rem",
    fontWeight: 700,
    cursor: "pointer",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e0e7f3",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 4px 18px rgba(31,45,61,0.06)",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1fr",
    gap: 16,
    alignItems: "end",
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: "#4b5f88",
    marginBottom: 8,
  },
  select: {
    width: "100%",
    padding: "0.9rem 1rem",
    borderRadius: 12,
    border: "1px solid #d9e2f2",
    background: "#fff",
    fontSize: 14,
    boxSizing: "border-box",
    color: "#243b6b",
  },
  checkboxRow: {
    width: "100%",
    minHeight: 51,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0.85rem 1rem",
    borderRadius: 12,
    border: "1px solid #d9e2f2",
    background: "#fff",
    boxSizing: "border-box",
    fontSize: 14,
    color: "#31456a",
  },
  panelHeaderTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#1f3b7a",
    marginBottom: 14,
  },
  tabsHeader: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  tabButton: {
    border: "1px solid #d9e2f2",
    background: "#ffffff",
    color: "#5670a8",
    borderRadius: 12,
    padding: "0.75rem 1.1rem",
    fontWeight: 900,
    cursor: "pointer",
  },
  tabButtonActive: {
    background: "#2563eb",
    color: "#ffffff",
    border: "1px solid #2563eb",
  },
  rightPanelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  planHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  planMeta: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    fontSize: 13,
    color: "#6a7b9e",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  copyButton: {
    border: "1px solid #d9e2f2",
    background: "#ffffff",
    color: "#36558f",
    borderRadius: 10,
    padding: "0.55rem 0.85rem",
    fontWeight: 700,
    cursor: "pointer",
  },
  separator: {
    height: 1,
    background: "#e5ebf5",
    marginBottom: 16,
  },
  subPanelTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "#14213d",
    marginBottom: 12,
  },
  indexPanelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  indexFilterBox: {
    minWidth: 260,
  },
  indexSelect: {
    width: "100%",
    padding: "0.65rem 0.85rem",
    borderRadius: 10,
    border: "1px solid #d9e2f2",
    background: "#fff",
    fontSize: 13,
    boxSizing: "border-box",
    color: "#243b6b",
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: 14,
    border: "1px solid #e1e8f4",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#fff",
  },
  th: {
    background: "#f4f7fc",
    fontSize: "0.72rem",
    fontWeight: 800,
    textTransform: "uppercase",
    color: "#8396ba",
    padding: "0.95rem 0.8rem",
    borderBottom: "1px solid #e1e8f4",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  td: {
    fontSize: "0.80rem",
    color: "#1a2b4f",
    padding: "0.9rem 0.8rem",
    borderBottom: "1px solid #eef3fa",
    textAlign: "left",
    verticalAlign: "top",
  },
  tdCenter: {
    fontSize: "0.80rem",
    color: "#1a2b4f",
    padding: "0.9rem 0.8rem",
    borderBottom: "1px solid #eef3fa",
    textAlign: "center",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    fontWeight: 700,
  },
  tdSql: {
    fontSize: "0.80rem",
    color: "#31456a",
    padding: "0.9rem 0.8rem",
    borderBottom: "1px solid #eef3fa",
    minWidth: 220,
    lineHeight: 1.45,
  },
  rowEven: {
    background: "#ffffff",
  },
  rowOdd: {
    background: "#fbfcff",
  },
  rowSelected: {
    background: "#eef4ff",
  },
  sqlLink: {
    color: "#3b82f6",
    fontWeight: 700,
  },
  schemaBadge: {
    display: "inline-block",
    padding: "0.30rem 0.62rem",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    background: "#f1f5f9",
    color: "#64748b",
    border: "1px solid #e2e8f0",
  },
  inlinePhvWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    minWidth: 120,
  },
  inlinePhvButton: {
    borderRadius: 999,
    padding: "0.34rem 0.72rem",
    background: "#eef4ff",
    border: "1px solid #bfd2ff",
    color: "#2563eb",
    fontWeight: 800,
    fontSize: 11,
    cursor: "pointer",
  },
  inlinePhvButtonActive: {
    background: "#2563eb",
    color: "#fff",
    border: "1px solid #2563eb",
  },
  metricBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "0.28rem 0.55rem",
    borderRadius: 999,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  metricBadgeLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#64748b",
  },
  metricBadgeValue: {
    fontSize: 11,
    fontWeight: 800,
    color: "#0f172a",
  },
  planTextBlock: {
    margin: 0,
    padding: "1rem 1.1rem",
    background: "linear-gradient(135deg, #101827 0%, #1f2937 100%)",
    color: "#eef2ff",
    borderRadius: 14,
    border: "1px solid #243042",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
    lineHeight: 1.58,
    whiteSpace: "pre-wrap",
    overflowX: "auto",
    minHeight: 320,
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
    padding: "3rem 1.5rem",
    background: "#f8fbff",
    border: "1px dashed #d8e3f3",
    borderRadius: 16,
    color: "#8da0be",
  },
  emptyIcon: {
    fontSize: "2.4rem",
    marginBottom: "0.75rem",
  },
  emptyTitle: {
    fontWeight: 800,
    fontSize: "1.05rem",
    color: "#334155",
    marginBottom: "0.35rem",
  },
  emptySub: {
    fontSize: "0.9rem",
  },
};