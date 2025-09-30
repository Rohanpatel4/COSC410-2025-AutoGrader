/*
ORIGINAL
//
import React from "react";

export default function FacultyDashboard() {
  return (
    <div className="container">
      <h1>Faculty</h1>
      <p>User ID: </p>
    </div>
  );
}
//
*/

/* ========== NEW ========== */
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function FacultyDashboard() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true }); // or navigate("/", { replace: true })
  };

  return (
    <div className="container">
      <h1>Faculty</h1>
      <p>User ID: {userId ?? "—"}</p>
      <div style={{ display: "flex", gap: 12 }}>
        <Link to="/assignment">Go to Sandbox</Link>
        <button onClick={onLogout}>Log out</button>
      </div>
    </div>
  );
}
