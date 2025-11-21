import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import type { Course } from "../types/courses";
import { Button, Input, Label, Card, Alert } from "../components/ui";
import { ArrowLeft } from "lucide-react";

export default function CreateCoursePage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const professorId = Number(userId ?? 0);

  const [courseCode, setCourseCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!courseCode.trim() || !name.trim()) {
      setMsg("Course code and name are required");
      return;
    }
    
    setSubmitting(true);
    try {
      const created = await fetchJson<Course>(`/api/v1/courses`, {
        method: "POST",
        body: JSON.stringify({
          course_code: courseCode.trim(),
          name: name.trim(),
          description: description || null,
        }),
      });
      setMsg("Course created successfully!");
      setTimeout(() => {
        navigate("/my");
      }, 1500);
    } catch (e: any) {
      setMsg(e?.message ?? "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Back Link */}
      <Link
        to="/courses"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Courses
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Create New Course</h1>
        <p className="mt-2 text-muted-foreground">
          Create a new course and get an enrollment key to share with your students.
        </p>
      </div>

      {msg && (
        <Alert variant={msg.includes("failed") || msg.includes("fail") ? "error" : "success"} className="mb-6">
          <p className="font-medium">{msg}</p>
        </Alert>
      )}

      <Card className="mb-8">
        <form onSubmit={onCreate} className="space-y-6">
              <div>
                <Label htmlFor="c-code">Course code *</Label>
                <Input
                  id="c-code"
                  placeholder="e.g., COSC-410"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  required
                  disabled={submitting}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  A unique identifier for your course (e.g., COSC-410, CS101)
                </p>
              </div>

              <div>
                <Label htmlFor="c-name">Course name *</Label>
                <Input
                  id="c-name"
                  placeholder="e.g., Software Engineering"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div>
                <Label htmlFor="c-desc">
                  Description <span className="text-muted-foreground">(optional)</span>
                </Label>
                <textarea
                  id="c-desc"
                  placeholder="Enter course description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[120px] resize-y w-full rounded-xl border border-border bg-background px-4 py-2.5 text-foreground shadow-sm placeholder:text-muted-foreground transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-ring/25 focus:outline-none"
                  disabled={submitting}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Provide additional information about the course content and objectives
                </p>
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
                  disabled={!courseCode.trim() || !name.trim() || submitting}
                  className="flex-1"
                >
                  {submitting ? "Creating..." : "Create Course"}
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                An enrollment key will be automatically generated for this course.
              </p>
            </form>
          </Card>
    </div>
  );
}

