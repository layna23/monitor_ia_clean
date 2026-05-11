import { useState } from "react";
import BarreLaterale from "./BarreLaterale";

export default function MiseEnPage({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={styles.wrapper}>
      <BarreLaterale
        collapsed={collapsed}
        onToggle={() => setCollapsed((prev) => !prev)}
      />

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
    background: "#f3f6fb",
  },
};