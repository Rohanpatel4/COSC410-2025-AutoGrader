// src/webpages/CoursePage.tsx
/*
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
*/



//AI generated framework

import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchJson } from "../api/client";

// Dummy types—adjust as needed to match your backend.
type Student = { student_id: string; name?: string };
type Faculty = { faculty_id: string; name?: string };
type Assignment = { assignment_id: string; title: string };

export default function CoursePage() {
  const { course_id = "" } = useParams<{ course_id: string }>();
  const navigate = useNavigate();

  const [students, setStudents] = React.useState<Student[]>([]);
  const [faculty, setFaculty] = React.useState<Faculty[]>([]);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Placeholder: replace with real faculty auth check
  const isFaculty = true;

  React.useEffect(() => {
    let alive = true;
    setLoading(true);

    fetchJson<Student[]>(`/api/v1/courses/${course_id}/students`)
      .then(s => { if (alive) setStudents(s); })
      .catch(() => { if (alive) setStudents([]); });

    fetchJson<Faculty[]>(`/api/v1/courses/${course_id}/faculty`)
      .then(f => { if (alive) setFaculty(f); })
      .catch(() => { if (alive) setFaculty([]); });

    fetchJson<Assignment[]>(`/api/v1/courses/${course_id}/assignments`)
      .then(a => { if (alive) setAssignments(a); })
      .catch(() => { if (alive) setAssignments([]); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [course_id]);

  const handleDeleteStudent = (student_id: string) => {
    // TODO: call DELETE endpoint, update UI
    alert(`Delete student ${student_id} (not implemented)`);
  };

  const handleDeleteAssignment = (assignment_id: string) => {
    // TODO: call DELETE endpoint, update UI
    alert(`Delete assignment ${assignment_id} (not implemented)`);
  };

  return (
    <div className="container">
      <div style={{ marginBottom: 12 }}>
        <Link to="/my">← Back to dashboard</Link>
      </div>

      {loading && <p>Loading…</p>}

      {/* Faculty List */}
      <h2>Faculty</h2>
      {faculty.length === 0 ? (
        <p>No faculty listed.</p>
      ) : (
        <ul>
          {faculty.map(f => (
            <li key={f.faculty_id}>
              {f.name ?? f.faculty_id}
            </li>
          ))}
        </ul>
      )}

      {/* Students List */}
      <h2>Students</h2>
      {students.length === 0 ? (
        <p>No students enrolled.</p>
      ) : (
        <ul>
          {students.map(student => (
            <li key={student.student_id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {student.name ?? student.student_id}
              {isFaculty && (
                <button
                  style={{
                    background: "none", border: "none", cursor: "pointer", color: "crimson"
                  }}
                  title="Remove student"
                  onClick={() => handleDeleteStudent(student.student_id)}
                >
                  🗑️
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Assignments List */}
      <h2>Assignments</h2>
      {assignments.length === 0 ? (
        <p>No assignments.</p>
      ) : (
        <ul>
          {assignments.map(assignment => (
            <li key={assignment.assignment_id}
                style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              {/* Clickable assignment button */}
              <button
                style={{
                  background: "#4285f4",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 12px",
                  cursor: "pointer"
                }}
                onClick={() => navigate(`/assignments/${assignment.assignment_id}`)}
              >
                {assignment.title}
              </button>
              {isFaculty && (
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "crimson" }}
                  title="Delete assignment"
                  onClick={() => handleDeleteAssignment(assignment.assignment_id)}
                >
                  🗑️
                </button>
              )}
              {/* Display the submission count for each assignment */}
              <span style={{ color: "#555" }}>
                Submissions: {assignment.submission_count ?? 0}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}