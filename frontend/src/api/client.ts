/*
ORIGINAL
//
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

export async function fetchJson(path: string, init?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers||{}) },
    ...init,
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}
//
*/

/* ========== NEW ========== */
export const BASE =
  import.meta.env.VITE_API_URL || "http://localhost:8000";
  
// JSON helper (kept from your version, with token support)
export async function fetchJson(path: string, init?: RequestInit) {
  let token: string | null = null;
  try {
    token = JSON.parse(localStorage.getItem("auth") || "null")?.token || null;
  } catch {}

  const r = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// (Optional) export an upload helper from here if you want:
export async function uploadFile(
  category: "TEST_CASE" | "SUBMISSION",
  file: File
) {
  const form = new FormData();
  form.append("category", category);
  form.append("file", file);

  const res = await fetch(`${BASE}/api/v1/files`, {
    method: "POST",
    body: form, // do NOT set Content-Type manually
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload failed (${res.status})`);
  }
  return res.json();
}