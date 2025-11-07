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
          ? `/api/v1/courses/faculty/${userId}`
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
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Courses Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <ContentCard key={course.id} onClick={() => handleCourseClick(course)}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-base">{course.name}</h3>
                    <Badge variant="secondary" className="mt-1">{course.course_code}</Badge>
                  </div>
                </div>
              </div>

              <p className="text-muted-foreground line-clamp-2 mb-4">
                {course.description}
              </p>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
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
      </div>

      {/* Empty State */}
      {courses.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No courses available</h3>
          <p className="text-muted-foreground mb-6">
            {isFaculty
              ? "Create your first course to get started"
              : "There are no courses available for enrollment at this time"
            }
          </p>

          {isFaculty && (
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Course
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
