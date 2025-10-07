import React, { useState } from "react";
import { BASE } from "../api/client";
import { useNavigate } from "react-router-dom";

const UploadTestFile: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Uploading test file…");

    if (!file) {
      setMsg("Please choose a test file");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".py")) {
      setMsg("Only .py files are accepted.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(`${BASE}/api/v1/files`, {
        method: "POST",
        body: fd,
      });

      const data = await res.clone().json().catch(() => null);
      if (!res.ok) {
        const text = await res.text();
        setMsg(`Upload failed: ${res.status} ${text}`);
        return;
      }

      const testCase = data?.test_case ?? "";
      const filename = data?.filename ?? file.name;

      // ✅ store in session so /upload/student can read it
      sessionStorage.setItem("autograder:test_case", testCase);
      sessionStorage.setItem("autograder:test_filename", filename);

      setMsg("Test uploaded. Redirecting to student submission…");
      navigate("/upload/student", { state: { testCase, filename }, replace: true });
    } catch (err: any) {
      setMsg(err?.message || "Network error");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Upload Test File</h2>
      <input
        type="file"
        accept=".py"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button type="submit">Upload Test File</button>
      <p>{msg}</p>
    </form>
  );
};

export default UploadTestFile;
