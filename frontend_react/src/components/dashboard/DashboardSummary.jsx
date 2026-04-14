import { SectionCard, MetricBox } from "./DashboardCommon";

export default function DashboardSummary({ summaryCards }) {
  // 🔥 Chercher la métrique SESSION_COUNT
  const sessionMetric = summaryCards.find(
    (card) =>
      card.metric_code === "SESSION_COUNT" ||
      card.label?.toLowerCase().includes("session")
  );

  return (
    <>
      <div style={styles.title}>Résumé des métriques</div>

      <SectionCard>
        <div style={styles.grid}>
          {/* 🔹 Cartes existantes */}
          {summaryCards.map((card) => (
            <MetricBox
              key={card.label}
              label={card.label}
              value={card.value}
            />
          ))}

          {/* 🔥 Nouvelle carte ajoutée */}
          <MetricBox
            label="SESSIONS OUVERTES"
            value={sessionMetric?.value ?? "-"}
          />
        </div>
      </SectionCard>
    </>
  );
}

const styles = {
  title: {
    fontSize: "1.4rem",
    fontWeight: 800,
    margin: "20px 0 10px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: 12,
  },
};