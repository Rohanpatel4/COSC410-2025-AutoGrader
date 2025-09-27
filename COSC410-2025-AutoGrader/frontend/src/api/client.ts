const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

export async function fetchJson(path: string, init?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers||{}) },
    ...init,
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}
