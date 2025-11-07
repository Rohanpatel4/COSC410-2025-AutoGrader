// src/webpages/GradebookIndexPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import { ContentCard } from "../components/ui/content-row";
import { GraduationCap, Users } from "lucide-react";

interface Course {
  id: number;
  course_code: string;
  name: string;
  description: string;
  enrollment_key?: string;
}

export default function GradebookIndexPage() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchCourses = async () => {
      if (!userId) return;

      try {
        const data = await fetchJson<Course[]>(
          `/api/v1/courses/faculty/${userId}`
        );
        setCourses(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load courses");
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [userId]);

  const handleCourseClick = (course: Course) => {
    navigate(`/courses/${course.course_code}/gradebook`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 text-red-600">
        <p className="text-lg">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Select a course to view its gradebook:
        </h2>
      </div>

      {/* Courses Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <ContentCard key={course.id} onClick={() => handleCourseClick(course)}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{course.name}</h3>
                    <p className="text-sm text-muted-foreground">{course.course_code}</p>
                  </div>
                </div>
              </div>

              <p className="text-muted-foreground line-clamp-2 mb-4">
                {course.description || "No description available"}
              </p>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    View Grades
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
          <GraduationCap className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No courses found</h3>
          <p className="text-muted-foreground">
            You haven't created any courses yet. Create a course first to access gradebooks.
          </p>
        </div>
      )}
    </div>
  );
}
