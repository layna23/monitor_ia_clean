import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

export default function DbTypes() {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [openCreate, setOpenCreate] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const [createForm, setCreateForm] = useState({
    code: "",
    name: "",
    version: "",
    driver: "",
    status: "ACTIVE",
    description: "",
  });

  const [editForm, setEditForm] = useState({
    code: "",
    name: "",
    version: "",
    driver: "",
    status: "ACTIVE",
    description: "",
  });

  async function apiGet(endpoint, defaultValue = null) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`);
      if (!res.ok) throw new Error("GET error");
      const result = await res.json();
      return result ?? defaultValue;
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

  async function loadDbTypes() {
    try {
      setLoading(true);
      const result = await apiGet("/db-types/", []);
      setData(Array.isArray(result) ? result : []);
    } catch {
      setMessage({ type: "error", text: "Erreur lors du chargement des types BD." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDbTypes();
  }, []);

  useEffect(() => {
    if (!message.text) return;
    const timer = setTimeout(() => {
      setMessage({ type: "", text: "" });
    }, 3000);
    return () => clearTimeout(timer);
  }, [message]);

  function badgeStatus(status) {
    const s = String(status || "").toUpperCase();
    if (s === "ACTIVE") return <span style={styles.badgeSuccess}>ACTIF</span>;
    if (s === "INACTIVE") return <span style={styles.badgeError}>INACTIF</span>;
    if (s === "BETA") return <span style={styles.badgeWarning}>BETA</span>;
    return <span style={styles.badgeInfo}>{s || "—"}</span>;
  }

  function resetCreateForm() {
    setCreateForm({
      code: "",
      name: "",
      version: "",
      driver: "",
      status: "ACTIVE",
      description: "",
    });
  }

  function openEditDialog(item) {
    setEditItem(item);
    setDeleteItem(null);
    setOpenCreate(false);
    setEditForm({
      code: item.code || "",
      name: item.name || "",
      version: item.version || "",
      driver: item.driver || "",
      status: (item.status || "ACTIVE").toUpperCase(),
      description: item.description || "",
    });
  }

  async function handleCreate() {
    if (!createForm.code.trim() || !createForm.name.trim()) {
      setMessage({ type: "warning", text: "Code et Nom sont obligatoires." });
      return;
    }

    try {
      await apiPost("/db-types/", {
        code: createForm.code.trim().toUpperCase(),
        name: createForm.name.trim(),
        version: createForm.version.trim(),
        driver: createForm.driver.trim(),
        status: createForm.status,
        description: createForm.description.trim(),
      });

      setMessage({ type: "success", text: "Type BD créé ✅" });
      setOpenCreate(false);
      resetCreateForm();
      await loadDbTypes();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la création." });
    }
  }

  async function handleEditSave() {
    if (!editItem) return;

    try {
      await apiPut(`/db-types/${editItem.db_type_id}`, {
        code: editForm.code.trim().toUpperCase(),
        name: editForm.name.trim(),
        version: editForm.version.trim(),
        driver: editForm.driver.trim(),
        status: editForm.status,
        description: editForm.description.trim(),
      });

      setMessage({ type: "success", text: "Modifié ✅" });
      setEditItem(null);
      await loadDbTypes();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la modification." });
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteItem) return;

    try {
      await apiDelete(`/db-types/${deleteItem.db_type_id}`);
      setMessage({ type: "success", text: "Supprimé ✅" });
      setDeleteItem(null);
      await loadDbTypes();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression." });
    }
  }

  const filteredData = useMemo(() => {
    let result = Array.isArray(data) ? data : [];

    // cacher les éléments supprimés / inactifs
    result = result.filter(
      (x) => String(x.status || "").toUpperCase() !== "INACTIVE"
    );

    if (!search.trim()) return result;

    const s = search.toLowerCase().trim();

    return result.filter(
      (x) =>
        String(x.code || "").toLowerCase().includes(s) ||
        String(x.name || "").toLowerCase().includes(s) ||
        String(x.driver || "").toLowerCase().includes(s)
    );
  }, [data, search]);

  return (
    <div style={styles.page}>
      <PageHeader
        title="Types de Base de Données"
        subtitle="Référentiel des SGBD supportés par le monitoring"
      />

      {message.text ? (
        <div style={{ marginBottom: 16 }}>
          {message.type === "success" && <SuccessBox text={message.text} />}
          {message.type === "error" && <ErrorBox text={message.text} />}
          {message.type === "warning" && <WarningBox text={message.text} />}
        </div>
      ) : null}

      <div style={styles.toolbar}>
        <input
          style={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔎 Rechercher Oracle, postgresql…"
        />

        <button
          style={styles.primaryButton}
          onClick={() => {
            setOpenCreate(true);
            setEditItem(null);
            setDeleteItem(null);
          }}
        >
          ➕ Nouveau type BD
        </button>
      </div>

      {openCreate && (
        <Modal
          title="Créer un type BD"
          onClose={() => {
            setOpenCreate(false);
            resetCreateForm();
          }}
        >
          <div style={styles.grid2}>
            <div>
              <FieldLabel text="Code *" />
              <input
                style={styles.input}
                value={createForm.code}
                placeholder="ORACLE"
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, code: e.target.value }))
                }
              />
            </div>

            <div>
              <FieldLabel text="Nom *" />
              <input
                style={styles.input}
                value={createForm.name}
                placeholder="Oracle Database"
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>

            <div>
              <FieldLabel text="Version" />
              <input
                style={styles.input}
                value={createForm.version}
                placeholder="19c"
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, version: e.target.value }))
                }
              />
            </div>

            <div>
              <FieldLabel text="Driver" />
              <input
                style={styles.input}
                value={createForm.driver}
                placeholder="cx_Oracle"
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, driver: e.target.value }))
                }
              />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <FieldLabel text="Statut" />
            <select
              style={styles.select}
              value={createForm.status}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, status: e.target.value }))
              }
            >
              <option>ACTIVE</option>
              <option>INACTIVE</option>
              <option>BETA</option>
            </select>
          </div>

          <div style={{ marginTop: 14 }}>
            <FieldLabel text="Description" />
            <textarea
              style={styles.textarea}
              rows={4}
              value={createForm.description}
              placeholder="Description du SGBD…"
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, description: e.target.value }))
              }
            />
          </div>

          <div style={styles.buttonRow}>
            <button
              style={styles.secondaryButton}
              onClick={() => {
                setOpenCreate(false);
                resetCreateForm();
              }}
            >
              Annuler
            </button>
            <button style={styles.primaryButton} onClick={handleCreate}>
              Créer
            </button>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal title="Modifier le type BD" onClose={() => setEditItem(null)}>
          <div style={styles.grid2}>
            <div>
              <FieldLabel text="Code" />
              <input
                style={styles.input}
                value={editForm.code}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, code: e.target.value }))
                }
              />
            </div>

            <div>
              <FieldLabel text="Nom" />
              <input
                style={styles.input}
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>

            <div>
              <FieldLabel text="Version" />
              <input
                style={styles.input}
                value={editForm.version}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, version: e.target.value }))
                }
              />
            </div>

            <div>
              <FieldLabel text="Driver" />
              <input
                style={styles.input}
                value={editForm.driver}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, driver: e.target.value }))
                }
              />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <FieldLabel text="Statut" />
            <select
              style={styles.select}
              value={editForm.status}
              onChange={(e) =>
                setEditForm((p) => ({ ...p, status: e.target.value }))
              }
            >
              <option>ACTIVE</option>
              <option>INACTIVE</option>
              <option>BETA</option>
            </select>
          </div>

          <div style={{ marginTop: 14 }}>
            <FieldLabel text="Description" />
            <textarea
              style={styles.textarea}
              rows={4}
              value={editForm.description}
              onChange={(e) =>
                setEditForm((p) => ({ ...p, description: e.target.value }))
              }
            />
          </div>

          <div style={styles.buttonRow}>
            <button style={styles.secondaryButton} onClick={() => setEditItem(null)}>
              Annuler
            </button>
            <button style={styles.primaryButton} onClick={handleEditSave}>
              Enregistrer
            </button>
          </div>
        </Modal>
      )}

      {deleteItem && (
        <Modal title="Supprimer le type BD" onClose={() => setDeleteItem(null)}>
          <div style={styles.deleteBox}>
            ⚠️ Vous allez supprimer <b>{deleteItem.name}</b> (ID {deleteItem.db_type_id}).
            Cette action est <b>irréversible</b>.
          </div>

          <div style={styles.buttonRow}>
            <button style={styles.secondaryButton} onClick={() => setDeleteItem(null)}>
              Annuler
            </button>
            <button style={styles.dangerButton} onClick={handleDeleteConfirm}>
              Supprimer
            </button>
          </div>
        </Modal>
      )}

      <div style={styles.sectionTitleTop}>🧩 SGBD SUPPORTÉS</div>

      {loading ? (
        <InfoBox text="Chargement..." />
      ) : !filteredData.length ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🧩</div>
          <div style={styles.emptyTitle}>Aucun type BD trouvé</div>
        </div>
      ) : (
        <div style={styles.cardsGrid}>
          {filteredData.map((item) => (
            <div key={item.db_type_id} style={styles.card}>
              <div style={styles.dbTypeHeader}>
                <div>
                  <div style={styles.dbTypeTitle}>{item.name || ""}</div>
                  <div style={styles.dbTypeSub}>
                    Code : {item.code || ""} · ID : {item.db_type_id || ""}
                  </div>
                </div>
                {badgeStatus(item.status)}
              </div>

              <div style={styles.dbTypeGrid}>
                <div style={styles.dbTypeBox}>
                  <div style={styles.dbTypeLabel}>VERSION</div>
                  <div style={styles.dbTypeValue}>{item.version || "—"}</div>
                </div>

                <div style={styles.dbTypeBox}>
                  <div style={styles.dbTypeLabel}>DRIVER</div>
                  <div style={styles.dbTypeValue}>{item.driver || "—"}</div>
                </div>
              </div>

              <div style={styles.dbTypeDesc}>
                {item.description || "Aucune description"}
              </div>

              <div style={styles.buttonRow}>
                <button
                  style={styles.secondaryButton}
                  onClick={() => openEditDialog(item)}
                >
                  ✏️ Modifier
                </button>

                <button
                  style={styles.dangerButton}
                  onClick={() => {
                    setDeleteItem(item);
                    setEditItem(null);
                    setOpenCreate(false);
                  }}
                >
                  🗑️ Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 20 }} />

      <SectionCard>
        <SectionTitle text="📋 TABLE DB_TYPES" />
        {!filteredData.length ? (
          <InfoBox text="Aucune donnée." />
        ) : (
          <DataTable
            columns={["db_type_id", "code", "name", "version", "driver", "description", "status"]}
            rows={filteredData.map((item) => ({
              db_type_id: item.db_type_id,
              code: item.code,
              name: item.name,
              version: item.version,
              driver: item.driver,
              description: item.description,
              status: item.status,
            }))}
          />
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

function Modal({ title, children, onClose }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalTitle}>{title}</div>
        {children}
        <button style={styles.modalClose} onClick={onClose}>
          ×
        </button>
      </div>
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
  toolbar: {
    display: "grid",
    gridTemplateColumns: "2.5fr 1.5fr 6fr",
    gap: 12,
    alignItems: "center",
    marginBottom: 18,
  },
  searchInput: {
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
  sectionTitleTop: {
    fontSize: "0.67rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#8fa0bb",
    marginBottom: 12,
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
  },
  dbTypeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  dbTypeTitle: {
    fontSize: "1rem",
    fontWeight: 700,
    color: "#0d1b2a",
    marginBottom: 4,
  },
  dbTypeSub: {
    fontSize: "0.78rem",
    color: "#64748b",
  },
  dbTypeGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 14,
  },
  dbTypeBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "0.8rem 0.9rem",
  },
  dbTypeLabel: {
    fontSize: "0.62rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#94a3b8",
    marginBottom: 6,
  },
  dbTypeValue: {
    fontSize: "0.9rem",
    fontWeight: 700,
    color: "#0d1b2a",
  },
  dbTypeDesc: {
    fontSize: "0.84rem",
    lineHeight: 1.55,
    color: "#526077",
    minHeight: 56,
    marginBottom: 14,
  },
  label: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "#526077",
    marginBottom: 6,
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
    fontSize: 14,
    lineHeight: 1.6,
    boxSizing: "border-box",
    resize: "vertical",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    marginTop: 16,
    flexWrap: "wrap",
  },
  badgeSuccess: {
    background: "#f0fdf4",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 999,
    padding: "0.2rem 0.7rem",
    fontSize: "0.72rem",
    fontWeight: 700,
  },
  badgeError: {
    background: "#fff1f2",
    color: "#9f1239",
    border: "1px solid #fecdd3",
    borderRadius: 999,
    padding: "0.2rem 0.7rem",
    fontSize: "0.72rem",
    fontWeight: 700,
  },
  badgeWarning: {
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
    borderRadius: 999,
    padding: "0.2rem 0.7rem",
    fontSize: "0.72rem",
    fontWeight: 700,
  },
  badgeInfo: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: 999,
    padding: "0.2rem 0.7rem",
    fontSize: "0.72rem",
    fontWeight: 700,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 700,
    background: "#fff",
    borderRadius: 18,
    border: "1px solid #e4e9f2",
    boxShadow: "0 20px 60px rgba(15,23,42,0.18)",
    padding: 22,
    position: "relative",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0d1b2a",
    marginBottom: 16,
  },
  modalClose: {
    position: "absolute",
    top: 12,
    right: 14,
    border: "none",
    background: "transparent",
    fontSize: 24,
    cursor: "pointer",
    color: "#64748b",
  },
  deleteBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: 10,
    padding: "0.9rem",
    marginBottom: "1rem",
    fontSize: "0.875rem",
    color: "#9f1239",
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
    padding: "3rem",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
  },
  emptyIcon: {
    fontSize: "2rem",
    marginBottom: 8,
  },
  emptyTitle: {
    fontWeight: 600,
    color: "#64748b",
  },
  emptySub: {
    fontSize: "0.85rem",
    color: "#94a3b8",
    marginTop: 4,
  },
};