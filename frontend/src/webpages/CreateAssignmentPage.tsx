import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson, BASE } from "../api/client";

// Safe join function for URLs
function join(base: string, path: string) {
  if (!base) return path;
  return base.replace(/\/+$/, "") + path;
}
import { Button, Input, Label, Card, Alert } from "../components/ui";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
import InstructionsManager from "../components/ui/InstructionsManager";

type TestCase = {
  id: number;
  code: string;
  visible: boolean;
  points: number;
};

export default function CreateAssignmentPage() {
  const { course_id = "" } = useParams<{ course_id: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [language, setLanguage] = React.useState("python");
  const [instructions, setInstructions] = React.useState<any>(null);
  const [subLimit, setSubLimit] = React.useState<string>("");
  const [start, setStart] = React.useState<string>("");
  const [stop, setStop] = React.useState<string>("");
  const [testFile, setTestFile] = React.useState<File | null>(null);
  const [testCases, setTestCases] = React.useState<TestCase[]>([
    { id: 1, code: "", visible: true, points: 10 }
  ]);
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
        language: language,
        instructions: instructions,
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
        const res = await fetch(join(BASE, `/api/v1/assignments/${created.id}/test-file`), {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || res.statusText);
        }
      }

      // Create test cases from the UI
      if (testCases.length > 0 && testCases.some(tc => tc.code.trim())) {
        const testCasesPayload = {
          test_cases: testCases
            .filter(tc => tc.code.trim()) // Only include non-empty test cases
            .map((tc, index) => ({
              test_code: tc.code.trim(),
              point_value: tc.points,
              visibility: tc.visible,
              order: index + 1
            }))
        };

        await fetchJson(
          `/api/v1/assignments/${created.id}/test-cases/batch`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(testCasesPayload),
          }
        );
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

  function addTestCase() {
    const newId = Math.max(...testCases.map(tc => tc.id)) + 1;
    setTestCases([...testCases, { id: newId, code: "", visible: true, points: 10 }]);
  }

  function updateTestCase(id: number, field: keyof TestCase, value: string | boolean | number) {
    setTestCases(testCases.map(tc =>
      tc.id === id ? { ...tc, [field]: value } : tc
    ));
  }

  function deleteTestCase(id: number) {
    if (testCases.length > 1) {
      setTestCases(testCases.filter(tc => tc.id !== id));
    }
  }

  function moveTestCase(fromIndex: number, toIndex: number) {
    const newTestCases = [...testCases];
    const [movedItem] = newTestCases.splice(fromIndex, 1);
    newTestCases.splice(toIndex, 0, movedItem);
    setTestCases(newTestCases);
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
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Create New Assignment</h1>
            <p className="mt-2 text-muted-foreground">
              Create a new assignment with test cases for automatic grading.
            </p>
          </div>
          <a
            href="/TEST_CASE_GUIDE.pdf"
            download="Test_Case_Guide.pdf"
            className="text-primary hover:underline text-sm font-medium flex items-center gap-1 whitespace-nowrap"
          >
            📄 Download Test Case Guide
          </a>
        </div>
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
              Description <span className="text-muted-foreground">*</span>
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

          <InstructionsManager
            instructions={instructions}
            onChange={setInstructions}
            disabled={submitting}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="language">
                Language <span className="text-red-500">*</span>
              </Label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={submitting}
                className="flex h-10 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-foreground shadow-sm transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-ring/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
              <p className="mt-2 text-xs text-muted-foreground">
                Programming language for this assignment
              </p>
            </div>

            <div>
              <Label htmlFor="subLimit">
                Submission Limit <span className="text-muted-foreground">(optional)</span>
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
                Maximum submissions per student (blank = unlimited)
              </p>
            </div>
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

      {/* Add Test Cases Section */}
      <Card className="bg-card border-border mt-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Add Test Cases</h2>
            <p className="text-muted-foreground text-sm">
              Add individual test cases that will be used to grade student submissions.
            </p>
          </div>

          <div className="space-y-6">
            {testCases.map((testCase, index) => (
              <div
                key={testCase.id}
                className="space-y-2"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', index.toString())}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                  moveTestCase(fromIndex, index);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="cursor-move text-muted-foreground hover:text-foreground">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <Label className="text-sm font-medium text-foreground">
                    Test Case {index + 1}:
                  </Label>
                  <div className="flex items-center gap-4 ml-auto">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={testCase.visible}
                        onChange={(e) => updateTestCase(testCase.id, 'visible', e.target.checked)}
                        className="w-4 h-4 text-primary border-border rounded focus:ring-primary/25"
                      />
                      visible
                    </label>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">points:</Label>
                      <Input
                        type="number"
                        min="1"
                        value={testCase.points || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            updateTestCase(testCase.id, 'points', 0);
                          } else {
                            const numVal = parseInt(val);
                            updateTestCase(testCase.id, 'points', isNaN(numVal) ? 1 : numVal);
                          }
                        }}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          if (!val || val < 1) {
                            updateTestCase(testCase.id, 'points', 1);
                          }
                        }}
                        className="w-2 h-8 text-xs px-1"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTestCase(testCase.id)}
                      disabled={testCases.length <= 1}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <textarea
                  placeholder="Enter your test case code here..."
                  value={testCase.code}
                  onChange={(e) => updateTestCase(testCase.id, 'code', e.target.value)}
                  className="w-full h-32 font-mono text-sm resize-vertical rounded-xl border border-border bg-background px-4 py-2.5 text-foreground shadow-sm placeholder:text-muted-foreground transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-ring/25 focus:outline-none"
                  style={{
                    fontFamily: "'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                    lineHeight: '1.5',
                    tabSize: '4'
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={addTestCase}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Test Case
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
