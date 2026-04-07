import { useState } from "react";

export function SectionCard({ children }) {
  return <div style={styles.card}>{children}</div>;
}

export function FieldLabel({ text }) {
  return <div style={styles.fieldLabel}>{text}</div>;
}

export function MetricBox({ label, value }) {
  return (
    <div style={styles.metricBox}>
      <div style={styles.metricBoxLabel}>{label}</div>
      <div style={styles.metricBoxValue}>{String(value ?? "-")}</div>
    </div>
  );
}

export function ErrorBox({ text }) {
  return <div style={styles.errorBox}>{text}</div>;
}

export function InfoBox({ text }) {
  return <div style={styles.infoBox}>{text}</div>;
}

export function CollapsibleTable({ title, defaultOpen = false, children, count }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={styles.collapsibleWrap}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={styles.collapsibleButton}
      >
        <span>
          {open ? "▼" : "▶"} {title}
          {count !== undefined ? ` (${count})` : ""}
        </span>
        <span style={styles.collapsibleHint}>{open ? "Fermer" : "Ouvrir"}</span>
      </button>

      {open ? <div style={styles.collapsibleContent}>{children}</div> : null}
    </div>
  );
}

const styles = {
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 8,
  },
  metricBox: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 14,
  },
  metricBoxLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 700,
    marginBottom: 6,
  },
  metricBoxValue: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
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
  collapsibleWrap: {
    border: "1px solid #dbe4f0",
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
  },
  collapsibleButton: {
    width: "100%",
    border: "none",
    background: "#f8fafc",
    padding: "0.9rem 1rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    cursor: "pointer",
    textAlign: "left",
  },
  collapsibleHint: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
  },
  collapsibleContent: {
    padding: 0,
    background: "#fff",
  },
};