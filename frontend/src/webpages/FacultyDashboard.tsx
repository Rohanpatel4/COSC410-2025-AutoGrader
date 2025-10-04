/* ========== NEW (numeric IDs) ========== */
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import type { Course } from "../types/courses";

export default function FacultyDashboard() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();

  // Coerce to number; if your seed puts faculty user 3, userId should already be that.
  const professorId = Number(userId ?? 0);

  const [courseId, setCourseId] = React.useState(""); // numeric string; parse before POST
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [mine, setMine] = React.useState<Course[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [msg, setMsg] = React.useState<string | null>(null);

  function onLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  async function loadMine() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetchJson<{ items: Course[] }>(
        `/api/v1/courses?professor=${encodeURIComponent(professorId)}`
      );
      setMine(res.items);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const courseIdNum = Number(courseId.trim());
    if (!Number.isFinite(courseIdNum)) {
      setMsg("Course ID must be numeric");
      return;
    }

    try {
      const created = await fetchJson<Course>("/api/v1/courses", {
        method: "POST",
        body: JSON.stringify({
          course_id: courseIdNum,
          name: name.trim(),
          description: description || null,
          professor_id: professorId,
        }),
      });
      setMine((prev) => [created, ...prev]);
      setCourseId("");
      setName("");
      setDescription("");
      setMsg("Course created!");
    } catch (e: any) {
      setMsg(e?.message ?? "Create failed");
    }
  }

  return (
    <div className="container">
      <h1>Faculty</h1>
      <p>User ID: {userId ?? "—"}</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Link to="/assignment">Go to Sandbox</Link>
        <button onClick={onLogout}>Log out</button>
      </div>

      <form
        onSubmit={onCreate}
        style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}
      >
        <div>
          <label htmlFor="c-id">Course ID</label>
          <input
            id="c-id"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="e.g., 4101"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="c-name">Course Name</label>
          <input
            id="c-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="c-desc">Description</label>
          <textarea
            id="c-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={!courseId.trim() || !name.trim()}
        >
          Create Course
        </button>
        {msg && (
          <p role="status" aria-live="polite">
            {msg}
          </p>
        )}
      </form>

      <h2 style={{ marginTop: 16 }}>My Courses</h2>
      {loading ? (
        <p>Loading…</p>
      ) : mine.length ? (
        <ul>
          {mine.map((c) => (
            <li key={c.id}>
              <Link to={`/courses/${encodeURIComponent(c.course_id)}`}>
                {c.name}
              </Link>{" "}
              <span style={{ color: "#666" }}>({c.course_id})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No courses yet.</p>
      )}
    </div>
  );
}
