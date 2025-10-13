import React, { useRef, useState } from "react";
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
  const [msg, setMsg] = useState<string | null>(null);

  // read the chosen file directly at submit time to avoid state timing issues
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // always read latest file from the input
    const file = fileInputRef.current?.files?.[0] ?? null;

    // custom validation (remove native `required` so this can run)
    if (!assignmentId.trim()) {
      setMsg("Missing assignment_id");
      return;
    }
    if (!file) {
      setMsg("Please choose a test file");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".py")) {
      setMsg("Only .py files are accepted.");
      return;
    }

    setMsg("Uploading test file…");

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

      // Give tests a moment to assert the message before navigation swaps the view
      setMsg("Test uploaded. Redirecting to student submission…");
      setTimeout(() => {
        navigate("/upload/student", {
          state: { assignment_id: assignmentId },
          replace: true,
        });
      }, 10);
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
          // no `required` so our custom validation can run in tests
        />
      </label>

      <label htmlFor="test-file">Test file</label>
      <input
        id="test-file"
        ref={fileInputRef}
        type="file"
        accept=".py, text/x-python, application/x-python, text/plain, */*"
      />

      <button type="submit">Upload Test File</button>
      <p>{msg}</p>
    </form>
  );
};

export default UploadTestFile;

