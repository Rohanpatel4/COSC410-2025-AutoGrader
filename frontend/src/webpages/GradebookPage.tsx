// src/webpages/GradebookPage.tsx
import React from "react";
import { useParams, Link } from "react-router-dom";
import { fetchJson } from "../api/client";
import { Card, Alert } from "../components/ui";
import { formatGradeDisplay } from "../utils/formatGrade";

type GBPayload = {
  course: { id: number; name: string; course_code: string };
  assignments: { id: number; title: string; total_points: number }[];
  students: { student_id: number; username: string; grades: Record<string, number | null> }[];
};

export default function GradebookPage() {
  const { course_id = "" } = useParams<{ course_id: string }>(); // works with numeric id or course_code
  const [data, setData] = React.useState<GBPayload | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showPoints, setShowPoints] = React.useState(false); // Toggle between percentage and points

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const payload = await fetchJson<GBPayload>(
          `/api/v1/assignments/gradebook/by-course/${encodeURIComponent(course_id)}`
        );
        setData(payload);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load gradebook");
      } finally {
        setLoading(false);
      }
    })();
  }, [course_id]);

  const aIds = data?.assignments.map((a) => a.id) ?? [];

  return (
    <div className="container py-12">
        <Card>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">
              Gradebook{" "}
              {data ? `– ${data.course.course_code || data.course.name || data.course.id}` : ""}
            </h1>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {showPoints ? "Points" : "Percentage"}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={showPoints}
                  onChange={(e) => setShowPoints(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

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
                        <th className="text-left p-2 border-b border-border">
                          Student
                        </th>
                        {data.assignments.map((a) => (
                          <th
                            key={a.id}
                            className="text-left p-2 border-b border-border"
                            title={`Assignment ${a.id}`}
                          >
                            {a.title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.students.map((s) => (
                        <tr key={s.student_id}>
                          <td className="p-2 border-b border-border font-semibold">
                            {s.username}
                          </td>
                          {aIds.map((aid) => {
                            const gradeValue = s.grades[String(aid)];
                            const assignment = data.assignments.find(a => a.id === aid);
                            const totalPoints = assignment?.total_points || 0;

                            let displayGrade = "—";
                            if (gradeValue !== null && gradeValue !== undefined) {
                              if (showPoints) {
                                // Show points format: "35/50"
                                displayGrade = `${gradeValue}/${totalPoints}`;
                              } else {
                                // Show percentage format: "70%"
                                const percentage = totalPoints > 0 ? Math.round((gradeValue / totalPoints) * 100) : 0;
                                displayGrade = `${percentage}%`;
                              }
                            }

                            return (
                              <td key={aid} className="p-2 border-b border-border text-center">
                                {displayGrade}
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
