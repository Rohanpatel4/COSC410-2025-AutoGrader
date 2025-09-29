/* =========================
   ORIGINAL (commented out)
   =========================
import ... from ...
// ...your previous code here...


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
// Keep everything exactly as it was, just inside this block.
*/

/* ========== NEW ========== */
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "../styles/LoginPage.css";

// Temporary hard-coded login for development
const DEV_USER = {
  username: "admin",
  password: "letmein",
  userId: "u-0001",
  role: "faculty" as const,
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [role, setRole] = React.useState<"faculty" | "student">("student");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // PHASE 1: Hard-coded dev path
    if (username === DEV_USER.username && password === DEV_USER.password) {
      // Use dropdown-selected role during dev, or force DEV_USER.role if you prefer.
      const effectiveRole = role; // or DEV_USER.role
      login({ userId: DEV_USER.userId, role: effectiveRole, token: null });
      navigate("/my", { replace: true });
      return;
    }

    // PHASE 2: Real backend (uncomment when ready)
    /*
    try {
      const res = await fetchJson("/api/v1/login", {
        method: "POST",
        body: JSON.stringify({ username, password, role }),
      });
      // example expected: { user_id, role, token? }
      login({ userId: String(res.user_id), role: res.role, token: res.token ?? null });
      navigate("/my", { replace: true });
      return;
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    }
    */

    setError("Invalid credentials (using temporary hard-coded login).");
  }

  return (
    <div className="container">
      <h1>Login</h1>
      <form className="login-card" onSubmit={onSubmit}>
        <label htmlFor="role">Select role</label>
        <select id="role" value={role} onChange={e => setRole(e.target.value as "faculty" | "student")}>
          <option value="faculty">Faculty</option>
          <option value="student">Student</option>
        </select>

        <label htmlFor="username">Username</label>
        <input id="username" placeholder="enter username" value={username} onChange={e => setUsername(e.target.value)} />

        <label htmlFor="password">Password</label>
        <input id="password" type="password" placeholder="enter password" value={password} onChange={e => setPassword(e.target.value)} />

        <button type="submit">Enter</button>
        {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
        <small>Dev login: <code>admin / letmein</code></small>
      </form>
    </div>
  );
}
