import React, { useState } from "react";
import { BASE } from "../api/client";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Faculty: upload a test file that's attached to a specific assignment.
 * Backend route: POST /api/v1/assignments/:assignment_id/test-file
 */
const UploadTestFile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;

  // allow caller to pass { assignment_id } via navigate(..., { state })
  const [assignmentId, setAssignmentId] = useState<string>(
    String(location?.state?.assignment_id ?? "")
  );
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Uploading test file…");

    if (!assignmentId.trim()) return setMsg("Missing assignment_id");
    if (!file) return setMsg("Please choose a test file");
    if (!file.name.toLowerCase().endsWith(".py")) {
      return setMsg("Only .py files are accepted.");
    }

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(
        `${BASE}/api/v1/assignments/${encodeURIComponent(assignmentId)}/test-file`,
        { method: "POST", body: fd }
      );

      if (!res.ok) {
        const text = await res.text();
        setMsg(`Upload failed: ${res.status} ${text}`);
        return;
      }

      setMsg("Test uploaded. Redirecting to student submission…");
      navigate("/upload/student", { state: { assignment_id: assignmentId }, replace: true });
    } catch (err: any) {
      setMsg(err?.message || "Network error");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Upload Test File</h2>

      <label style={{ display: "block", marginBottom: 8 }}>
        Assignment ID
        <input
          style={{ marginLeft: 8 }}
          value={assignmentId}
          onChange={(e) => setAssignmentId(e.target.value)}
          placeholder="e.g., 1"
          required
        />
      </label>

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

