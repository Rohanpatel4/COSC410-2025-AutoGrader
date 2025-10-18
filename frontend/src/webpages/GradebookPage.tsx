// src/webpages/GradebookPage.tsx
import React from "react";
import { useParams, Link } from "react-router-dom";
import { fetchJson } from "../api/client";

type GBPayload = {
  course: { id: number; name: string; course_tag: string };
  assignments: { id: number; title: string }[];
  students: { student_id: number; username: string; grades: Record<string, number | null> }[];
};

export default function GradebookPage() {
  const { course_id = "" } = useParams<{ course_id: string }>(); // works with numeric id or course_tag
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
    <div className="container">
      <div style={{ marginBottom: 12 }}>
        <Link to={`/courses/${encodeURIComponent(course_id)}`}>← Back to course</Link>
      </div>

      <h1>
        Gradebook{" "}
        {data ? `– ${data.course.course_tag || data.course.name || data.course.id}` : ""}
      </h1>

      {loading && <p>Loading…</p>}
      {err && <p style={{ color: "crimson" }}>{err}</p>}

      {data && (
        <>
          {data.assignments.length === 0 ? (
            <p>No assignments yet.</p>
          ) : data.students.length === 0 ? (
            <p>No enrolled students.</p>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e2e8f0" }}>
                      Student
                    </th>
                    {data.assignments.map((a) => (
                      <th
                        key={a.id}
                        style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e2e8f0" }}
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
                      <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>
                        {s.username}
                      </td>
                      {aIds.map((aid) => (
                        <td key={aid} style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                          {s.grades[String(aid)] == null ? "—" : s.grades[String(aid)]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
