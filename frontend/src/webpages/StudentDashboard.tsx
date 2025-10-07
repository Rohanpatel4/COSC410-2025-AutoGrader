import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import type { Course } from "../types/courses";

export default function StudentDashboard() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const studentId = Number(userId ?? 0);

  const [tag, setTag] = React.useState(""); // user types a course_tag (e.g., "COSC-410")
  const [mine, setMine] = React.useState<Course[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [msg, setMsg] = React.useState<string | null>(null);

  function onLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  async function loadMyCourses() {
    if (!studentId || Number.isNaN(studentId)) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetchJson<any>(`/api/v1/students/${encodeURIComponent(studentId)}/courses`);
      const data: Course[] = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
      setMine(data);
      if (!Array.isArray(res) && !Array.isArray(res?.items)) {
        // Non-fatal informational message
        setMsg("Unexpected response format; showing 0 courses.");
      }
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load courses");
      setMine([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { loadMyCourses(); }, [studentId]);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = tag.trim();
    if (!trimmed) {
      setMsg("Please enter a Course Tag (e.g., COSC-410)");
      return;
    }

    setMsg(null);
    try {
      // backend accepts course_tag OR course_id; we use course_tag
      await fetchJson("/api/v1/registrations", {
        method: "POST",
        body: JSON.stringify({ student_id: studentId, course_tag: trimmed }),
      });
      setMsg("Registered!");
      setTag("");
      await loadMyCourses();
    } catch (e: any) {
      setMsg(e?.message ?? "Registration failed");
    }
  }

  // Reuse a lightweight style set similar to FacultyDashboard
  const styles = {
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 16,
    } as React.CSSProperties,
    subheader: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      color: "#555",
      marginBottom: 16,
    } as React.CSSProperties,
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
      gap: 16,
    } as React.CSSProperties,
    card: {
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: 16,
      background: "#fff",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    } as React.CSSProperties,
    label: { fontWeight: 600, display: "block", marginBottom: 6 } as React.CSSProperties,
    input: {
      width: "100%",
      padding: "8px 10px",
      border: "1px solid #d1d5db",
      borderRadius: 8,
      outline: "none",
      marginBottom: 8,
    } as React.CSSProperties,
    primaryBtn: {
      background: "#111827",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "8px 12px",
      cursor: "pointer",
    } as React.CSSProperties,
    ghostBtn: {
      background: "#fff",
      color: "#111827",
      border: "1px solid #d1d5db",
      borderRadius: 8,
      padding: "8px 12px",
      cursor: "pointer",
    } as React.CSSProperties,
    courseItem: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      padding: "8px 10px",
      border: "1px solid #eee",
      borderRadius: 8,
      marginBottom: 8,
      background: "#fafafa",
    } as React.CSSProperties,
  };

  return (
    <div className="container">
      <div style={styles.header}>
        <div>
          <h1 style={{ margin: 0 }}>Student</h1>
          <div style={styles.subheader}>
            <span>User ID: {userId ?? "—"}</span>
            <span>•</span>
            <Link to="/assignment">Go to Sandbox</Link>
          </div>
        </div>
        <div>
          <button style={styles.ghostBtn} onClick={onLogout}>Log out</button>
        </div>
      </div>

      {msg && (
        <div role="status" aria-live="polite" style={{ marginBottom: 12, color: msg.toLowerCase().includes("fail") ? "crimson" : "#065f46" }}>
          {msg}
        </div>
      )}

      <div style={styles.grid}>
        {/* Register card */}
        <div style={styles.card}>
          <h2 style={{ marginTop: 0 }}>Register for courses</h2>
          <form onSubmit={onRegister}>
            <label htmlFor="course-search" style={styles.label}>Course Tag</label>
            <input
              id="course-search"
              placeholder="Enter Course Tag (e.g., COSC-410)"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              style={styles.input}
            />
            <button type="submit" style={styles.primaryBtn} disabled={!tag.trim()}>
              Register
            </button>
          </form>
        </div>

        {/* My Courses card */}
        <div style={styles.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>My Courses</h2>
            <span style={{ color: "#6b7280" }}>{loading ? "" : `${mine.length} total`}</span>
          </div>
          {loading ? (
            <p>Loading…</p>
          ) : mine.length ? (
            <div>
              {mine.map((c) => (
                <div key={c.id} style={styles.courseItem}>
                  <div style={{ fontWeight: 600 }}>
                    {c.course_tag} - {c.name}
                  </div>
                  <button
                    style={styles.ghostBtn}
                    onClick={() => navigate(`/courses/${encodeURIComponent(c.course_tag)}`)}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#6b7280" }}>
              <p style={{ marginTop: 4 }}>Not enrolled in any courses yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


