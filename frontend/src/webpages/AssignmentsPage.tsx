import React from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../api/client";
import type { Assignment } from "../types/assignments";

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);

    fetchJson<Assignment[]>("/api/v1/assignments")
      .then(a => { if (alive) setAssignments(a); })
      .catch(() => { if (alive) setAssignments([]); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, []);

  return (
    <div className="container">
      <h1>All Assignments</h1>
      {loading ? (
        <p>Loading…</p>
      ) : assignments.length === 0 ? (
        <p>No assignments found.</p>
      ) : (
        <ul>
          {assignments.map(assignment => (
            <li key={assignment.id} style={{ marginBottom: 12 }}>
              <button
                style={{
                  background: "#4285f4",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 12px",
                  cursor: "pointer",
                  marginRight: 8
                }}
                onClick={() => navigate(`/assignments/${assignment.id}`)}
              >
                {assignment.title}
              </button>
              <span style={{ marginLeft: 12, color: "#555" }}>
                Submissions: {assignment.submission_count ?? 0}
              </span>
              <div style={{ fontSize: "0.95em", color: "#555" }}>
                <div>Course: {assignment.course_id}</div>
                {assignment.description && <div>Description: {assignment.description}</div>}
                <div>Test File ID: {assignment.test_file_id ?? "None"}</div>
                <div>Submission Limit: {assignment.submission_limit == null ? "∞" : assignment.submission_limit}</div>
                <div>Start: {assignment.start_at ?? "No start"}</div>
                <div>End: {assignment.end_at ?? "No stop"}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}