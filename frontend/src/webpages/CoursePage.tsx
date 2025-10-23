// src/webpages/CoursePage.tsx
import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchJson, BASE } from "../api/client";
import type { Assignment } from "../types/assignments";
import { useAuth } from "../auth/AuthContext";

type Student = { id: number; name?: string };
type Faculty = { id: number; name?: string };

type CoursePayload = {
  id: number;
  course_code: string;           // e.g., "COSC-410"
  name: string;                  // course title/name
  description?: string | null;
  enrollment_key?: string;       // present for faculty views
};

export default function CoursePage() {
  const { course_id = "" } = useParams<{ course_id: string }>();
  const navigate = useNavigate();
  const { role, userId } = useAuth();
  const isFaculty = role === "faculty";
  const [course, setCourse] = React.useState<CoursePayload | null>(null);

  const [students, setStudents] = React.useState<Student[]>([]);
  const [faculty, setFaculty] = React.useState<Faculty[]>([]);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // create form
  const [showCreate, setShowCreate] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [subLimit, setSubLimit] = React.useState<string>("");
  const [start, setStart] = React.useState<string>("");
  const [stop, setStop] = React.useState<string>("");
  const [testFile, setTestFile] = React.useState<File | null>(null);

  async function loadAll() {
  // Don’t wipe old data
  setErr(null);
  setLoading(true);

  try {
      const studentIdParam =
        role === "student" && userId ? `?student_id=${userId}` : "";

      const [courseData, s, f, a] = await Promise.all([
        fetchJson<CoursePayload>(`/api/v1/courses/${encodeURIComponent(course_id)}`),
        fetchJson<Student[]>(`/api/v1/courses/${encodeURIComponent(course_id)}/students`),
        fetchJson<Faculty[]>(`/api/v1/courses/${encodeURIComponent(course_id)}/faculty`),
        fetchJson<Assignment[]>(
          `/api/v1/courses/${encodeURIComponent(course_id)}/assignments${studentIdParam}`
        ),
      ]);

    // ✅ Update all data once fetch completes
    setCourse(courseData);
    setStudents(s);
    setFaculty(f);
    setAssignments(a);
  } catch (e: any) {
    setErr(e?.message ?? "Failed to load course page");
  } finally {
    // ✅ Only mark loading as false, don’t reset course
    setLoading(false);
  }
}


  React.useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course_id]);

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const payload: any = {
      title: title.trim(),
      description: description.trim() || null,
    };
    const limitNum = subLimit.trim() ? Number(subLimit.trim()) : null;
    if (limitNum != null && Number.isFinite(limitNum)) payload.sub_limit = limitNum;
    if (start) payload.start = start;
    if (stop) payload.stop = stop;

    if (!payload.title) {
      setErr("Title is required.");
      return;
    }

    try {
      // POST to the course-specific assignments endpoint
      const created = await fetchJson<Assignment>(`/api/v1/courses/${encodeURIComponent(course_id)}/assignments`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setAssignments((prev) => [created, ...prev]);

      // If a test file was picked, attach it
      if (testFile) {
        const fd = new FormData();
        fd.append("file", testFile);
        await fetch(`${BASE}/api/v1/assignments/${created.id}/test-file`, {
          method: "POST",
          body: fd,
        });
      }

      // reset
      setTitle("");
      setDescription("");
      setSubLimit("");
      setStart("");
      setStop("");
      setTestFile(null);
      setShowCreate(false);
    } catch (e: any) {
      setErr(e?.message ?? "Create failed");
    }
  }

  const handleDeleteStudent = (student_id: number) => {
    alert(`Delete student ${student_id} (not implemented)`);
  };

  const handleDeleteAssignment = (assignment_id: number) => {
    alert(`Delete assignment ${assignment_id} (not implemented)`);
  };

  return (
    <div className="container">
      <div style={{ marginBottom: 12 }}>
        <Link to="/my">← Back to dashboard</Link>
      </div>
      {course && (
        <div style={{ marginBottom: 24 }}>
          {/* Header uses course_code – name */}
          <h1 style={{ marginBottom: 4 }}>
            {course.course_code} – {course.name}
          </h1>

          {/* Description + Enrollment key (if present) */}
          <div style={{ color: "#555", fontSize: "1rem" }}>
            <p style={{ marginTop: 0 }}>
              {course.description || "No description provided."}
            </p>
            {course.enrollment_key && (
              <p style={{ marginTop: 6 }}>
                <span style={{ color: "#6b7280" }}>Enrollment key: </span>
                <code>{course.enrollment_key}</code>
              </p>
            )}
          </div>
    {loading && (
      <p style={{ color: "#888", fontStyle: "italic" }}>Refreshing data…</p>
    )}
  </div>
)}


      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {loading && <p>Loading…</p>}

      <h2>Faculty</h2>
      {faculty.length === 0 ? <p>No faculty listed.</p> : (
        <ul>{faculty.map((f) => <li key={f.id}>{f.name ?? f.id}</li>)}</ul>
      )}

      <h2>Students</h2>
      {students.length === 0 ? <p>No students enrolled.</p> : (
        <ul>
          {students.map((s) => (
            <li key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {s.name ?? s.id}
              {isFaculty && (
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "crimson" }}
                  title="Remove student"
                  onClick={() => handleDeleteStudent(s.id)}
                >
                  🗑️
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Assignments</h2>
        {isFaculty && (
          <>
            <button onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Cancel" : "Create Assignment"}
            </button>
            <button onClick={() => navigate(`/courses/${encodeURIComponent(course_id)}/gradebook`)}>
              View Gradebook
            </button>
          </>
        )}
      </div>

      {isFaculty && showCreate && (
        <form
          noValidate
          onSubmit={createAssignment}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            margin: "12px 0",
            display: "grid",
            gap: 8,
            maxWidth: 560,
          }}
        >
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <label>
            Submission limit (blank = no limit)
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="e.g., 3"
              value={subLimit}
              onChange={(e) => setSubLimit(e.target.value)}
            />
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label>
              Start
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} style={{ marginLeft: 6 }} />
            </label>
            <label>
              Stop
              <input type="datetime-local" value={stop} onChange={(e) => setStop(e.target.value)} style={{ marginLeft: 6 }} />
            </label>
          </div>

          <label>
            Attach test file (.py) now (optional)
            <input
              type="file"
              accept=".py"
              onChange={(e) => setTestFile(e.target.files?.[0] ?? null)}
              style={{ display: "block", marginTop: 6 }}
            />
          </label>

          <div>
            <button type="submit">Save Assignment</button>
          </div>
        </form>
      )}

      {assignments.length === 0 ? (
        <p>No assignments.</p>
      ) : (
        <ul>
          {assignments.map((a) => (
            <li key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <button
                style={{
                  background: "#4285f4",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 12px",
                  cursor: "pointer",
                }}
                onClick={() => navigate(`/assignments/${a.id}`)}
              >
                {a.title}
              </button>
              {isFaculty && (
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "crimson" }}
                  title="Delete assignment"
                  onClick={() => handleDeleteAssignment(a.id)}
                >
                  🗑️
                </button>
              )}
              <span style={{ color: "#555" }}>
                Attempts: {a.num_attempts ?? 0} • Window:{" "}
                {a.start ? new Date(a.start).toLocaleString() : "–"} →{" "}
                {a.stop ? new Date(a.stop).toLocaleString() : "–"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}




