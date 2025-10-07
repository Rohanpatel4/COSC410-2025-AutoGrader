import React from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../api/client";
import type { Assignment } from "../types/assignments";

// datetime-local helpers
function toLocalInputValue(d: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const [dateMap, setDateMap] = React.useState<Record<
    number,
    { start: Date | null; stop: Date | null }
  >>({});

  React.useEffect(() => {
    let alive = true;
    setLoading(true);

    fetchJson<any[]>("/api/v1/assignments")
      .then((raw) => {
        if (!alive) return;
        const normalized: Assignment[] = (raw || []).map((a: any) => ({
          ...a,
          start: a?.start ?? null,
          stop: a?.stop ?? null,
          num_attempts: a?.num_attempts ?? 0,
        }));
        setAssignments(normalized);

        const seeded: Record<number, { start: Date | null; stop: Date | null }> = {};
        for (const a of normalized) {
          seeded[a.id] = {
            start: a.start ? new Date(a.start) : null,
            stop: a.stop ? new Date(a.stop) : null,
          };
        }
        setDateMap(seeded);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
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
          {assignments.map((a) => (
            <li key={a.id} style={{ marginBottom: 12 }}>
              <button
                style={{
                  background: "#4285f4",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 12px",
                  cursor: "pointer",
                  marginRight: 8,
                }}
                onClick={() => navigate(`/assignments/${a.id}`)}
              >
                {a.title}
              </button>
              <span style={{ marginLeft: 12, color: "#555" }}>
                Attempts: {a.num_attempts ?? 0}
              </span>
              <div style={{ fontSize: "0.95em", color: "#555" }}>
                <div>Course: {a.course_id}</div>
                {a.description && <div>Description: {a.description}</div>}
                <div>Submission Limit: {a.sub_limit == null ? "∞" : a.sub_limit}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label>
                    Start
                    <input
                      style={{ marginLeft: 6 }}
                      type="datetime-local"
                      value={toLocalInputValue(dateMap[a.id]?.start ?? null)}
                      onChange={(e) =>
                        setDateMap((prev) => ({
                          ...prev,
                          [a.id]: {
                            start: fromLocalInputValue(e.target.value),
                            stop: prev[a.id]?.stop ?? null,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Stop
                    <input
                      style={{ marginLeft: 6 }}
                      type="datetime-local"
                      value={toLocalInputValue(dateMap[a.id]?.stop ?? null)}
                      onChange={(e) =>
                        setDateMap((prev) => ({
                          ...prev,
                          [a.id]: {
                            start: prev[a.id]?.start ?? null,
                            stop: fromLocalInputValue(e.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                  <span style={{ color: "#666" }}>
                    ({a.start ? new Date(a.start).toLocaleString() : "No start"} →{" "}
                    {a.stop ? new Date(a.stop).toLocaleString() : "No stop"})
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
