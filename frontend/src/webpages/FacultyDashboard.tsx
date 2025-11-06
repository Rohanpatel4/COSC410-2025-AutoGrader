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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50/50 to-orange-50/30">
      <HeroHeader
        title="Faculty Dashboard"
        subtitle="Manage your courses and assignments"
        stats={[
          { label: "My Courses", value: mine.length },
          { label: "Total Students", value: 0 },
          { label: "Active Assignments", value: 0 }
        ]}
        className="hero-header-improved"
      />

      <div className="relative z-10 -mt-8 px-6 pb-8">
        {/* Alert Messages */}
        {msg && (
          <div className={`p-4 rounded-xl mb-6 ${msg.includes("failed") || msg.includes("fail") ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
            <p className="font-medium">{msg}</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex justify-end mb-8">
          <Button
            className="flex items-center gap-2"
            onClick={() => navigate("/courses/new")}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
            </svg>
            Create Course
          </Button>
        </div>

        {/* My Courses Section */}
        {mine.length > 0 && (
          <ContentRow>
            {mine.map((c) => (
              <ContentCard
                key={c.id}
                onClick={() => navigate(`/courses/${encodeURIComponent(c.course_code)}`)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
                        <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{c.name}</h3>
                        <Badge variant="secondary" className="mt-1">{c.course_code}</Badge>
                      </div>
                    </div>
                    {c.enrollment_key && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        Key: {c.enrollment_key}
                      </Badge>
                    )}
                  </div>

                  <p className="text-gray-600 line-clamp-2 mb-4">
                    {c.description || "No description available"}
                  </p>

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Manage Course
                    </span>
                  </div>
                </div>
              </ContentCard>
            ))}
          </ContentRow>
        )}

        {/* Empty State */}
        {!loading && mine.length === 0 && (
          <div className="text-center py-16">
            <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No courses created</h3>
            <p className="text-gray-600 mb-6">
              You haven't created any courses yet. Use the button above to create your first course.
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your courses...</p>
          </div>
        )}
      </div>
    </div>
  );
}
