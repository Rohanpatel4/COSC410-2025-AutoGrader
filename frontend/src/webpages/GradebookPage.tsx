// src/webpages/GradebookPage.tsx
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchJson } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Card, Alert, Badge } from "../components/ui";
import { ExternalLink, Eye } from "lucide-react";

type GBPayload = {
  course: { id: number; name: string; course_code: string };
  assignments: { id: number; title: string; total_points: number }[];
  students: { student_id: number; username: string; grades: Record<string, number | null> }[];
};

type StudentAttemptsPayload = {
  assignment: { id: number; title: string };
  students: {
    student_id: number;
    username: string;
    attempts: { id: number; earned_points: number | null }[];
    best: number | null;
  }[];
};

export default function GradebookPage() {
  const { course_id = "" } = useParams<{ course_id: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [data, setData] = React.useState<GBPayload | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showPoints, setShowPoints] = React.useState(false);

  // Cache for best submission IDs per student/assignment
  const [submissionCache, setSubmissionCache] = React.useState<
    Map<string, number | null>
  >(new Map());

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const payload = await fetchJson<GBPayload>(
          `/api/v1/assignments/gradebook/by-course/${encodeURIComponent(course_id)}`
        );
        setData(payload);

        // Pre-fetch submission data for each assignment to get submission IDs
        const newCache = new Map<string, number | null>();
        for (const assignment of payload.assignments) {
          try {
            const attemptsData = await fetchJson<StudentAttemptsPayload>(
              `/api/v1/assignments/${assignment.id}/grades`
            );
            
            for (const student of attemptsData.students) {
              // Get the best attempt (last one with max points) or first attempt if none
              if (student.attempts.length > 0) {
                // Find best attempt
                let bestAttempt = student.attempts[0];
                for (const att of student.attempts) {
                  if (att.earned_points !== null && 
                      (bestAttempt.earned_points === null || att.earned_points > bestAttempt.earned_points)) {
                    bestAttempt = att;
                  }
                }
                newCache.set(`${student.student_id}-${assignment.id}`, bestAttempt.id);
              }
            }
          } catch (e) {
            console.error(`Failed to fetch attempts for assignment ${assignment.id}:`, e);
          }
        }
        setSubmissionCache(newCache);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load gradebook");
      } finally {
        setLoading(false);
      }
    })();
  }, [course_id]);

  const aIds = data?.assignments.map((a) => a.id) ?? [];

  const handleGradeClick = (studentId: number, assignmentId: number) => {
    const submissionId = submissionCache.get(`${studentId}-${assignmentId}`);
    if (submissionId) {
      navigate(`/assignments/${assignmentId}/submissions/${submissionId}`);
    } else {
      // Fallback: navigate to assignment detail page
      navigate(`/assignments/${assignmentId}`);
    }
  };

  const handleStudentClick = (studentId: number) => {
    // Navigate to the first assignment with a submission
    if (data && data.assignments.length > 0) {
      for (const assignment of data.assignments) {
        const submissionId = submissionCache.get(`${studentId}-${assignment.id}`);
        if (submissionId) {
          navigate(`/assignments/${assignment.id}/submissions/${submissionId}`);
          return;
        }
      }
      // No submissions found, navigate to first assignment
      navigate(`/assignments/${data.assignments[0].id}`);
    }
  };

  return (
    <div className="page-container">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="page-title">
            Gradebook{" "}
            {data ? `– ${data.course.course_code || data.course.name || data.course.id}` : ""}
          </h1>
          <p className="page-subtitle">View and manage student grades</p>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={() => setShowPoints(false)}
            className={`px-3 py-1.5 rounded-l-lg font-medium transition-colors ${
              !showPoints
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Percentage
          </button>
          <button
            onClick={() => setShowPoints(true)}
            className={`px-3 py-1.5 rounded-r-lg font-medium transition-colors ${
              showPoints
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Points
          </button>
        </div>
      </div>

      {/* Hint Card */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
        <Eye className="w-5 h-5 text-primary shrink-0" />
        <p className="text-sm text-foreground">
          <span className="font-medium">Tip:</span> Click on any grade to view the student's submitted code. Click on a student name to view their first submission.
        </p>
      </div>

      <Card>
        {loading && <p className="text-center text-muted-foreground">Loading…</p>}
        {err && (
          <Alert variant="error">
            <p className="font-medium">{err}</p>
          </Alert>
        )}

        {data && (
          <>
            {data.assignments.length === 0 ? (
              <p className="text-muted-foreground">No assignments yet.</p>
            ) : data.students.length === 0 ? (
              <p className="text-muted-foreground">No enrolled students.</p>
            ) : (
              <div className="overflow-x-auto mt-3">
                <table className="w-full border-collapse min-w-[800px]">
                  <thead>
                    <tr>
                      <th className="text-left p-2 border-b border-border w-[200px]">
                        Student
                      </th>
                      {data.assignments.map((a) => (
                        <th
                          key={a.id}
                          className="text-center p-2 border-b border-border"
                          title={a.title}
                        >
                          <button
                            onClick={() => navigate(`/assignments/${a.id}`)}
                            className="hover:text-primary transition-colors underline-offset-2 hover:underline font-semibold"
                          >
                            {a.title}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s) => (
                      <tr key={s.student_id} className="group hover:bg-muted/30 transition-colors">
                        <td className="p-2 border-b border-border font-semibold">
                          {submissionCache.has(`${s.student_id}-${aIds[0]}`) || 
                           aIds.some(aid => submissionCache.has(`${s.student_id}-${aid}`)) ? (
                            <span
                              onClick={() => handleStudentClick(s.student_id)}
                              className="hover:text-primary transition-colors cursor-pointer inline-flex items-center group/btn"
                              title="Click to view student's submissions"
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => e.key === 'Enter' && handleStudentClick(s.student_id)}
                            >
                              {s.username}
                              <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover/btn:opacity-50 transition-opacity" />
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {s.username}
                            </span>
                          )}
                        </td>
                        {aIds.map((aid) => {
                          const gradeValue = s.grades[String(aid)];
                          const assignment = data.assignments.find(a => a.id === aid);
                          const totalPoints = assignment?.total_points || 0;
                          const hasSubmission = submissionCache.has(`${s.student_id}-${aid}`);

                          let displayGrade = "—";
                          if (gradeValue !== null && gradeValue !== undefined) {
                            if (showPoints) {
                              displayGrade = `${gradeValue}/${totalPoints}`;
                            } else {
                              const percentage = totalPoints > 0 ? Math.round((gradeValue / totalPoints) * 100) : 0;
                              displayGrade = `${percentage}%`;
                            }
                          }

                          const percentage = gradeValue !== null && totalPoints > 0
                            ? Math.round((gradeValue / totalPoints) * 100)
                            : null;

                          return (
                            <td key={aid} className="p-2 border-b border-border text-center">
                              {hasSubmission ? (
                                <button
                                  onClick={() => handleGradeClick(s.student_id, aid)}
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
                                  {displayGrade}
                                </button>
                              ) : (
                                <span className="text-muted-foreground">{displayGrade}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
