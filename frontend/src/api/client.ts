// dev: no BASE (use Vite proxy); prod: use VITE_API_URL if set
const BASE = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_URL ?? "");

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
  if (!path.startsWith("/")) {
    throw new Error(`fetchJson path must start with '/': received "${path}"`);
  }

  const { token, userId, role } = getAuthFromStorage();

  const res = await fetch(join(BASE, path), {
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

