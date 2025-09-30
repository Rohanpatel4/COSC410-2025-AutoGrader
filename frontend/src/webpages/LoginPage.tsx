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

/* ========== CONNECTED TO BACKEND ========== */
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../types/role";   
import "../styles/LoginPage.css";

// REMOVE the local: `type Role = "student" | "faculty" | "admin";`

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [role, setRole] = React.useState<Role>("student");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });

      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.detail) message = body.detail;
        } catch {}
        throw new Error(message);
      }

      const data: { user_id: number; status: Role } = await res.json();
      login({ userId: String(data.user_id), role: data.status, token: null });
      navigate("/my", { replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>Login</h1>
      <form className="login-card" onSubmit={onSubmit}>
        <label htmlFor="role">Select role</label>
        <select id="role" value={role} onChange={e => setRole(e.target.value as Role)}>
          <option value="student">Student</option>
          <option value="faculty">Faculty</option>
          {/* <option value="admin">Admin</option> */}
        </select>

        <label htmlFor="username">Email</label>
        <input
          id="username"
          placeholder="student@wofford.edu"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Enter"}
        </button>

        {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
      </form>
    </div>
  );
}

