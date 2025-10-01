// frontend/src/pages/UploadFiles.tsx
import React, { useState } from "react";
import { BASE } from "../api/client";  // export BASE from src/api/client.ts
// or: const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const UploadFiles: React.FC = () => {
  const [category, setCategory] = useState<"TEST_CASE" | "SUBMISSION">("TEST_CASE");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setMsg("Please choose a file");
    setMsg("Uploading...");


    // When the route is protected
    // 
    // let token: string | null = null;
    // try { token = JSON.parse(localStorage.getItem("auth") || "null")?.token || null; } catch {}
    // const res = await fetch(`${BASE}/api/v1/files`, {
    //   method: "POST",
    //   headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    //   body: fd,
    // });


    const fd = new FormData();
    fd.append("category", category);
    fd.append("f", file); // ✅ correct field name

    // Optional token (if your backend protects the route)
    let token: string | null = null;
    try {
      token = JSON.parse(localStorage.getItem("auth") || "null")?.token || null;
    } catch {}

    const res = await fetch(`${BASE}/api/v1/files`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd, // DO NOT set Content-Type; browser adds boundary
    });

    if (!res.ok) {
      const text = await res.text();
      setMsg(`Upload failed: ${res.status} ${text}`);
      return;
    }
    setMsg("Uploaded!");
  }

  return (
    <form onSubmit={onSubmit}>
      <div>
        <label>Category</label>
        <select value={category} onChange={e => setCategory(e.target.value as any)}>
          <option>TEST_CASE</option>
          <option>SUBMISSION</option>
        </select>
      </div>

      <div>
        <label>File</label>
        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
      </div>

      <button type="submit">Upload</button>
      {msg && <p>{msg}</p>}
    </form>
  );
};

export default UploadFiles;
