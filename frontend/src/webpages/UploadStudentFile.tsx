import React, { useState } from "react";
import { BASE } from "../api/client";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * Student: upload a submission for a specific assignment.
 * Backend route: POST /api/v1/assignments/:assignment_id/submit
 * FormData fields: submission (file), student_id (number)
 */
const UploadStudentFile: React.FC = () => {
  const location = useLocation() as any;
  const { userId } = useAuth();

  // prefill assignment_id from navigation state if present
  const [assignmentId, setAssignmentId] = useState<string>(
    String(location?.state?.assignment_id ?? "")
  );

  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [errorJson, setErrorJson] = useState<any>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Uploading student code…");
    setResult(null);
    setErrorJson(null);

    if (!assignmentId.trim()) return setMsg("Missing assignment_id");
    if (!file) return setMsg("Please choose a student .py file");
    if (!file.name.toLowerCase().endsWith(".py")) {
      return setMsg("Only .py files are accepted.");
    }

    const fd = new FormData();
    fd.append("submission", file);
    fd.append("student_id", String(userId ?? ""));

    try {
      const res = await fetch(
        `${BASE}/api/v1/assignments/${encodeURIComponent(assignmentId)}/submit`,
        { method: "POST", body: fd }
      );

      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch {}

      if (!res.ok) {
        const detail = data?.detail ?? text;
        setErrorJson(data ?? { raw: text });
        setMsg(
          `Run failed: ${res.status} ${
            typeof detail === "string" ? detail : JSON.stringify(detail)
          }`
        );
        return;
      }

      setResult(data);
      setMsg(`Submitted. Grade: ${data?.grade ?? "—"}`);
    } catch (err: any) {
      setMsg(err?.message || "Network error");
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 800, margin: "0 auto" }}>
      <h2>Upload Student Code</h2>

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
        aria-label="Student code file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        style={{ marginTop: 20, marginRight: 10 }}
      />
      <button type="submit">Upload &amp; Run</button>
      <p style={{ color: "#334155", marginTop: 10 }}>{msg}</p>

      {errorJson && (
        <pre
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            padding: 12,
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            marginTop: 10,
          }}
        >
          {JSON.stringify(errorJson, null, 2)}
        </pre>
      )}

      {/* Show grading status */}
      {result && result.grading && (
        <div
          style={{
            marginTop: 20,
            padding: "16px",
            borderRadius: "8px",
            border: "2px solid",
            backgroundColor: result.grading.passed ? "#f0fdf4" : "#fef2f2",
            borderColor: result.grading.passed ? "#22c55e" : "#ef4444",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: result.grading.passed ? "#16a34a" : "#dc2626",
              marginBottom: "8px",
            }}
          >
            {result.grading.passed ? "PASS" : "FAIL"}
          </div>
          <div style={{ fontSize: "14px", color: "#64748b" }}>
            {result.grading.passed_tests} of {result.grading.total_tests} tests passed
          </div>
        </div>
      )}

      {/* Show raw result */}
      {result && (
        <pre
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            padding: 12,
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            marginTop: 10,
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </form>
  );
};

export default UploadStudentFile;