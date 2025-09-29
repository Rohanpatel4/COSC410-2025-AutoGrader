import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/LoginPage.css"; // keep or remove if you don't need per-page CSS

export default function LoginPage() {
  const navigate = useNavigate();
  const [role, setRole] = React.useState<"faculty" | "student">("student");

  const go = () => {
    // Always go to /my, but carry the chosen role in navigation state
    navigate("/my", { replace: true, state: { role } });
  };

  return (
    <div className="container">
      <h1>Login</h1>
      <div className="login-card">
        <label htmlFor="role">Select role</label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value as "faculty" | "student")}
        >
          <option value="faculty">Faculty</option>
          <option value="student">Student</option>
        </select>

        <button onClick={go}>Enter</button>
      </div>
    </div>
  );
}
