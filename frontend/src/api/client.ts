// dev: no BASE (use Vite proxy); prod: use VITE_API_URL if set
const BASE = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_URL ?? "");

// Safe join in case someone sets a trailing slash in BASE
function join(base: string, path: string) {
  if (!base) return path;
  return base.replace(/\/+$/, "") + path;
}

function getToken(): string | null {
  try {
    return JSON.parse(localStorage.getItem("auth") || "null")?.token ?? null;
  } catch {
    return null;
  }
}

export async function fetchJson<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  // Ensure caller passes paths like "/api/..." so proxy picks them up in dev
  if (!path.startsWith("/")) {
    throw new Error(`fetchJson path must start with '/': received "${path}"`);
  }

  const token = getToken();

  const res = await fetch(join(BASE, path), {
    // Only set JSON header here; callers can override/extend via init.headers
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      // FastAPI puts message in detail
      throw new Error(j.detail ?? j.error ?? res.statusText);
    } catch {
      throw new Error(text || res.statusText);
    }
  }
  // If no JSON body, this will throw—adjust per your API if needed
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

export { BASE }; // export if other modules need to inspect it
