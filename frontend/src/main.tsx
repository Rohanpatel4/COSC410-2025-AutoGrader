import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import LoginPage from "./tsx_files/LoginPage";
import StudentDashboard from "./tsx_files/StudentDashboard";
import FacultyDashboard from "./tsx_files/FacultyDashboard";
import SandboxApp from "./tsx_files/SandboxApp"; // unchanged
import "./styles/index.css";

/** Decides what to show at /my based on role carried in navigation state */
function RoleRouter() {
  const location = useLocation();
  const role = (location.state as { role?: "faculty" | "student" } | undefined)?.role;

  if (role === "faculty") return <FacultyDashboard />;
  if (role === "student") return <StudentDashboard />;

  // If someone hits /my directly without coming from login, push them to /login
  return <Navigate to="/login" replace />;
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* default -> /login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* login (choose role, then go to /my) */}
        <Route path="/login" element={<LoginPage />} />

        {/* this URL never shows role; RoleRouter decides which dashboard to render */}
        <Route path="/my" element={<RoleRouter />} />

        {/* your sandbox section remains accessible at /app/* */}
        <Route path="/assignment/*" element={<SandboxApp />} />

        {/* catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(<AppRouter />);
