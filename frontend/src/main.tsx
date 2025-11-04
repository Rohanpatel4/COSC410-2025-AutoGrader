/* ========== UPDATED main.tsx ========== */
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import LoginPage from "./webpages/LoginPage";
import StudentDashboard from "./webpages/StudentDashboard";
import FacultyDashboard from "./webpages/FacultyDashboard";
import CoursePage from "./webpages/CoursePage";
import AssignmentsPage from "./webpages/AssignmentsPage";
import AssignmentDetailPage from "./webpages/AssignmentDetailPage";
import GradebookPage from "./webpages/GradebookPage";
import CreateCoursePage from "./webpages/CreateCoursePage";
import JoinCoursePage from "./webpages/JoinCoursePage";

// Upload pages
import UploadTestFile from "./webpages/UploadTestFile";
import UploadStudentFile from "./webpages/UploadStudentFile";

import "./styles/index.css";
import { AuthProvider, Protected, useAuth } from "./auth/AuthContext";

function RoleRouter() {
  const location = useLocation();
  const { role } = useAuth();
  const stateRole = (location.state as { role?: "faculty" | "student" } | undefined)?.role;
  const effectiveRole = role ?? stateRole;

  if (effectiveRole === "faculty") return <FacultyDashboard />;
  if (effectiveRole === "student") return <StudentDashboard />;
  return <Navigate to="/login" replace />;
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
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
              <CreateCoursePage />
            </Protected>
          }
        />

        {/* Join course (student) */}
        <Route
          path="/courses/join"
          element={
            <Protected>
              <JoinCoursePage />
            </Protected>
          }
        />

        {/* Course page */}
        <Route
          path="/courses/:course_id"
          element={
            <Protected>
              <CoursePage />
            </Protected>
          }
        />

        {/* Course gradebook (faculty) */}
        <Route
          path="/courses/:course_id/gradebook"
          element={
            <Protected>
              <GradebookPage />
            </Protected>
          }
        />

        {/* All assignments index */}
        <Route
          path="/assignments"
          element={
            <Protected>
              <AssignmentsPage />
            </Protected>
          }
        />

        {/* Assignment detail (student/faculty) */}
        <Route
          path="/assignments/:assignment_id"
          element={
            <Protected>
              <AssignmentDetailPage />
            </Protected>
          }
        />

        {/* Upload flows (protect if you want sign-in required) */}
        <Route
          path="/upload/test"
          element={
            <Protected>
              <UploadTestFile />
            </Protected>
          }
        />
        <Route
          path="/upload/student"
          element={
            <Protected>
              <UploadStudentFile />
            </Protected>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <AuthProvider>
    <AppRouter />
  </AuthProvider>
);


