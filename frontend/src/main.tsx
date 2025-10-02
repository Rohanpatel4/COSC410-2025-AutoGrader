/* ========== NEW ========== */
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import LoginPage from "./webpages/LoginPage";
import StudentDashboard from "./webpages/StudentDashboard";
import FacultyDashboard from "./webpages/FacultyDashboard";
import CoursePage from "./webpages/CoursePage"; // ← added
import SandboxApp from "./webpages/SandboxApp";
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

        {/* Protect the course page so only logged-in users can view it */}
        <Route
          path="/courses/:course_id"
          element={
            <Protected>
              <CoursePage />
            </Protected>
          }
        />

        {/*
        LATER PUT THIS IN WHEN WE ARE FINISHED WITH THE SANDBOX!!!!!!!

        <Route
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

