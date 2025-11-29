import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import { Button, Input, Label, Card, Alert } from "../components/ui";
import { ArrowLeft } from "lucide-react";

export default function JoinCoursePage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const studentId = Number(userId ?? 0);

  const [enrollKey, setEnrollKey] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = enrollKey.trim();
    if (!trimmed) {
      setMsg("Please enter an enrollment key.");
      return;
    }

    setMsg(null);
    setSubmitting(true);
    try {
      await fetchJson("/api/v1/registrations", {
        method: "POST",
        body: JSON.stringify({ student_id: studentId, enrollment_key: trimmed }),
      });
      setMsg("Successfully registered for the course!");
      setTimeout(() => {
        navigate("/my");
      }, 1500);
    } catch (e: any) {
      setMsg(e?.message ?? "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-container">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          to="/my"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="text-center">
          <h1 className="page-title">Join a Course</h1>
          <p className="page-subtitle">
            Enter the enrollment key provided by your instructor to register for a course.
          </p>
        </div>

        {msg && (
          <Alert variant={msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("failed") ? "error" : "success"}>
            <p className="font-medium">{msg}</p>
          </Alert>
        )}

        <Card>
          <form onSubmit={onRegister} className="space-y-6">
            <div>
              <Label htmlFor="enroll-key">Enrollment key *</Label>
              <Input
                id="enroll-key"
                placeholder="Enter the 12-character enrollment key"
                value={enrollKey}
                onChange={(e) => setEnrollKey(e.target.value)}
                required
                disabled={submitting}
                className="font-mono"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                The enrollment key is a unique code provided by your instructor. It's typically 12 characters long.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Need help?</h3>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Make sure you've copied the entire key from your instructor</li>
                <li>• Keys are case-sensitive</li>
                <li>• Contact your instructor if the key doesn't work</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate("/my")}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!enrollKey.trim() || submitting}
                className="flex-1"
              >
                {submitting ? "Registering..." : "Join Course"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
