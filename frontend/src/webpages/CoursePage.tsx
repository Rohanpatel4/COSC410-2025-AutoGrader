// src/webpages/CoursePage.tsx
import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchJson, BASE } from "../api/client";
import type { Assignment } from "../types/assignments";
import { useAuth } from "../auth/AuthContext";
import { Button, Input, Card, Alert, Badge } from "../components/ui";
import { formatGradeDisplay } from "../utils/formatGrade";
import { 
  Calendar, 
  Clock, 
  Trophy, 
  FileCode, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  SortAsc,
  Filter,
  Flame
} from "lucide-react";

type Student = { id: number; name?: string; role: "student" };
type Faculty = { id: number; name?: string; role: "faculty" };
type Participant = Student | Faculty;

type CoursePayload = {
  id: number;
  course_code: string;
  name: string;
  description?: string | null;
  enrollment_key?: string;
};

type GradebookPayload = {
  course: { id: number; name: string; course_code: string };
  assignments: { id: number; title: string; total_points?: number }[];
  students: { 
    student_id: number; 
    username: string; 
    grades: Record<string, number | null>;
    best_submission_ids?: Record<string, number | null>;
  }[];
};

type TabType = "course" | "participants" | "grades";

export default function CoursePage() {
  const { course_id = "" } = useParams<{ course_id: string }>();
  const navigate = useNavigate();
  const { role, userId } = useAuth();
  const isFaculty = role === "faculty";

  // Active tab state
  const [activeTab, setActiveTab] = React.useState<TabType>(() => {
    const saved = localStorage.getItem(`courseTab_${course_id}`);
    return (saved as TabType) || "course";
  });

  // Course data
  const [course, setCourse] = React.useState<CoursePayload | null>(null);
  const [students, setStudents] = React.useState<Student[]>([]);
  const [faculty, setFaculty] = React.useState<Faculty[]>([]);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // Gradebook data (lazy loaded)
  const [gradebook, setGradebook] = React.useState<GradebookPayload | null>(null);
  const [gradebookLoading, setGradebookLoading] = React.useState(false);

  // Student attempts data (for student view)
  type StudentAttempt = { id: number; grade: number | null; earned_points?: number | null };
  type AssignmentAttempts = { assignmentId: number; attempts: StudentAttempt[]; totalPoints?: number };
  const [studentAttempts, setStudentAttempts] = React.useState<AssignmentAttempts[]>([]);
  const [studentAttemptsLoading, setStudentAttemptsLoading] = React.useState(false);

  // Participants tab state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortField, setSortField] = React.useState<"name" | "role" | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  // Delete student state
  const [studentToDelete, setStudentToDelete] = React.useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Grades display toggle
  const [showPoints, setShowPoints] = React.useState(false);

  // Student assignments sorting and filtering
  type AssignmentFilterType = "all" | "active" | "due-soon";
  type AssignmentSortType = "due-date" | "name" | "status";
  const [assignmentFilter, setAssignmentFilter] = React.useState<AssignmentFilterType>("all");
  const [assignmentSort, setAssignmentSort] = React.useState<AssignmentSortType>("due-date");

  // Load course, students, faculty, assignments
  async function loadAll() {
  setErr(null);
  setLoading(true);

  try {
      const studentIdParam = role === "student" && userId ? `?student_id=${userId}` : "";

      const [courseData, s, f, a] = await Promise.all([
        fetchJson<CoursePayload>(`/api/v1/courses/${encodeURIComponent(course_id)}`),
        fetchJson<Student[]>(`/api/v1/courses/${encodeURIComponent(course_id)}/students`).then(arr => 
          arr.map(item => ({ ...item, role: "student" as const }))
        ),
        fetchJson<Faculty[]>(`/api/v1/courses/${encodeURIComponent(course_id)}/faculty`).then(arr =>
          arr.map(item => ({ ...item, role: "faculty" as const }))
        ),
        fetchJson<Assignment[]>(
          `/api/v1/courses/${encodeURIComponent(course_id)}/assignments${studentIdParam}`
        ),
      ]);

    setCourse(courseData);
    setStudents(s);
    setFaculty(f);
    setAssignments(a);
  } catch (e: any) {
    setErr(e?.message ?? "Failed to load course page");
  } finally {
    setLoading(false);
  }
}

  // Load gradebook (lazy) - for faculty
  async function loadGradebook() {
    if (gradebook) return; // Already loaded
    setGradebookLoading(true);
    try {
      const data = await fetchJson<GradebookPayload>(
        `/api/v1/assignments/gradebook/by-course/${encodeURIComponent(course_id)}`
      );
      setGradebook(data);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load gradebook");
    } finally {
      setGradebookLoading(false);
    }
  }

  // Load student attempts (lazy) - for students
  async function loadStudentAttempts() {
    if (!userId || studentAttempts.length > 0) return; // Already loaded or no user
    setStudentAttemptsLoading(true);
    try {
      const attemptsPromises = assignments.map(async (assignment) => {
        try {
          const attempts = await fetchJson<StudentAttempt[]>(
            `/api/v1/assignments/${assignment.id}/attempts?student_id=${encodeURIComponent(String(userId))}`
          ).catch(() => []);
          
          // Use total_points from assignment (fetched from backend)
          const totalPoints = assignment.total_points || 0;
          
          return { assignmentId: assignment.id, attempts, totalPoints };
        } catch {
          return { assignmentId: assignment.id, attempts: [], totalPoints: 0 };
        }
      });
      const results = await Promise.all(attemptsPromises);
      setStudentAttempts(results);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load attempts");
    } finally {
      setStudentAttemptsLoading(false);
    }
  }

  React.useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course_id]);

  // Load gradebook or student attempts when grades/course tab is activated
  React.useEffect(() => {
    if (activeTab === "grades") {
      if (isFaculty) {
        loadGradebook();
      } else {
        // Load attempts after assignments are loaded
        if (assignments.length > 0) {
          loadStudentAttempts();
        }
      }
    }
    // Also load student attempts when on course tab for best grade display
    if (activeTab === "course" && !isFaculty && assignments.length > 0) {
      loadStudentAttempts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, assignments.length]);

  // Save active tab to localStorage
  React.useEffect(() => {
    localStorage.setItem(`courseTab_${course_id}`, activeTab);
  }, [activeTab, course_id]);


  // Handle tab navigation
  function handleTabChange(tab: TabType) {
    setActiveTab(tab);
  }

  // Handle keyboard navigation for tabs
  function handleTabKeyDown(e: React.KeyboardEvent, tab: TabType) {
    const tabs: TabType[] = ["course", "participants", "grades"];
    const currentIndex = tabs.indexOf(activeTab);

    if (e.key === "ArrowLeft" && currentIndex > 0) {
      e.preventDefault();
      setActiveTab(tabs[currentIndex - 1]);
    } else if (e.key === "ArrowRight" && currentIndex < tabs.length - 1) {
      e.preventDefault();
      setActiveTab(tabs[currentIndex + 1]);
    }
  }

  // Participants filtering and sorting
  const participants: Participant[] = React.useMemo(() => {
    return [...students, ...faculty];
  }, [students, faculty]);

  const filteredAndSortedParticipants = React.useMemo(() => {
    let result = [...participants];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) =>
        (p.name || String(p.id)).toLowerCase().includes(query)
      );
    }

    // Sort
    if (sortField) {
      result.sort((a, b) => {
        let aVal: string;
        let bVal: string;

        if (sortField === "name") {
          aVal = (a.name || String(a.id)).toLowerCase();
          bVal = (b.name || String(b.id)).toLowerCase();
        } else {
          aVal = a.role;
          bVal = b.role;
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [participants, searchQuery, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedParticipants.length / itemsPerPage);
  const paginatedParticipants = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedParticipants.slice(start, start + itemsPerPage);
  }, [filteredAndSortedParticipants, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortDirection, itemsPerPage]);

  // Handle sort toggle
  function toggleSort(field: "name" | "role") {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        // Turn off sorting
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  // Delete student function
  async function deleteStudent() {
    if (!studentToDelete) return;
    
    setErr(null);
    setIsDeleting(true);

    try {
      await fetchJson(
        `/api/v1/courses/${encodeURIComponent(course_id)}/students/${studentToDelete.id}`,
        { method: "DELETE" }
      );
      
      // Refresh the participants list
      await loadAll();
      
      // Close dialog
      setStudentToDelete(null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete student");
    } finally {
      setIsDeleting(false);
    }
  }

  // Assignment status calculation
  // For Faculty: "scheduled" (before start), "active" (in progress), "closed" (past due)
  // For Students: "active" (can submit), "closed" (past due) - they don't see scheduled
  function getAssignmentStatus(assignment: Assignment, forStudent: boolean = false): "scheduled" | "active" | "closed" {
    const now = new Date();
    
    // Check start date first
    const hasStarted = !assignment.start || now >= new Date(assignment.start);
    
    // Check stop date
    const hasClosed = assignment.stop && now > new Date(assignment.stop);
    
    if (hasClosed) return "closed";
    if (!hasStarted) return "scheduled";
    return "active";
  }
  
  // Filter assignments for students - they should only see active or closed assignments
  const visibleAssignments = React.useMemo(() => {
    if (isFaculty) return assignments;
    // Students only see assignments that have started (or have no start date)
    return assignments.filter(a => {
      const now = new Date();
      return !a.start || now >= new Date(a.start);
    });
  }, [assignments, isFaculty]);

  // Helper function to check if assignment is due soon (within 3 days)
  const isDueSoon = (assignment: Assignment): boolean => {
    if (!assignment.stop) return false;
    const now = new Date();
    const dueDate = new Date(assignment.stop);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return dueDate > now && dueDate <= threeDaysFromNow;
  };

  // Helper function to get time remaining string
  const getTimeRemaining = (stopDate: string | null | undefined): string | null => {
    if (!stopDate) return null;
    const now = new Date();
    const due = new Date(stopDate);
    const diff = due.getTime() - now.getTime();
    
    if (diff < 0) return "Past due";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 7) return null; // Don't show countdown for far-off dates
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m left`;
  };

  // Filter and sort assignments for student view
  const filteredAndSortedAssignments = React.useMemo(() => {
    if (isFaculty) return visibleAssignments;
    
    let filtered = [...visibleAssignments];
    
    // Apply filter
    if (assignmentFilter === "active") {
      filtered = filtered.filter(a => getAssignmentStatus(a, true) === "active");
    } else if (assignmentFilter === "due-soon") {
      filtered = filtered.filter(a => {
        const status = getAssignmentStatus(a, true);
        return status === "active" && isDueSoon(a);
      });
    }
    
    // Apply sort
    filtered.sort((a, b) => {
      if (assignmentSort === "due-date") {
        // When sorting by due date, always put closed assignments last
        const aStatus = getAssignmentStatus(a, true);
        const bStatus = getAssignmentStatus(b, true);
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
      } else if (assignmentSort === "name") {
        return a.title.localeCompare(b.title);
      } else if (assignmentSort === "status") {
        const statusOrder = { active: 0, scheduled: 1, closed: 2 };
        const statusA = getAssignmentStatus(a, true);
        const statusB = getAssignmentStatus(b, true);
        return statusOrder[statusA] - statusOrder[statusB];
      }
      return 0;
    });
    
    return filtered;
  }, [visibleAssignments, assignmentFilter, assignmentSort, isFaculty]);

  // Get best grade for an assignment from student attempts
  const getBestGradeForAssignment = (assignmentId: number): { best: number | null; totalPoints: number } => {
    const attemptData = studentAttempts.find(sa => sa.assignmentId === assignmentId);
    if (!attemptData || attemptData.attempts.length === 0) {
      return { best: null, totalPoints: attemptData?.totalPoints ?? 0 };
    }
    const best = Math.max(...attemptData.attempts.map(a => (a.earned_points ?? a.grade) ?? -Infinity));
    return { best: best === -Infinity ? null : best, totalPoints: attemptData.totalPoints ?? 0 };
  };

  // Calculate best score across all assignments
  function calculateBestScore(grades: Record<string, number | null>): number | null {
    const values = Object.values(grades).filter((g): g is number => g !== null);
    if (values.length === 0) return null;
    return Math.max(...values);
  }

  return (
    <div className="page-container">
        {err && (
          <Alert variant="error">
            <p className="font-medium">{err}</p>
          </Alert>
        )}
        
      {course && (
        <Card>
          <div className="mb-6">
            <h1 className="page-title">
              {course.course_code} – {course.name}
            </h1>

            <div className="text-base text-muted-foreground">
                <p className="mt-0">{course.description || "No description provided."}</p>
              {isFaculty && course.enrollment_key && (
                <p className="mt-1.5 flex items-center gap-2">
                  <span className="text-muted-foreground">Enrollment key:</span>
                  <code className="code-inline">{course.enrollment_key}</code>
                </p>
              )}
            </div>
            {loading && (
              <p className="text-muted-foreground italic mt-2">Refreshing data…</p>
            )}
          </div>

            {/* Tab Navigation */}
            <nav role="tablist" className="border-b border-border flex gap-1">
              {(["course", "participants", "grades"] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  aria-controls={`${tab}-panel`}
                  tabIndex={activeTab === tab ? 0 : -1}
                  onClick={() => handleTabChange(tab)}
                  onKeyDown={(e) => handleTabKeyDown(e, tab)}
                  className={`px-6 py-3 font-medium text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    activeTab === tab
                      ? "text-primary border-b-2 border-primary -mb-[1px]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
        </Card>
      )}
      
      {loading && !course && <p className="text-center text-muted-foreground">Loading…</p>}

        {/* Tab Panels */}
        {course && (
          <>
            {/* Participants Tab */}
            {activeTab === "participants" && (
              <div role="tabpanel" id="participants-panel" aria-labelledby="participants-tab">
      <Card>
                  <h2 className="text-2xl font-semibold mb-4">Participants</h2>

                  {/* Search and controls */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="flex-1">
                      <Input
                        type="search"
                        placeholder="Search by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Search participants"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap text-center sm:text-left">Show per page:</span>
                      <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5" role="group" aria-label="Participants per page">
                        {[10, 20, 50].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setItemsPerPage(value)}
                            aria-pressed={itemsPerPage === value}
                            className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                              itemsPerPage === value
                                ? "bg-primary text-primary-foreground shadow"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Participants table */}
                  {participants.length === 0 ? (
                    <p className="text-muted-foreground">No participants yet.</p>
                  ) : filteredAndSortedParticipants.length === 0 ? (
                    <p className="text-muted-foreground">No participants match your search.</p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full table-fixed">
                          <thead>
                            <tr className="border-b border-border">
                              <th className={`text-left p-3 ${isFaculty ? 'w-1/2' : 'w-3/4'}`}>
                  <button
                                  onClick={() => toggleSort("name")}
                                  className="flex items-center gap-2 font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                                  aria-label={`Sort by name ${
                                    sortField === "name"
                                      ? sortDirection === "asc"
                                        ? "descending"
                                        : "off"
                                      : "ascending"
                                  }`}
                                  aria-sort={
                                    sortField === "name"
                                      ? sortDirection === "asc"
                                        ? "ascending"
                                        : "descending"
                                      : "none"
                                  }
                                >
                                  Name
                                  <span className="inline-flex items-center justify-center w-4" aria-hidden="true">
                                    <span className={sortField === "name" ? "" : "invisible"}>
                                      {sortDirection === "asc" ? "↑" : "↓"}
                                    </span>
                                  </span>
                  </button>
                              </th>
                              <th className="text-left p-3 w-32">
                                <button
                                  onClick={() => toggleSort("role")}
                                  className="flex items-center gap-2 font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                                  aria-label={`Sort by role ${
                                    sortField === "role"
                                      ? sortDirection === "asc"
                                        ? "descending"
                                        : "off"
                                      : "ascending"
                                  }`}
                                  aria-sort={
                                    sortField === "role"
                                      ? sortDirection === "asc"
                                        ? "ascending"
                                        : "descending"
                                      : "none"
                                  }
                                >
                                  Role
                                  <span className="inline-flex items-center justify-center w-4" aria-hidden="true">
                                    <span className={sortField === "role" ? "" : "invisible"}>
                                      {sortDirection === "asc" ? "↑" : "↓"}
                                    </span>
                                  </span>
                                </button>
                              </th>
                              {isFaculty && (
                                <th className="text-right p-3 w-24">
                                  <span className="font-semibold">Actions</span>
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedParticipants.map((p) => (
                              <tr key={`${p.role}-${p.id}`} className="border-b border-border last:border-0 hover:bg-muted/50">
                                <td className="p-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                                      {(p.name || String(p.id)).charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-medium">{p.name || `User ${p.id}`}</span>
                                  </div>
                                </td>
                                <td className="p-3 w-32">
                                  <Badge variant={p.role === "faculty" ? "default" : "info"}>
                                    {p.role === "faculty" ? "Faculty" : "Student"}
                                  </Badge>
                                </td>
                                {isFaculty && (
                                  <td className="p-3 text-right w-24">
                                    {p.role === "student" && (
                                      <button
                                        onClick={() => setStudentToDelete({ id: p.id, name: p.name || `User ${p.id}` })}
                                        className="inline-flex items-center justify-center rounded-lg p-2 text-danger hover:bg-danger/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                                        aria-label={`Delete ${p.name || `User ${p.id}`}`}
                                        title="Delete student"
                                      >
                                        <svg 
                                          className="h-5 w-5" 
                                          fill="none" 
                                          stroke="currentColor" 
                                          viewBox="0 0 24 24"
                                        >
                                          <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={2} 
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                                          />
                                        </svg>
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <p className="text-sm text-muted-foreground">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                            {Math.min(currentPage * itemsPerPage, filteredAndSortedParticipants.length)} of{" "}
                            {filteredAndSortedParticipants.length} participants
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                            >
                              Prev
                            </Button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              const page = i + 1;
                              return (
                                <Button
                                  key={page}
                                  size="sm"
                                  variant={currentPage === page ? "primary" : "secondary"}
                                  onClick={() => setCurrentPage(page)}
                                >
                                  {page}
                                </Button>
                              );
                            })}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
        )}
      </Card>

                {/* Delete Student Confirmation Dialog */}
                {studentToDelete && (
                  <div 
                    className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setStudentToDelete(null)}
                  >
                    <Card 
                      className="max-w-md w-full"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <h3 className="text-xl font-semibold mb-4">Confirm Deletion</h3>
                      <p className="text-muted-foreground mb-6">
                        Are you sure you want to remove <strong>{studentToDelete.name}</strong> student?
                      </p>
                      <div className="flex gap-3 justify-end">
                        <Button
                          variant="secondary"
                          onClick={() => setStudentToDelete(null)}
                          disabled={isDeleting}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          onClick={deleteStudent}
                          disabled={isDeleting}
                          className="bg-danger hover:bg-danger/90"
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {/* Course Tab (Assignments) */}
            {activeTab === "course" && (
              <div role="tabpanel" id="course-panel" aria-labelledby="course-tab">
                {/* Faculty View - Simple List */}
                {isFaculty ? (
                  <Card>
                    <div className="flex items-center justify-between gap-3 mb-6">
                      <h2 className="text-2xl font-semibold m-0">Assignments</h2>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/courses/${course_id}/assignments/new`)}
                      >
                        Create Assignment
                      </Button>
                    </div>

                    {visibleAssignments.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground mb-4">No assignments yet.</p>
                        <Button size="sm" onClick={() => navigate(`/courses/${course_id}/assignments/new`)}>
                          Create one
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {visibleAssignments.map((a) => {
                          const status = getAssignmentStatus(a, false);
                          const statusColors = {
                            closed: "border-l-danger",
                            active: "border-l-accent",
                            scheduled: "border-l-muted-foreground",
                          };
                          const statusLabels = {
                            closed: "Closed",
                            active: "Active",
                            scheduled: "Scheduled",
                          };
                          const badgeVariants: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
                            closed: "danger",
                            active: "success",
                            scheduled: "default",
                          };

                          return (
                            <Link
                              key={a.id}
                              to={`/assignments/${a.id}`}
                              className={`group block rounded-lg border-l-4 border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${statusColors[status]}`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                    {a.title}
                                  </h3>
                                  <Badge variant={badgeVariants[status]} className="text-xs whitespace-nowrap shrink-0">
                                    {statusLabels[status]}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                                  {a.stop && (
                                    <span className="hidden sm:inline">
                                      <span className="font-medium">Due:</span>{" "}
                                      {new Date(a.stop).toLocaleDateString()}
                                    </span>
                                  )}
                                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                ) : (
                  /* Student View - with Sorting/Filtering */
                  <div className="space-y-6">
                    {/* Header with Filters and Sort */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Filter Tabs */}
                      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border">
                        {[
                          { id: "all" as AssignmentFilterType, label: "All", icon: FileCode },
                          { id: "active" as AssignmentFilterType, label: "Active", icon: CheckCircle2 },
                          { id: "due-soon" as AssignmentFilterType, label: "Due Soon", icon: Flame },
                        ].map(({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            onClick={() => setAssignmentFilter(id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                              assignmentFilter === id
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Sort Dropdown */}
                      <div className="flex items-center gap-2">
                        <SortAsc className="w-4 h-4 text-muted-foreground" />
                        <select
                          value={assignmentSort}
                          onChange={(e) => setAssignmentSort(e.target.value as AssignmentSortType)}
                          className="bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="due-date">Sort by Due Date</option>
                          <option value="name">Sort by Name</option>
                          <option value="status">Sort by Status</option>
                        </select>
                      </div>
                    </div>

                    {/* Assignments Grid */}
                    {filteredAndSortedAssignments.length === 0 ? (
                      <Card className="text-center py-16">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                          <FileCode className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          {assignmentFilter === "all" 
                            ? "No assignments yet" 
                            : assignmentFilter === "active"
                              ? "No active assignments"
                              : "No assignments due soon"}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {assignmentFilter !== "all" && "Try changing your filter to see more assignments."}
                        </p>
                      </Card>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {filteredAndSortedAssignments.map((a) => {
                          const status = getAssignmentStatus(a, true);
                          const timeRemaining = getTimeRemaining(a.stop);
                          const isUrgent = isDueSoon(a) && status === "active";
                          const gradeInfo = getBestGradeForAssignment(a.id);
                          const hasAttempted = (a.num_attempts ?? 0) > 0;
                          
                          // Status styling
                          const statusConfig = {
                            active: { 
                              bg: "bg-gradient-to-br from-accent/10 to-accent/5", 
                              border: "border-accent/30",
                              dot: "bg-accent",
                              text: "text-accent"
                            },
                            closed: { 
                              bg: "bg-gradient-to-br from-danger/10 to-danger/5", 
                              border: "border-danger/30",
                              dot: "bg-danger",
                              text: "text-danger"
                            },
                            scheduled: { 
                              bg: "bg-gradient-to-br from-muted to-muted/50", 
                              border: "border-border",
                              dot: "bg-muted-foreground",
                              text: "text-muted-foreground"
                            },
                          };

                          const config = statusConfig[status];

                          return (
                            <Link
                              key={a.id}
                              to={`/assignments/${a.id}`}
                              className={`group relative block rounded-2xl border ${config.border} ${config.bg} p-5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/40 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-hidden`}
                            >
                              {/* Urgent Indicator */}
                              {isUrgent && (
                                <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden">
                                  <div className="absolute top-3 -right-6 w-28 text-center py-1 bg-warning text-warning-foreground text-[10px] font-bold uppercase tracking-wider rotate-45 shadow-sm">
                                    Due Soon
                                  </div>
                                </div>
                              )}

                              {/* Top Row: Title + Status */}
                              <div className="flex items-start justify-between gap-3 mb-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`w-2 h-2 rounded-full ${config.dot} shrink-0`} />
                                    <span className={`text-xs font-semibold uppercase tracking-wide ${config.text}`}>
                                      {status === "active" ? "Active" : status === "closed" ? "Closed" : "Scheduled"}
                                    </span>
                                  </div>
                                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                    {a.title}
                                  </h3>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                              </div>

                              {/* Stats Row */}
                              <div className="grid grid-cols-3 gap-3 mb-4">
                                {/* Due Date */}
                                <div className="flex flex-col items-center p-2.5 rounded-xl bg-background/50 border border-border/50">
                                  <Calendar className={`w-4 h-4 mb-1 ${isUrgent ? "text-warning" : "text-muted-foreground"}`} />
                                  {a.stop ? (
                                    <div className="flex flex-col items-center">
                                      <span className={`text-xs font-medium ${isUrgent ? "text-warning" : "text-foreground"}`}>
                                        {new Date(a.stop).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                      </span>
                                      <span className={`text-[10px] font-medium ${isUrgent ? "text-warning" : "text-muted-foreground"}`}>
                                        {new Date(a.stop).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className={`text-xs font-medium ${isUrgent ? "text-warning" : "text-foreground"}`}>
                                      No due
                                    </span>
                                  )}
                                </div>

                                {/* Attempts */}
                                <div className="flex flex-col items-center p-2.5 rounded-xl bg-background/50 border border-border/50">
                                  <FileCode className="w-4 h-4 mb-1 text-muted-foreground" />
                                  <span className="text-xs font-medium text-foreground">
                                    {a.num_attempts ?? 0}{a.sub_limit ? `/${a.sub_limit}` : ""} tries
                                  </span>
                                </div>

                                {/* Best Grade / Points */}
                                <div className="flex flex-col items-center p-2.5 rounded-xl bg-background/50 border border-border/50">
                                  <Trophy className={`w-4 h-4 mb-1 ${hasAttempted && gradeInfo.best !== null ? "text-accent" : "text-muted-foreground"}`} />
                                  <span className={`text-xs font-medium ${hasAttempted && gradeInfo.best !== null ? "text-accent" : "text-foreground"}`}>
                                    {hasAttempted && gradeInfo.best !== null 
                                      ? `${gradeInfo.best}/${gradeInfo.totalPoints}`
                                      : `${a.total_points ?? 0} pts`
                                    }
                                  </span>
                                </div>
                              </div>

                              {/* Bottom Row: Time Remaining / Progress */}
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
                                    Submissions closed
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" />
                                    {a.stop ? `Due ${new Date(a.stop).toLocaleDateString()}` : "No deadline"}
                                  </div>
                                )}

                                {/* Progress Indicator */}
                                {hasAttempted && gradeInfo.best !== null && gradeInfo.totalPoints > 0 && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                      <div 
                                        className="h-full rounded-full bg-accent transition-all duration-500"
                                        style={{ width: `${Math.min(100, (gradeInfo.best / gradeInfo.totalPoints) * 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium text-accent">
                                      {Math.round((gradeInfo.best / gradeInfo.totalPoints) * 100)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Grades Tab */}
            {activeTab === "grades" && (
              <div role="tabpanel" id="grades-panel" aria-labelledby="grades-tab">
                <Card>
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <h2 className="text-2xl font-semibold m-0">Grades</h2>
                    <div className="flex items-center gap-1 text-sm">
                      <button
                        onClick={() => setShowPoints(false)}
                        className={`px-3 py-1.5 rounded-l-lg font-medium transition-colors ${
                          !showPoints
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Percentage
                      </button>
                      <button
                        onClick={() => setShowPoints(true)}
                        className={`px-3 py-1.5 rounded-r-lg font-medium transition-colors ${
                          showPoints
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Points
                      </button>
                    </div>
                  </div>

                  {/* Faculty View */}
                  {isFaculty && (
                    <>
                      {gradebookLoading && <p className="text-center text-muted-foreground">Loading gradebook…</p>}

                      {!gradebookLoading && gradebook && (
                        <>
                          {gradebook.assignments.length === 0 ? (
                            <p className="text-muted-foreground">No assignments yet.</p>
                          ) : gradebook.students.length === 0 ? (
                            <p className="text-muted-foreground">No enrolled students.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse min-w-[600px]">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="sticky left-0 bg-card z-10 text-left p-3 font-semibold border-r border-border w-[200px]">
                                      Student
                                    </th>
                                    {gradebook.assignments.map((a) => (
                                      <th
                                        key={a.id}
                                        className="text-center p-3 font-semibold whitespace-nowrap min-w-[120px]"
                                        title={a.title}
                                      >
                                        <button
                                          onClick={() => navigate(`/assignments/${a.id}`)}
                                          className="hover:text-primary transition-colors underline-offset-2 hover:underline"
                                        >
                                          {a.title}
                                        </button>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {gradebook.students.map((s) => {
                                    return (
                                      <tr key={s.student_id} className="border-b border-border hover:bg-muted/50">
                                        <td className="sticky left-0 bg-card z-10 p-3 font-medium border-r border-border">
                                          {s.username}
                                        </td>
                                        {gradebook.assignments.map((a) => {
                                          const gradeValue = s.grades[String(a.id)];
                                          const submissionId = s.best_submission_ids?.[String(a.id)];
                                          const totalPoints = a.total_points || 0;
                                          const isMissing = gradeValue === null || gradeValue === undefined;

                                          let displayGrade = "—";
                                          let percentage: number | null = null;
                                          if (!isMissing) {
                                            percentage = totalPoints > 0 ? Math.round((gradeValue / totalPoints) * 100) : 0;
                                            if (showPoints) {
                                              displayGrade = `${gradeValue}/${totalPoints}`;
                                            } else {
                                              displayGrade = `${percentage}%`;
                                            }
                                          }

                                          return (
                                            <td key={a.id} className="p-3 text-center">
                                              {isMissing ? (
                                                <span className="text-muted-foreground">—</span>
                                              ) : submissionId ? (
                                                <button
                                                  onClick={() => navigate(`/assignments/${a.id}/submissions/${submissionId}`)}
                                                  className={`
                                                    px-3 py-1 rounded-lg font-medium transition-all duration-200
                                                    hover:scale-105 cursor-pointer
                                                    ${percentage !== null
                                                      ? percentage >= 70
                                                        ? "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20"
                                                        : percentage >= 50
                                                          ? "bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20"
                                                          : "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20"
                                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                                    }
                                                  `}
                                                  title="Click to view best submission"
                                                >
                                                  {displayGrade}
                                                </button>
                                              ) : (
                                                <span className="font-medium">{displayGrade}</span>
                                              )}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Student View */}
                  {!isFaculty && (
                    <>
                      {studentAttemptsLoading && <p className="text-center text-muted-foreground">Loading attempts…</p>}

                      {!studentAttemptsLoading && (
                        <>
                          {assignments.length === 0 ? (
                            <p className="text-muted-foreground">No assignments yet.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse min-w-[600px]">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="sticky left-0 bg-card z-10 text-left p-3 font-semibold border-r border-border w-[200px]">
                                      Assignment
                                    </th>
                                    <th className="text-center p-3 font-semibold bg-muted/30 min-w-[120px]">
                                      BEST
                                    </th>
                                    {(() => {
                                      // Find max attempts across all assignments
                                      const maxAttempts = Math.max(
                                        ...studentAttempts.map((sa) => sa.attempts.length),
                                        1
                                      );
                                      return Array.from({ length: maxAttempts }, (_, i) => (
                                        <th
                                          key={i}
                                          className="text-center p-3 font-semibold whitespace-nowrap min-w-[120px]"
                                        >
                                          Attempt {i + 1}
                                        </th>
                                      ));
                                    })()}
                                  </tr>
                                </thead>
                                <tbody>
                                  {assignments.map((assignment) => {
                                    const assignmentData = studentAttempts.find(
                                      (sa) => sa.assignmentId === assignment.id
                                    );
                                    const assignmentAttempts = assignmentData?.attempts || [];
                                    const totalPoints = assignmentData?.totalPoints ?? 0;
                                    
                                    const bestScore = assignmentAttempts.length > 0
                                      ? Math.max(...assignmentAttempts.map(a => (a.earned_points ?? a.grade) ?? -Infinity).filter(g => g !== -Infinity))
                                      : null;
                                    
                                    let bestScoreDisplay: string;
                                    if (bestScore == null || bestScore === -Infinity) {
                                      bestScoreDisplay = "—";
                                    } else if (showPoints) {
                                      bestScoreDisplay = `${bestScore}/${totalPoints}`;
                                    } else {
                                      const percentage = totalPoints > 0 ? Math.round((bestScore / totalPoints) * 100) : 0;
                                      bestScoreDisplay = `${percentage}%`;
                                    }
                                    
                                    return (
                                      <tr key={assignment.id} className="border-b border-border hover:bg-muted/50">
                                        <td className="sticky left-0 bg-card z-10 p-3 font-medium border-r border-border">
                                          {assignment.title}
                                        </td>
                                        {/* BEST column - rendered first */}
                                        <td className="p-3 text-center font-semibold bg-muted/30">
                                          {bestScoreDisplay === "—" ? (
                                            <span className="text-muted-foreground">—</span>
                                          ) : (
                                            <span>{bestScoreDisplay}</span>
                                          )}
                                        </td>
                                        {/* Attempt columns */}
                                        {(() => {
                                          const maxAttempts = Math.max(
                                            ...studentAttempts.map((sa) => sa.attempts.length),
                                            1
                                          );
                                          
                                          return Array.from({ length: maxAttempts }, (_, i) => {
                                            const attempt = assignmentAttempts[i];
                                            const earnedPoints = attempt?.earned_points ?? attempt?.grade ?? null;
                                            const isMissing = earnedPoints === null;

                                            let displayGrade: string;
                                            if (isMissing) {
                                              displayGrade = "—";
                                            } else if (showPoints) {
                                              displayGrade = `${earnedPoints}/${totalPoints}`;
                                            } else {
                                              const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
                                              displayGrade = `${percentage}%`;
                                            }

                                            return (
                                              <td key={i} className="p-3 text-center">
                                                {isMissing ? (
                                                  <span className="text-muted-foreground">—</span>
                                                ) : (
                                                  <span className="font-medium">{displayGrade}</span>
                                                )}
                                              </td>
                                            );
                                          });
                                        })()}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </Card>
              </div>
            )}
          </>
        )}
      </div>
  );
}
