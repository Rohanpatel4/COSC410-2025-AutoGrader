/* ========== UPDATED main.tsx ========== */
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import LoginPage from "./webpages/LoginPage";
import StudentDashboard from "./webpages/StudentDashboard";
import FacultyDashboard from "./webpages/FacultyDashboard";
import CoursePage from "./webpages/CoursePage";
import CoursesPage from "./webpages/CoursesPage";
import { Layout } from "./components/layout";
import AssignmentsPage from "./webpages/AssignmentsPage";
import AssignmentDetailPage from "./webpages/AssignmentDetailPage";
import GradebookPage from "./webpages/GradebookPage";
import GradebookIndexPage from "./webpages/GradebookIndexPage";
import StudentAttemptViewPage from "./webpages/StudentAttemptViewPage";
import CreateCoursePage from "./webpages/CreateCoursePage";
import CreateAssignmentPage from "./webpages/CreateAssignmentPage";
import EditAssignmentPage from "./webpages/EditAssignmentPage";
import JoinCoursePage from "./webpages/JoinCoursePage";

import "./styles/index.css";
import { AuthProvider, Protected, useAuth } from "./auth/AuthContext";
import { Button } from "./components/ui/Button";
import { useNavigate } from "react-router-dom";
import { Plus, BookOpen } from "lucide-react";

function AssignmentDetailPageWrapper() {
  const { role } = useAuth();
  const isStudent = role === "student";

  // Students get a full-screen view without the title card
  if (isStudent) {
    return (
      <Layout fullScreen>
        <AssignmentDetailPage />
      </Layout>
    );
  }

  // Faculty get the standard view with title
  return (
    <Layout title="Assignment Details">
      <AssignmentDetailPage />
    </Layout>
  );
}

function CoursesLayoutWrapper() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isFaculty = role === "faculty";

  const actions = (
    <>
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
    </>
  );

  return (
    <Layout title="Courses" actions={actions}>
      <CoursesPage />
    </Layout>
  );
}

function RoleRouter() {
  const location = useLocation();
  const { role } = useAuth();
  const stateRole = (location.state as { role?: "faculty" | "student" } | undefined)?.role;
  const effectiveRole = role ?? stateRole;

  if (effectiveRole === "faculty") {
    return (
      <Layout title="Faculty Dashboard">
        <FacultyDashboard />
      </Layout>
    );
  }
  if (effectiveRole === "student") {
    return (
      <Layout title="Student Dashboard">
        <StudentDashboard />
      </Layout>
    );
  }
  return <Navigate to="/login" replace />;
}

// Root route that redirects based on auth state
function RootRoute() {
  const { role } = useAuth();
  const location = useLocation();
  
  // Only redirect if we're actually on the root path
  // This prevents redirect loops when using browser back button
  if (location.pathname === "/") {
    // If authenticated, redirect to dashboard (without replace to preserve history)
    if (role) {
      return <Navigate to="/my" replace={false} />;
    }
    
    // If not authenticated, redirect to login (without replace to preserve history)
    return <Navigate to="/login" replace={false} />;
  }
  
  // If not on root path, don't redirect (let other routes handle it)
  return null;
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/my"
          element={
            <Protected>
              <RoleRouter />
            </Protected>
          }
        />

        {/* Create course (faculty) */}
        <Route
          path="/courses/new"
          element={
            <Protected>
              <Layout title="Create Course">
                <CreateCoursePage />
              </Layout>
            </Protected>
          }
        />

        {/* Join course (student) */}
        <Route
          path="/courses/join"
          element={
            <Protected>
              <Layout title="Join Course">
                <JoinCoursePage />
              </Layout>
            </Protected>
          }
        />

        {/* Courses index */}
        <Route
          path="/courses"
          element={
            <Protected>
              <CoursesLayoutWrapper />
            </Protected>
          }
        />

        {/* Course page */}
        <Route
          path="/courses/:course_id"
          element={
            <Protected>
              <Layout title="Course Details">
                <CoursePage />
              </Layout>
            </Protected>
          }
        />

        {/* Create assignment (faculty) */}
        <Route
          path="/courses/:course_id/assignments/new"
          element={
            <Protected>
              <Layout title="Create Assignment">
                <CreateAssignmentPage />
              </Layout>
            </Protected>
          }
        />

        {/* Course gradebook (faculty) */}
        <Route
          path="/courses/:course_id/gradebook"
          element={
            <Protected>
              <Layout title="Gradebook">
                <GradebookPage />
              </Layout>
            </Protected>
          }
        />

        {/* All assignments index */}
        <Route
          path="/assignments"
          element={
            <Protected>
              <Layout title="Assignments">
                <AssignmentsPage />
              </Layout>
            </Protected>
          }
        />

        {/* Gradebook index (faculty) */}
        <Route
          path="/gradebook"
          element={
            <Protected>
              <Layout title="Gradebook">
                <GradebookIndexPage />
              </Layout>
            </Protected>
          }
        />

        {/* Edit assignment (faculty) - must be before /assignments/:assignment_id */}
        <Route
          path="/assignments/:assignment_id/edit"
          element={
            <Protected>
              <Layout title="Edit Assignment">
                <EditAssignmentPage />
              </Layout>
            </Protected>
          }
        />

        {/* Student submission view (faculty) - must be before /assignments/:assignment_id */}
        <Route
          path="/assignments/:assignment_id/submissions/:submission_id"
          element={
            <Protected>
              <Layout title="Submission View">
                <StudentAttemptViewPage />
              </Layout>
            </Protected>
          }
        />

        {/* Assignment detail (student/faculty) */}
        <Route
          path="/assignments/:assignment_id"
          element={
            <Protected>
              <AssignmentDetailPageWrapper />
            </Protected>
          }
        />

        <Route path="*" element={<CatchAllRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

// Catch-all route that redirects based on auth state
function CatchAllRoute() {
  const { role } = useAuth();
  
  // If authenticated, redirect to dashboard
  if (role) {
    return <Navigate to="/my" replace />;
  }
  
  // If not authenticated, redirect to login
  return <Navigate to="/login" replace />;
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <AuthProvider>
    <AppRouter />
  </AuthProvider>
);


