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

      {/* Sample Test File Instructions */}
      <Card className="bg-card border-border">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Test File Format Guide</h2>
            <p className="text-muted-foreground text-sm">
              When creating assignments, you'll need to upload a test file. Use the <code className="px-1.5 py-0.5 bg-muted rounded text-sm">@points(value)</code> decorator to assign point values to each test function.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Example Test File:</h3>
            <div className="bg-background border border-border rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-foreground font-mono">
{`# Test Cases for Calculator Functions with Point Values
# Upload this file as the test case for the assignment
# Each test must use the @points(value) decorator to assign point values

@points(7)
def test_add_positive():
    assert add(5, 3) == 8

@points(5)
def test_add_negative():
    assert add(-2, -3) == -5

@points(3)
def test_add_zero():
    assert add(0, 0) == 0
    assert add(1, 1) == 2

@points(10)
def test_multiply_positive():
    assert multiply(4, 5) == 20

@points(5)
def test_multiply_by_zero():
    assert multiply(10, 0) == 0

@points(5)
def test_multiply_negative():
    assert multiply(-3, 4) == -12

@points(10)
def test_subtract():
    assert subtract(10, 3) == 7

@points(5)
def test_divide():
    assert divide(20, 4) == 5

# Total points: 50`}
              </pre>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Key Points:</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Each test function must have the <code className="px-1.5 py-0.5 bg-muted rounded text-xs">@points(value)</code> decorator</li>
              <li>Test function names should start with <code className="px-1.5 py-0.5 bg-muted rounded text-xs">test_</code></li>
              <li>Use standard Python <code className="px-1.5 py-0.5 bg-muted rounded text-xs">assert</code> statements</li>
              <li>The total points across all tests will be the assignment's maximum score</li>
              <li>Students will submit their implementation file (e.g., <code className="px-1.5 py-0.5 bg-muted rounded text-xs">calculator.py</code>) which will be tested against your test file</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

