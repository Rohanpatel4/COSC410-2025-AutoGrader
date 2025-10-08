// src/webpages/AssignmentDetailPage.tsx
import React from "react";
import { useParams, Link } from "react-router-dom";
import { fetchJson, BASE } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Assignment } from "../types/assignments";

type Attempt = { id: number; grade: number | null };

export default function AssignmentDetailPage() {
  // ✅ match your route: /assignments/:assignment_id
  const { assignment_id } = useParams<{ assignment_id: string }>();
  const { role, userId } = useAuth();
  const isStudent = role === "student";

  const [a, setA] = React.useState<Assignment | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [attempts, setAttempts] = React.useState<Attempt[]>([]);
  const [file, setFile] = React.useState<File | null>(null);
  const [submitMsg, setSubmitMsg] = React.useState<string | null>(null);
  const [lastResult, setLastResult] = React.useState<any>(null);

  async function loadAll() {
    if (!assignment_id) return; // guard
    setLoading(true);
    setErr(null);
    try {
      const details = await fetchJson<Assignment>(
        `/api/v1/assignments/${encodeURIComponent(assignment_id)}`
      );
      setA(details);

      if (isStudent && userId) {
        const list = await fetchJson<Attempt[]>(
          `/api/v1/assignments/${encodeURIComponent(
            assignment_id
          )}/attempts?student_id=${encodeURIComponent(String(userId))}`
        ).catch(() => []);
        setAttempts(list || []);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load assignment");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment_id]);

  const bestGrade = React.useMemo(() => {
    if (!attempts.length) return null;
    return attempts.reduce(
      (max, r) => (r.grade != null && r.grade > max ? r.grade : max),
      -1
    );
  }, [attempts]);

  const nowBlocked = React.useMemo(() => {
    if (!a) return false;
    try {
      const now = Date.now();
      const startOk = a.start ? now >= new Date(a.start).getTime() : true;
      const stopOk = a.stop ? now <= new Date(a.stop).getTime() : true;
      return !(startOk && stopOk);
    } catch {
      return false;
    }
  }, [a]);

  const limitReached = React.useMemo(() => {
    if (!a) return false;
    if (a.sub_limit == null || a.sub_limit < 0) return false;
    return attempts.length >= a.sub_limit;
  }, [a, attempts]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assignment_id) return;
    if (!file) {
      setSubmitMsg("Choose a .py file");
      return;
    }
    setSubmitMsg("Submitting…");
    setLastResult(null);

    try {
      const fd = new FormData();
      fd.append("student_id", String(userId ?? "")); // API expects this
      fd.append("submission", file);

      const res = await fetch(
        `${BASE}/api/v1/assignments/${encodeURIComponent(assignment_id)}/submit`,
        { method: "POST", body: fd }
      );

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        /* ignore */
      }

      if (!res.ok) {
        const detail = data?.detail ?? text;
        setSubmitMsg(
          `Submit failed: ${res.status} ${
            typeof detail === "string" ? detail : JSON.stringify(detail)
          }`
        );
        return;
      }

      setSubmitMsg(`Submitted. Grade: ${data?.grade ?? "—"}`);
      setLastResult(data ?? null);

      // refresh attempts
      const list = await fetchJson<Attempt[]>(
        `/api/v1/assignments/${encodeURIComponent(
          assignment_id
        )}/attempts?student_id=${encodeURIComponent(String(userId))}`
      ).catch(() => []);
      setAttempts(list || []);
    } catch (err: any) {
      setSubmitMsg(err?.message || "Network error");
    }
  }

  return (
    <div className="container">
      <div style={{ marginBottom: 12 }}>
        <Link to="/my">← Back</Link>
      </div>

      {!assignment_id && (
        <p style={{ color: "crimson" }}>No assignment selected.</p>
      )}

      {loading && <p>Loading…</p>}
      {err && <p style={{ color: "crimson" }}>{err}</p>}

      {!a ? null : (
        <>
          <h1>{a.title}</h1>
          {a.description && <p>{a.description}</p>}

          <p style={{ color: "#555" }}>
            Window: {a.start ? new Date(a.start).toLocaleString() : "—"} →{" "}
            {a.stop ? new Date(a.stop).toLocaleString() : "—"}
          </p>
          <p style={{ color: "#555" }}>
            Submission limit: {a.sub_limit == null ? "∞" : a.sub_limit}
          </p>

          {isStudent && (
            <>
              <h2>Submit your code</h2>
              <form onSubmit={onSubmit}>
                <input
                  type="file"
                  accept=".py"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={nowBlocked || limitReached}
                />
                <button type="submit" disabled={!file || nowBlocked || limitReached}>
                  Submit
                </button>
                {nowBlocked && (
                  <p style={{ color: "#b91c1c" }}>Submission window is closed.</p>
                )}
                {limitReached && (
                  <p style={{ color: "#b91c1c" }}>
                    You’ve reached the submission limit.
                  </p>
                )}
                {submitMsg && <p style={{ color: "#334155" }}>{submitMsg}</p>}
              </form>

              {/* Show grading results prominently */}
              {lastResult?.grading && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "16px",
                    borderRadius: "8px",
                    backgroundColor: lastResult.grading.passed ? "#f0fdf4" : "#fef2f2",
                    border: `2px solid ${lastResult.grading.passed ? "#16a34a" : "#dc2626"}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: lastResult.grading.passed ? "#16a34a" : "#dc2626",
                      marginBottom: "8px",
                    }}
                  >
                    {lastResult.grading.passed ? "PASS" : "FAIL"}
                  </div>
                  <div style={{ fontSize: "14px", color: "#64748b" }}>
                    {lastResult.grading.passed_tests} of {lastResult.grading.total_tests} tests passed
                  </div>
                </div>
              )}

              {lastResult && (
                <div style={{ marginTop: 12 }}>
                  <h3>Last run result</h3>
                  <pre
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      padding: 12,
                      borderRadius: 8,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {JSON.stringify(lastResult, null, 2)}
                  </pre>
                </div>
              )}

              <h2 style={{ marginTop: 16 }}>Your attempts</h2>
              {!attempts.length ? (
                <p>No attempts yet.</p>
              ) : (
                <ul>
                  {attempts.map((t, idx) => (
                    <li key={t.id}>
                      Attempt {idx + 1}: Grade {t.grade ?? "—"}
                    </li>
                  ))}
                </ul>
              )}
              <p>
                Best grade:{" "}
                <strong>
                  {bestGrade == null || bestGrade < 0 ? "—" : bestGrade}
                </strong>
              </p>
            </>
          )}

          {!isStudent && (
            <p style={{ color: "#64748b" }}>
              (Faculty view here could show a gradebook later.)
            </p>
          )}
        </>
      )}
    </div>
  );
}



