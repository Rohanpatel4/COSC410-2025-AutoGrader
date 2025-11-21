// Use VITE_API_URL if set (for Docker), otherwise use Vite proxy in dev mode
const BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "" : "");

// Safe join in case someone sets a trailing slash in BASE
function join(base: string, path: string) {
  if (!base) return path;
  return base.replace(/\/+$/, "") + path;
}

function getAuthFromStorage(): { token: string | null; userId: string | null; role: string | null } {
  try {
    const a = JSON.parse(localStorage.getItem("auth") || "null");
    return { token: a?.token ?? null, userId: a?.userId ?? null, role: a?.role ?? null };
  } catch {
    return { token: null, userId: null, role: null };
  }
}

export async function fetchJson<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  // If path is already a full URL (starts with http), use it directly
  // Otherwise, it must start with '/' for joining with BASE
  if (!path.startsWith("http") && !path.startsWith("/")) {
    throw new Error(`fetchJson path must start with '/' or be a full URL: received "${path}"`);
  }

  const { token, userId, role } = getAuthFromStorage();

  // If path is already a full URL, use it directly; otherwise join with BASE
  const url = path.startsWith("http") ? path : join(BASE, path);
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(userId ? { "X-User-Id": String(userId) } : {}),
      ...(role ? { "X-User-Role": String(role) } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.detail ?? j.error ?? res.statusText);
    } catch {
      throw new Error(text || res.statusText);
    }
  }
  return (await res.json()) as T;
}

// Multipart helper for file uploads
export async function uploadFile<T = unknown>(
  category: "TEST_CASE" | "SUBMISSION",
  file: File
): Promise<T> {
  const form = new FormData();
  form.append("category", category);
  form.append("file", file);

  const res = await fetch(join(BASE, "/api/v1/files"), {
    method: "POST",
    body: form, // do NOT set Content-Type manually
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.detail ?? j.error ?? res.statusText);
    } catch {
      throw new Error(text || `Upload failed (${res.status})`);
    }
  }
  return (await res.json()) as T;
}

export { BASE };

