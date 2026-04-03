import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

export default function Utilisateurs() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [showCreate, setShowCreate] = useState(false);

  const [createForm, setCreateForm] = useState({
    email: "",
    full_name: "",
    password: "",
    is_active: true,
  });

  const [selectedEditId, setSelectedEditId] = useState("");
  const [editForm, setEditForm] = useState({
    user_id: "",
    email: "",
    full_name: "",
    password: "",
    is_active: true,
    created_at: "",
    last_login_at: "",
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

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await apiGet("/users/");
      const list = Array.isArray(data) ? data : [];
      setUsers(list);

      if (list.length > 0) {
        if (!selectedEditId) {
          const first = list[0];
          setSelectedEditId(String(first.user_id));
          fillEditForm(first);
        } else {
          const found = list.find((u) => String(u.user_id) === String(selectedEditId));
          if (found) fillEditForm(found);
        }

        if (!selectedDeleteId) {
          setSelectedDeleteId(String(list[0].user_id));
        } else {
          const exists = list.some((u) => String(u.user_id) === String(selectedDeleteId));
          if (!exists) setSelectedDeleteId(String(list[0].user_id));
        }
      }
    } catch {
      setMessage({ type: "error", text: "Impossible de charger les utilisateurs." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const selectedDeleteUser = useMemo(() => {
    return users.find((u) => String(u.user_id) === String(selectedDeleteId)) || null;
  }, [users, selectedDeleteId]);

  function formatDateTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function userLabel(u) {
    return `${u.email || "(sans email)"} · ${u.full_name || ""}`;
  }

  function fillEditForm(user) {
    setEditForm({
      user_id: user.user_id,
      email: user.email || "",
      full_name: user.full_name || "",
      password: "",
      is_active: Number(user.is_active ?? 1) === 1,
      created_at: user.created_at || "",
      last_login_at: user.last_login_at || "",
    });
  }

  function resetCreateForm() {
    setCreateForm({
      email: "",
      full_name: "",
      password: "",
      is_active: true,
    });
  }

  async function handleCreate() {
    setMessage({ type: "", text: "" });

    if (!createForm.email.trim()) {
      setMessage({ type: "warning", text: "Email obligatoire." });
      return;
    }
    if (!createForm.password.trim()) {
      setMessage({ type: "warning", text: "Mot de passe obligatoire." });
      return;
    }

    try {
      await apiPost("/users/", {
        email: createForm.email.trim(),
        full_name: createForm.full_name.trim(),
        password: createForm.password,
        is_active: createForm.is_active ? 1 : 0,
      });

      setMessage({ type: "success", text: "Utilisateur créé ✅" });
      setShowCreate(false);
      resetCreateForm();
      await loadUsers();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la création." });
    }
  }

  async function handleUpdate() {
    setMessage({ type: "", text: "" });

    if (!editForm.user_id) return;

    try {
      const payload = {
        email: editForm.email.trim(),
        full_name: editForm.full_name.trim(),
        is_active: editForm.is_active ? 1 : 0,
      };

      if (editForm.password.trim()) {
        payload.password = editForm.password;
      }

      await apiPut(`/users/${editForm.user_id}`, payload);
      setMessage({ type: "success", text: "Utilisateur mis à jour ✅" });
      await loadUsers();
      setEditForm((prev) => ({ ...prev, password: "" }));
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la mise à jour." });
    }
  }

  async function handleDelete() {
    setMessage({ type: "", text: "" });

    if (!selectedDeleteUser || !confirmDelete) return;

    try {
      await apiDelete(`/users/${selectedDeleteUser.user_id}`);
      setMessage({ type: "success", text: "Utilisateur supprimé ✅" });
      setConfirmDelete(false);
      await loadUsers();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression." });
    }
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Gestion des Utilisateurs"
        subtitle="Créer, modifier et supprimer les comptes utilisateurs"
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
          ➕ Nouvel utilisateur
        </button>
        <button style={styles.secondaryButton} onClick={loadUsers}>
          🔄 Rafraîchir
        </button>
      </div>

      {showCreate && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Créer un utilisateur</div>

            <div style={styles.formGrid2}>
              <div>
                <FieldLabel text="Email *" />
                <input
                  style={styles.input}
                  placeholder="user@entreprise.dz"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>

              <div>
                <FieldLabel text="Nom complet" />
                <input
                  style={styles.input}
                  placeholder="Ahmed Benali"
                  value={createForm.full_name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <FieldLabel text="Mot de passe *" />
              <input
                type="password"
                style={styles.input}
                placeholder="Min. 8 caractères"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, password: e.target.value }))
                }
              />
            </div>

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={createForm.is_active}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, is_active: e.target.checked }))
                }
              />
              Compte actif
            </label>

            <div style={styles.modalActions}>
              <button style={styles.secondaryButton} onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button style={styles.primaryButton} onClick={handleCreate}>
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      <SectionCard>
        <SectionTitle icon="👤" text="UTILISATEURS ENREGISTRÉS" />

        {loading ? (
          <InfoBox text="Chargement..." />
        ) : users.length === 0 ? (
          <EmptyState
            icon="👤"
            message="Aucun utilisateur trouvé. Créez votre premier compte avec le bouton ci-dessus."
          />
        ) : (
          <DataTable
            columns={["ID", "EMAIL", "NOM", "STATUT", "CRÉÉ LE", "DERNIÈRE CONNEXION"]}
            rows={users.map((u) => ({
              ID: u.user_id,
              EMAIL: u.email,
              NOM: u.full_name || "—",
              STATUT: Number(u.is_active || 0) === 1 ? "✅ Actif" : "⛔ Inactif",
              "CRÉÉ LE": formatDateTime(u.created_at),
              "DERNIÈRE CONNEXION": formatDateTime(u.last_login_at),
            }))}
          />
        )}
      </SectionCard>

      {users.length > 0 && (
        <>
          <div style={{ height: 18 }} />

          <div style={styles.twoCols}>
            <SectionCard>
              <SectionTitle icon="✏️" text="MODIFIER UN UTILISATEUR" />

              <select
                style={styles.select}
                value={selectedEditId}
                onChange={(e) => {
                  setSelectedEditId(e.target.value);
                  const found = users.find((u) => String(u.user_id) === String(e.target.value));
                  if (found) fillEditForm(found);
                }}
              >
                {users.map((u) => (
                  <option key={u.user_id} value={String(u.user_id)}>
                    {userLabel(u)}
                  </option>
                ))}
              </select>

              <div style={styles.caption}>
                Créé le : {formatDateTime(editForm.created_at)} · Dernière connexion :{" "}
                {formatDateTime(editForm.last_login_at)}
              </div>

              <div style={styles.formGrid2}>
                <div>
                  <FieldLabel text="Email" />
                  <input
                    style={styles.input}
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <FieldLabel text="Nom complet" />
                  <input
                    style={styles.input}
                    value={editForm.full_name}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, full_name: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <FieldLabel text="Nouveau mot de passe (optionnel)" />
                <input
                  type="password"
                  style={styles.input}
                  placeholder="Laisser vide si inchangé"
                  value={editForm.password}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                />
              </div>

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                />
                Compte actif
              </label>

              <div style={{ marginTop: 16 }}>
                <button style={styles.primaryButton} onClick={handleUpdate}>
                  Mettre à jour
                </button>
              </div>
            </SectionCard>

            <SectionCard>
              <SectionTitle icon="🗑️" text="SUPPRIMER UN UTILISATEUR" />

              <select
                style={styles.select}
                value={selectedDeleteId}
                onChange={(e) => setSelectedDeleteId(e.target.value)}
              >
                {users.map((u) => (
                  <option key={u.user_id} value={String(u.user_id)}>
                    {userLabel(u)}
                  </option>
                ))}
              </select>

              {selectedDeleteUser && (
                <div style={styles.dangerNote}>
                  ⚠️ Suppression définitive du compte <b>{selectedDeleteUser.email}</b>.
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
  formGrid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
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
  caption: {
    marginTop: 10,
    marginBottom: 14,
    fontSize: 12.5,
    color: "#64748b",
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
    maxWidth: 700,
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