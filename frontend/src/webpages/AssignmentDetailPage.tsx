// src/webpages/AssignmentDetailPage.tsx
import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchJson, BASE } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Assignment } from "../types/assignments";
import { Button, Card, Alert, Input, Label, Badge } from "../components/ui";
import { formatGradeDisplay } from "../utils/formatGrade";
import { 
  GripVertical, 
  ExternalLink, 
  Eye, 
  Clock, 
  FileCode, 
  Calendar, 
  ArrowLeft,
  Settings,
  Users,
  Trophy
} from "lucide-react";
import StudentAssignmentView from "./StudentAssignmentView";
import InstructionsManager from "../components/ui/InstructionsManager";

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
  const [editInstructions, setEditInstructions] = React.useState<any>(null);
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
    // Set instructions directly
    setEditInstructions(a.instructions || null);

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
      payload.instructions = editInstructions;

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
        // For students, don't use include_hidden (they can't see hidden test cases via API)
        // For faculty, use include_hidden to get all test cases
        const url = isStudent
          ? `/api/v1/assignments/${encodeURIComponent(assignment_id)}/test-cases?user_id=${userId}`
          : `/api/v1/assignments/${encodeURIComponent(assignment_id)}/test-cases?include_hidden=true&user_id=${userId}`;
        const testCasesData: any[] = await fetchJson<any[]>(url).catch(() => []);
        setTestCases(testCasesData || []);
      } catch (e) {
        console.error("Failed to load test cases:", e);
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

      setSubmitMsg(`Submitted. Grade: ${formatGradeDisplay(data?.grade)}%`);
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

  if (isStudent && a) {
    return (
      <>
        {/* For students, we render the full-screen assignment view without the container/padding wrappers */}
        {loading && <div className="p-8 text-center text-muted-foreground">Loading…</div>}
        {err && (
          <div className="p-4">
             <Alert variant="error">
                <p className="font-medium">{err}</p>
             </Alert>
          </div>
        )}
        
        <StudentAssignmentView
          assignment={a}
          attempts={attempts}
          bestGrade={bestGrade}
          totalPoints={totalPoints}
          testCases={testCases}
          onCodeChange={setCode}
          onFileChange={setFile}
          onSubmit={onSubmit}
          loading={submitMsg === "Submitting…"}
          submitMsg={submitMsg}
          lastResult={lastResult}
          nowBlocked={nowBlocked}
          limitReached={limitReached}
          initialCode={code}
          instructions={a.instructions}
        />
      </>
    );
  }

  return (
    <div className="page-container">
        {/* Back Navigation */}
        <div className="mb-4">
          {a?.course_id ? (
            <Link 
              to={`/courses/${encodeURIComponent(a.course_id)}`} 
              className="text-primary hover:opacity-80 inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to course
            </Link>
          ) : (
            <Link to="/my" className="text-primary hover:opacity-80 inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          )}
        </div>

        {!assignment_id && (
          <Alert variant="error">
            <p className="font-medium">No assignment selected.</p>
          </Alert>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading assignment...</p>
            </div>
          </div>
        )}
        {err && (
          <Alert variant="error">
            <p className="font-medium">{err}</p>
          </Alert>
        )}

        {!a ? null : (
          <>
            {/* Assignment Header Card */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm mb-6">
              {/* Assignment Info */}
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h1 className="text-3xl font-bold text-foreground">{a.title}</h1>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={openEditModal}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
                {a.description && (
                  <p className="text-muted-foreground mb-6 leading-relaxed">{a.description}</p>
                )}
                
                {/* Stats Grid - 5 items */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {/* Language */}
                  <div className="bg-muted/30 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                      <FileCode className="w-5 h-5 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Language</p>
                      <p className="text-lg font-bold text-foreground capitalize">{a.language || 'Python'}</p>
                    </div>
                  </div>
                  
                  {/* Total Points */}
                  <div className="bg-muted/30 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Points</p>
                      <p className="text-lg font-bold text-foreground">{totalPoints}</p>
                    </div>
                  </div>
                  
                  {/* Submissions Limit */}
                  <div className="bg-muted/30 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <FileCode className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Limit</p>
                      <p className="text-lg font-bold text-foreground">{a.sub_limit == null ? "∞" : a.sub_limit}</p>
                    </div>
                  </div>
                  
                  {/* Start Date */}
                  <div className="bg-muted/30 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Opens</p>
                      <p className="text-sm font-semibold text-foreground">
                        {a.start ? new Date(a.start).toLocaleDateString() : <span className="text-muted-foreground">Not set</span>}
                      </p>
                    </div>
                  </div>
                  
                  {/* End Date */}
                  <div className="bg-muted/30 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Closes</p>
                      <p className="text-sm font-semibold text-foreground">
                        {a.stop ? new Date(a.stop).toLocaleDateString() : <span className="text-muted-foreground">Not set</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grades Section */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Student Grades</h2>
                    <p className="text-sm text-muted-foreground">View and track student progress</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
              {/* Hint */}
              {!facLoading && !facErr && (facRows?.length ?? 0) > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 flex items-center gap-3">
                  <Eye className="w-5 h-5 text-primary shrink-0" />
                  <p className="text-sm text-foreground">
                    <span className="font-medium">Tip:</span> Click on any grade or the best score to view submitted code. Click a student name to view their first submission.
                  </p>
                </div>
              )}
              
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
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left p-2 border-b border-border whitespace-nowrap sticky left-0 bg-card z-10 min-w-[150px]">
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
                                    className="text-center p-2 border-b border-border whitespace-nowrap min-w-[80px]"
                                  >
                                    Attempt {i + 1}
                                  </th>
                                );
                              }
                              headers.push(
                                <th
                                  key="best"
                                  className="text-center p-2 border-b border-border whitespace-nowrap min-w-[80px] bg-muted/30"
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
                            
                            // Get first attempt for student name click
                            const firstAttempt = row.attempts[0];
                            
                            return (
                              <tr key={row.student_id} className="group hover:bg-muted/30 transition-colors">
                                <td className="p-2 border-b border-border whitespace-nowrap sticky left-0 bg-card z-10 font-medium">
                                  {firstAttempt ? (
                                    <span
                                      onClick={() => navigate(`/assignments/${assignment_id}/submissions/${firstAttempt.id}`)}
                                      className="hover:text-primary transition-colors cursor-pointer inline-flex items-center group/btn"
                                      title="Click to view student's first submission"
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => e.key === 'Enter' && navigate(`/assignments/${assignment_id}/submissions/${firstAttempt.id}`)}
                                    >
                                      {row.username}
                                      <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover/btn:opacity-50 transition-opacity" />
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      {row.username}
                                    </span>
                                  )}
                                </td>
                                {[...Array(maxAttempts)].map((_, i) => {
                                  const att = row.attempts[i];
                                  const earnedPoints = att?.earned_points ?? null;
                                  const displayPoints = earnedPoints !== null && totalPoints > 0
                                    ? `${earnedPoints}/${totalPoints}`
                                    : formatGradeDisplay(earnedPoints);
                                  
                                  const percentage = earnedPoints !== null && totalPoints > 0
                                    ? Math.round((earnedPoints / totalPoints) * 100)
                                    : null;
                                  
                                  return (
                                    <td key={i} className="p-2 border-b border-border text-center whitespace-nowrap">
                                      {att ? (
                                        <button
                                          onClick={() => navigate(`/assignments/${assignment_id}/submissions/${att.id}`)}
                                          className={`
                                            px-3 py-1 rounded-lg font-medium transition-all duration-200
                                            hover:scale-105 cursor-pointer
                                            ${percentage !== null
                                              ? percentage >= 70
                                                ? "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20"
                                                : percentage >= 50
                                                  ? "bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20"
                                                  : "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20"
                                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                                            }
                                          `}
                                          title="Click to view submitted code"
                                        >
                                          {displayPoints}
                                        </button>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="p-2 border-b border-border font-semibold text-center whitespace-nowrap bg-muted/30">
                                  {(() => {
                                    if (row.best == null) return "—";
                                    
                                    // Find the best attempt (the one with earned_points matching row.best)
                                    const bestAttempt = row.attempts.find(att => att.earned_points === row.best);
                                    const displayBest = totalPoints > 0 
                                      ? `${row.best}/${totalPoints}` 
                                      : formatGradeDisplay(row.best);
                                    const percentage = totalPoints > 0
                                      ? Math.round((row.best / totalPoints) * 100)
                                      : null;
                                    
                                    if (!bestAttempt) return displayBest;
                                    
                                    return (
                                      <button
                                        onClick={() => navigate(`/assignments/${assignment_id}/submissions/${bestAttempt.id}`)}
                                        className={`
                                          px-3 py-1 rounded-lg font-semibold transition-all duration-200
                                          hover:scale-105 cursor-pointer
                                          ${percentage !== null
                                            ? percentage >= 70
                                              ? "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20"
                                              : percentage >= 50
                                                ? "bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20"
                                                : "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                          }
                                        `}
                                        title="Click to view best submission"
                                      >
                                        {displayBest}
                                      </button>
                                    );
                                  })()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

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

                    <InstructionsManager
                      instructions={editInstructions}
                      onChange={setEditInstructions}
                      disabled={editLoading}
                    />

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