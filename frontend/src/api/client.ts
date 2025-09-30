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
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function fetchJson(path: string, init?: RequestInit) {
  let token: string | null = null;
  try { token = JSON.parse(localStorage.getItem("auth") || "null")?.token || null; } catch {}

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
