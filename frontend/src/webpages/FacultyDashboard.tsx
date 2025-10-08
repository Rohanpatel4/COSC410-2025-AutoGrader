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
    // Don't fetch until we have a real professor id
    if (!professorId || Number.isNaN(professorId)) return;
    setLoading(true);
    setMsg(null);
    try {
      // Use the same param name as the create endpoint so filtering works consistently
      const res = await fetchJson<any>(`/api/v1/courses?professor_id=${encodeURIComponent(professorId)}`);
      let items: Course[] = [];
      if (Array.isArray(res)) {
        items = res as Course[];
      } else if (Array.isArray(res?.items)) {
        items = res.items as Course[];
      }
      setMine(items);
      if (items.length === 0 && !Array.isArray(res?.items) && !Array.isArray(res)) {
        setMsg("Unexpected response format; showing 0 courses.");
      }
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load courses");
      setMine([]);
    } finally {
      setLoading(false);
    }
  }

  // Reload when the authenticated user changes (e.g., after navigation)
  React.useEffect(() => { loadMine(); }, [professorId]);

  function generateRandomTag() {
    // Generate a random 6-digit number
    const randomCode = Math.floor(100000 + Math.random() * 900000);
    setCourseTag(randomCode.toString());
  }

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
    textarea: {
      width: "100%",
      padding: "8px 10px",
      border: "1px solid #d1d5db",
      borderRadius: 8,
      outline: "none",
      minHeight: 80,
      resize: "vertical",
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
    secondaryBtn: {
      background: "#f3f4f6",
      color: "#374151",
      border: "1px solid #d1d5db",
      borderRadius: 6,
      padding: "4px 8px",
      cursor: "pointer",
      fontSize: "12px",
      marginLeft: "8px",
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
          <h1 style={{ margin: 0 }}>Faculty</h1>
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
        <div role="status" aria-live="polite" style={{ marginBottom: 12, color: msg.includes("failed") ? "crimson" : "#065f46" }}>
          {msg}
        </div>
      )}

      <div style={styles.grid}>
        {/* Create Course card */}
        <div style={styles.card}>
          <h2 style={{ marginTop: 0 }}>Create Course</h2>
          <form onSubmit={onCreate}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
              <label htmlFor="c-tag" style={styles.label}>Course Tag</label>
              <button type="button" style={styles.secondaryBtn} onClick={generateRandomTag}>
                Generate Tag
              </button>
            </div>
            <input
              id="c-tag"
              placeholder="e.g., COSC-410"
              value={courseTag}
              onChange={(e) => setCourseTag(e.target.value)}
              required
              style={styles.input}
            />

            <label htmlFor="c-name" style={styles.label}>Course Name</label>
            <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required style={styles.input} />

            <label htmlFor="c-desc" style={styles.label}>Description</label>
            <textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} style={styles.textarea} />

            <button type="submit" style={styles.primaryBtn} disabled={!courseTag.trim() || !name.trim()}>
              Create Course
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
          ) : (mine?.length ?? 0) > 0 ? (
            <div>
              {(mine ?? []).map((c) => (
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
              <p style={{ marginTop: 4 }}>No courses yet.</p>
              <p style={{ marginTop: 4 }}>Create your first course using the form on the left.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
