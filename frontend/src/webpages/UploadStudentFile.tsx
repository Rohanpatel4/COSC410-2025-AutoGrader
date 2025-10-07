import React, { useState } from "react";
import { BASE } from "../api/client";
import { useLocation } from "react-router-dom";

const UploadStudentFile: React.FC = () => {
  const location = useLocation() as any;

  // --- retrieve test case from router or sessionStorage ---
  let testCase: string = location?.state?.testCase ?? "";
  let testFilename: string = location?.state?.filename ?? "";

  if (!testCase) {
    testCase = sessionStorage.getItem("autograder:test_case") ?? "";
  }
  if (!testFilename) {
    testFilename =
      sessionStorage.getItem("autograder:test_filename") ?? "test_case.py";
  }

  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [errorJson, setErrorJson] = useState<any>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Uploading student code…");
    setResult(null);
    setErrorJson(null);

    if (!file) return setMsg("Please choose a student .py file");
    if (!file.name.toLowerCase().endsWith(".py"))
      return setMsg("Only .py files are accepted.");
    if (!testCase)
      return setMsg("No test case available. Upload a test file first.");

    const fd = new FormData();
    fd.append("submission", file);
    fd.append("test_case", testCase);

    try {
      const res = await fetch(`${BASE}/api/v1/attempts`, {
        method: "POST",
        body: fd,
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        /* ignore JSON parse errors */
      }

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
      setMsg("Ran in sandbox.");
    } catch (err: any) {
      setMsg(err?.message || "Network error");
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 800, margin: "0 auto" }}>
      <h2>Upload Student Code</h2>

      {testCase ? (
        <p style={{ fontSize: 12, color: "#475569" }}>
          Test loaded: <strong>{testFilename}</strong>
        </p>
      ) : (
        <div
          style={{
            background: "#fef2f2",
            color: "#b91c1c",
            padding: "1rem",
            borderRadius: "0.5rem",
            border: "2px solid #b91c1c",
            textAlign: "center",
            fontWeight: "bold",
            marginTop: "1rem",
            fontSize: "1.5rem",
          }}
        >
          ⚠️ NO TEST CASE FOUND ⚠️  
          <br />
          Please upload a test file first at <code>/upload/test</code>.
        </div>
      )}

      <input
        type="file"
        accept=".py"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        style={{ marginTop: 20, marginRight: 10 }}
      />
      <button type="submit">Upload &amp; Run</button>
      <p style={{ color: "#334155", marginTop: 10 }}>{msg}</p>

      {/* === SHOW DETAILED ERROR (if exists) === */}
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

      {/* === SHOW GRADING STATUS === */}
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

      {/* === SHOW RESULT (if success) === */}
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

      {/* === SHOW TEST CASE CONTENT === */}
      {testCase && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ marginBottom: 6 }}>
            Test Case Contents{" "}
            <span
              style={{
                fontSize: "0.9rem",
                fontWeight: "normal",
                color: "#475569",
                marginLeft: 6,
              }}
            >
              (type: <strong>{typeof testCase}</strong>)
            </span>
          </h3>
          <pre
            style={{
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              padding: 10,
              borderRadius: 8,
              fontFamily: "monospace",
              fontSize: 13,
              whiteSpace: "pre-wrap",
              overflowX: "auto",
            }}
          >
            {testCase}
          </pre>
        </div>
      )}
    </form>
  );
};

export default UploadStudentFile;
