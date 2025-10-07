import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchJson } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Assignment } from "../types/assignments";

type AttemptSummary = {
  // optional shape if you later expose a summary endpoint
  total_attempts?: number;
  highest_score?: number | null;
};

export default function AssignmentDetailPage() {
  const { assignment_id = "" } = useParams<{ assignment_id: string }>();
  const { role } = useAuth();

  const [assignment, setAssignment] = React.useState<Assignment | null>(null);
  const [summary, setSummary] = React.useState<AttemptSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const isFaculty = role === "faculty";
  const isStudent = role === "student";

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // Basic assignment details
        const a = await fetchJson<Assignment>(`/api/v1/assignments/${encodeURIComponent(assignment_id)}`);
        if (!alive) return;
        setAssignment(a);

        // OPTIONAL: if/when you add a summary route, uncomment:
        // const s = await fetchJson<AttemptSummary>(`/api/v1/assignments/${assignment_id}/summary`).catch(() => null);
        // if (!alive) return;
        // setSummary(s);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load assignment");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [assignment_id]);

  return (
    <div className="container">
      <div style={{ marginBottom: 12 }}>
        <Link to="/my">← Back to dashboard</Link>
      </div>

      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {loading && <p>Loading…</p>}
      {!loading && !assignment && <p>Not found.</p>}

      {assignment && (
        <>
          <h1 style={{ marginBottom: 4 }}>{assignment.title}</h1>
          <p style={{ marginTop: 0, color: "#555" }}>
            Course ID: <strong>{assignment.course_id}</strong>
          </p>

          {assignment.description && (
            <>
              <h3>Description</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{assignment.description}</p>
            </>
          )}

          <h3>Submission Window</h3>
          <p style={{ marginTop: 0 }}>
            {assignment.start ? new Date(assignment.start).toLocaleString() : "No start"} →{" "}
            {assignment.stop ? new Date(assignment.stop).toLocaleString() : "No stop"}
          </p>

          <h3>Limits</h3>
          <p style={{ marginTop: 0 }}>
            Submission limit:{" "}
            <strong>{assignment.sub_limit == null ? "No limit" : assignment.sub_limit}</strong>
            {typeof assignment.num_attempts === "number" && (
              <>
                {" "}• Attempts so far: <strong>{assignment.num_attempts}</strong>
              </>
            )}
          </p>

          {/* Optional summary block once you wire a summary endpoint */}
          {summary && (
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 12,
                marginTop: 12,
                background: "#f8fafc",
              }}
            >
              <h3 style={{ marginTop: 0 }}>Summary</h3>
              <div>Total attempts: {summary.total_attempts ?? "—"}</div>
              <div>Highest score: {summary.highest_score ?? "—"}</div>
            </div>
          )}

          {/* Student section (placeholder until backend auto-grading submit endpoint is ready) */}
          {isStudent && (
            <div
              style={{
                border: "1px dashed #94a3b8",
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
                background: "#f1f5f9",
                color: "#334155",
              }}
            >
              <strong>Student submissions</strong>
              <p style={{ marginTop: 6 }}>
                Submissions and instant grading will appear here once the submission endpoint is wired.
              </p>
            </div>
          )}

          {/* Faculty notes */}
          {isFaculty && (
            <div
              style={{
                borderTop: "1px solid #e2e8f0",
                marginTop: 24,
                paddingTop: 12,
                color: "#475569",
              }}
            >
              <strong>Faculty</strong>
              <ul style={{ marginTop: 6 }}>
                <li>
                  Test files are uploaded during <em>Create Assignment</em> on the Course page (as requested).
                </li>
                <li>
                  This page no longer shows “Upload Test File” or “Try Student Submission”. Grading runs when students
                  submit (once that endpoint is live).
                </li>
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}


