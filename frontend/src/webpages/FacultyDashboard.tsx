import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import type { Course } from "../types/courses";

export default function FacultyDashboard() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const professorId = Number(userId ?? 0);

  const [courseTag, setCourseTag] = React.useState("");
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
      const res = await fetchJson<any>(`/api/v1/courses?professor=${encodeURIComponent(professorId)}`);
      const items: Course[] = Array.isArray(res?.items) ? res.items : [];
      setMine(items);
      if (!Array.isArray(res?.items)) {
        setMsg("Unexpected response format; showing 0 courses.");
      }
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load courses");
      setMine([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { loadMine(); }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!courseTag.trim() || !name.trim()) {
      setMsg("course_tag and name are required");
      return;
    }
    try {
      const created = await fetchJson<Course>(`/api/v1/courses?professor_id=${professorId}`, {
        method: "POST",
        body: JSON.stringify({
          course_tag: courseTag.trim(),
          name: name.trim(),
          description: description || null,
        }),
      });
      setMine((prev) => [created, ...prev]);
      setCourseTag(""); setName(""); setDescription("");
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

      <form onSubmit={onCreate} style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
        <div>
          <label htmlFor="c-tag">Course Tag</label>
          <input
            id="c-tag"
            placeholder="e.g., COSC-410"
            value={courseTag}
            onChange={(e) => setCourseTag(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="c-name">Course Name</label>
          <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="c-desc">Description</label>
          <textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button type="submit" disabled={!courseTag.trim() || !name.trim()}>
          Create Course
        </button>
        {msg && <p role="status" aria-live="polite">{msg}</p>}
      </form>

      <h2 style={{ marginTop: 16 }}>My Courses</h2>
      {loading ? (
        <p>Loading…</p>
      ) : (mine?.length ?? 0) > 0 ? (
        <ul>
          {(mine ?? []).map((c) => (
            <li key={c.id}>
              <Link to={`/courses/${encodeURIComponent(c.course_tag)}`}>{c.name}</Link>{" "}
              <span style={{ color: "#666" }}>({c.course_tag})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No courses yet.</p>
      )}
    </div>
  );
}



