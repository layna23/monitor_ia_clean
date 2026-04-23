import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [showCreate, setShowCreate] = useState(false);

  const [createForm, setCreateForm] = useState({
    role_code: "",
    role_name: "",
  });

  const [selectedEditId, setSelectedEditId] = useState("");
  const [editForm, setEditForm] = useState({
    role_id: "",
    role_code: "",
    role_name: "",
  });

  const [selectedDeleteId, setSelectedDeleteId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function apiGet(url) {
    const res = await fetch(API_BASE + url);
    if (!res.ok) throw new Error("GET error");
    return res.json();
  }

  async function apiPost(url, data) {
    const res = await fetch(API_BASE + url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("POST error");
    return res.json();
  }

  async function apiPut(url, data) {
    const res = await fetch(API_BASE + url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("PUT error");
    return res.json();
  }

  async function apiDelete(url) {
    const res = await fetch(API_BASE + url, { method: "DELETE" });
    if (!res.ok) throw new Error("DELETE error");
    return true;
  }

  async function loadRoles() {
    try {
      setLoading(true);
      const data = await apiGet("/roles/");
      const list = Array.isArray(data) ? data : [];
      setRoles(list);

      if (list.length > 0) {
        if (!selectedEditId) {
          const first = list[0];
          setSelectedEditId(String(first.role_id));
          fillEditForm(first);
        } else {
          const found = list.find((r) => String(r.role_id) === String(selectedEditId));
          if (found) fillEditForm(found);
        }

        if (!selectedDeleteId) {
          setSelectedDeleteId(String(list[0].role_id));
        } else {
          const exists = list.some((r) => String(r.role_id) === String(selectedDeleteId));
          if (!exists) setSelectedDeleteId(String(list[0].role_id));
        }
      }
    } catch {
      setMessage({ type: "error", text: "Impossible de charger les rôles." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoles();
  }, []);

  const selectedDeleteRole = useMemo(() => {
    return roles.find((r) => String(r.role_id) === String(selectedDeleteId)) || null;
  }, [roles, selectedDeleteId]);

  function roleLabel(role) {
    return `${role.role_code || "—"} · ${role.role_name || ""}`;
  }

  function fillEditForm(role) {
    setEditForm({
      role_id: role.role_id,
      role_code: role.role_code || "",
      role_name: role.role_name || "",
    });
  }

  function resetCreateForm() {
    setCreateForm({
      role_code: "",
      role_name: "",
    });
  }

  async function handleCreate() {
    setMessage({ type: "", text: "" });

    const rc = createForm.role_code.trim().toUpperCase();
    const rn = createForm.role_name.trim();

    if (!rc || !rn) {
      setMessage({ type: "warning", text: "Tous les champs sont obligatoires." });
      return;
    }

    try {
      await apiPost("/roles/", {
        role_code: rc,
        role_name: rn,
      });

      setMessage({ type: "success", text: "Rôle créé " });
      setShowCreate(false);
      resetCreateForm();
      await loadRoles();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la création du rôle." });
    }
  }

  async function handleUpdate() {
    setMessage({ type: "", text: "" });

    if (!editForm.role_id) return;

    const rc = editForm.role_code.trim().toUpperCase();
    const rn = editForm.role_name.trim();

    if (!rc || !rn) {
      setMessage({ type: "warning", text: "Tous les champs sont obligatoires." });
      return;
    }

    try {
      await apiPut(`/roles/${editForm.role_id}`, {
        role_code: rc,
        role_name: rn,
      });

      setMessage({ type: "success", text: "Rôle mis à jour " });
      await loadRoles();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la mise à jour." });
    }
  }

  async function handleDelete() {
    setMessage({ type: "", text: "" });

    if (!selectedDeleteRole || !confirmDelete) return;

    try {
      await apiDelete(`/roles/${selectedDeleteRole.role_id}`);
      setMessage({ type: "success", text: "Rôle supprimé " });
      setConfirmDelete(false);
      await loadRoles();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression." });
    }
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Gestion des Rôles"
        subtitle="Créer, modifier et supprimer les rôles système"
      />

      {message.text ? (
        <div style={{ marginBottom: 16 }}>
          {message.type === "success" && <SuccessBox text={message.text} />}
          {message.type === "error" && <ErrorBox text={message.text} />}
          {message.type === "warning" && <WarningBox text={message.text} />}
        </div>
      ) : null}

      <div style={styles.toolbar}>
        <button style={styles.primaryButton} onClick={() => setShowCreate(true)}>
           Nouveau rôle
        </button>
        <button style={styles.secondaryButton} onClick={loadRoles}>
           Rafraîchir
        </button>
      </div>

      {showCreate && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Créer un rôle</div>

            <div style={styles.helperText}>
              Le <b>code</b> est utilisé en interne, par exemple <code>DB_ADMIN</code>.
            </div>

            <div style={{ marginTop: 14 }}>
              <FieldLabel text="Code du rôle *" />
              <input
                style={styles.input}
                placeholder="ex: DB_ADMIN"
                value={createForm.role_code}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, role_code: e.target.value }))
                }
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <FieldLabel text="Nom affiché *" />
              <input
                style={styles.input}
                placeholder="ex: Administrateur Base"
                value={createForm.role_name}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, role_name: e.target.value }))
                }
              />
            </div>

            <div style={styles.modalActions}>
              <button style={styles.secondaryButton} onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button style={styles.primaryButton} onClick={handleCreate}>
                Créer le rôle
              </button>
            </div>
          </div>
        </div>
      )}

      <SectionCard>
        <SectionTitle icon="" text="RÔLES CONFIGURÉS" />

        {loading ? (
          <InfoBox text="Chargement..." />
        ) : roles.length === 0 ? (
          <EmptyState
            icon="👥"
            message="Aucun rôle trouvé. Créez votre premier rôle avec le bouton ci-dessus."
          />
        ) : (
          <DataTable
            columns={["ID", "CODE", "NOM"]}
            rows={roles.map((r) => ({
              ID: r.role_id,
              CODE: r.role_code || "—",
              NOM: r.role_name || "—",
            }))}
          />
        )}
      </SectionCard>

      {roles.length > 0 && (
        <>
          <div style={{ height: 18 }} />

          <div style={styles.twoCols}>
            <SectionCard>
              <SectionTitle icon="" text="MODIFIER UN RÔLE" />

              <select
                style={styles.select}
                value={selectedEditId}
                onChange={(e) => {
                  setSelectedEditId(e.target.value);
                  const found = roles.find((r) => String(r.role_id) === String(e.target.value));
                  if (found) fillEditForm(found);
                }}
              >
                {roles.map((r) => (
                  <option key={r.role_id} value={String(r.role_id)}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>

              <div style={{ marginTop: 14 }}>
                <FieldLabel text="Nouveau code" />
                <input
                  style={styles.input}
                  value={editForm.role_code}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, role_code: e.target.value }))
                  }
                />
              </div>

              <div style={{ marginTop: 14 }}>
                <FieldLabel text="Nouveau nom" />
                <input
                  style={styles.input}
                  value={editForm.role_name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, role_name: e.target.value }))
                  }
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <button style={styles.primaryButton} onClick={handleUpdate}>
                  Mettre à jour
                </button>
              </div>
            </SectionCard>

            <SectionCard>
              <SectionTitle icon="" text="SUPPRIMER UN RÔLE" />

              <select
                style={styles.select}
                value={selectedDeleteId}
                onChange={(e) => setSelectedDeleteId(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r.role_id} value={String(r.role_id)}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>

              {selectedDeleteRole && (
                <div style={styles.dangerNote}>
                   Action irréversible — rôle <b>{selectedDeleteRole.role_code}</b> supprimé
                  définitivement.
                </div>
              )}

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={confirmDelete}
                  onChange={(e) => setConfirmDelete(e.target.checked)}
                />
                Je confirme la suppression
              </label>

              <div style={{ marginTop: 16 }}>
                <button
                  style={{
                    ...styles.dangerButton,
                    opacity: confirmDelete ? 1 : 0.6,
                    cursor: confirmDelete ? "pointer" : "not-allowed",
                  }}
                  disabled={!confirmDelete}
                  onClick={handleDelete}
                >
                  Supprimer
                </button>
              </div>
            </SectionCard>
          </div>
        </>
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

function EmptyState({ icon, message }) {
  return (
    <div style={styles.emptyState}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      {message}
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
  toolbar: {
    display: "flex",
    gap: 12,
    marginBottom: 18,
    flexWrap: "wrap",
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
  twoCols: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1fr",
    gap: 18,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    fontSize: 14,
    color: "#334155",
  },
  helperText: {
    fontSize: 13,
    color: "#64748b",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "0.8rem 0.9rem",
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
  },
  dangerNote: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: 12,
    padding: "0.85rem 1rem",
    marginTop: 14,
    color: "#9f1239",
    fontSize: 13,
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
    padding: "3rem",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    color: "#94a3b8",
    fontSize: 14,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 650,
    background: "#fff",
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 60px rgba(15,23,42,0.18)",
    padding: 22,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 16,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 18,
  },
};