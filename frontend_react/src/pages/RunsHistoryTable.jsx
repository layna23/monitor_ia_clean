import { useEffect, useMemo, useState } from "react";

export default function RunsHistoryTable({ dbRuns = [], formatDateTime }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const normalizedRuns = useMemo(() => {
    return dbRuns.map((r) => ({
      run_id: r.run_id ?? "-",
      metric_code: r.metric_code ?? "-",
      value: r.value ?? "-",
      status: r.status ?? "-",
      started_at: r.started_at ? formatDateTime(r.started_at) : "-",
    }));
  }, [dbRuns, formatDateTime]);

  const filteredRuns = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return normalizedRuns.filter((row) => {
      const matchesSearch =
        !term ||
        String(row.run_id).toLowerCase().includes(term) ||
        String(row.metric_code).toLowerCase().includes(term) ||
        String(row.value).toLowerCase().includes(term) ||
        String(row.status).toLowerCase().includes(term) ||
        String(row.started_at).toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "ALL" ||
        String(row.status).toUpperCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [normalizedRuns, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / rowsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRuns = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredRuns.slice(start, end);
  }, [filteredRuns, currentPage, rowsPerPage]);

  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxVisible = 5;

    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }

    return pages;
  }, [currentPage, totalPages]);

  if (!dbRuns.length) {
    return <div style={styles.infoBox}>Aucun run pour cette base.</div>;
  }

  return (
    <div>
      <div style={styles.toolbar}>
        <input
          type="text"
          placeholder="Rechercher par métrique, date, statut, run id..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={styles.select}
        >
          <option value="ALL">Tous les statuts</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILED">FAILED</option>
          <option value="NOT RUN">NOT RUN</option>
        </select>

        <select
          value={rowsPerPage}
          onChange={(e) => setRowsPerPage(Number(e.target.value))}
          style={styles.select}
        >
          <option value={5}>5 / page</option>
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
          <option value={30}>30 / page</option>
        </select>
      </div>

      <div style={styles.resultsInfo}>
        {filteredRuns.length} résultat{filteredRuns.length > 1 ? "s" : ""}
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>RUN_ID</th>
              <th style={styles.th}>METRIC_CODE</th>
              <th style={styles.th}>VALUE</th>
              <th style={styles.th}>STATUS</th>
              <th style={styles.th}>STARTED_AT</th>
            </tr>
          </thead>

          <tbody>
            {paginatedRuns.length ? (
              paginatedRuns.map((row, idx) => (
                <tr
                  key={`${row.run_id}-${idx}`}
                  style={idx % 2 === 0 ? styles.rowEven : styles.rowOdd}
                >
                  <td style={styles.td}>{String(row.run_id)}</td>
                  <td style={styles.td}>{String(row.metric_code)}</td>
                  <td style={styles.td}>{String(row.value)}</td>
                  <td style={styles.td}>
                    <StatusBadge status={row.status} />
                  </td>
                  <td style={styles.td}>{String(row.started_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={styles.emptyTd}>
                  Aucun résultat trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={styles.paginationWrap}>
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          style={{
            ...styles.pageButton,
            ...(currentPage === 1 ? styles.pageButtonDisabled : {}),
          }}
        >
          Précédent
        </button>

        {pageNumbers[0] > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              style={styles.pageButton}
            >
              1
            </button>
            {pageNumbers[0] > 2 ? <span style={styles.dots}>...</span> : null}
          </>
        ) : null}

        {pageNumbers.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => setCurrentPage(page)}
            style={{
              ...styles.pageButton,
              ...(currentPage === page ? styles.pageButtonActive : {}),
            }}
          >
            {page}
          </button>
        ))}

        {pageNumbers[pageNumbers.length - 1] < totalPages ? (
          <>
            {pageNumbers[pageNumbers.length - 1] < totalPages - 1 ? (
              <span style={styles.dots}>...</span>
            ) : null}
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              style={styles.pageButton}
            >
              {totalPages}
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          style={{
            ...styles.pageButton,
            ...(currentPage === totalPages ? styles.pageButtonDisabled : {}),
          }}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = String(status || "").toUpperCase();

  const conf = {
    SUCCESS: {
      background: "#f0fdf4",
      color: "#166534",
      borderColor: "#bbf7d0",
    },
    FAILED: {
      background: "#fff1f2",
      color: "#9f1239",
      borderColor: "#fecdd3",
    },
    "NOT RUN": {
      background: "#f8fafc",
      color: "#64748b",
      borderColor: "#e2e8f0",
    },
  };

  const style = conf[s] || {
    background: "#eff6ff",
    color: "#1d4ed8",
    borderColor: "#bfdbfe",
  };

  return (
    <span
      style={{
        ...styles.badge,
        background: style.background,
        color: style.color,
        borderColor: style.borderColor,
      }}
    >
      {s || "-"}
    </span>
  );
}

const styles = {
  toolbar: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 14,
  },
  searchInput: {
    flex: "1 1 320px",
    minWidth: 260,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
  },
  select: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 14,
    color: "#0f172a",
    minWidth: 150,
  },
  resultsInfo: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 600,
    marginBottom: 10,
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
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "#8fa0bb",
    padding: "10px 12px",
    borderBottom: "1px solid #e4e9f2",
    textAlign: "left",
  },
  td: {
    fontSize: 13,
    color: "#0d1b2a",
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5fb",
    textAlign: "left",
  },
  rowEven: {
    background: "#ffffff",
  },
  rowOdd: {
    background: "#fbfdff",
  },
  emptyTd: {
    padding: "18px 12px",
    textAlign: "center",
    color: "#64748b",
    fontWeight: 600,
    background: "#fff",
  },
  badge: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.06em",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid",
    display: "inline-block",
  },
  paginationWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  pageButton: {
    minWidth: 38,
    height: 38,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
  },
  pageButtonActive: {
    background: "#2563eb",
    color: "#fff",
    border: "1px solid #2563eb",
  },
  pageButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  dots: {
    color: "#64748b",
    fontWeight: 700,
    padding: "0 2px",
  },
  infoBox: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: "14px 16px",
    color: "#1d4ed8",
    fontWeight: 700,
  },
};