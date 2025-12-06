import React from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { fetchJson } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Assignment } from "../types/assignments";
import { Button, Input, Label, Card, Badge } from "../components/ui";
import { 
  Calendar, 
  Clock, 
  Trophy, 
  FileCode, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  SortAsc,
  Flame,
  BookOpen,
  Filter,
  XCircle
} from "lucide-react";

// datetime-local helpers
function toLocalInputValue(d: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInputValue(v: string): Date | null {
  if (!v) return null;
  const [date, time] = v.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

type CourseInfo = {
  id: number;
  course_code: string;
  name: string;
};

type AssignmentWithCourse = Assignment & {
  course_code?: string;
  course_name?: string;
};

type FilterType = "all" | "active" | "due-soon" | "closed";
type SortType = "due-date" | "name" | "course" | "status";

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, userId } = useAuth();
  const isStudent = role === "student";
  const [assignments, setAssignments] = React.useState<AssignmentWithCourse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dateMap, setDateMap] = React.useState<Record<
    number,
    { start: Date | null; stop: Date | null }
  >>({});

  // Get initial filter from URL params
  const getInitialFilter = (): FilterType => {
    const param = searchParams.get("filter");
    if (param === "active" || param === "due-soon" || param === "closed") {
      return param;
    }
    return "all";
  };

  // Filter and sort state for students
  const [filter, setFilter] = React.useState<FilterType>(getInitialFilter);
  const [sort, setSort] = React.useState<SortType>("due-date");

  // Update filter when URL params change
  React.useEffect(() => {
    const paramFilter = searchParams.get("filter");
    if (paramFilter === "active" || paramFilter === "due-soon" || paramFilter === "closed") {
      setFilter(paramFilter);
    }
  }, [searchParams]);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    async function loadAssignments() {
      if (!userId) {
        if (alive) {
          setAssignments([]);
          setDateMap({});
          setError("User not logged in.");
          setLoading(false);
        }
        return;
      }

      try {
        if (isStudent) {
          const courses = await fetchJson<CourseInfo[]>(
            `/api/v1/students/${encodeURIComponent(String(userId))}/courses`
          ).catch(() => []);

          if (!alive) return;

          if (!courses.length) {
            setAssignments([]);
            setDateMap({});
            return;
          }

          const nestedAssignments = await Promise.all(
            courses.map(async (course) => {
              try {
                const list = await fetchJson<Assignment[]>(
                  `/api/v1/courses/${encodeURIComponent(String(course.id))}/assignments?student_id=${encodeURIComponent(
                    String(userId)
                  )}`
                );
                return list.map((assignment) => ({
                  ...assignment,
                  start: assignment?.start ?? null,
                  stop: assignment?.stop ?? null,
                  num_attempts: assignment?.num_attempts ?? 0,
                  course_code: course.course_code,
                  course_name: course.name,
                }));
              } catch {
                return [];
              }
            })
          );

          if (!alive) return;

          const flattened = nestedAssignments.flat();
          setAssignments(flattened);

          const seeded: Record<number, { start: Date | null; stop: Date | null }> = {};
          for (const a of flattened) {
            seeded[a.id] = {
              start: a.start ? new Date(a.start) : null,
              stop: a.stop ? new Date(a.stop) : null,
            };
          }
          setDateMap(seeded);
        } else {
          const raw = await fetchJson<any[]>("/api/v1/assignments");
          if (!alive) return;
          const normalized: AssignmentWithCourse[] = (raw || []).map((a: any) => ({
            ...a,
            start: a?.start ?? null,
            stop: a?.stop ?? null,
            num_attempts: a?.num_attempts ?? 0,
          }));
          setAssignments(normalized);

          const seeded: Record<number, { start: Date | null; stop: Date | null }> = {};
          for (const a of normalized) {
            seeded[a.id] = {
              start: a.start ? new Date(a.start) : null,
              stop: a.stop ? new Date(a.stop) : null,
            };
          }
          setDateMap(seeded);
        }
      } catch (err: any) {
        if (!alive) return;
        setAssignments([]);
        setDateMap({});
        setError(err?.message ?? "Failed to load assignments");
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    loadAssignments();

    return () => {
      alive = false;
    };
  }, [isStudent, userId]);

  // Helper functions for student view
  const getAssignmentStatus = (a: AssignmentWithCourse): "active" | "closed" | "upcoming" => {
    const now = new Date();
    const hasStarted = !a.start || now >= new Date(a.start);
    const hasClosed = a.stop && now > new Date(a.stop);
    
    if (hasClosed) return "closed";
    if (!hasStarted) return "upcoming";
    return "active";
  };

  const isDueSoon = (a: AssignmentWithCourse): boolean => {
    if (!a.stop) return false;
    const now = new Date();
    const dueDate = new Date(a.stop);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return dueDate > now && dueDate <= threeDaysFromNow;
  };

  const getTimeRemaining = (stopDate: string | null | undefined): string | null => {
    if (!stopDate) return null;
    const now = new Date();
    const due = new Date(stopDate);
    const diff = due.getTime() - now.getTime();
    
    if (diff < 0) return "Past due";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 7) return null;
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m left`;
  };

  // Filter and sort assignments for student view
  const filteredAndSortedAssignments = React.useMemo(() => {
    if (!isStudent) return assignments;
    
    let filtered = [...assignments];
    
    // Apply filter
    if (filter === "active") {
      filtered = filtered.filter(a => getAssignmentStatus(a) === "active");
    } else if (filter === "due-soon") {
      filtered = filtered.filter(a => {
        const status = getAssignmentStatus(a);
        return status === "active" && isDueSoon(a);
      });
    } else if (filter === "closed") {
      filtered = filtered.filter(a => getAssignmentStatus(a) === "closed");
    }
    
    // Apply sort
    filtered.sort((a, b) => {
      if (sort === "due-date") {
        // When sorting by due date, always put closed assignments last
        const aStatus = getAssignmentStatus(a);
        const bStatus = getAssignmentStatus(b);
        const aClosed = aStatus === "closed";
        const bClosed = bStatus === "closed";
        
        if (aClosed !== bClosed) {
          return aClosed ? 1 : -1; // Closed goes to the end
        }
        
        // Within same status group, sort by due date
        if (!a.stop && !b.stop) return 0;
        if (!a.stop) return 1;
        if (!b.stop) return -1;
        return new Date(a.stop).getTime() - new Date(b.stop).getTime();
      } else if (sort === "name") {
        return a.title.localeCompare(b.title);
      } else if (sort === "course") {
        const courseA = a.course_name || a.course_code || "";
        const courseB = b.course_name || b.course_code || "";
        return courseA.localeCompare(courseB);
      } else if (sort === "status") {
        const statusOrder = { active: 0, upcoming: 1, closed: 2 };
        return statusOrder[getAssignmentStatus(a)] - statusOrder[getAssignmentStatus(b)];
      }
      return 0;
    });
    
    return filtered;
  }, [assignments, filter, sort, isStudent]);

  // Count assignments by filter type for badges
  const filterCounts = React.useMemo(() => {
    const all = assignments.length;
    const active = assignments.filter(a => getAssignmentStatus(a) === "active").length;
    const dueSoon = assignments.filter(a => getAssignmentStatus(a) === "active" && isDueSoon(a)).length;
    const closed = assignments.filter(a => getAssignmentStatus(a) === "closed").length;
    return { all, active, dueSoon, closed };
  }, [assignments]);

  // Student View
  if (isStudent) {
    return (
      <div className="page-container">
        {/* Header - matching CoursesPage and GradebookPage style */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="page-title">My Assignments</h1>
            <p className="page-subtitle">Track your progress across all courses</p>
          </div>
        </div>

        {error ? (
          <Card className="text-center py-12">
            <XCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <p className="text-danger font-medium">{error}</p>
          </Card>
        ) : loading ? (
          <Card className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your assignments...</p>
          </Card>
        ) : assignments.length === 0 ? (
          <Card className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No assignments yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              You haven't been assigned any work yet. Check back later!
            </p>
            <Button onClick={() => navigate("/courses")}>
              View My Courses
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Filters and Sort */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border overflow-x-auto">
                {[
                  { id: "all" as FilterType, label: "All", icon: FileCode, count: filterCounts.all },
                  { id: "active" as FilterType, label: "Active", icon: CheckCircle2, count: filterCounts.active },
                  { id: "due-soon" as FilterType, label: "Due Soon", icon: Flame, count: filterCounts.dueSoon },
                  { id: "closed" as FilterType, label: "Closed", icon: XCircle, count: filterCounts.closed },
                ].map(({ id, label, icon: Icon, count }) => (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                      filter === id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      filter === id ? "bg-primary-foreground/20" : "bg-muted"
                    }`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <SortAsc className="w-4 h-4 text-muted-foreground" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortType)}
                  className="bg-muted/40 border border-border rounded-lg px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="due-date">Sort by Due Date</option>
                  <option value="name">Sort by Name</option>
                  <option value="course">Sort by Course</option>
                  <option value="status">Sort by Status</option>
                </select>
              </div>
            </div>

            {/* Assignment Cards Grid */}
            {filteredAndSortedAssignments.length === 0 ? (
              <Card className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                  <Filter className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  No assignments match your filter. Try a different filter.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredAndSortedAssignments.map((a) => {
                  const status = getAssignmentStatus(a);
                  const timeRemaining = getTimeRemaining(a.stop);
                  const isUrgent = isDueSoon(a) && status === "active";
                  
                  // Status styling
                  const statusConfig = {
                    active: { 
                      bg: "bg-gradient-to-br from-accent/10 via-accent/5 to-transparent", 
                      border: "border-accent/30 hover:border-accent/50",
                      dot: "bg-accent",
                      text: "text-accent",
                      label: "Active"
                    },
                    closed: { 
                      bg: "bg-gradient-to-br from-danger/10 via-danger/5 to-transparent", 
                      border: "border-danger/30 hover:border-danger/50",
                      dot: "bg-danger",
                      text: "text-danger",
                      label: "Closed"
                    },
                    upcoming: { 
                      bg: "bg-gradient-to-br from-muted via-muted/50 to-transparent", 
                      border: "border-border hover:border-primary/30",
                      dot: "bg-muted-foreground",
                      text: "text-muted-foreground",
                      label: "Upcoming"
                    },
                  };

                  const config = statusConfig[status];

                  return (
                    <Link
                      key={a.id}
                      to={`/assignments/${a.id}`}
                      className={`group relative block rounded-2xl border ${config.border} ${config.bg} p-5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-hidden`}
                    >
                      {/* Urgent Ribbon */}
                      {isUrgent && (
                        <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden">
                          <div className="absolute top-3 -right-6 w-28 text-center py-1 bg-warning text-warning-foreground text-[10px] font-bold uppercase tracking-wider rotate-45 shadow-sm">
                            Due Soon
                          </div>
                        </div>
                      )}

                      {/* Course Badge */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                          {a.course_code || `Course ${a.course_id}`}
                        </span>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                          <span className={`text-xs font-semibold ${config.text}`}>
                            {config.label}
                          </span>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors mb-3 line-clamp-2 pr-4">
                        {a.title}
                      </h3>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {/* Due Date */}
                        <div className="flex flex-col items-center p-2 rounded-lg bg-background/50 border border-border/50">
                          <Calendar className={`w-3.5 h-3.5 mb-1 ${isUrgent ? "text-warning" : "text-muted-foreground"}`} />
                          <span className={`text-[11px] font-medium text-center ${isUrgent ? "text-warning" : "text-foreground"}`}>
                            {a.stop 
                              ? new Date(a.stop).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              : "No due"
                            }
                          </span>
                        </div>

                        {/* Attempts */}
                        <div className="flex flex-col items-center p-2 rounded-lg bg-background/50 border border-border/50">
                          <FileCode className="w-3.5 h-3.5 mb-1 text-muted-foreground" />
                          <span className="text-[11px] font-medium text-foreground">
                            {a.num_attempts ?? 0}{a.sub_limit ? `/${a.sub_limit}` : ""} tries
                          </span>
                        </div>

                        {/* Points */}
                        <div className="flex flex-col items-center p-2 rounded-lg bg-background/50 border border-border/50">
                          <Trophy className="w-3.5 h-3.5 mb-1 text-muted-foreground" />
                          <span className="text-[11px] font-medium text-foreground">
                            {a.total_points ?? 0} pts
                          </span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-border/50">
                        {/* Time Remaining */}
                        {timeRemaining && status === "active" ? (
                          <div className={`flex items-center gap-1.5 text-xs font-medium ${isUrgent ? "text-warning" : "text-muted-foreground"}`}>
                            <Clock className="w-3.5 h-3.5" />
                            {timeRemaining}
                          </div>
                        ) : status === "closed" ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-danger">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Closed
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            {a.stop ? `Due ${new Date(a.stop).toLocaleDateString()}` : "No deadline"}
                          </div>
                        )}

                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Faculty View - Keep simpler
  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">All Assignments</h1>
        <p className="page-subtitle">View and manage all assignments</p>
      </div>
      <Card>
          {error ? (
            <p className="text-red-600">Error: {error}</p>
          ) : loading ? (
            <p className="text-center text-muted-foreground">Loading…</p>
          ) : assignments.length === 0 ? (
            <p className="text-muted-foreground">No assignments found.</p>
          ) : (
            <ul className="space-y-6">
              {assignments.map((a) => (
                <li key={a.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3 mb-3">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/assignments/${a.id}`)}
                    >
                      {a.title}
                    </Button>
                    <Badge variant="info">
                      Attempts: {a.num_attempts ?? 0}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>
                      Course: {a.course_name ? `${a.course_name} (${a.course_code ?? a.course_id})` : a.course_id}
                    </div>
                    {a.description && <div>Description: {a.description}</div>}
                    <div>Submission Limit: {a.sub_limit == null ? "∞" : a.sub_limit}</div>
                    <div className="flex gap-4 items-center flex-wrap mt-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`start-${a.id}`} className="mb-0">Start</Label>
                        <Input
                          id={`start-${a.id}`}
                          type="datetime-local"
                          value={toLocalInputValue(dateMap[a.id]?.start ?? null)}
                          onChange={(e) =>
                            setDateMap((prev) => ({
                              ...prev,
                              [a.id]: {
                                start: fromLocalInputValue(e.target.value),
                                stop: prev[a.id]?.stop ?? null,
                              },
                            }))
                          }
                          className="w-auto"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`stop-${a.id}`} className="mb-0">Stop</Label>
                        <Input
                          id={`stop-${a.id}`}
                          type="datetime-local"
                          value={toLocalInputValue(dateMap[a.id]?.stop ?? null)}
                          onChange={(e) =>
                            setDateMap((prev) => ({
                              ...prev,
                              [a.id]: {
                                start: prev[a.id]?.start ?? null,
                                stop: fromLocalInputValue(e.target.value),
                              },
                            }))
                          }
                          className="w-auto"
                        />
                      </div>
                      <span className="text-muted-foreground text-xs">
                        ({a.start ? new Date(a.start).toLocaleString() : "No start"} →{" "}
                        {a.stop ? new Date(a.stop).toLocaleString() : "No stop"})
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
    </div>
  );
}
