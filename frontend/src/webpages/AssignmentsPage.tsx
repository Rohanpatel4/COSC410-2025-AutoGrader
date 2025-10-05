import React from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../api/client";
import type { Assignment } from "../types/assignments";

// Helpers for <input type="datetime-local">
function toLocalInputValue(d: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromLocalInputValue(v: string): Date | null {
  if (!v) return null;
  const [date, time] = v.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dateMap, setDateMap] = React.useState<Record<string, { start: Date | null; end: Date | null }>>({});

  React.useEffect(() => {
    let alive = true;
    setLoading(true);

    // Fetch as unknown and normalize date fields to Date objects
    fetchJson<any[]>("/api/v1/assignments")
      .then(raw => {
        if (!alive) return;
        const normalized: Assignment[] = (raw || []).map((a: any) => ({
          ...a,
          start_at: a?.start_at ? new Date(a.start_at) : null,
          end_at: a?.end_at ? new Date(a.end_at) : null,
        }));
        setAssignments(normalized);
        // seed local date inputs
        const seeded: Record<string, { start: Date | null; end: Date | null }> = {};
        for (const a of normalized) {
          seeded[a.id] = { start: a.start_at ?? null, end: a.end_at ?? null };
        }
        setDateMap(seeded);
      })
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
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label>
                    Start
                    <input
                      style={{ marginLeft: 6 }}
                      type="datetime-local"
                      value={toLocalInputValue(dateMap[assignment.id]?.start ?? null)}
                      onChange={(e) =>
                        setDateMap(prev => ({
                          ...prev,
                          [assignment.id]: {
                            start: fromLocalInputValue(e.target.value),
                            end: prev[assignment.id]?.end ?? null,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    End
                    <input
                      style={{ marginLeft: 6 }}
                      type="datetime-local"
                      value={toLocalInputValue(dateMap[assignment.id]?.end ?? null)}
                      onChange={(e) =>
                        setDateMap(prev => ({
                          ...prev,
                          [assignment.id]: {
                            start: prev[assignment.id]?.start ?? null,
                            end: fromLocalInputValue(e.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                  <span style={{ color: "#666" }}>
                    ({assignment.start_at ? assignment.start_at.toLocaleString() : "No start"} → {assignment.end_at ? assignment.end_at.toLocaleString() : "No stop"})
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}