/* ========== UPDATED main.tsx ========== */
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import LoginPage from "./webpages/LoginPage";
import StudentDashboard from "./webpages/StudentDashboard";
import FacultyDashboard from "./webpages/FacultyDashboard";
import CoursePage from "./webpages/CoursePage";
import AssignmentsPage from "./webpages/AssignmentsPage";
import AssignmentDetailPage from "./webpages/AssignmentDetailPage"; // ← NEW

// Optional sandbox (still rough per your note)
import SandboxApp from "./webpages/SandboxApp";

// NEW upload pages
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

        {/* Course page */}
        <Route
          path="/courses/:course_id"
          element={
            <Protected>
              <CoursePage />
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

        {/* All assignments index (optional) */}
        <Route
          path="/stuassignment/*"
          element={
            <Protected>
              <AssignmentsPage />
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

        {/* Temporary sandbox route (unprotected per your comment, change if needed) */}
        {/* <Route
          path="/assignment/*"
          element={
            <Protected>
              <SandboxApp />
            </Protected>
          }
        /> */}
        <Route path="/assignment/*" element={<SandboxApp />} />

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


