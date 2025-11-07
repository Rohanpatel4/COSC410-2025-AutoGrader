// src/webpages/CoursePage.tsx
import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchJson, BASE } from "../api/client";
import type { Assignment } from "../types/assignments";
import { useAuth } from "../auth/AuthContext";
import { Button, Input, Card, Alert, Badge } from "../components/ui";
import { formatGradeDisplay } from "../utils/formatGrade";

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
  assignments: { id: number; title: string }[];
  students: { student_id: number; username: string; grades: Record<string, number | null> }[];
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
  type StudentAttempt = { id: number; grade: number | null };
  type AssignmentAttempts = { assignmentId: number; attempts: StudentAttempt[] };
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
          );
          return { assignmentId: assignment.id, attempts };
        } catch {
          return { assignmentId: assignment.id, attempts: [] };
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

  // Load gradebook or student attempts when grades tab is activated
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
  function getAssignmentStatus(assignment: Assignment): "overdue" | "active" | "upcoming" {
    // If no start and no stop, assignment is active
    if (!assignment.start && !assignment.stop) return "active";
    
    // If no stop date, check start date
    if (!assignment.stop) {
      if (!assignment.start) return "active";
      const startDate = new Date(assignment.start);
      const now = new Date();
      return now >= startDate ? "active" : "upcoming";
    }
    
    const stopDate = new Date(assignment.stop);
    const now = new Date();
    const hoursUntilDue = (stopDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDue < 0) return "overdue";
    if (hoursUntilDue < 72) return "active";
    return "upcoming";
  }

  // Calculate best score across all assignments
  function calculateBestScore(grades: Record<string, number | null>): number | null {
    const values = Object.values(grades).filter((g): g is number => g !== null);
    if (values.length === 0) return null;
    return Math.max(...values);
  }

  return (
    <div className="container py-12 space-y-8">
        {err && (
          <Alert variant="error">
            <p className="font-medium">{err}</p>
          </Alert>
        )}
        
      {course && (
        <Card>
          <div className="mb-6">
            <h1 className="mb-1 text-3xl font-bold tracking-tight">
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
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left p-3">
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
                                  {sortField === "name" && (
                                    <span aria-hidden="true">
                                      {sortDirection === "asc" ? "↑" : "↓"}
                                    </span>
                                  )}
                  </button>
                              </th>
                              <th className="text-left p-3">
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
                                  {sortField === "role" && (
                                    <span aria-hidden="true">
                                      {sortDirection === "asc" ? "↑" : "↓"}
                                    </span>
                                  )}
                                </button>
                              </th>
                              {isFaculty && (
                                <th className="text-right p-3">
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
                                <td className="p-3">
                                  <Badge variant={p.role === "faculty" ? "default" : "info"}>
                                    {p.role === "faculty" ? "Faculty" : "Student"}
                                  </Badge>
                                </td>
                                {isFaculty && (
                                  <td className="p-3 text-right">
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
      <Card>
        <div className="flex items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-semibold m-0">Assignments</h2>
          {isFaculty && (
            <Button
              size="sm"
              onClick={() => navigate(`/courses/${course_id}/assignments/new`)}
            >
              Create Assignment
            </Button>
          )}
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No assignments yet.</p>
            {isFaculty && (
              <Button size="sm" onClick={() => navigate(`/courses/${course_id}/assignments/new`)}>
                Create one
              </Button>
            )}
          </div>
        ) : (
                    <div className="space-y-3">
                      {assignments.map((a) => {
                        const status = getAssignmentStatus(a);
                        const statusColors = {
                          overdue: "border-l-danger",
                          active: "border-l-warning",
                          upcoming: "border-l-primary/50",
                        };
                        const statusLabels = {
                          overdue: "Overdue",
                          active: "Active",
                          upcoming: "Upcoming",
                        };

                        return (
                          <Link
                            key={a.id}
                            to={`/assignments/${a.id}`}
                            className={`group block rounded-lg border-l-4 border border-border bg-card p-5 transition-all duration-200 hover:shadow-md hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${statusColors[status]}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {a.title}
                                  </h3>
                                  <Badge variant={status === "overdue" ? "default" : "info"} className="text-xs whitespace-nowrap">
                                    {statusLabels[status]}
                                  </Badge>
                                </div>

                                {a.description && (
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {a.description}
                                  </p>
                                )}

                                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                  {a.stop && (
                                    <span>
                                      <span className="font-medium">Due:</span>{" "}
                                      {new Date(a.stop).toLocaleString()}
                                    </span>
                                  )}
                                  {a.num_attempts !== undefined && (
                                    <span>
                                      <span className="font-medium">Attempts:</span> {a.num_attempts}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <svg 
                                className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary flex-shrink-0" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* Grades Tab */}
            {activeTab === "grades" && (
              <div role="tabpanel" id="grades-panel" aria-labelledby="grades-tab">
                <Card>
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <h2 className="text-2xl font-semibold m-0">Grades</h2>
                    {isFaculty && (
                      <Button size="sm" variant="secondary" disabled title="Coming soon">
                        Download CSV
                      </Button>
                    )}
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
                                        {a.title}
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
                                          const displayGrade = formatGradeDisplay(gradeValue);
                                          const isMissing = displayGrade === "—";

                                          return (
                                            <td key={a.id} className="p-3 text-center">
                                              {isMissing ? (
                                                <span className="text-muted-foreground">—</span>
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
                                    <th className="text-center p-3 font-semibold bg-muted/30 min-w-[120px]">
                                      Best Score
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {assignments.map((assignment) => {
                                    const assignmentAttempts = studentAttempts.find(
                                      (sa) => sa.assignmentId === assignment.id
                                    )?.attempts || [];
                                    const bestScore = assignmentAttempts.length > 0
                                      ? Math.max(...assignmentAttempts.map(a => a.grade ?? -Infinity).filter(g => g !== -Infinity))
                                      : null;
                                    return (
                                      <tr key={assignment.id} className="border-b border-border hover:bg-muted/50">
                                        <td className="sticky left-0 bg-card z-10 p-3 font-medium border-r border-border">
                                          {assignment.title}
                                        </td>
                                        {(() => {
                                          const maxAttempts = Math.max(
                                            ...studentAttempts.map((sa) => sa.attempts.length),
                                            1
                                          );
                                          return Array.from({ length: maxAttempts }, (_, i) => {
                                            const attempt = assignmentAttempts[i];
                                            const displayGrade = formatGradeDisplay(attempt?.grade ?? null);
                                            const isMissing = displayGrade === "—";

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
                                        <td className="p-3 text-center font-semibold bg-muted/30">
                                          {bestScore == null || bestScore === -Infinity ? (
                                            <span className="text-muted-foreground">—</span>
                                          ) : (
                                            <span>{formatGradeDisplay(bestScore)}</span>
                                          )}
                                        </td>
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
