import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import { HeroHeader } from "../components/ui/hero-header";
import { ContentRow, ContentCard } from "../components/ui/content-row";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  BookOpen,
  Users,
  Plus
} from "lucide-react";

interface Course {
  id: number;
  course_code: string;
  name: string;
  description: string;
  enrollment_key?: string;
}

export default function CoursesPage() {
  const navigate = useNavigate();
  const { role, userId } = useAuth();
  const isFaculty = role === "faculty";
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    const fetchCourses = async () => {
      try {
        const endpoint = isFaculty
          ? `/api/v1/faculty/${userId}/courses`
          : `/api/v1/students/${userId}/courses`;
        const data = await fetchJson<Course[]>(endpoint);
        if (alive) {
          setCourses(data);
        }
      } catch (err: any) {
        if (alive) {
          setError(err?.message || "Failed to load courses");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    if (userId) {
      fetchCourses();
    } else {
      setLoading(false);
      setError("User not logged in.");
    }

    return () => {
      alive = false;
    };
  }, [role, userId, isFaculty]);

  const handleCourseClick = (course: Course) => {
    navigate(`/courses/${encodeURIComponent(course.course_code)}`);
  };

  const title = isFaculty ? "Course Management" : "My Courses";
  const subtitle = isFaculty
    ? "Create and manage your courses"
    : "Browse and enroll in available courses";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading courses...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-lg">Error: {error}</p>
          <Button onClick={() => navigate("/my")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50/50 to-orange-50/30">
      {/* Hero Header */}
      <HeroHeader
        title={title}
        subtitle={subtitle}
        stats={[
          { label: "Total Courses", value: courses.length },
          { label: "Active", value: courses.length },
          { label: "Enrolled", value: isFaculty ? "N/A" : courses.length }
        ]}
        className="hero-header-improved"
      />

      <div className="relative z-10 -mt-8 px-6 pb-8">
        {/* Action Buttons */}
        <div className="mb-8 flex justify-end">
          {isFaculty && (
            <Button
              className="flex items-center gap-2"
              onClick={() => navigate("/courses/new")}
            >
              <Plus className="h-4 w-4" />
              Create Course
            </Button>
          )}

          {!isFaculty && (
            <Button
              variant="secondary"
              className="flex items-center gap-2"
              onClick={() => navigate("/courses/join")}
            >
              <BookOpen className="h-4 w-4" />
              Join Course
            </Button>
          )}
        </div>

        {/* Courses Grid */}
        <ContentRow>
          {courses.map((course) => (
            <ContentCard key={course.id} onClick={() => handleCourseClick(course)}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{course.name}</h3>
                      <Badge variant="secondary" className="mt-1">{course.course_code}</Badge>
                    </div>
                  </div>

                  {isFaculty && course.enrollment_key && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      Key: {course.enrollment_key}
                    </Badge>
                  )}
                </div>

                <p className="text-gray-600 line-clamp-2 mb-4">
                  {course.description}
                </p>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {isFaculty ? "Manage" : "Enroll"}
                    </span>
                  </div>
                  <span className="text-amber-600 font-medium">Click to view</span>
                </div>
              </div>
            </ContentCard>
          ))}
        </ContentRow>

        {/* Empty State */}
        {courses.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No courses available</h3>
            <p className="text-gray-600 mb-6">
              {isFaculty
                ? "Create your first course to get started"
                : "There are no courses available for enrollment at this time"
              }
            </p>

            {isFaculty && (
              <Button className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Course
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
