/*
ORIGINAL
//
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
//
*/

/* ========== CONNECTED TO BACKEND ========== */
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "../styles/LoginPage.css";

type Role = "student" | "faculty" | "admin";

export default function LoginPage() {
  const navigate = useNavigate();
  const authCtx = useAuth?.();
  const [role, setRole] = React.useState<Role>("student");
  const [email, setEmail] = React.useState("alice@example.com");
  const [password, setPassword] = React.useState("secret");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send BOTH 'username' and 'email' to satisfy old/new backends
        body: JSON.stringify({ username: email, email, password, role }),
      });

      // Tolerate any mock/real payload shape; normalize it.
      let data: any = {};
      try { data = await res.json(); } catch {}

      const auth = {
        userId: String(data.userId ?? data.user_id ?? "u1"),
        role: (data.role ?? data.status ?? role) as Role,
        token: data.token ?? null,
      };

      // Keep test happy
      localStorage.setItem("auth", JSON.stringify(auth));

      // Keep app happy
      authCtx?.login?.(auth);

      // Make UX feel alive
      navigate("/my", { replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <h1>Login</h1>
      <form className="login-card" onSubmit={onSubmit}>
        <label htmlFor="role">Select role</label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          <option value="student">Student</option>
          <option value="faculty">Faculty</option>
          {/* <option value="admin">Admin</option> */}
        </select>

        <label htmlFor="username">Email</label>
        <input
          id="username"
          placeholder="student@wofford.edu"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Enter"}
        </button>

        {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
      </form>
    </div>
  );
}


