// src/webpages/LoginPage.tsx
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
        // keep dual-post to satisfy either backend shape
        body: JSON.stringify({ username: email, email, password, role }),
      });

      // Bail out on non-2xx
      if (!res.ok) {
        // Try to extract a helpful message from the backend
        let msg = `Login failed (HTTP ${res.status})`;
        try {
          const j = await res.clone().json();
          if (j?.detail) msg = String(j.detail);
        } catch {
          try {
            const t = await res.text();
            if (t) msg = t;
          } catch {}
        }
        throw new Error(msg);
      }

      // Only here do we treat it as success
      let data: any = {};
      try { data = await res.json(); } catch {}

      const auth = {
        userId: String(data.userId ?? data.user_id ?? "u1"),
        role: (data.role ?? data.status ?? role) as Role,
        token: data.token ?? null,
      };

      localStorage.setItem("auth", JSON.stringify(auth));
      authCtx?.login?.(auth);
      navigate("/my", { replace: true });
    } catch (err: any) {
      // Clear any stale auth if a previous attempt succeeded
      localStorage.removeItem("auth");
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


