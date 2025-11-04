import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import type { Course } from "../types/courses";
import { Button, Input, Label, Card, Badge, Alert } from "../components/ui";
import { AppShell } from "../components/layout/AppShell";

export default function StudentDashboard() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const studentId = Number(userId ?? 0);

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

  return (
    <AppShell>
      <main className="page-container space-y-8 py-12">
        <header className="rounded-3xl border border-border/80 bg-card/90 p-8 shadow-soft">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Badge variant="default">
                Student
              </Badge>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
                <p className="text-sm text-muted-foreground">
                  User ID <span className="font-semibold text-foreground">{userId ?? "—"}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button variant="secondary" onClick={onLogout}>
                Log out
              </Button>
            </div>
          </div>
        </header>

        {/* Alert Messages */}
        {msg && (
          <Alert variant={msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("failed") ? "error" : "success"}>
            <p className="font-medium">{msg}</p>
          </Alert>
        )}

        {/* My Courses Section */}
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                My courses
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {!loading && (
                <Badge variant="info">
                  {mine.length} {mine.length === 1 ? "course" : "courses"}
                </Badge>
              )}
              <Button size="sm" onClick={() => navigate("/courses/join")}>
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                </svg>
                Join Course
              </Button>
            </div>
          </div>

            <div className="mt-6">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <svg className="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : mine.length ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {mine.map((c) => (
                    <Link
                      key={c.id}
                      to={`/courses/${encodeURIComponent(c.course_code)}`}
                      className="group flex min-h-[160px] flex-col rounded-2xl border border-border bg-card/90 p-6 shadow-sm transition-all duration-300 ease-soft hover:-translate-y-[2px] hover:border-primary/30 hover:shadow-glow active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <article className="flex flex-1 flex-col justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {c.course_code}
                          </p>
                          <h3 className="text-lg font-semibold leading-tight text-foreground line-clamp-2">
                            {c.name}
                          </h3>
                        </div>
                        <div className="flex items-center justify-end">
                          <svg 
                            className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center">
                  <div className="flex flex-col items-center gap-4 rounded-2xl bg-muted px-6 py-10">
                    <svg className="h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        Not enrolled in any courses yet
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Use the enrollment key from your instructor to join a course.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
        </Card>
      </main>
    </AppShell>
  );
}
