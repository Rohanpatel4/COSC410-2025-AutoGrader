// frontend/src/pages/UploadFiles.tsx
import React, { useState } from "react";
import { BASE } from "../api/client";  // export BASE from src/api/client.ts
// or: const BASE = (import.meta as any).env?.VITE_API_URL || ""; // original fallback
// or: const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"; // teammate note

type Category = "TEST_CASE" | "SUBMISSION";

const UploadFiles: React.FC = () => {
  const [category, setCategory] = useState<Category>("TEST_CASE");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!file) {
      setMsg("Please choose a file");
      return;
    }

    setMsg("Uploading...");

    const fd = new FormData();
    fd.append("category", category);
    fd.append("file", file); // matches MSW handler (now also accepts "f" in handlers)

    // When the route is protected
    //
    // let token: string | null = null;
    // try { token = JSON.parse(localStorage.getItem("auth") || "null")?.token || null; } catch {}
    // const res = await fetch(`${BASE}/api/v1/files`, {
    //   method: "POST",
    //   headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    //   body: fd,
    // });

    // Optional token (if your backend protects the route)
    let token: string | null = null;
    try {
      token = JSON.parse(localStorage.getItem("auth") || "null")?.token ?? null;
    } catch {
      /* ignore parse errors */
    }

    try {
      const res = await fetch(`${BASE}/api/v1/files`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd, // DO NOT set Content-Type; browser adds multipart boundary
      });

      // Consume the body (json) to flush async work reliably in jsdom/undici
      await res.clone().json().catch(() => ({}));

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setMsg(`Upload failed: ${res.status} ${text}`.trim());
        return;
      }

      setMsg("Uploaded!");
    } catch (err: any) {
      setMsg(err?.message || "Network error");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div>
        <label htmlFor="category">Category</label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          <option value="TEST_CASE">TEST_CASE</option>
          <option value="SUBMISSION">SUBMISSION</option>
        </select>
      </div>

      <div>
        <label htmlFor="upload-file">File</label>
        <input
          id="upload-file"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>

      <button type="submit">Upload</button>

      {/* Live region + test id for rock-solid assertions */}
      <p role="status" aria-live="polite" data-testid="upload-msg">
        {msg}
      </p>
    </form>
  );
};

export default UploadFiles;

