// src/webpages/LoginPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, Role } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import { Button, Input, Label, Select, Card, Alert } from "../components/ui";
import { AppShell } from "../components/layout/AppShell";

export default function LoginPage() {
  const navigate = useNavigate();
  const authCtx = useAuth?.();

  const [role, setRole] = React.useState<Role>("student");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [shouldClearPasswordOnNextInput, setShouldClearPasswordOnNextInput] = React.useState(false);
  const [emailError, setEmailError] = React.useState<string | null>(null);

  // Helper to parse auth errors from the server
  async function parseAuthError(res: Response): Promise<string> {
    try {
      const data = await res.json().catch(() => ({}));
      const msg = (data?.detail ?? data?.message ?? "").toString();
      return msg || "Invalid username or password";
    } catch {
      return "Invalid username or password";
    }
  }

  // Validate email format
  function validateEmail(email: string): boolean {
    return /^\S+@\S+\.\S+$/.test(email);
  }

  // Handle password input - clear on first keystroke after error
  function onPasswordKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (shouldClearPasswordOnNextInput) {
      setPassword("");
      setShouldClearPasswordOnNextInput(false);
    }
  }

  // Handle email change - revalidate if there's an error
  function onEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newEmail = e.target.value;
    setEmail(newEmail);
    if (emailError && validateEmail(newEmail)) {
      setEmailError(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Validate email before submitting
    if (!validateEmail(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setEmailError(null);

    try {
      const data = await fetchJson<{
        userId?: number | string;
        user_id?: number | string;
        role?: string;
        status?: string;
        token?: string | null;
      }>("/api/v1/login", {
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
      // Normalize all login errors to a clean message
      setError("Invalid username or password");
      setShouldClearPasswordOnNextInput(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="flex min-h-screen items-center justify-center py-12">
        <div className="mx-auto w-full max-w-md space-y-8 px-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            AutoGrader
          </h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to your account
          </p>
        </div>

        <Card>
          <form className="space-y-6" onSubmit={onSubmit} noValidate>
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
                onChange={onEmailChange}
                required
                error={!!emailError}
              />
              {emailError && (
                <p className="mt-2 text-sm text-danger">{emailError}</p>
              )}
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
                onKeyDown={onPasswordKeyDown}
                required
                error={!!error}
              />
            </div>

            {error && (
              <Alert variant="error" role="alert" aria-live="polite">
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
    </AppShell>
  );
}
