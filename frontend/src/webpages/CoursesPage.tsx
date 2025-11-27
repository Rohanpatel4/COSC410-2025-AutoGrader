import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import {
  BookOpen,
  Users,
  Plus,
  Search,
  Calendar,
  GraduationCap
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
  const [searchQuery, setSearchQuery] = React.useState("");

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

  const filteredCourses = courses.filter(course => 
    course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.course_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const title = isFaculty ? "Course Management" : "My Courses";
  const subtitle = isFaculty
    ? "Create and manage your academic courses"
    : "Access your enrolled courses and materials";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading courses...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600 bg-red-50 p-8 rounded-xl border border-red-200">
          <p className="text-lg font-medium">Error loading courses</p>
          <p className="text-sm opacity-80 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-muted-foreground text-lg">{subtitle}</p>
        </div>
        
        <div className="flex items-center gap-4">
          {isFaculty ? (
            <Button 
              onClick={() => navigate("/courses/new")} 
              className="bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Course
            </Button>
          ) : (
            <Button 
              variant="secondary" 
              onClick={() => navigate("/courses/join")} 
              className="shadow-sm hover:shadow-md transition-all"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Join a Course
            </Button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search courses by name or code..." 
            className="pl-10 bg-background border-input focus:ring-2 focus:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Courses List */}
      <div className="space-y-4">
        {filteredCourses.length > 0 ? (
          filteredCourses.map((course) => (
            <div 
              key={course.id} 
              onClick={() => handleCourseClick(course)}
              className="group bg-card hover:bg-accent/5 border border-border rounded-xl p-6 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex flex-col md:flex-row gap-6 items-start md:items-center"
            >
              {/* Icon Box */}
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                <GraduationCap className="w-8 h-8" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                    {course.name}
                  </h3>
                  <Badge variant="default" className="text-xs font-mono">
                    {course.course_code}
                  </Badge>
                </div>
                
                <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                  {course.description || "No description provided."}
                </p>
              </div>

              {/* Meta / Actions */}
              <div className="flex flex-row md:flex-col items-center md:items-end gap-4 md:gap-2 shrink-0 w-full md:w-auto justify-between md:justify-center border-t md:border-t-0 pt-4 md:pt-0 mt-2 md:mt-0 border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                  <Users className="w-4 h-4" />
                  <span>{isFaculty ? "Instructor" : "Student"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground hidden md:flex">
                  <Calendar className="w-4 h-4" />
                  <span>Active</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          /* Empty Search State */
          <div className="text-center py-16 bg-card border border-border rounded-xl border-dashed">
            <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">No courses found</h3>
            <p className="text-muted-foreground">
              {searchQuery 
                ? `No results matching "${searchQuery}"` 
                : isFaculty 
                  ? "Get started by creating your first course" 
                  : "You haven't joined any courses yet"
              }
            </p>
            {/* Call to action if empty and no search */}
            {!searchQuery && courses.length === 0 && (
              <div className="mt-6">
                 {isFaculty ? (
                  <Button onClick={() => navigate("/courses/new")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Course
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => navigate("/courses/join")}>
                    <BookOpen className="w-4 h-4 mr-2" />
                    Join Course
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
