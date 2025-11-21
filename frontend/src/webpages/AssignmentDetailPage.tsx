// src/webpages/AssignmentDetailPage.tsx
import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchJson, BASE } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Assignment } from "../types/assignments";
import { Button, Card, Alert, Input, Label } from "../components/ui";
import { formatGradeDisplay } from "../utils/formatGrade";
import { GripVertical } from "lucide-react";

type Attempt = { id: number; grade: number | null; earned_points?: number | null };

type FacAttempt = { id: number; earned_points: number | null };
type FacRow = { student_id: number; username: string; attempts: FacAttempt[]; best: number | null };
type FacPayload = { assignment: { id: number; title: string }; students: FacRow[] };

type EditTestCase = {
  id: number;
  code: string;
  points: number;
  visible: boolean;
  order: number;
  isNew?: boolean;
};


export default function AssignmentDetailPage() {
  // ✅ match your route: /assignments/:assignment_id
  const { assignment_id } = useParams<{ assignment_id: string }>();
  const navigate = useNavigate();
  const { role, userId } = useAuth();
  const isStudent = role === "student";

  const [a, setA] = React.useState<Assignment | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [attempts, setAttempts] = React.useState<Attempt[]>([]);
  const [file, setFile] = React.useState<File | null>(null);
  const [code, setCode] = React.useState<string>("");
  const [submitMsg, setSubmitMsg] = React.useState<string | null>(null);
  const [lastResult, setLastResult] = React.useState<any>(null);

  const [facRows, setFacRows] = React.useState<FacRow[] | null>(null);
  const [facLoading, setFacLoading] = React.useState(false);
  const [facErr, setFacErr] = React.useState<string | null>(null);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editLanguage, setEditLanguage] = React.useState("python");
  const [editSubLimit, setEditSubLimit] = React.useState("");
  const [editStart, setEditStart] = React.useState("");
  const [editStop, setEditStop] = React.useState("");
  const [editLoading, setEditLoading] = React.useState(false);

  // Edit test cases state
  const [editTestCases, setEditTestCases] = React.useState<EditTestCase[]>([]);
  const [editTestCasesLoading, setEditTestCasesLoading] = React.useState(false);
  const [testCases, setTestCases] = React.useState<any[]>([]);

  // Get file extensions based on language
  const getFileExtensions = (language: string | undefined): string => {
    switch (language?.toLowerCase()) {
      case "python":
        return ".py";
      case "java":
        return ".java";
      case "cpp":
      case "c++":
        return ".cpp,.c,.cc,.cxx";
      case "javascript":
      case "js":
        return ".js,.jsx";
      default:
        return ".py"; // Default to Python
    }
  };

  // Calculate total points from test cases
  const totalPoints = React.useMemo(() => {
    return testCases.reduce((sum, tc) => sum + (tc.point_value || 0), 0);
  }, [testCases]);

  const downloadSubmissionCode = async (submissionId: number) => {
    if (!assignment_id) return;

    try {
      const response = await fetch(
        `${BASE}/api/v1/assignments/${encodeURIComponent(assignment_id)}/submissions/${submissionId}/code?user_id=${encodeURIComponent(String(userId))}`
      );

      if (!response.ok) {
        throw new Error(`Failed to download code: ${response.status}`);
      }

      const code = await response.text();
      const blob = new Blob([code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `submission_${submissionId}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Failed to download submission code: ${error}`);
    }
  };

  const openEditModal = async () => {
    if (!a) return;

    // Set assignment fields
    setEditTitle(a.title || "");
    setEditDescription(a.description || "");
    setEditLanguage(a.language || "python");
    setEditSubLimit(a.sub_limit?.toString() || "");
    setEditStart(a.start ? new Date(a.start).toISOString().slice(0, 16) : "");
    setEditStop(a.stop ? new Date(a.stop).toISOString().slice(0, 16) : "");

    // Fetch existing test cases
    setEditTestCasesLoading(true);
    try {
      const testCases: any[] = await fetchJson(`/api/v1/assignments/${a.id}/test-cases?include_hidden=true&user_id=${userId}`);
      setEditTestCases(testCases.map((tc: any, index: number) => ({
        id: tc.id,
        code: tc.test_code,
        points: tc.point_value,
        visible: tc.visibility,
        order: index + 1
      })));
    } catch (error) {
      console.error("Failed to fetch test cases:", error);
      setEditTestCases([]);
    } finally {
      setEditTestCasesLoading(false);
    }

    setEditModalOpen(true);
  };

  // Test case management functions for edit modal
  const addEditTestCase = () => {
    const newId = Date.now(); // Temporary ID for new test cases
    setEditTestCases(prev => [...prev, {
      id: newId,
      code: "",
      points: 10,
      visible: true,
      order: prev.length + 1,
      isNew: true // Mark as new for backend handling
    }]);
  };

  const updateEditTestCase = (id: number, field: string, value: any) => {
    setEditTestCases(prev => prev.map(tc =>
      tc.id === id ? { ...tc, [field]: value } : tc
    ));
  };

  const deleteEditTestCase = (id: number) => {
    setEditTestCases(prev => prev.filter(tc => tc.id !== id));
  };

  const moveEditTestCase = (fromIndex: number, toIndex: number) => {
    setEditTestCases(prev => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      // Update order numbers
      return result.map((tc, index) => ({ ...tc, order: index + 1 }));
    });
  };

  const deleteAssignment = async () => {
    if (!a || !assignment_id) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the assignment "${a.title}"? This action cannot be undone and will delete all associated submissions and test cases.`
    );

    if (!confirmed) return;

    setEditLoading(true);
    try {
      await fetchJson(
        `/api/v1/assignments/${encodeURIComponent(assignment_id)}`,
        { method: "DELETE" }
      );

      // Navigate back to the course page
      if (a.course_id) {
        navigate(`/courses/${a.course_id}`);
      } else {
        navigate("/courses");
      }
    } catch (e: any) {
      alert(`Failed to delete assignment: ${e?.message ?? "Unknown error"}`);
    } finally {
      setEditLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!a || !assignment_id) return;

    setEditLoading(true);
    try {
      // Update assignment details
      const payload: any = {
        title: editTitle.trim(),
      };

      if (editDescription.trim()) payload.description = editDescription.trim();
      if (editLanguage) payload.language = editLanguage;
      if (editSubLimit) payload.sub_limit = editSubLimit;
      if (editStart) payload.start = editStart;
      if (editStop) payload.stop = editStop;

      await fetchJson(
        `/api/v1/assignments/${encodeURIComponent(assignment_id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      // Handle test cases
      const assignmentId = parseInt(assignment_id);

      // Get original test cases to compare
      const originalTestCases: any[] = await fetchJson(`/api/v1/assignments/${assignmentId}/test-cases`);
      const originalIds = new Set(originalTestCases.map((tc: any) => tc.id));
      const currentIds = new Set(editTestCases.map(tc => tc.id));

      // Delete removed test cases
      for (const originalTc of originalTestCases) {
        if (!currentIds.has(originalTc.id)) {
          await fetchJson(
            `/api/v1/assignments/${assignmentId}/test-cases/${originalTc.id}`,
            { method: "DELETE" }
          );
        }
      }

      // Update existing and create new test cases
      for (const tc of editTestCases) {
        const tcPayload = {
          test_code: tc.code,
          point_value: tc.points,
          visibility: tc.visible,
          order: tc.order
        };

        if (tc.isNew) {
          // Create new test case
          await fetchJson(
            `/api/v1/assignments/${assignmentId}/test-cases`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(tcPayload),
            }
          );
        } else {
          // Update existing test case
          await fetchJson(
            `/api/v1/assignments/${assignmentId}/test-cases/${tc.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(tcPayload),
            }
          );
        }
      }

      // Reload assignment data
      await loadAll();
      setEditModalOpen(false);
    } catch (e: any) {
      alert(`Failed to update assignment: ${e.message}`);
    } finally {
      setEditLoading(false);
    }
  };


  async function loadAll() {
    if (!assignment_id) return; // guard
    setLoading(true);
    setErr(null);
    try {
      const details = await fetchJson<Assignment>(
        `/api/v1/assignments/${encodeURIComponent(assignment_id)}`
      );
      setA(details);

      // Load test cases to calculate total points
      try {
        const testCasesData: any[] = await fetchJson<any[]>(
          `/api/v1/assignments/${encodeURIComponent(assignment_id)}/test-cases?include_hidden=true&user_id=${userId}`
        ).catch(() => []);
        setTestCases(testCasesData || []);
      } catch (e) {
        setTestCases([]);
      }

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

    // Check if either file or code is provided
    if (!file && !code.trim()) {
      const lang = a?.language || "python";
      const extensions = getFileExtensions(lang);
      setSubmitMsg(`Either choose a ${extensions.split(',')[0]} file or paste your code`);
      return;
    }

    setSubmitMsg("Submitting…");
    setLastResult(null);

    try {
      const fd = new FormData();
      fd.append("student_id", String(userId ?? "")); // API expects this

      if (file) {
        // File upload mode
        fd.append("submission", file);
      } else {
        // Code text mode
        fd.append("code", code.trim());
      }

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
              <div className="flex justify-between items-start mb-4">
                <h1 className="text-3xl font-bold">{a.title}</h1>
                {!isStudent && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={openEditModal}
                  >
                    Edit Assignment
                  </Button>
                )}
              </div>
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
              <h2 className="text-2xl font-semibold mb-4">Submit Code</h2>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Option 1: Upload a file</h3>
                    <input
                      type="file"
                      accept={getFileExtensions(a?.language)}
                      aria-label="Upload your code file"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      disabled={nowBlocked || limitReached}
                      className="block text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 disabled:opacity-50"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Accepted: {getFileExtensions(a?.language).split(',').join(', ')}
                    </p>
                  </div>

                  <div className="text-center text-muted-foreground">
                    <span className="px-3 py-1 bg-muted rounded-full text-xs font-medium">OR</span>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Option 2: Paste your code</h3>
                    <textarea
                      placeholder={`Paste your ${a?.language ? a.language.charAt(0).toUpperCase() + a.language.slice(1) : 'code'} code here...`}
                      className="w-full h-64 font-mono text-sm resize-vertical"
                      style={{
                        fontFamily: "'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                        lineHeight: '1.5',
                        tabSize: '4'
                      }}
                      onChange={(e) => setCode(e.target.value)}
                      value={code}
                      disabled={nowBlocked || limitReached}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={(!file && !code.trim()) || nowBlocked || limitReached}>
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
                    backgroundColor: lastResult.result?.grading?.all_passed ? "rgb(240, 253, 244)" : "rgb(254, 242, 242)",
                    borderColor: lastResult.result?.grading?.all_passed ? "rgb(22, 163, 74)" : "rgb(220, 38, 38)",
                    borderWidth: "2px"
                  }}
                >
                  <div
                    className="text-2xl font-bold mb-2"
                    style={{
                      color: lastResult.result?.grading?.all_passed ? "rgb(22, 163, 74)" : "rgb(220, 38, 38)"
                    }}
                  >
                    {lastResult.result?.grading?.all_passed ? "PASS" : "FAIL"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {lastResult.result?.grading?.passed_tests || 0} of {lastResult.result?.grading?.total_tests || 0} tests passed
                  </div>
                </Card>
              )}

              {lastResult && lastResult.test_cases && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Test Results</h3>
                  <div className="space-y-3">
                    {lastResult.test_cases.map((testCase: any) => (
                      <Card key={testCase.id} variant="muted" className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {/* Pass/Fail indicator */}
                            <div
                              className={`w-4 h-4 rounded-full ${
                                testCase.passed ? 'bg-green-500' : 'bg-red-500'
                              }`}
                              title={testCase.passed ? 'Passed' : 'Failed'}
                            />
                            <span className="font-medium">
                              Test Case {testCase.order || testCase.id}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              ({testCase.point_value} point{testCase.point_value !== 1 ? 's' : ''})
                            </span>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${
                              testCase.passed ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {testCase.points_earned || 0} / {testCase.point_value}
                            </div>
                          </div>
                        </div>

                        {/* Show details only for visible test cases */}
                        {testCase.visibility ? (
                          <div className="mt-3">
                            <div className="bg-card border border-border rounded p-3">
                              <pre className="text-sm font-mono whitespace-pre-wrap text-slate-100">
                                {testCase.test_code}
                              </pre>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <div className="text-sm text-muted-foreground italic bg-slate-700 border border-slate-600 rounded p-3">
                              Test case details not visible to students
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="mt-4 p-4 bg-card border border-border rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-100">Overall Result:</span>
                      <span className={`font-bold text-lg ${
                        lastResult.result?.grading?.all_passed ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {lastResult.result?.grading?.all_passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300 mt-1">
                      {lastResult.result?.grading?.passed_tests || 0} of {lastResult.result?.grading?.total_tests || 0} tests passed
                    </div>
                  </div>
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
                  {attempts.map((t, idx) => {
                    const earnedPoints = t.earned_points ?? t.grade ?? 0;
                    const displayPoints = totalPoints > 0 
                      ? `${earnedPoints} / ${totalPoints}` 
                      : formatGradeDisplay(t.grade);
                    return (
                      <li key={t.id} className="text-foreground">
                        Attempt {idx + 1}: <span className="font-medium">{displayPoints}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-4 text-foreground">
                Best grade:{" "}
                <strong className="text-primary">
                  {bestGrade == null || bestGrade < 0 
                    ? "—" 
                    : totalPoints > 0 
                      ? `${bestGrade} / ${totalPoints}` 
                      : formatGradeDisplay(bestGrade)}
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
                              const earnedPoints = att?.earned_points ?? null;
                              const displayPoints = earnedPoints !== null && totalPoints > 0
                                ? `${earnedPoints} / ${totalPoints}`
                                : formatGradeDisplay(earnedPoints);
                              
                              return (
                                <td key={i} className="p-2 border-b border-border">
                                  {att ? (
                                    <button
                                      onClick={() => downloadSubmissionCode(att.id)}
                                      className="text-primary hover:underline font-medium"
                                      title="Click to download submitted code"
                                    >
                                      {displayPoints}
                                    </button>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              );
                            })}
                            <td className="p-2 border-b border-border font-semibold">
                              {row.best == null 
                                ? "—" 
                                : totalPoints > 0 
                                  ? `${row.best} / ${totalPoints}` 
                                  : formatGradeDisplay(row.best)}
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

        {/* Edit Assignment Modal */}
        {editModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Edit Assignment</h2>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={deleteAssignment}
                  disabled={editLoading}
                >
                  Delete
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-title">Title *</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Assignment title"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <textarea
                    id="edit-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Assignment description"
                    rows={3}
                    className="w-full p-2 border border-gray-300 rounded resize-vertical"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-language">Language</Label>
                  <select
                    id="edit-language"
                    value={editLanguage}
                    onChange={(e) => setEditLanguage(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>

                  </select>
                </div>

                <div>
                  <Label htmlFor="edit-sub-limit">Submission Limit</Label>
                  <Input
                    id="edit-sub-limit"
                    type="number"
                    value={editSubLimit}
                    onChange={(e) => setEditSubLimit(e.target.value)}
                    placeholder="Unlimited if empty"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-start">Start Date/Time</Label>
                  <Input
                    id="edit-start"
                    type="datetime-local"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-stop">End Date/Time</Label>
                  <Input
                    id="edit-stop"
                    type="datetime-local"
                    value={editStop}
                    onChange={(e) => setEditStop(e.target.value)}
                  />
                </div>
              </div>

              {/* Test Cases Section */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Test Cases</h3>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addEditTestCase}
                    disabled={editTestCasesLoading}
                  >
                    Add Test Case
                  </Button>
                </div>

                {editTestCasesLoading ? (
                  <p className="text-muted-foreground">Loading test cases...</p>
                ) : editTestCases.length === 0 ? (
                  <p className="text-muted-foreground">No test cases yet. Click "Add Test Case" to create one.</p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {editTestCases.map((testCase, index) => (
                      <div
                        key={testCase.id}
                        className="space-y-2 border border-border rounded p-4 bg-muted/20"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', index.toString())}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                          moveEditTestCase(fromIndex, index);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="cursor-move text-muted-foreground hover:text-foreground">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <Label className="text-sm font-medium">
                            Test Case {index + 1}:
                          </Label>
                          <div className="flex items-center gap-4 ml-auto">
                            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                              <input
                                type="checkbox"
                                checked={testCase.visible}
                                onChange={(e) => updateEditTestCase(testCase.id, 'visible', e.target.checked)}
                                className="w-4 h-4"
                              />
                              visible
                            </label>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm text-muted-foreground">points:</Label>
                              <Input
                                type="number"
                                min="1"
                                value={testCase.points || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '') {
                                    updateEditTestCase(testCase.id, 'points', 0);
                                  } else {
                                    const numVal = parseInt(val);
                                    updateEditTestCase(testCase.id, 'points', isNaN(numVal) ? 1 : numVal);
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (!val || val < 1) {
                                    updateEditTestCase(testCase.id, 'points', 1);
                                  }
                                }}
                                className="w-16 h-8 text-center"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => deleteEditTestCase(testCase.id)}
                              disabled={editTestCases.length <= 1}
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                        <textarea
                          placeholder="Enter test case code (e.g., assert add(2, 3) == 5)"
                          value={testCase.code}
                          onChange={(e) => updateEditTestCase(testCase.id, 'code', e.target.value)}
                          rows={3}
                          className="w-full p-2 border border-border rounded text-sm font-mono resize-vertical"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setEditModalOpen(false)}
                  disabled={editLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveEdit}
                  disabled={editLoading || !editTitle.trim()}
                  className="flex-1"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        )}

        </>
      )}
    </div>
  );
}



