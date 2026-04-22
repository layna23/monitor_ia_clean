import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

export default function DbTypes() {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [deleteItem, setDeleteItem] = useState(null);

  const emptyForm = {
    code: "",
    name: "",
    version: "",
    driver: "",
    status: "ACTIVE",
    description: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

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

  function resetForm() {
    setForm(emptyForm);
    setEditId(null);
  }

  function badgeStatus(status) {
    const s = String(status || "").toUpperCase();
    if (s === "ACTIVE") return <span style={styles.badgeSuccess}>ACTIVE</span>;
    if (s === "INACTIVE") return <span style={styles.badgeError}>INACTIVE</span>;
    if (s === "BETA") return <span style={styles.badgeWarning}>BETA</span>;
    return <span style={styles.badgeInfo}>{s || "—"}</span>;
  }

  function openEdit(item) {
    setDeleteItem(null);
    setEditId(item.db_type_id);
    setForm({
      code: item.code || "",
      name: item.name || "",
      version: item.version || "",
      driver: item.driver || "",
      status: String(item.status || "ACTIVE").toUpperCase(),
      description: item.description || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      setMessage({ type: "warning", text: "Code et Nom sont obligatoires." });
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      version: form.version.trim(),
      driver: form.driver.trim(),
      status: form.status,
      description: form.description.trim(),
    };

    try {
      if (editId) {
        await apiPut(`/db-types/${editId}`, payload);
        setMessage({ type: "success", text: "Type BD modifié ✅" });
      } else {
        await apiPost("/db-types/", payload);
        setMessage({ type: "success", text: "Type BD créé ✅" });
      }

      resetForm();
      await loadDbTypes();
    } catch {
      setMessage({
        type: "error",
        text: editId
          ? "Erreur lors de la modification."
          : "Erreur lors de la création.",
      });
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteItem) return;

    try {
      await apiDelete(`/db-types/${deleteItem.db_type_id}`);
      setMessage({ type: "success", text: "Type BD supprimé ✅" });

      if (editId === deleteItem.db_type_id) {
        resetForm();
      }

      setDeleteItem(null);
      await loadDbTypes();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression." });
    }
  }

  const filteredData = useMemo(() => {
    let result = Array.isArray(data) ? data : [];

    // Cacher les éléments supprimés logiquement / inactifs
    result = result.filter(
      (x) => String(x.status || "").toUpperCase() !== "INACTIVE"
    );

    if (!search.trim()) return result;

    const s = search.toLowerCase().trim();

    return result.filter(
      (x) =>
        String(x.code || "").toLowerCase().includes(s) ||
        String(x.name || "").toLowerCase().includes(s) ||
        String(x.driver || "").toLowerCase().includes(s) ||
        String(x.version || "").toLowerCase().includes(s)
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

      <div style={styles.topActions}>
        <input
          style={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔎 Rechercher Oracle, PostgreSQL, driver..."
        />

        <button style={styles.secondaryButton} onClick={loadDbTypes}>
           Rafraîchir
        </button>
      </div>

      <SectionCard>
        <SectionTitle text={editId ? " MODIFIER UN TYPE BD" : " AJOUTER UN TYPE BD"} />
        <div style={styles.helperText}>
          Le code doit être unique. Utilise cette section pour ajouter ou modifier un SGBD.
        </div>

        <div style={styles.formGrid}>
          <div>
            <FieldLabel text="Code *" />
            <input
              style={styles.input}
              value={form.code}
              placeholder="ex: ORACLE"
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            />
          </div>

          <div>
            <FieldLabel text="Nom *" />
            <input
              style={styles.input}
              value={form.name}
              placeholder="ex: Oracle Database"
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <FieldLabel text="Version" />
            <input
              style={styles.input}
              value={form.version}
              placeholder="ex: 19c"
              onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))}
            />
          </div>

          <div>
            <FieldLabel text="Driver" />
            <input
              style={styles.input}
              value={form.driver}
              placeholder="ex: oracledb"
              onChange={(e) => setForm((p) => ({ ...p, driver: e.target.value }))}
            />
          </div>

          <div>
            <FieldLabel text="Statut" />
            <select
              style={styles.select}
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="BETA">BETA</option>
            </select>
          </div>

          <div>
            <FieldLabel text="Aperçu statut" />
            <div style={styles.previewBox}>{badgeStatus(form.status)}</div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <FieldLabel text="Description" />
          <textarea
            style={styles.textarea}
            rows={5}
            value={form.description}
            placeholder="Description du SGBD..."
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        <div style={styles.buttonRow}>
          <button style={styles.primaryButton} onClick={handleSave}>
            {editId ? " Enregistrer" : " Créer"}
          </button>

          <button style={styles.secondaryButton} onClick={resetForm}>
            🧹 Réinitialiser
          </button>

          {editId ? (
            <button
              style={styles.dangerButton}
              onClick={() => {
                const current = data.find((x) => x.db_type_id === editId);
                if (current) setDeleteItem(current);
              }}
            >
               Supprimer
            </button>
          ) : null}
        </div>
      </SectionCard>

      <div style={{ height: 20 }} />

      <SectionCard>
        <SectionTitle text=" TABLE DB_TYPES" />

        {loading ? (
          <InfoBox text="Chargement..." />
        ) : !filteredData.length ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}></div>
            <div style={styles.emptyTitle}>Aucun type BD trouvé</div>
            <div style={styles.emptySub}>Vérifie la recherche ou ajoute un nouveau type.</div>
          </div>
        ) : (
          <DataTable
            columns={[
              "db_type_id",
              "code",
              "name",
              "version",
              "driver",
              "description",
              "status",
              "actions",
            ]}
            rows={filteredData.map((item) => ({
              ...item,
              actions: (
                <div style={styles.tableActions}>
                  <button
                    style={styles.tableEditButton}
                    onClick={() => openEdit(item)}
                  >
                    Modifier
                  </button>
                  <button
                    style={styles.tableDeleteButton}
                    onClick={() => setDeleteItem(item)}
                  >
                    Supprimer
                  </button>
                </div>
              ),
            }))}
            renderCell={(col, row) => {
              if (col === "status") return badgeStatus(row.status);
              if (col === "actions") return row.actions;
              return row[col] != null && row[col] !== "" ? String(row[col]) : "—";
            }}
          />
        )}
      </SectionCard>

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

function DataTable({ columns, rows, renderCell }) {
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
                  {renderCell ? renderCell(col, row) : row[col]}
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

  topActions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginBottom: 18,
    flexWrap: "wrap",
  },

  searchInput: {
    width: 360,
    maxWidth: "100%",
    padding: "0.85rem 0.95rem",
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
    padding: "0.85rem 1.1rem",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1.5px solid #e4e9f2",
    background: "#fff",
    color: "#0d1b2a",
    borderRadius: 12,
    padding: "0.85rem 1.1rem",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },

  dangerButton: {
    border: "1.5px solid #fecdd3",
    background: "#fff1f2",
    color: "#9f1239",
    borderRadius: 12,
    padding: "0.85rem 1.1rem",
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
    fontSize: "0.72rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#8fa0bb",
    paddingBottom: 10,
    borderBottom: "1px solid #e4e9f2",
    marginBottom: 14,
  },

  helperText: {
    fontSize: 14,
    color: "#7b8aa3",
    marginBottom: 18,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },

  label: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#526077",
    marginBottom: 8,
  },

  input: {
    width: "100%",
    padding: "0.9rem 1rem",
    borderRadius: 12,
    border: "1.5px solid #e4e9f2",
    background: "#fff",
    fontSize: 14,
    boxSizing: "border-box",
  },

  select: {
    width: "100%",
    padding: "0.9rem 1rem",
    borderRadius: 12,
    border: "1.5px solid #e4e9f2",
    background: "#fff",
    fontSize: 14,
    boxSizing: "border-box",
  },

  textarea: {
    width: "100%",
    padding: "1rem",
    borderRadius: 12,
    border: "1.5px solid #e4e9f2",
    background: "#fff",
    fontSize: 14,
    lineHeight: 1.6,
    boxSizing: "border-box",
    resize: "vertical",
  },

  previewBox: {
    minHeight: 48,
    display: "flex",
    alignItems: "center",
    padding: "0.7rem 0.9rem",
    borderRadius: 12,
    border: "1.5px solid #e4e9f2",
    background: "#fff",
    boxSizing: "border-box",
  },

  buttonRow: {
    display: "flex",
    gap: 12,
    marginTop: 18,
    flexWrap: "wrap",
  },

  badgeSuccess: {
    background: "#f0fdf4",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 999,
    padding: "0.25rem 0.75rem",
    fontSize: "0.72rem",
    fontWeight: 700,
    display: "inline-block",
  },

  badgeError: {
    background: "#fff1f2",
    color: "#9f1239",
    border: "1px solid #fecdd3",
    borderRadius: 999,
    padding: "0.25rem 0.75rem",
    fontSize: "0.72rem",
    fontWeight: 700,
    display: "inline-block",
  },

  badgeWarning: {
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
    borderRadius: 999,
    padding: "0.25rem 0.75rem",
    fontSize: "0.72rem",
    fontWeight: 700,
    display: "inline-block",
  },

  badgeInfo: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: 999,
    padding: "0.25rem 0.75rem",
    fontSize: "0.72rem",
    fontWeight: 700,
    display: "inline-block",
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
    maxWidth: 560,
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
    padding: "0.95rem",
    marginBottom: "1rem",
    fontSize: "0.9rem",
    color: "#9f1239",
    lineHeight: 1.5,
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
    padding: "0.8rem 0.9rem",
    borderBottom: "1px solid #e4e9f2",
    textAlign: "left",
    whiteSpace: "nowrap",
  },

  td: {
    fontSize: "0.84rem",
    color: "#0d1b2a",
    padding: "0.8rem 0.9rem",
    borderBottom: "1px solid #f1f5fb",
    textAlign: "left",
    verticalAlign: "middle",
  },

  rowEven: {
    background: "#ffffff",
  },

  rowOdd: {
    background: "#fbfdff",
  },

  tableActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  tableEditButton: {
    border: "1px solid #dbe5f3",
    background: "#fff",
    color: "#0d1b2a",
    borderRadius: 10,
    padding: "0.45rem 0.75rem",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },

  tableDeleteButton: {
    border: "1px solid #fecdd3",
    background: "#fff1f2",
    color: "#9f1239",
    borderRadius: 10,
    padding: "0.45rem 0.75rem",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
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