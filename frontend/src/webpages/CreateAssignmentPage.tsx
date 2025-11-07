import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson, BASE } from "../api/client";
import { Button, Input, Label, Card, Alert } from "../components/ui";
import { ArrowLeft } from "lucide-react";

export default function CreateAssignmentPage() {
  const { course_id = "" } = useParams<{ course_id: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [subLimit, setSubLimit] = React.useState<string>("");
  const [start, setStart] = React.useState<string>("");
  const [stop, setStop] = React.useState<string>("");
  const [testFile, setTestFile] = React.useState<File | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!title.trim()) {
      setMsg("Title is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
      };
      const limitNum = subLimit.trim() ? Number(subLimit.trim()) : null;
      if (limitNum != null && Number.isFinite(limitNum)) payload.sub_limit = limitNum;
      if (start) payload.start = start;
      if (stop) payload.stop = stop;

      const created = await fetchJson<{ id: number }>(
        `/api/v1/courses/${encodeURIComponent(course_id)}/assignments`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (testFile) {
        const fd = new FormData();
        fd.append("file", testFile);
        await fetch(`${BASE}/api/v1/assignments/${created.id}/test-file`, {
          method: "POST",
          body: fd,
        });
      }

      setMsg("Assignment created successfully!");
      setTimeout(() => {
        navigate(`/courses/${course_id}`);
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
        to={`/courses/${course_id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Course
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Create New Assignment</h1>
        <p className="mt-2 text-muted-foreground">
          Create a new assignment with test cases for automatic grading.
        </p>
      </div>

      {msg && (
        <Alert variant={msg.includes("failed") || msg.includes("fail") ? "error" : "success"} className="mb-6">
          <p className="font-medium">{msg}</p>
        </Alert>
      )}

      <Card className="mb-8">
        <form onSubmit={createAssignment} className="space-y-6">
          <div>
            <Label htmlFor="title">Assignment Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Calculator Implementation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div>
            <Label htmlFor="description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              id="description"
              placeholder="Enter assignment description and requirements..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px] resize-y w-full rounded-xl border border-border bg-background px-4 py-2.5 text-foreground shadow-sm placeholder:text-muted-foreground transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-ring/25 focus:outline-none"
              disabled={submitting}
            />
          </div>

          <div>
            <Label htmlFor="subLimit">
              Submission Limit <span className="text-muted-foreground">(optional, leave blank for unlimited)</span>
            </Label>
            <Input
              id="subLimit"
              type="number"
              min="1"
              placeholder="e.g., 3"
              value={subLimit}
              onChange={(e) => setSubLimit(e.target.value)}
              disabled={submitting}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Maximum number of submissions allowed per student
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">
                Start Date <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="stop">
                Due Date <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="stop"
                type="datetime-local"
                value={stop}
                onChange={(e) => setStop(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="testFile">
              Test File <span className="text-muted-foreground">(optional, can be added later)</span>
            </Label>
            <input
              id="testFile"
              type="file"
              accept=".py,application/x-python,text/x-python"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && !file.name.endsWith('.py')) {
                  alert('Only Python (.py) files are allowed');
                  e.target.value = '';
                  setTestFile(null);
                } else {
                  setTestFile(file ?? null);
                }
              }}
              className="block mt-1.5 text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
              disabled={submitting}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Only Python (.py) files are accepted. Must include @points decorators (see format guide below)
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/courses/${course_id}`)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || submitting}
              className="flex-1"
            >
              {submitting ? "Creating..." : "Create Assignment"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Sample Test File Instructions */}
      <Card className="bg-card border-border">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Test File Format Guide</h2>
            <p className="text-muted-foreground text-sm">
              Test files must be Python (.py) files. Use the <code className="px-1.5 py-0.5 bg-muted rounded text-sm">@points(value)</code> decorator to assign point values to each test function.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Example Test File:</h3>
            <div className="bg-background border border-border rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-foreground font-mono">
{`@points(7)
def test_add_positive():
    assert add(5, 3) == 8`}
              </pre>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Requirements:</h3>
            <p className="text-sm text-muted-foreground">
              Each test function must have the <code className="px-1.5 py-0.5 bg-muted rounded text-xs">@points(value)</code> decorator with a point value.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
