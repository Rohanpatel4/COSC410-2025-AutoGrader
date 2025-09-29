/* ========== NEW ========== */
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import LoginPage from "./tsx_files/LoginPage";
import StudentDashboard from "./tsx_files/StudentDashboard";
import FacultyDashboard from "./tsx_files/FacultyDashboard";
import SandboxApp from "./tsx_files/SandboxApp";
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

        <Route
          path="/assignment/*"
          element={
            <Protected>
              <SandboxApp />
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
