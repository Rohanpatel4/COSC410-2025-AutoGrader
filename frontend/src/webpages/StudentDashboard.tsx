/*
ORIGINAL
//
import React from "react";

export default function StudentDashboard() {
  return (
    <div className="container">
      <h1>Student</h1>
      <p>User ID: </p>
    </div>
  );
}
//
*/

/* ========== NEW ========== */
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import type { Course } from "../types/courses"; // 👈 moved here

export default function StudentDashboard() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const studentId = userId ?? "u1";

  const [query, setQuery] = React.useState("");
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

  React.useEffect(() => { loadMyCourses(); }, []);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    const code = query.trim();
    if (!code) return;
    setMsg(null);
    try {
      await fetchJson("/api/v1/registrations", {
        method: "POST",
        body: JSON.stringify({ student_id: studentId, course_id: code }),
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

      <form onSubmit={onRegister} style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
        <label htmlFor="course-search">Register for courses</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="course-search"
            placeholder="Enter Course ID (e.g., COSC-410)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={!query.trim()}>Register</button>
        </div>
        {msg && <p role="status" aria-live="polite">{msg}</p>}
      </form>

      <h2 style={{ marginTop: 16 }}>My Courses</h2>
      {loading ? (
        <p>Loading…</p>
      ) : mine.length ? (
        <ul>
          {mine.map((c) => (
            <li key={c.id}>
              <Link to={`/courses/${encodeURIComponent(c.course_id)}`}>{c.name}</Link>{" "}
              <span style={{ color: "#666" }}>({c.course_id})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Not enrolled in any courses yet.</p>
      )}
    </div>
  );
}


