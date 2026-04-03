import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";
const TARGET_ENDPOINT = "/target-dbs/";
const DBTYPES_ENDPOINT = "/db-types/";

const EMPTY_FORM = {
  db_name: "",
  db_type_id: "",
  host: "",
  port: "1521",
  service_name: "",
  username: "",
  password: "",
  is_active: 1,
};

export default function ConfigBD() {
  const [dbTypes, setDbTypes] = useState([]);
  const [targets, setTargets] = useState([]);
  const [showInactive, setShowInactive] = useState(false);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Tous");
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [selectedId, setSelectedId] = useState("");

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

  function intOrNone(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? null : n;
  }

  async function loadDbTypes() {
    const data = await apiGet(DBTYPES_ENDPOINT, []);
    return Array.isArray(data) ? data : [];
  }

  async function loadTargets(onlyActive = true) {
    const data = await apiGet(
      `${TARGET_ENDPOINT}?only_active=${onlyActive ? "true" : "false"}`,
      []
    );
    return Array.isArray(data) ? data : [];
  }

  async function refreshAll(inactive = showInactive) {
    try {
      setLoading(true);
      const [typesRes, targetsRes] = await Promise.all([
        loadDbTypes(),
        loadTargets(!inactive),
      ]);

      setDbTypes(typesRes);
      setTargets(targetsRes);

      if (targetsRes.length > 0) {
        const exists = targetsRes.some((t) => String(t.db_id) === String(selectedId));
        if (!selectedId || !exists) {
          setSelectedId(String(targetsRes[0].db_id));
        }
      } else {
        setSelectedId("");
      }
    } catch {
      setMessage({ type: "error", text: "Erreur lors du chargement des données." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll(false);
  }, []);

  useEffect(() => {
    refreshAll(showInactive);
  }, [showInactive]);

  const dbTypeMap = useMemo(() => {
    const map = {};
    dbTypes.forEach((d) => {
      if (d.db_type_id !== null && d.db_type_id !== undefined) {
        map[Number(d.db_type_id)] = String(d.name || "").trim();
      }
    });
    return map;
  }, [dbTypes]);

  const dbTypeIds = useMemo(() => {
    return Object.keys(dbTypeMap).map(Number).sort((a, b) => a - b);
  }, [dbTypeMap]);

  function resetForm() {
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  function fillForm(row) {
    setEditId(row.db_id);
    setForm({
      db_name: row.db_name || "",
      db_type_id:
        row.db_type_id !== null && row.db_type_id !== undefined
          ? String(row.db_type_id)
          : "",
      host: row.host || "",
      port: row.port !== null && row.port !== undefined ? String(row.port) : "",
      service_name: row.service_name || "",
      username: row.username || "",
      password: "",
      is_active: intOrNone(row.is_active) || 1,
    });
  }

  async function handleSave() {
    setMessage({ type: "", text: "" });

    const payload = {
      db_name: form.db_name.trim(),
      db_type_id: intOrNone(form.db_type_id),
      host: form.host.trim(),
      port: intOrNone(form.port),
      service_name: form.service_name.trim(),
      username: form.username.trim(),
      password: form.password,
      is_active: Number(form.is_active) === 1 ? 1 : 0,
    };

    let err = null;
    if (!payload.db_name) err = "db_name obligatoire.";
    else if (payload.db_type_id === null) err = "db_type_id obligatoire.";
    else if (!payload.host) err = "host obligatoire.";
    else if (payload.port === null) err = "port obligatoire.";
    else if (!payload.service_name) err = "service_name obligatoire.";
    else if (!payload.username) err = "username obligatoire.";

    if (err) {
      setMessage({ type: "error", text: err });
      return;
    }

    try {
      if (editId !== null) {
        const upd = { ...payload };
        if (!String(upd.password || "").trim()) {
          delete upd.password;
        }

        await apiPut(`${TARGET_ENDPOINT}${editId}`, upd);
        setMessage({ type: "success", text: "Target DB modifiée ✅" });
      } else {
        if (!String(payload.password || "").trim()) {
          setMessage({
            type: "error",
            text: "password obligatoire à la création.",
          });
          return;
        }

        await apiPost(TARGET_ENDPOINT, payload);
        setMessage({ type: "success", text: "Target DB ajoutée ✅" });
      }

      resetForm();
      await refreshAll(showInactive);
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la sauvegarde." });
    }
  }

  function handlePreview() {
    const typeName = dbTypeMap[intOrNone(form.db_type_id)] || "?";
    const text = `DB_NAME=${form.db_name}
TYPE=${typeName}
HOST=${form.host}
PORT=${form.port}
SERVICE=${form.service_name}
USER=${form.username}`;
    alert(text);
  }

  async function handleSoftDelete() {
    if (!selectedId) return;
    try {
      await apiDelete(`${TARGET_ENDPOINT}${intOrNone(selectedId)}`);
      setMessage({ type: "success", text: "Désactivée ✅" });
      await refreshAll(showInactive);
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la désactivation." });
    }
  }

  async function handleHardDelete() {
    if (!selectedId) return;
    try {
      await apiDelete(`${TARGET_ENDPOINT}${intOrNone(selectedId)}?hard=true`);
      setMessage({ type: "success", text: "Supprimée ✅" });
      await refreshAll(showInactive);
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression définitive." });
    }
  }

  const isEdit = editId !== null;
  const actionTitle = isEdit ? "MODIFIER UNE TARGET DB" : "AJOUTER UNE TARGET DB";

  const filteredTargets = useMemo(() => {
    let view = [...targets].map((x) => ({
      ...x,
      type_bd: dbTypeMap[intOrNone(x.db_type_id)] || String(x.db_type_id ?? ""),
      actif: intOrNone(x.is_active) === 1 ? "Oui" : "Non",
    }));

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      view = view.filter(
        (r) =>
          String(r.db_name || "").toLowerCase().includes(q) ||
          String(r.host || "").toLowerCase().includes(q) ||
          String(r.service_name || "").toLowerCase().includes(q)
      );
    }

    if (typeFilter !== "Tous") {
      view = view.filter((r) => r.type_bd === typeFilter);
    }

    if (activeFilter !== "Tous") {
      view = view.filter((r) => r.actif === activeFilter);
    }

    return view;
  }, [targets, dbTypeMap, search, typeFilter, activeFilter]);

  const selectedRow = useMemo(() => {
    return targets.find((x) => String(x.db_id) === String(selectedId)) || null;
  }, [targets, selectedId]);

  if (loading) {
    return <div style={styles.page}>Chargement...</div>;
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Configuration des Bases Surveillées"
        subtitle="Ajout, modification et désactivation des Target DBs"
      />

      {message.text ? (
        <div style={{ marginBottom: 16 }}>
          {message.type === "success" && <SuccessBox text={message.text} />}
          {message.type === "error" && <ErrorBox text={message.text} />}
        </div>
      ) : null}

      <div style={styles.toolbar}>
        <button
          style={styles.primaryButton}
          onClick={() => {
            resetForm();
          }}
        >
          ➕ Nouvelle base
        </button>

        <button
          style={styles.secondaryButton}
          onClick={() => refreshAll(showInactive)}
        >
          🔄 Rafraîchir
        </button>
      </div>

      <SectionCard>
        <SectionTitle text={`🗄️ ${actionTitle}`} />
        <div style={styles.helperText}>
          db_name + host + port doivent être uniques.
        </div>

        <div style={styles.grid3}>
          <div>
            <FieldLabel text="Nom DB (db_name) *" />
            <input
              style={styles.input}
              value={form.db_name}
              placeholder="ex: ORCL_PROD"
              onChange={(e) => setForm((p) => ({ ...p, db_name: e.target.value }))}
            />
          </div>

          <div>
            <FieldLabel text="Type BD *" />
            {dbTypeIds.length ? (
              <select
                style={styles.select}
                value={form.db_type_id}
                onChange={(e) => setForm((p) => ({ ...p, db_type_id: e.target.value }))}
              >
                {dbTypeIds.map((id) => (
                  <option key={id} value={String(id)}>
                    {dbTypeMap[id]}
                  </option>
                ))}
              </select>
            ) : (
              <InfoBox text="Aucun Type BD. Ajoutez d'abord dans Types BD." />
            )}
          </div>

          <div>
            <FieldLabel text="Actif" />
            <select
              style={styles.select}
              value={Number(form.is_active) === 1 ? "Oui" : "Non"}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  is_active: e.target.value === "Oui" ? 1 : 0,
                }))
              }
            >
              <option>Oui</option>
              <option>Non</option>
            </select>
          </div>
        </div>

        <div style={styles.grid3}>
          <div>
            <FieldLabel text="Host / IP *" />
            <input
              style={styles.input}
              value={form.host}
              placeholder="192.168.1.10"
              onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
            />
          </div>

          <div>
            <FieldLabel text="Port *" />
            <input
              style={styles.input}
              value={form.port}
              placeholder="1521"
              onChange={(e) => setForm((p) => ({ ...p, port: e.target.value }))}
            />
          </div>

          <div>
            <FieldLabel text="Service name *" />
            <input
              style={styles.input}
              value={form.service_name}
              placeholder="ORCLPDB1"
              onChange={(e) =>
                setForm((p) => ({ ...p, service_name: e.target.value }))
              }
            />
          </div>
        </div>

        <div style={styles.grid2}>
          <div>
            <FieldLabel text="Username *" />
            <input
              style={styles.input}
              value={form.username}
              placeholder="system"
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
            />
          </div>

          <div>
            <FieldLabel text="Password *" />
            <input
              type="password"
              style={styles.input}
              value={form.password}
              placeholder="••••••••"
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
        </div>

        <div style={styles.buttonRow}>
          <button style={styles.primaryButton} onClick={handleSave}>
            💾 Sauvegarder
          </button>
          <button style={styles.secondaryButton} onClick={resetForm}>
            🧹 Réinitialiser
          </button>
          <button style={styles.secondaryButton} onClick={handlePreview}>
            🔌 Aperçu config
          </button>
        </div>
      </SectionCard>

      <div style={{ height: 18 }} />

      <div style={{ marginBottom: 12 }}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Afficher aussi les bases désactivées
        </label>
      </div>

      <SectionCard>
        <SectionTitle text="📌 BASES CONFIGURÉES" />
        <div style={styles.helperText}>Liste des Target DBs</div>

        {!targets.length ? (
          <EmptyState
            icon="🗄️"
            title="Aucune base configurée."
            subtitle=""
          />
        ) : (
          <>
            <div style={styles.filterGrid}>
              <input
                style={styles.input}
                value={search}
                placeholder="Rechercher (nom / host / service)"
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                style={styles.select}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option>Tous</option>
                {dbTypeIds.map((id) => (
                  <option key={id}>{dbTypeMap[id]}</option>
                ))}
              </select>

              <select
                style={styles.select}
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
              >
                <option>Tous</option>
                <option>Oui</option>
                <option>Non</option>
              </select>
            </div>

            {filteredTargets.length ? (
              <DataTable
                columns={[
                  "db_id",
                  "db_name",
                  "type_bd",
                  "host",
                  "port",
                  "service_name",
                  "username",
                  "last_status",
                  "actif",
                ]}
                rows={filteredTargets.map((r) => ({
                  db_id: r.db_id,
                  db_name: r.db_name,
                  type_bd: r.type_bd,
                  host: r.host,
                  port: r.port,
                  service_name: r.service_name,
                  username: r.username,
                  last_status: r.last_status,
                  actif: r.actif,
                }))}
              />
            ) : (
              <EmptyState
                icon="🔎"
                title="Aucun résultat"
                subtitle="Aucune base ne correspond aux filtres."
              />
            )}

            {!!filteredTargets.length && (
              <>
                <div style={styles.separator} />

                <div style={styles.actionGrid4}>
                  <select
                    style={styles.select}
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    {filteredTargets.map((r) => (
                      <option key={r.db_id} value={String(r.db_id)}>
                        #{r.db_id} — {r.db_name}
                      </option>
                    ))}
                  </select>

                  <button
                    style={styles.secondaryButton}
                    onClick={() => {
                      if (selectedRow) fillForm(selectedRow);
                    }}
                  >
                    ✏️ Modifier
                  </button>

                  <button style={styles.secondaryButton} onClick={handleSoftDelete}>
                    ⛔ Désactiver
                  </button>

                  <button style={styles.dangerButton} onClick={handleHardDelete}>
                    🗑️ Hard delete
                  </button>
                </div>
              </>
            )}
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

function SectionTitle({ text }) {
  return <div style={styles.sectionTitle}>{text}</div>;
}

function FieldLabel({ text }) {
  return <div style={styles.label}>{text}</div>;
}

function SuccessBox({ text }) {
  return <div style={styles.successBox}>{text}</div>;
}

function ErrorBox({ text }) {
  return <div style={styles.errorBox}>{text}</div>;
}

function InfoBox({ text }) {
  return <div style={styles.infoBox}>{text}</div>;
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>{icon}</div>
      <div style={styles.emptyTitle}>{title}</div>
      {subtitle ? <div style={styles.emptySub}>{subtitle}</div> : null}
    </div>
  );
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
  toolbar: {
    display: "flex",
    gap: 12,
    marginBottom: 18,
    flexWrap: "wrap",
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
  helperText: {
    fontSize: "0.78rem",
    color: "#94a3b8",
    marginBottom: 14,
  },
  label: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "#526077",
    marginBottom: 6,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1.3fr 0.9fr",
    gap: 16,
    marginBottom: 14,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 14,
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "2.2fr 2fr 1.2fr",
    gap: 16,
    marginBottom: 16,
  },
  actionGrid4: {
    display: "grid",
    gridTemplateColumns: "2.4fr 1.1fr 1.2fr 1.3fr",
    gap: 12,
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
    flexWrap: "wrap",
    marginTop: 10,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: "#334155",
  },
  separator: {
    borderTop: "1px solid #e2e8f0",
    margin: "16px 0 12px",
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
    fontSize: "0.82rem",
    color: "#0d1b2a",
    padding: "0.7rem 0.9rem",
    borderBottom: "1px solid #f1f5fb",
    textAlign: "left",
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
    padding: "2rem",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    color: "#94a3b8",
  },
  emptyIcon: {
    fontSize: "2rem",
    marginBottom: 8,
  },
  emptyTitle: {
    fontWeight: 700,
    fontSize: "1rem",
    color: "#334155",
    marginBottom: 6,
  },
  emptySub: {
    fontSize: "0.85rem",
  },
};
