import React from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../api/client";
import type { Assignment } from "../types/assignments";
import { Button, Input, Label, Card, Badge } from "../components/ui";

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
    <div className="container py-12">
        <Card>
          <h1 className="text-3xl font-bold mb-6">All Assignments</h1>
          {loading ? (
            <p className="text-center text-muted-foreground">Loading…</p>
          ) : assignments.length === 0 ? (
            <p className="text-muted-foreground">No assignments found.</p>
          ) : (
            <ul className="space-y-6">
              {assignments.map((a) => (
                <li key={a.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3 mb-3">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/assignments/${a.id}`)}
                    >
                      {a.title}
                    </Button>
                    <Badge variant="info">
                      Attempts: {a.num_attempts ?? 0}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Course: {a.course_id}</div>
                    {a.description && <div>Description: {a.description}</div>}
                    <div>Submission Limit: {a.sub_limit == null ? "∞" : a.sub_limit}</div>
                    <div className="flex gap-4 items-center flex-wrap mt-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`start-${a.id}`} className="mb-0">Start</Label>
                        <Input
                          id={`start-${a.id}`}
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
                          className="w-auto"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`stop-${a.id}`} className="mb-0">Stop</Label>
                        <Input
                          id={`stop-${a.id}`}
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
                          className="w-auto"
                        />
                      </div>
                      <span className="text-muted-foreground text-xs">
                        ({a.start ? new Date(a.start).toLocaleString() : "No start"} →{" "}
                        {a.stop ? new Date(a.stop).toLocaleString() : "No stop"})
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
    </div>
  );
}
