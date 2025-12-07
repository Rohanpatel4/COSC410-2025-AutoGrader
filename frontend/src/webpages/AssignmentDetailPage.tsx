// src/webpages/AssignmentDetailPage.tsx
import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchJson, BASE } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Assignment } from "../types/assignments";
import { Button, Card, Alert, Badge, RichTextEditor } from "../components/ui";
import { formatGradeDisplay } from "../utils/formatGrade";
import {
  ExternalLink,
  Eye,
  Clock,
  FileCode,
  Calendar,
  ArrowLeft,
  Settings,
  Users,
  Trophy,
  ChevronDown,
  ChevronUp,
  BookOpen,
  RotateCcw
} from "lucide-react";
import StudentAssignmentView from "./StudentAssignmentView";
import InstructionsManager from "../components/ui/InstructionsManager";

type Attempt = { id: number; grade: number | null; earned_points?: number | null };

type FacAttempt = { id: number; earned_points: number | null };
type FacRow = { student_id: number; username: string; attempts: FacAttempt[]; best: number | null };
type FacPayload = { assignment: { id: number; title: string }; students: FacRow[] };


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
  const [rerunningAll, setRerunningAll] = React.useState(false);

  // Poll server to check if rerun is in progress
  // This runs on mount and continuously polls
  React.useEffect(() => {
    if (!assignment_id || isStudent) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let isPolling = true;
    let wasRerunning = false;

    const pollRerunStatus = async () => {
      if (!isPolling) return;
      
      try {
        const status = await fetchJson<{ in_progress: boolean; started_at: string | null }>(
          `/api/v1/assignments/${encodeURIComponent(assignment_id)}/rerun-status`
        );
        
        // Update state based on server status
        setRerunningAll(status.in_progress);
        
        if (status.in_progress) {
          wasRerunning = true;
          // Continue polling while rerun is in progress
          timeoutId = setTimeout(pollRerunStatus, 5000); // Poll every 5 seconds
        } else {
          // Rerun completed - refresh grades if we were showing rerunning state
          if (wasRerunning) {
            await loadFacRows();
            wasRerunning = false;
          }
          // Continue polling to detect new reruns (poll less frequently when idle)
          timeoutId = setTimeout(pollRerunStatus, 10000); // Poll every 10 seconds when idle
        }
      } catch (e: any) {
        console.error("Error polling rerun status:", e);
        // Continue polling even on error (might be temporary)
        if (isPolling) {
          timeoutId = setTimeout(pollRerunStatus, 5000);
        }
      }
    };

    // Check immediately on mount - don't wait
    pollRerunStatus();

    return () => {
      isPolling = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [assignment_id, isStudent]);

  async function loadFacRows() {
    if (!assignment_id || isStudent) return;

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

  async function rerunAllStudents() {
    if (!assignment_id || !userId) return;

    // Optimistically set to true - server will confirm via polling
    setRerunningAll(true);
    setFacErr(null);
    setSubmitMsg(null);
    
    try {
      const res = await fetchJson<{ message: string; total_submissions: number; total_students: number; results: any[] }>(`/api/v1/assignments/${assignment_id}/rerun-all-students?user_id=${userId}`, {
        method: 'POST'
      });
      
      // Check if ALL reruns succeeded
      const allSucceeded = res.results && res.results.every((r: any) => r.success === true);
      
      if (!allSucceeded) {
        // Some reruns failed - backend should have rolled back
        const failedCount = res.results.filter((r: any) => r.success !== true).length;
        // Don't set rerunningAll to false here - let polling detect the server cleared it
        setFacErr(
          `Rerun failed: ${failedCount} out of ${res.total_submissions} attempts failed. ` +
          `Transaction was rolled back - no grades were updated.`
        );
        setSubmitMsg(null);
        return;
      }
      
      // All reruns succeeded - polling will detect completion and refresh grades
      setSubmitMsg(`Reran ${res.total_submissions} attempts across ${res.total_students} students. Waiting for completion...`);
      // Don't set rerunningAll to false here - let polling detect completion from server
    } catch (e: any) {
      // On error, the server should have cleared the rerun status
      // But set it to false immediately for better UX
      setRerunningAll(false);
      const errorMessage = e?.message ?? "Failed to rerun all student attempts";
      setFacErr(errorMessage);
      setSubmitMsg(null);
    }
  }

  // Expandable section state
  const [descriptionExpanded, setDescriptionExpanded] = React.useState(false);

  // Helper to parse description from backend (handles both JSON string and plain text)
  const parseDescription = React.useCallback((desc: string | null | undefined): any => {
    if (!desc) return null;
    try {
      // Try to parse as JSON (new format)
      const parsed = JSON.parse(desc);
      if (parsed && typeof parsed === 'object' && parsed.type) {
        return parsed; // Valid TipTap JSON
      }
      // Not a valid TipTap structure, treat as plain text
      return null;
    } catch {
      // Plain text (old format)
      return null;
    }
  }, []);

  // Check if description has rich text content
  const parsedDescription = React.useMemo(() => {
    return a ? parseDescription(a.description) : null;
  }, [a, parseDescription]);

  // Grades table expansion state
  const [gradesExpanded, setGradesExpanded] = React.useState(false);

  // Test cases for calculating total points
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
        await loadFacRows();
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
                    onClick={() => navigate(`/assignments/${assignment_id}/edit`)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
                
                {/* Description & Instructions - Combined */}
                {(() => {
                  const descriptionText = a.description || '';
                  const hasDescription = descriptionText.length > 0;
                  const hasInstructions = a.instructions && (Array.isArray(a.instructions) ? a.instructions.length > 0 : Object.keys(a.instructions).length > 0);
                  const isRichDescription = parsedDescription !== null;
                  const isLongDescription = descriptionText.length > 200;
                  const needsExpansion = isLongDescription || hasInstructions || isRichDescription;
                  
                  if (!hasDescription && !hasInstructions) return null;
                  
                  return (
                    <div className="mb-6">
                      {/* Description */}
                      {hasDescription && (
                        <div className={`leading-relaxed ${!descriptionExpanded && needsExpansion ? 'line-clamp-3' : ''}`}>
                          {isRichDescription ? (
                            <RichTextEditor
                              content={parsedDescription}
                              onChange={() => {}}
                              readOnly={true}
                            />
                          ) : (
                            <span className="text-muted-foreground">{descriptionText}</span>
                          )}
                        </div>
                      )}
                      
                      {/* Instructions - shown when expanded */}
                      {descriptionExpanded && hasInstructions && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="flex items-center gap-2 mb-3">
                            <BookOpen className="w-4 h-4 text-amber-500" />
                            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Instructions</h3>
                          </div>
                          <InstructionsManager
                            instructions={a.instructions}
                            onChange={() => {}}
                            disabled={true}
                            readOnly={true}
                          />
                        </div>
                      )}
                      
                      {/* Show more/less button - only if there's content to expand */}
                      {needsExpansion && (
                        <button
                          onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                          className="text-primary text-sm font-medium mt-2 flex items-center gap-1 hover:opacity-80"
                        >
                          {descriptionExpanded ? (
                            <>Show less <ChevronUp className="w-4 h-4" /></>
                          ) : (
                            <>Show more <ChevronDown className="w-4 h-4" /></>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })()}
                
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Student Grades</h2>
                      <p className="text-sm text-muted-foreground">View and track student progress</p>
                    </div>
                  </div>
                  {/* Rerun All Students Button */}
                  {!facLoading && !facErr && (facRows?.length ?? 0) > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={rerunAllStudents}
                      disabled={rerunningAll}
                      className="gap-2"
                    >
                      {rerunningAll ? (
                        <>
                          <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          Rerunning...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          Rerun All
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="p-6">
              {/* Hint */}
              {!facLoading && !facErr && (facRows?.length ?? 0) > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 flex items-center gap-3">
                  <Eye className="w-5 h-5 text-primary shrink-0" />
                  <p className="text-sm text-foreground">
                    <span className="font-medium">Tip:</span> Click on any grade to view submitted code. The best score is shown first, followed by attempts. Click a student name to view their first submission.
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
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left p-2 border-b border-border whitespace-nowrap sticky left-0 bg-card z-10 min-w-[150px]">
                              Student
                            </th>
                            {/* Best column first */}
                            <th className="text-center p-2 border-b border-border whitespace-nowrap min-w-[80px] bg-primary/5 font-semibold">
                              Best
                            </th>
                            {/* Attempt columns */}
                            {(() => {
                              const maxAttempts =
                                facRows?.reduce((m, r) => Math.max(m, r.attempts.length), 0) ?? 0;
                              const displayAttempts = gradesExpanded ? maxAttempts : Math.min(maxAttempts, 5);
                              const headers = [];
                              for (let i = 0; i < displayAttempts; i++) {
                                headers.push(
                                  <th
                                    key={`h-${i}`}
                                    className="text-center p-2 border-b border-border whitespace-nowrap min-w-[80px]"
                                  >
                                    Attempt {i + 1}
                                  </th>
                                );
                              }
                              // When collapsed and there are more attempts, show header for +X column
                              if (!gradesExpanded && maxAttempts > 5) {
                                headers.push(
                                  <th
                                    key="more"
                                    className="text-center p-2 border-b border-border whitespace-nowrap min-w-[80px] text-muted-foreground"
                                  >
                                    More
                                  </th>
                                );
                              }
                              // When expanded, show collapse button in last header
                              if (gradesExpanded && maxAttempts > 5) {
                                headers.push(
                                  <th
                                    key="collapse"
                                    className="text-center p-2 border-b border-border whitespace-nowrap min-w-[80px]"
                                  >
                                    <button
                                      onClick={() => setGradesExpanded(false)}
                                      className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 transition-colors"
                                    >
                                      Collapse
                                    </button>
                                  </th>
                                );
                              }
                              return headers;
                            })()}
                          </tr>
                        </thead>
                        <tbody>
                          {facRows!.map((row) => {
                            const maxAttempts =
                              facRows?.reduce((m, r) => Math.max(m, r.attempts.length), 0) ?? 0;
                            const displayAttempts = gradesExpanded ? maxAttempts : Math.min(maxAttempts, 5);
                            
                            // Per-student remaining attempts count
                            const studentRemainingAttempts = row.attempts.length > 5 ? row.attempts.length - 5 : 0;

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
                                {/* Best column first */}
                                <td className="p-2 border-b border-border font-semibold text-center whitespace-nowrap bg-primary/5">
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
                                {/* Attempt columns */}
                                {[...Array(displayAttempts)].map((_, i) => {
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
                                {/* Per-student "More" cell when collapsed - clickable to expand */}
                                {!gradesExpanded && maxAttempts > 5 && (
                                  <td className="p-2 border-b border-border text-center whitespace-nowrap">
                                    {studentRemainingAttempts > 0 ? (
                                      <button
                                        onClick={() => setGradesExpanded(true)}
                                        className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors cursor-pointer"
                                        title="Click to show all attempts"
                                      >
                                        +{studentRemainingAttempts}
                                      </button>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                )}
                                {/* Empty cell to align with Collapse header when expanded */}
                                {gradesExpanded && maxAttempts > 5 && (
                                  <td className="p-2 border-b border-border"></td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

          </>
        )}
    </div>
  );
}