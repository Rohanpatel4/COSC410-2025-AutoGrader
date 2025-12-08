import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import type { Course } from "../types/courses";
import { Button } from "../components/ui/Button";
import {
  BookOpen,
  ClipboardList,
  UserPlus,
  ArrowRight,
  FileText
} from "lucide-react";
import CalendarWidget from "../components/ui/CalendarWidget";

// Generate a consistent gradient based on course code
function getCourseGradient(code: string): string {
  const gradients = [
    "from-rose-500 to-pink-600",
    "from-violet-500 to-purple-600",
    "from-sky-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-indigo-500 to-blue-600",
    "from-cyan-500 to-teal-600",
    "from-fuchsia-500 to-pink-600",
  ];
  
  // Simple hash to pick a gradient
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

// Course Card Component
function CourseCard({ course, navigate }: { course: Course; navigate: (path: string) => void }) {
  return (
    <div 
      className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition-all"
    >
      {/* Clickable Course Area */}
      <div 
        className="cursor-pointer group"
        onClick={() => navigate(`/courses/${course.course_code}`)}
      >
        {/* Course Banner */}
        <div 
          className={`h-36 bg-gradient-to-br ${getCourseGradient(course.course_code)} relative overflow-hidden`}
        >
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-4 left-4 w-20 h-20 border-4 border-white/30 rounded-full"></div>
            <div className="absolute bottom-4 right-4 w-16 h-16 border-4 border-white/30 rounded-lg rotate-12"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-4 border-white/20 rounded-full"></div>
          </div>
          
          {/* Course Code Badge */}
          <div className="absolute bottom-3 left-3">
            <span className="bg-black/30 backdrop-blur-sm text-white text-sm font-mono px-3 py-1.5 rounded-lg">
              {course.course_code}
            </span>
          </div>
        </div>

        {/* Course Title */}
        <div className="p-4 pb-2">
          <h3 
            className="font-semibold text-foreground text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2 min-h-[3.5rem]"
          >
            {course.name}
          </h3>
          {course.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {course.description}
            </p>
          )}
        </div>
      </div>
        
      {/* Assignments Button */}
      <div className="px-4 pb-4">
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => navigate(`/courses/${course.course_code}`)}
          className="w-full gap-2 justify-center"
        >
          <ClipboardList className="w-4 h-4" />
          Assignments
        </Button>
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const studentId = Number(userId ?? 0);

  const [mine, setMine] = React.useState<Course[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function loadMyCourses() {
    if (!studentId || Number.isNaN(studentId)) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetchJson<any>(`/api/v1/students/${encodeURIComponent(studentId)}/courses`);
      const data: Course[] = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
      setMine(data);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load courses");
      setMine([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { loadMyCourses(); }, [studentId]);

  return (
    <div className="w-full px-10 lg:px-16 py-6 space-y-6">
      {/* Header - matching Faculty Dashboard */}
      <div>
        <h1 className="text-5xl font-bold text-foreground tracking-tight">Student Dashboard</h1>
        <p className="text-xl text-muted-foreground mt-3">Welcome back to your learning dashboard</p>
      </div>

      {/* Top Action Cards - matching Faculty Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Enrolled Courses Stat Card */}
        <div 
          className="bg-card border border-border rounded-xl shadow-sm flex items-center gap-5 p-5 hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground">{mine.length}</div>
            <div className="text-sm text-muted-foreground font-medium">Enrolled Courses</div>
          </div>
        </div>

        {/* Assignments Action Card */}
        <div 
          onClick={() => navigate("/assignments")}
          className="bg-card border border-border rounded-xl shadow-sm flex items-center gap-5 p-5 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <FileText className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">Assignments</div>
            <div className="text-sm text-muted-foreground">View your assignments</div>
          </div>
        </div>

        {/* Join Course Action Card */}
        <div 
          onClick={() => navigate("/courses/join")}
          className="bg-card border border-border rounded-xl shadow-sm flex items-center gap-5 p-5 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">Join Course</div>
            <div className="text-sm text-muted-foreground">Enroll in a new course</div>
          </div>
        </div>
      </div>

      {/* Course Overview Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">My Courses</h2>
          <button 
            onClick={() => navigate("/courses")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            View All Courses
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading courses...</p>
            </div>
          </div>
        ) : mine.length > 0 ? (
          <div className="flex flex-col md:flex-row gap-5">
            {/* Courses Grid - takes remaining space */}
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {mine.map((course) => (
                <CourseCard key={course.id} course={course} navigate={navigate} />
              ))}
            </div>
            
            {/* Calendar - always on the right, fixed width */}
            <div className="w-full md:w-72 lg:w-80 shrink-0 order-first md:order-last">
              <CalendarWidget studentId={studentId} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-5">
            {/* Empty state - takes remaining space */}
            <div className="flex-1 min-w-0 bg-card border border-border border-dashed rounded-2xl p-16 text-center">
              <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No courses yet</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Get started by joining a course. Use the enrollment key provided by your instructor.
              </p>
              <Button onClick={() => navigate("/courses/join")} className="gap-2">
                <UserPlus className="w-4 h-4" />
                Join Your First Course
              </Button>
            </div>
            
            {/* Calendar - always on the right */}
            <div className="w-full md:w-72 lg:w-80 shrink-0 order-first md:order-last">
              <CalendarWidget studentId={studentId} />
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {msg && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-4 text-center">
          {msg}
        </div>
      )}
    </div>
  );
}
