import { useState } from "react";
import axios from "axios";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post("http://127.0.0.1:8000/auth/login", {
        email: email,
        password: password,
      });

      console.log("Login success:", res.data);

      if (res.data.access_token) {
        localStorage.setItem("token", res.data.access_token);
      }

      onLogin();

    } catch (err) {
      console.error(err);
      setError("Email ou mot de passe incorrect");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.left}>
        <div style={styles.leftContent}>
          <div style={styles.leftBadge}>Monitoring IA</div>
          <h1 style={styles.leftTitle}>DB Monitor</h1>
          <p style={styles.leftSub}>
            Surveillance intelligente de vos bases de données en temps réel.
          </p>
          <div style={styles.features}>
            <FeatureItem text="Collecte automatique des métriques" />
            <FeatureItem text="Alertes critiques en temps réel" />
            <FeatureItem text="Analyse SQL assistée par IA" />
            <FeatureItem text="Dashboard de performance avancé" />
          </div>
        </div>
      </div>

      <div style={styles.right}>
        <div style={styles.card}>
          <div style={styles.logoRow}>
            <div style={styles.logoBadge}>DB</div>
            <div>
              <div style={styles.logoTitle}>DB Monitor</div>
              <div style={styles.logoSub}>Monitoring IA</div>
            </div>
          </div>

          <div style={styles.divider} />

          <div style={styles.formTitle}>Connexion</div>
          <div style={styles.formSub}>Accédez à votre espace de monitoring</div>

          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Adresse email</label>
              <input
                type="email"
                placeholder="admin@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Mot de passe</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
            </div>

            {error && <div style={styles.errorBox}>⚠️ {error}</div>}

            <button type="submit" style={styles.button}>
              Se connecter
            </button>
          </form>

          <div style={styles.footer}>
            <span style={styles.footerDot} />
            Système sécurisé — accès restreint
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ text }) {
  return (
    <div style={styles.featureItem}>
      <div style={styles.featureCheck}>✓</div>
      <span>{text}</span>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
  },
  left: {
    flex: 1,
    background: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 56px",
  },
  leftContent: {
    maxWidth: 420,
  },
  leftBadge: {
    display: "inline-block",
    background: "rgba(37,99,235,0.25)",
    color: "#93c5fd",
    border: "1px solid rgba(37,99,235,0.4)",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 14px",
    marginBottom: 20,
    letterSpacing: "0.05em",
  },
  leftTitle: {
    margin: "0 0 14px",
    fontSize: 42,
    fontWeight: 900,
    color: "#ffffff",
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
  },
  leftSub: {
    margin: "0 0 32px",
    fontSize: 16,
    color: "#94a3b8",
    lineHeight: 1.6,
  },
  features: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 14,
    color: "#cbd5e1",
  },
  featureCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    background: "rgba(37,99,235,0.2)",
    border: "1px solid rgba(37,99,235,0.4)",
    color: "#60a5fa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  right: {
    width: 580,
    background: "#f6f8fc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 48px",
    boxSizing: "border-box",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: "40px 48px",
    width: "100%",
    boxShadow: "0 4px 24px rgba(15,23,42,0.08)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: "#2563eb",
    color: "#fff",
    fontSize: 13,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    letterSpacing: "-0.02em",
  },
  logoTitle: {
    fontSize: 17,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  logoSub: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 600,
    marginTop: 1,
  },
  divider: {
    borderTop: "1px solid #e2e8f0",
    marginBottom: 22,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.02em",
    marginBottom: 4,
  },
  formSub: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 24,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
  },
  input: {
    padding: "0.85rem 1rem",
    borderRadius: 12,
    border: "1.5px solid #e2e8f0",
    background: "#f8fafc",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#9f1239",
    fontSize: 13,
    fontWeight: 700,
  },
  button: {
    padding: "0.9rem",
    borderRadius: 12,
    background: "#2563eb",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 800,
    width: "100%",
    marginTop: 4,
    letterSpacing: "-0.01em",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    fontSize: 12,
    color: "#94a3b8",
    justifyContent: "center",
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#22c55e",
    display: "inline-block",
    flexShrink: 0,
  },
};