// src/webpages/CoursePage.tsx
import React from "react";
import { useParams, Link } from "react-router-dom";
import { fetchJson } from "../api/client";
import type { Course } from "../types/courses";

export default function CoursePage() {
  const { course_id = "" } = useParams<{ course_id: string }>();

  const [course, setCourse] = React.useState<Course | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchJson<Course>(`/api/v1/courses/${encodeURIComponent(course_id)}`)
      .then((c) => {
        if (alive) setCourse(c);
      })
      .catch(async (e: any) => {
        if (!alive) return;
        // e.message may contain FastAPI's detail or raw text
        setError(e?.message || "Failed to load course");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [course_id]);

  return (
    <div className="container">
      <div style={{ marginBottom: 12 }}>
        <Link to="/my">← Back to dashboard</Link>
      </div>

      {loading && <p>Loading…</p>}
      {error && !loading && <p style={{ color: "crimson" }}>{error}</p>}

      {!loading && !error && course && (
        <>
          <h1 style={{ marginBottom: 8 }}>{course.name}</h1>
          <p style={{ margin: 0, color: "#666" }}>Course ID: {course.course_id}</p>
          {course.description && (
            <p style={{ marginTop: 8 }}>{course.description}</p>
          )}
          {course.professor_name || course.professor_id ? (
            <p style={{ marginTop: 8 }}>
              Instructor: {course.professor_name ?? course.professor_id}
            </p>
          ) : null}
        </>
      )}

      {!loading && !error && !course && (
        <p>Course not found.</p>
      )}
    </div>
  );
}
