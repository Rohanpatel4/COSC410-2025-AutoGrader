// src/webpages/AssignmentDetailPage.tsx
import React from "react";
import { useParams, Link } from "react-router-dom";
import { fetchJson, BASE } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Assignment } from "../types/assignments";
import { Button, Card, Alert } from "../components/ui";
import { formatGradeDisplay } from "../utils/formatGrade";

type Attempt = { id: number; grade: number | null };

type FacAttempt = { id: number; grade: number | null };
type FacRow = { student_id: number; username: string; attempts: FacAttempt[]; best: number | null };
type FacPayload = { assignment: { id: number; title: string }; students: FacRow[] };


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

  const [facRows, setFacRows] = React.useState<FacRow[] | null>(null);
  const [facLoading, setFacLoading] = React.useState(false);
  const [facErr, setFacErr] = React.useState<string | null>(null);


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

      if (!isStudent && assignment_id) {
        setFacLoading(true);
        setFacErr(null);
        try {
          const data = await fetchJson<FacPayload>(
            `/api/v1/assignments/${encodeURIComponent(assignment_id)}/grades`
          );
          setFacRows(data.students || []);
        } catch (e: any) {
          setFacErr(e?.message ?? "Failed to load grades");
          setFacRows([]);
        } finally {
          setFacLoading(false);
        }
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

      setSubmitMsg(`Submitted. Grade: ${formatGradeDisplay(data?.grade)}`);
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
    <div className="container py-12 space-y-6">
        <div className="mb-3">
          {a?.course_id ? (
            <Link to={`/courses/${encodeURIComponent(a.course_id)}`} className="text-primary hover:opacity-80">
              ← Back to course
            </Link>
          ) : (
            <Link to="/my" className="text-primary hover:opacity-80">← Back</Link>
          )}
        </div>

        {!assignment_id && (
          <Alert variant="error">
            <p className="font-medium">No assignment selected.</p>
          </Alert>
        )}

        {loading && <p className="text-center text-muted-foreground">Loading…</p>}
        {err && (
          <Alert variant="error">
            <p className="font-medium">{err}</p>
          </Alert>
        )}

        {!a ? null : (
          <>
            <Card>
              <h1 className="text-3xl font-bold mb-4">{a.title}</h1>
              {a.description && <p className="text-foreground mb-4">{a.description}</p>}

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Window: {a.start ? new Date(a.start).toLocaleString() : "—"} →{" "}
                  {a.stop ? new Date(a.stop).toLocaleString() : "—"}
                </p>
                <p>
                  Submission limit: {a.sub_limit == null ? "∞" : a.sub_limit}
                </p>
              </div>
            </Card>

          {isStudent && (
            <Card>
              <h2 className="text-2xl font-semibold mb-4">Submit your code</h2>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <input
                    type="file"
                    accept=".py"
                    aria-label="Submit your code"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    disabled={nowBlocked || limitReached}
                    className="block text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 disabled:opacity-50"
                  />
                </div>
                
                <Button type="submit" disabled={!file || nowBlocked || limitReached}>
                  Submit
                </Button>
                
                {nowBlocked && (
                  <Alert variant="error">
                    <p className="font-medium">Submission window is closed.</p>
                  </Alert>
                )}
                {limitReached && (
                  <Alert variant="error">
                    <p className="font-medium">You've reached the submission limit.</p>
                  </Alert>
                )}
                {submitMsg && <p className="text-foreground">{submitMsg}</p>}
              </form>

              {/* Show grading results prominently */}
              {lastResult?.grading && (
                <Card 
                  className="mt-3 text-center"
                  style={{
                    backgroundColor: lastResult.grading.passed ? "rgb(240, 253, 244)" : "rgb(254, 242, 242)",
                    borderColor: lastResult.grading.passed ? "rgb(22, 163, 74)" : "rgb(220, 38, 38)",
                    borderWidth: "2px"
                  }}
                >
                  <div 
                    className="text-2xl font-bold mb-2"
                    style={{
                      color: lastResult.grading.passed ? "rgb(22, 163, 74)" : "rgb(220, 38, 38)"
                    }}
                  >
                    {lastResult.grading.passed ? "PASS" : "FAIL"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {lastResult.grading.passed_tests} of {lastResult.grading.total_tests} tests passed
                  </div>
                </Card>
              )}

              {lastResult && (
                <div className="mt-3">
                  <h3 className="text-lg font-semibold mb-2">Last run result</h3>
                  <Card variant="muted">
                    <pre className="whitespace-pre-wrap text-sm overflow-x-auto">
                      {JSON.stringify(lastResult, null, 2)}
                    </pre>
                  </Card>
                </div>
              )}
            </Card>
          )}

          {isStudent && (
            <Card>
              <h2 className="text-2xl font-semibold mb-4">Your attempts</h2>
              {!attempts.length ? (
                <p className="text-muted-foreground">No attempts yet.</p>
              ) : (
                <ul className="space-y-2">
                  {attempts.map((t, idx) => (
                    <li key={t.id} className="text-foreground">
                      Attempt {idx + 1}: Grade {formatGradeDisplay(t.grade)}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-foreground">
                Best grade:{" "}
                <strong className="text-primary">
                  {bestGrade == null || bestGrade < 0 ? "—" : formatGradeDisplay(bestGrade)}
                </strong>
              </p>
            </Card>
          )}

          {!isStudent && (
            <Card>
              <h2 className="text-2xl font-semibold mb-4">Grades (this assignment)</h2>
              {facLoading && <p className="text-muted-foreground">Loading grades…</p>}
              {facErr && (
                <Alert variant="error">
                  <p className="font-medium">{facErr}</p>
                </Alert>
              )}

              {!facLoading && !facErr && (facRows?.length ?? 0) === 0 && (
                <p className="text-muted-foreground">No enrolled students or no data yet.</p>
              )}

              {!facLoading && !facErr && (facRows?.length ?? 0) > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[600px]">
                    <thead>
                      <tr>
                        <th className="text-left p-2 border-b border-border">
                          Student
                        </th>
                        {(() => {
                          const maxAttempts =
                            facRows?.reduce((m, r) => Math.max(m, r.attempts.length), 0) ?? 0;
                          const headers = [];
                          for (let i = 0; i < maxAttempts; i++) {
                            headers.push(
                              <th
                                key={`h-${i}`}
                                className="text-left p-2 border-b border-border"
                              >
                                Attempt {i + 1}
                              </th>
                            );
                          }
                          headers.push(
                            <th
                              key="best"
                              className="text-left p-2 border-b border-border"
                            >
                              Best
                            </th>
                          );
                          return headers;
                        })()}
                      </tr>
                    </thead>
                    <tbody>
                      {facRows!.map((row) => {
                        const maxAttempts =
                          facRows?.reduce((m, r) => Math.max(m, r.attempts.length), 0) ?? 0;
                        return (
                          <tr key={row.student_id}>
                            <td className="p-2 border-b border-border">
                              {row.username}
                            </td>
                            {[...Array(maxAttempts)].map((_, i) => {
                              const att = row.attempts[i];
                              return (
                                <td key={i} className="p-2 border-b border-border">
                              {formatGradeDisplay(att?.grade)}
                                </td>
                              );
                            })}
                            <td className="p-2 border-b border-border font-semibold">
                              {row.best == null ? "—" : formatGradeDisplay(row.best)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

        </>
      )}
    </div>
  );
}



