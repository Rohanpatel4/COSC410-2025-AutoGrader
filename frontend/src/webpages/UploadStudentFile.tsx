import React, { useState } from "react";
import { BASE } from "../api/client";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button, Input, Label, Card, Alert } from "../components/ui";
import { formatGradeDisplay } from "../utils/formatGrade";

/**
 * Student: upload a submission for a specific assignment.
 * Backend route: POST /api/v1/assignments/:assignment_id/submit
 * FormData fields: submission (file), student_id (number)
 */
const UploadStudentFile: React.FC = () => {
  const location = useLocation() as any;
  const { userId } = useAuth();

  // prefill assignment_id from navigation state if present
  const [assignmentId, setAssignmentId] = useState<string>(
    String(location?.state?.assignment_id ?? "")
  );

  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [errorJson, setErrorJson] = useState<any>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Uploading student code…");
    setResult(null);
    setErrorJson(null);

    if (!assignmentId.trim()) return setMsg("Missing assignment_id");
    if (!file) return setMsg("Please choose a student .py file");
    if (!file.name.toLowerCase().endsWith(".py")) {
      return setMsg("Only .py files are accepted.");
    }

    const fd = new FormData();
    fd.append("submission", file);
    fd.append("student_id", String(userId ?? ""));

    try {
      const res = await fetch(
        `${BASE}/api/v1/assignments/${encodeURIComponent(assignmentId)}/submit`,
        { method: "POST", body: fd }
      );

      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch {}

      if (!res.ok) {
        const detail = data?.detail ?? text;
        setErrorJson(data ?? { raw: text });
        setMsg(
          `Run failed: ${res.status} ${
            typeof detail === "string" ? detail : JSON.stringify(detail)
          }`
        );
        return;
      }

      setResult(data);
      setMsg(`Submitted. Grade: ${formatGradeDisplay(data?.grade)}`);
    } catch (err: any) {
      setMsg(err?.message || "Network error");
    }
  }

  return (
    <div className="container py-12">
        <Card className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Upload Student Code</h2>
          
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <Label htmlFor="assignmentId">Assignment ID</Label>
              <Input
                id="assignmentId"
                value={assignmentId}
                onChange={(e) => setAssignmentId(e.target.value)}
                placeholder="e.g., 1"
                required
              />
            </div>

            <div>
              <Label htmlFor="studentFile">Student code file (.py)</Label>
              <input
                id="studentFile"
                type="file"
                accept=".py"
                aria-label="Student code file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block mt-1.5 text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90"
              />
            </div>

            <Button type="submit">Upload &amp; Run</Button>

            {msg && (
              <p className="text-foreground mt-2.5">{msg}</p>
            )}
          </form>

          {errorJson && (
            <Alert variant="error" className="mt-6">
              <pre className="whitespace-pre-wrap text-sm overflow-x-auto">
                {JSON.stringify(errorJson, null, 2)}
              </pre>
            </Alert>
          )}

          {/* Show grading status */}
          {result && result.grading && (
            <Card 
              className="mt-5 text-center"
              style={{
                backgroundColor: result.grading.passed ? "rgb(240, 253, 244)" : "rgb(254, 242, 242)",
                borderColor: result.grading.passed ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)",
                borderWidth: "2px"
              }}
            >
              <div 
                className="text-2xl font-bold mb-2"
                style={{
                  color: result.grading.passed ? "rgb(22, 163, 74)" : "rgb(220, 38, 38)"
                }}
              >
                {result.grading.passed ? "PASS" : "FAIL"}
              </div>
              <div className="text-sm text-muted-foreground">
                {result.grading.passed_tests} of {result.grading.total_tests} tests passed
              </div>
            </Card>
          )}

          {/* Show raw result */}
          {result && (
            <Card variant="muted" className="mt-2.5">
              <pre className="whitespace-pre-wrap text-sm overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </Card>
          )}
        </Card>
    </div>
  );
};

export default UploadStudentFile;