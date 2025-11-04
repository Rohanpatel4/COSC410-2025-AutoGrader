// src/webpages/LoginPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import { Button, Input, Label, Select, Card, Alert } from "../components/ui";

type Role = "student" | "faculty" | "admin";

export default function LoginPage() {
  const navigate = useNavigate();
  const authCtx = useAuth?.();

  const [role, setRole] = React.useState<Role>("student");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const data = await fetchJson("/api/v1/login", {
        method: "POST",
        body: JSON.stringify({ username: email, email, password, role }),
      });

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-50 via-white to-neutral-100 py-12 text-neutral-900 transition-colors duration-300 ease-soft dark:from-background-dark dark:via-gray-900 dark:to-gray-950 dark:text-gray-100">
      <div className="mx-auto w-full max-w-md space-y-8 px-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-gray-100">
            AutoGrader
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Sign in to your account
          </p>
        </div>

        <Card>
          <form className="space-y-6" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="role">Select role</Label>
              <Select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="username">Email</Label>
              <Input
                id="username"
                type="email"
                placeholder="student@wofford.edu"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                error={!!error}
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                error={!!error}
              />
            </div>

            {error && (
              <Alert variant="error">
                <p className="text-sm font-medium">{error}</p>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
