/* =========================
   ORIGINAL (commented out)
   =========================
import ... from ...
// ...your previous code here...
import React from "react";

export default function StudentDashboard() {
  return (
    <div className="container">
      <h1>Student</h1>
      <p>User ID: </p>
    </div>
  );
}
// Keep everything exactly as it was, just inside this block.
*/

/* ========== NEW ========== */
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function StudentDashboard() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true }); // or "/"
  };

  return (
    <div className="container">
      <h1>Student</h1>
      <p>User ID: {userId ?? "—"}</p>
      <div style={{ display: "flex", gap: 12 }}>
        <Link to="/assignment">Go to Sandbox</Link>
        <button onClick={onLogout}>Log out</button>
      </div>
    </div>
  );
}

