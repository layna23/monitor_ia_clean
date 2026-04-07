import { SectionCard, MetricBox } from "./DashboardCommon";

export default function DashboardSummary({ summaryCards }) {
  return (
    <>
      <div style={styles.title}>Résumé des métriques</div>

      <SectionCard>
        <div style={styles.grid}>
          {summaryCards.map((card) => (
            <MetricBox
              key={card.label}
              label={card.label}
              value={card.value}
            />
          ))}
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