import BarreLaterale from "./BarreLaterale";

export default function MiseEnPage({ children }) {
  return (
    <div style={styles.wrapper}>
      <BarreLaterale />
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    minHeight: "100vh",
    background: "#f8fafc",
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
};