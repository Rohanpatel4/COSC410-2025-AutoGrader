/* ========== NEW (numeric IDs) ========== */
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import type { Course } from "../types/courses";

export default function StudentDashboard() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();

  // Coerce to number; fall back to 0 (harmless) if not present.
  const studentId = Number(userId ?? 0);

  const [query, setQuery] = React.useState(""); // user types a number, we parse it
  const [mine, setMine] = React.useState<Course[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [msg, setMsg] = React.useState<string | null>(null);

  function onLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  async function loadMyCourses() {
    setLoading(true);
    setMsg(null);
    try {
      const data = await fetchJson<Course[]>(
        `/api/v1/students/${encodeURIComponent(studentId)}/courses`
      );
      setMine(data);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadMyCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    const courseIdNum = Number(trimmed);
    if (!trimmed || !Number.isFinite(courseIdNum)) {
      setMsg("Please enter a numeric Course ID");
      return;
    }

    setMsg(null);
    try {
      await fetchJson("/api/v1/registrations", {
        method: "POST",
        body: JSON.stringify({ student_id: studentId, course_id: courseIdNum }),
      });
      setMsg("Registered!");
      setQuery("");
      await loadMyCourses();
    } catch (e: any) {
      setMsg(e?.message ?? "Registration failed");
    }
  }

  return (
    <div className="container">
      <h1>Student</h1>
      <p>User ID: {userId ?? "—"}</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Link to="/assignment">Go to Sandbox</Link>
        <button onClick={onLogout}>Log out</button>
      </div>

      <form
        onSubmit={onRegister}
        style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}
      >
        <label htmlFor="course-search">Register for courses</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="course-search"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Enter numeric Course ID (e.g., 4101)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={!query.trim()}>
            Register
          </button>
        </div>
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
        <p>Not enrolled in any courses yet.</p>
      )}

      <div className="student-placeholder-buttons" style={{ marginTop: 24 }}>
        <button className="course-lookup-btn">Button 1</button>
        <button className="course-lookup-btn">Button 2</button>
        <button className="course-lookup-btn">Button 3</button>
      </div>
    </div>
  );
}
