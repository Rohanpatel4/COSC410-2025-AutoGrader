import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import type { Course } from "../types/courses";
import { Button, Input, Label, Card, Badge, Alert } from "../components/ui";

export default function FacultyDashboard() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const professorId = Number(userId ?? 0);

  const [courseCode, setCourseCode] = React.useState("");
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
    if (!professorId || Number.isNaN(professorId)) return;
    setLoading(true);
    setMsg(null);
    try {
      // NEW: path-based filter like students: /api/v1/courses/faculty/{id}
      const items = await fetchJson<Course[]>(
        `/api/v1/courses/faculty/${encodeURIComponent(professorId)}`
      );
      setMine(items);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load courses");
      setMine([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { loadMine(); }, [professorId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!courseCode.trim() || !name.trim()) {
      setMsg("course_code and name are required");
      return;
    }
    try {
      const created = await fetchJson<Course>(`/api/v1/courses`, {
        method: "POST",
        body: JSON.stringify({
          course_code: courseCode.trim(),
          name: name.trim(),
          description: description || null,
        }),
      });
      setMine((prev) => [created, ...prev]);
      setCourseCode(""); setName(""); setDescription("");
      setMsg("Course created!");
    } catch (e: any) {
      setMsg(e?.message ?? "Create failed");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 py-12 text-neutral-900 transition-colors duration-300 ease-soft dark:from-background-dark dark:via-gray-900 dark:to-gray-950 dark:text-gray-100">
      <main className="page-container space-y-8">
        <header className="rounded-3xl border border-neutral-100/80 bg-white/90 p-8 shadow-soft dark:border-white/10 dark:bg-gray-900/70">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Badge variant="default">
                Faculty
              </Badge>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  User ID <span className="font-semibold text-neutral-900 dark:text-gray-100">{userId ?? "—"}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button variant="secondary" onClick={onLogout}>
                Log out
              </Button>
              <Link to="/assignments">
                <Button>View all assignments</Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Alert Messages */}
        {msg && (
          <Alert variant={msg.includes("failed") || msg.includes("fail") ? "error" : "success"}>
            <p className="font-medium">{msg}</p>
          </Alert>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Create Course Card */}
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m6-6H6" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-gray-100">
                Create new course
              </h2>
            </div>
            <form onSubmit={onCreate} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="c-code">Course code</Label>
                <Input
                  id="c-code"
                  placeholder="e.g., COSC-410"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="c-name">Course name</Label>
                <Input
                  id="c-name"
                  placeholder="e.g., Software Engineering"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="c-desc">
                  Description <span className="text-gray-400 dark:text-gray-500">(optional)</span>
                </Label>
                <textarea
                  id="c-desc"
                  placeholder="Enter course description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[80px] resize-y"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!courseCode.trim() || !name.trim()}
              >
                Create course
              </Button>
              <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                An enrollment key will be automatically generated for this course.
              </p>
            </form>
          </Card>

          {/* My Courses Card */}
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-gray-100">
                  My courses
                </h2>
              </div>
              {!loading && (
                <Badge variant="info">
                  {mine.length} {mine.length === 1 ? "course" : "courses"}
                </Badge>
              )}
            </div>

            <div className="mt-6">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <svg className="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : (mine?.length ?? 0) > 0 ? (
                <div className="space-y-4">
                  {(mine ?? []).map((c) => (
                    <article
                      key={c.id}
                      className="flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-white/90 p-5 shadow-sm transition-all duration-300 ease-soft hover:-translate-y-[2px] hover:border-primary/30 hover:shadow-glow dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {c.course_code}
                          </p>
                          <p className="text-lg font-semibold text-neutral-900 dark:text-gray-100">{c.name}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => navigate(`/courses/${encodeURIComponent(c.course_code)}`)}
                        >
                          Open course
                        </Button>
                      </div>
                      {c.enrollment_key && (
                        <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-sm font-medium text-gray-600 dark:border-white/10 dark:bg-gray-900/60 dark:text-gray-300">
                          <span>Enrollment key</span>
                          <code className="code-inline">{c.enrollment_key}</code>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="text-center">
                  <div className="flex flex-col items-center gap-4 rounded-2xl bg-neutral-50 px-6 py-10 dark:bg-gray-900/60">
                    <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-gray-100">
                        No courses yet
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Create your first course using the form above.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
