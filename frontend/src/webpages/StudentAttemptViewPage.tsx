// src/webpages/StudentAttemptViewPage.tsx
import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { fetchJson, BASE } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Alert, Badge } from "../components/ui";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  User,
  FileCode,
  Calendar,
  Award,
  Users,
  ArrowLeft,
  BookOpen,
  ClipboardList,
} from "lucide-react";

interface SubmissionDetail {
  submission: {
    id: number;
    earned_points: number | null;
    code: string;
    created_at: string | null;
  };
  student: {
    id: number;
    username: string;
  };
  assignment: {
    id: number;
    title: string;
    language: string;
    total_points: number;
  };
  course: {
    id: number | null;
    name: string | null;
    course_code: string | null;
  };
  course_assignments: { id: number; title: string }[];
  attempt_number: number;
  total_attempts: number;
  all_attempts: { id: number; earned_points: number | null }[];
  students_with_attempts: { id: number; username: string }[];
}

export default function StudentAttemptViewPage() {
  const { assignment_id, submission_id } = useParams<{
    assignment_id: string;
    submission_id: string;
  }>();
  const navigate = useNavigate();
  const { userId } = useAuth();

  const [data, setData] = React.useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = React.useState<number | null>(null);
  const [studentAttempts, setStudentAttempts] = React.useState<
    { id: number; earned_points: number | null; created_at: string | null }[]
  >([]);

  // Load submission detail
  React.useEffect(() => {
    if (!assignment_id || !submission_id || !userId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchJson<SubmissionDetail>(
          `/api/v1/assignments/${assignment_id}/submission-detail/${submission_id}?user_id=${userId}`
        );
        setData(detail);
        setSelectedStudent(detail.student.id);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load submission");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [assignment_id, submission_id, userId]);

  // Load attempts when student changes
  React.useEffect(() => {
    if (!assignment_id || !selectedStudent || !userId) return;

    const loadAttempts = async () => {
      try {
        const attempts = await fetchJson<
          { id: number; earned_points: number | null; created_at: string | null }[]
        >(
          `/api/v1/assignments/${assignment_id}/students/${selectedStudent}/attempts?user_id=${userId}`
        );
        setStudentAttempts(attempts);
      } catch (e) {
        console.error("Failed to load student attempts:", e);
      }
    };

    loadAttempts();
  }, [assignment_id, selectedStudent, userId]);

  const getEditorLanguage = (lang?: string) => {
    switch (lang?.toLowerCase()) {
      case "python":
        return "python";
      case "java":
        return "java";
      case "cpp":
      case "c++":
        return "cpp";
      case "javascript":
      case "js":
        return "javascript";
      default:
        return "python";
    }
  };

  const getFileExtension = (lang?: string) => {
    switch (lang?.toLowerCase()) {
      case "python":
        return ".py";
      case "java":
        return ".java";
      case "cpp":
      case "c++":
        return ".cpp";
      case "javascript":
      case "js":
        return ".js";
      default:
        return ".py";
    }
  };

  const sanitizeFilename = (str: string) => {
    return str.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
  };

  const handleDownload = () => {
    if (!data) return;

    const { student, assignment, submission } = data;
    const ext = getFileExtension(assignment.language);
    const filename = `${sanitizeFilename(student.username)}_${sanitizeFilename(
      assignment.title
    )}_attempt${data.attempt_number}${ext}`;

    const blob = new Blob([submission.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const navigateToAttempt = (attemptId: number) => {
    navigate(`/assignments/${assignment_id}/submissions/${attemptId}`);
  };

  const navigateToStudent = async (studentId: number) => {
    setSelectedStudent(studentId);
    // Navigate to first attempt of the selected student for current assignment
    try {
      const attempts = await fetchJson<
        { id: number; earned_points: number | null; created_at: string | null }[]
      >(
        `/api/v1/assignments/${assignment_id}/students/${studentId}/attempts?user_id=${userId}`
      );
      if (attempts.length > 0) {
        navigate(`/assignments/${assignment_id}/submissions/${attempts[0].id}`);
      }
    } catch (e) {
      console.error("Failed to load student attempts:", e);
    }
  };

  const navigateToAssignment = async (newAssignmentId: number) => {
    if (!selectedStudent || !userId) return;
    
    // Try to find a submission for this student in the new assignment
    try {
      const attempts = await fetchJson<
        { id: number; earned_points: number | null; created_at: string | null }[]
      >(
        `/api/v1/assignments/${newAssignmentId}/students/${selectedStudent}/attempts?user_id=${userId}`
      );
      if (attempts.length > 0) {
        navigate(`/assignments/${newAssignmentId}/submissions/${attempts[0].id}`);
      } else {
        // No submission from this student - navigate to assignment detail
        navigate(`/assignments/${newAssignmentId}`);
      }
    } catch (e) {
      // Navigate to assignment detail page if we can't find submissions
      navigate(`/assignments/${newAssignmentId}`);
    }
  };

  const currentAttemptIndex =
    data?.all_attempts.findIndex((a) => a.id === data.submission.id) ?? -1;
  const hasPrevAttempt = currentAttemptIndex > 0;
  const hasNextAttempt =
    data && currentAttemptIndex < data.all_attempts.length - 1;

  const goToPrevAttempt = () => {
    if (hasPrevAttempt && data) {
      navigateToAttempt(data.all_attempts[currentAttemptIndex - 1].id);
    }
  };

  const goToNextAttempt = () => {
    if (hasNextAttempt && data) {
      navigateToAttempt(data.all_attempts[currentAttemptIndex + 1].id);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading submission...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <Alert variant="error">
          <p className="font-medium">{error}</p>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-container">
        <Alert variant="error">
          <p className="font-medium">Submission not found</p>
        </Alert>
      </div>
    );
  }

  const { submission, student, assignment, course, attempt_number, total_attempts } =
    data;

  const gradeDisplay =
    submission.earned_points !== null
      ? `${submission.earned_points}/${assignment.total_points}`
      : "—";
  const gradePercentage =
    submission.earned_points !== null && assignment.total_points > 0
      ? Math.round((submission.earned_points / assignment.total_points) * 100)
      : null;

  // Build course identifier for title
  const courseIdentifier = course.course_code || course.name || "Course";

  return (
    <div className="page-container">
      {/* Back Navigation */}
      <div className="mb-4">
        <Link
          to={course.id ? `/courses/${course.id}` : `/courses`}
          className="text-primary hover:opacity-80 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Course
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">
            Submission View{" "}
            {courseIdentifier ? `– ${courseIdentifier}` : ""}
          </h1>
          <p className="page-subtitle mt-2">
            View and navigate student submissions
          </p>
        </div>

        <Button onClick={handleDownload} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Download Code
        </Button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Student Info */}
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Student</p>
            <p className="font-semibold text-foreground">{student.username}</p>
          </div>
        </Card>

        {/* Attempt Info */}
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <FileCode className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Attempt</p>
            <p className="font-semibold text-foreground">
              {attempt_number} of {total_attempts}
            </p>
          </div>
        </Card>

        {/* Grade */}
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
            <Award className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Grade</p>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground">{gradeDisplay}</p>
              {gradePercentage !== null && (
                <Badge
                  variant={gradePercentage >= 70 ? "success" : "danger"}
                  className="text-xs"
                >
                  {gradePercentage}%
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {/* Submitted At */}
        <Card className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <Calendar className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Submitted</p>
            <p className="font-semibold text-foreground text-sm">
              {submission.created_at
                ? new Date(submission.created_at).toLocaleString()
                : "—"}
            </p>
          </div>
        </Card>
      </div>

      {/* Navigation Bar */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4">
          {/* Assignment Selector */}
          <div className="flex items-center gap-3 flex-1">
            <BookOpen className="w-5 h-5 text-muted-foreground shrink-0" />
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Assignment:
            </label>
            <select
              value={assignment.id}
              onChange={(e) => navigateToAssignment(Number(e.target.value))}
              className="flex-1 min-w-0 p-2 rounded-lg border border-border bg-background text-foreground"
            >
              {data.course_assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>

          {/* Student Selector */}
          <div className="flex items-center gap-3 flex-1">
            <Users className="w-5 h-5 text-muted-foreground shrink-0" />
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Student:
            </label>
            <select
              value={selectedStudent || ""}
              onChange={(e) => navigateToStudent(Number(e.target.value))}
              className="flex-1 min-w-0 p-2 rounded-lg border border-border bg-background text-foreground"
            >
              {data.students_with_attempts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.username}
                </option>
              ))}
            </select>
          </div>

          {/* Attempt Selector */}
          <div className="flex items-center gap-3 flex-1">
            <FileCode className="w-5 h-5 text-muted-foreground shrink-0" />
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Attempt:
            </label>
            <select
              value={submission.id}
              onChange={(e) => navigateToAttempt(Number(e.target.value))}
              className="flex-1 min-w-0 p-2 rounded-lg border border-border bg-background text-foreground"
            >
              {studentAttempts.map((att, index) => (
                <option key={att.id} value={att.id}>
                  Attempt {index + 1} -{" "}
                  {att.earned_points !== null
                    ? `${att.earned_points}/${assignment.total_points}`
                    : "—"}
                </option>
              ))}
            </select>
          </div>

          {/* Prev/Next Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={goToPrevAttempt}
              disabled={!hasPrevAttempt}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={goToNextAttempt}
              disabled={!hasNextAttempt}
              className="flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Code Editor (Read-Only) */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <FileCode className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Submitted Code</span>
            <Badge variant="default" className="text-xs uppercase">
              {assignment.language}
            </Badge>
          </div>
          <Badge variant="default" className="text-xs">
            Read-only
          </Badge>
        </div>

        <div className="h-[500px] bg-[#1e1e1e]">
          <Editor
            height="100%"
            language={getEditorLanguage(assignment.language)}
            theme="vs-dark"
            value={submission.code}
            options={{
              readOnly: true,
              minimap: { enabled: true },
              fontSize: 14,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              padding: { top: 16, bottom: 16 },
              lineNumbers: "on",
              renderLineHighlight: "all",
              wordWrap: "on",
            }}
            loading={
              <div className="p-4 text-muted-foreground text-sm">
                Loading editor...
              </div>
            }
          />
        </div>
      </Card>
    </div>
  );
}
