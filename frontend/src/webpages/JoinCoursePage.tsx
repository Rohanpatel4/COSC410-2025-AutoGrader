import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import { Button, Input, Label, Card, Alert } from "../components/ui";
import { ArrowLeft } from "lucide-react";

export default function JoinCoursePage() {
  const { userId, role } = useAuth();
  const navigate = useNavigate();
  const userIdNumber = Number(userId ?? 0);
  const isFaculty = role === "faculty";

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
      if (isFaculty) {
        // For faculty: First get the course by enrollment key, then add faculty
        const course = await fetchJson<{ id: number; course_code: string }>(
          `/api/v1/courses?q=${encodeURIComponent(trimmed)}`
        );
        
        // Need to find course by enrollment_key - may need backend endpoint
        // Alternative: Use course lookup and then add faculty
        // For now, we'll need a backend endpoint like POST /api/v1/courses/join
        // that works for both students and faculty
        
        // TEMPORARY: Use the registration endpoint structure but adapt for faculty
        // This assumes backend will be updated to support faculty
        await fetchJson("/api/v1/registrations", {
          method: "POST",
          body: JSON.stringify({ 
            faculty_id: userIdNumber,  // Use faculty_id instead of student_id
            enrollment_key: trimmed 
          }),
        });
      } else {
        // Existing student logic
        await fetchJson("/api/v1/registrations", {
          method: "POST",
          body: JSON.stringify({ student_id: userIdNumber, enrollment_key: trimmed }),
        });
      }
      
      setMsg(`Successfully ${isFaculty ? 'joined' : 'registered for'} the course!`);
      setTimeout(() => {
        navigate("/my");
      }, 1500);
    } catch (e: any) {
      setMsg(e?.message ?? `${isFaculty ? 'Joining' : 'Registration'} failed`);
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
            {isFaculty 
              ? "Enter the enrollment key to join a course as a co-instructor."
              : "Enter the enrollment key provided by your instructor to register for a course."}
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
                {isFaculty
                  ? "The enrollment key allows you to join an existing course as a co-instructor."
                  : "The enrollment key is a unique code provided by your instructor. It's typically 12 characters long."}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Need help?</h3>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Make sure you've copied the entire key {isFaculty ? 'from the course creator' : 'from your instructor'}</li>
                <li>• Keys are case-sensitive</li>
                <li>• Contact {isFaculty ? 'the course creator' : 'your instructor'} if the key doesn't work</li>
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
                {submitting ? (isFaculty ? "Joining..." : "Registering...") : "Join Course"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}