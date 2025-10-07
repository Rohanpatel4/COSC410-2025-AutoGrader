import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchJson } from "../api/client";
import type { Assignment } from "../types/assignments";
import { useAuth } from "../auth/AuthContext";

type Student = { id: number; name?: string };
type Faculty = { id: number; name?: string };

export default function CoursePage() {
  const { course_id = "" } = useParams<{ course_id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();

  // ---- data ----
  const [students, setStudents] = React.useState<Student[]>([]);
  const [faculty, setFaculty] = React.useState<Faculty[]>([]);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // ---- faculty-only create form ----
  const isFaculty = role === "faculty";
  const [showCreate, setShowCreate] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [subLimit, setSubLimit] = React.useState<string>("");
  const [start, setStart] = React.useState<string>("");
  const [stop, setStop] = React.useState<string>("");
  const [testFile, setTestFile] = React.useState<File | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [createMsg, setCreateMsg] = React.useState<string | null>(null);

  // ---- load all ----
  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const [s, f, a] = await Promise.all([
        fetchJson<Student[]>(`/api/v1/courses/${course_id}/students`).catch(() => []),
        fetchJson<Faculty[]>(`/api/v1/courses/${course_id}/faculty`).catch(() => []),
        fetchJson<Assignment[]>(`/api/v1/courses/${course_id}/assignments`).catch(() => []),
      ]);
      setStudents(s);
      setFaculty(f);
      setAssignments(a);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load course page");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course_id]);

  // ---- create assignment (with optional test file) ----
  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;

    setCreateMsg(null);
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
      setCreateMsg("Title is required.");
      return;
    }

    setCreating(true);

    try {
      // 1) If there is a test file, upload to /api/v1/files to get test_case text
      if (testFile) {
        const fd = new FormData();
        fd.append("file", testFile);
        const res = await fetch(`/api/v1/files`, { method: "POST", body: fd });
        const data = await res.clone().json().catch(() => null);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Test file upload failed: ${res.status} ${text}`);
        }
        const testCase: string | undefined = data?.test_case;
        if (testCase && typeof testCase === "string") {
          payload.test_case = testCase;
        } else {
          // If the converter responded but no test_case, we still continue (assignment can be created without it)
          console.warn("Upload returned no test_case; creating assignment without attached test.");
        }
      }

      // 2) Create the assignment for this course
      const created = await fetchJson<Assignment>(
        `/api/v1/courses/${encodeURIComponent(course_id)}/assignments`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      // 3) Update UI and reset
      setAssignments((prev) => [created, ...prev]);
      setTitle("");
      setDescription("");
      setSubLimit("");
      setStart("");
      setStop("");
      setTestFile(null);
      setShowCreate(false);
      setCreateMsg("Assignment created!");
    } catch (e: any) {
      setCreateMsg(e?.message ?? "Create failed");
    } finally {
      setCreating(false);
    }
  }

  // ---- delete (stubs) ----
  const handleDeleteStudent = (student_id: number) => {
    alert(`Delete student ${student_id} (not implemented)`);
  };

  const handleDeleteAssignment = async (assignment_id: number) => {
    alert(`Delete assignment ${assignment_id} (not implemented)`);
  };

  return (
    <div className="container">
      <div style={{ marginBottom: 12 }}>
        <Link to="/my">← Back to dashboard</Link>
      </div>

      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {loading && <p>Loading…</p>}

      {/* Faculty list */}
      <h2>Faculty</h2>
      {faculty.length === 0 ? (
        <p>No faculty listed.</p>
      ) : (
        <ul>
          {faculty.map((f) => (
            <li key={f.id}>{f.name ?? f.id}</li>
          ))}
        </ul>
      )}

      {/* Students */}
      <h2>Students</h2>
      {students.length === 0 ? (
        <p>No students enrolled.</p>
      ) : (
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

      {/* Assignments header + create toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Assignments</h2>
        {isFaculty && (
          <button onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "Create Assignment"}
          </button>
        )}
      </div>

      {/* Create Assignment (faculty only) */}
      {isFaculty && showCreate && (
        <form
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
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                style={{ marginLeft: 6 }}
              />
            </label>
            <label>
              Stop
              <input
                type="datetime-local"
                value={stop}
                onChange={(e) => setStop(e.target.value)}
                style={{ marginLeft: 6 }}
              />
            </label>
          </div>

          <div>
            <label>
              Attach test file (.py)
              <input
                type="file"
                accept=".py"
                onChange={(e) => setTestFile(e.target.files?.[0] ?? null)}
                style={{ display: "block", marginTop: 6 }}
              />
            </label>
            <p style={{ color: "#475569", marginTop: 4, fontSize: 13 }}>
              We’ll upload this file, convert it to text, and store it as the assignment’s test case.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="submit" disabled={creating}>
              {creating ? "Saving…" : "Save Assignment"}
            </button>
            {createMsg && <span style={{ color: createMsg.includes("failed") ? "crimson" : "#0f766e" }}>{createMsg}</span>}
          </div>
        </form>
      )}

      {/* Assignments list */}
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



