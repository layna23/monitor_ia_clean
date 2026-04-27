const API_BASE = "http://127.0.0.1:8000";

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function analyzeSinglePlan(payload) {
  const res = await fetch(`${API_BASE}/ai/analyze-sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(data?.detail || "Erreur analyse IA");
  }

  return data;
}

export async function analyzeMultiPhv(payload) {
  const res = await fetch(`${API_BASE}/ai/analyze-phv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(data?.detail || "Erreur analyse IA PHV");
  }

  return data;
}