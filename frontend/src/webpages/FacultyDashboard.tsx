import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import type { Course } from "../types/courses";
import { Button, Input, Label, Card, Badge, Alert } from "../components/ui";
import { HeroHeader, ContentRow, ContentCard } from "../components/ui";

export default function FacultyDashboard() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const professorId = Number(userId ?? 0);

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

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <>
        {/* Alert Messages */}
        {msg && (
          <div className={`p-4 rounded-xl mb-6 ${msg.includes("failed") || msg.includes("fail") ? "bg-red-900/50 border border-red-700 text-red-200" : "bg-green-900/50 border border-green-700 text-green-200"}`}>
            <p className="font-medium">{msg}</p>
          </div>
        )}

        {/* Main Content - Two Boxes */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Create Course Box */}
          <div className="card bg-card text-card-foreground border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m6-6H6" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Create a Course
              </h2>
            </div>

            <p className="text-muted-foreground mb-6">
              Set up a new course for your students to enroll in.
            </p>

            <Button
              className="w-full"
              onClick={() => navigate("/courses/new")}
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
              </svg>
              Create Course
            </Button>
          </div>

          {/* My Courses Box */}
          <div className="card bg-card text-card-foreground border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  My Courses
                </h2>
                <p className="text-sm text-muted-foreground">
                  {!loading && `${mine.length} course${mine.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : mine.length > 0 ? (
              <div className="space-y-3">
                {mine.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/courses/${encodeURIComponent(c.course_code)}`)}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50 hover:border-primary hover:bg-muted cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">{c.name}</h3>
                      <p className="text-sm text-muted-foreground">{c.course_code}</p>
                    </div>
                    <svg className="h-4 w-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ))}
                {mine.length > 3 && (
                  <Button
                    variant="ghost"
                    className="w-full text-primary hover:text-primary"
                    onClick={() => navigate("/courses")}
                  >
                    View all courses ({mine.length})
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="h-12 w-12 text-muted-foreground mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-sm text-muted-foreground">
                  No courses created yet
                </p>
              </div>
            )}
          </div>
        </div>
      </>
    </div>
  );
}
