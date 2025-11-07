// src/webpages/GradebookPage.tsx
import React from "react";
import { useParams, Link } from "react-router-dom";
import { fetchJson } from "../api/client";
import { Card, Alert } from "../components/ui";
import { formatGradeDisplay } from "../utils/formatGrade";

type GBPayload = {
  course: { id: number; name: string; course_code: string };
  assignments: { id: number; title: string }[];
  students: { student_id: number; username: string; grades: Record<string, number | null> }[];
};

export default function GradebookPage() {
  const { course_id = "" } = useParams<{ course_id: string }>(); // works with numeric id or course_code
  const [data, setData] = React.useState<GBPayload | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

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
          <h1 className="text-3xl font-bold mb-6">
            Gradebook{" "}
            {data ? `– ${data.course.course_code || data.course.name || data.course.id}` : ""}
          </h1>

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
                            const displayGrade = formatGradeDisplay(gradeValue);

                            return (
                              <td key={aid} className="p-2 border-b border-border">
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
