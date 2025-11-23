import React from "react";
import Editor from "@monaco-editor/react";
import { Assignment } from "../types/assignments";
import { Button, Card, Alert, Badge } from "../components/ui";
import { formatGradeDisplay } from "../utils/formatGrade";
import { Upload, X, FileCode, CheckCircle2, XCircle, Clock, History, Trophy, Calendar } from "lucide-react";

interface StudentAssignmentViewProps {
  assignment: Assignment;
  attempts: any[];
  bestGrade: number | null;
  totalPoints: number;
  testCases?: any[]; // Test cases from the assignment (visible and hidden metadata)
  onCodeChange: (code: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading?: boolean;
  submitMsg?: string | null;
  lastResult?: any; // Submission results with test case outcomes
  nowBlocked: boolean;
  limitReached: boolean;
  initialCode?: string;
}

export default function StudentAssignmentView({
  assignment,
  attempts,
  bestGrade,
  totalPoints,
  testCases = [],
  onCodeChange,
  onFileChange,
  onSubmit,
  loading,
  submitMsg,
  lastResult,
  nowBlocked,
  limitReached,
  initialCode = "",
}: StudentAssignmentViewProps) {
  const [code, setCode] = React.useState(initialCode);
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [activeTab, setActiveTab] = React.useState<"visible" | "hidden">("visible");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Separate visible and hidden test cases from the assignment
  // Note: Students can only see visible test cases from the API
  // Hidden test cases will only appear in lastResult after submission
  // Fallback: If testCases is empty but we have lastResult, use that
  const visibleTestCases = React.useMemo(() => {
    // First try from testCases prop
    if (testCases && testCases.length > 0) {
      // If visibility field exists, filter by it
      // Otherwise, assume all are visible (for backwards compatibility)
      const hasVisibilityField = testCases.some((tc: any) => 'visibility' in tc);
      
      if (hasVisibilityField) {
        const visible = testCases
          .filter((tc: any) => tc.visibility === true || tc.visibility === 1 || tc.visibility === "true")
          .sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));
        if (visible.length > 0) return visible;
      } else {
        // No visibility field - assume all are visible
        return testCases.sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));
      }
    }
    
    // Fallback: get visible test cases from lastResult if available
    if (lastResult?.test_cases) {
      return lastResult.test_cases
        .filter((tc: any) => tc.visibility === true || tc.visibility === 1 || tc.visibility === "true" || tc.visibility === undefined)
        .sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));
    }
    
    return [];
  }, [testCases, lastResult]);

  // For students, hidden test cases only come from submission results
  // We'll show them from lastResult if available
  const hiddenTestCasesFromResults = React.useMemo(() => {
    if (!lastResult?.test_cases) return [];
    return lastResult.test_cases
      .filter((tc: any) => tc.visibility === false || tc.visibility === 0)
      .sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));
  }, [lastResult]);

  // Combine: hidden from testCases (if faculty) or from lastResult (if student)
  const hiddenTestCases = React.useMemo(() => {
    // If we have hidden test cases in testCases (faculty view), use those
    const fromTestCases = testCases
      .filter((tc: any) => tc.visibility === false || tc.visibility === 0)
      .sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));
    
    if (fromTestCases.length > 0) return fromTestCases;
    
    // Otherwise, use hidden test cases from submission results
    return hiddenTestCasesFromResults;
  }, [testCases, hiddenTestCasesFromResults]);

  // Create a map of test case results from lastResult for quick lookup
  const testCaseResults = React.useMemo(() => {
    if (!lastResult?.test_cases) return new Map();
    const map = new Map();
    lastResult.test_cases.forEach((tc: any) => {
      map.set(tc.id, tc);
    });
    return map;
  }, [lastResult]);

  // Determine editor language based on assignment language
  const getEditorLanguage = (lang?: string) => {
    switch (lang?.toLowerCase()) {
      case "python": return "python";
      case "java": return "java";
      case "cpp": 
      case "c++": return "cpp";
      case "javascript":
      case "js": return "javascript";
      default: return "python";
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      onCodeChange(value);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      onFileChange(file);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    onFileChange(null);
    // Reset the file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getFileExtensions = (language: string | undefined): string => {
    switch (language?.toLowerCase()) {
      case "python": return ".py";
      case "java": return ".java";
      case "cpp": 
      case "c++": return ".cpp,.c,.cc,.cxx";
      case "javascript":
      case "js": return ".js,.jsx";
      default: return ".py";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[800px]">
      {/* Left Column: Details & Info (4 cols) */}
      <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-1">
        {/* Assignment Header Card */}
        <Card className="p-6 space-y-6 border-primary/20 shadow-lg">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">{assignment.title}</h1>
            {assignment.description && (
              <div className="prose prose-invert prose-sm max-w-none text-muted-foreground">
                <p className="leading-relaxed whitespace-pre-wrap">{assignment.description}</p>
              </div>
            )}
          </div>

          <div className="grid gap-4 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center text-muted-foreground">
                <Calendar className="w-4 h-4 mr-2" />
                <span>Due Date</span>
              </div>
              <span className="font-medium">
                {assignment.stop ? new Date(assignment.stop).toLocaleString() : "No deadline"}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
               <div className="flex items-center text-muted-foreground">
                <History className="w-4 h-4 mr-2" />
                <span>Attempts</span>
              </div>
              <span className="font-medium">
                {assignment.sub_limit ? `${attempts.length} / ${assignment.sub_limit}` : `${attempts.length} (Unlimited)`}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
               <div className="flex items-center text-muted-foreground">
                <Trophy className="w-4 h-4 mr-2" />
                <span>Best Grade</span>
              </div>
              <span className="text-primary font-bold">
                {bestGrade == null || bestGrade < 0 
                  ? "—" 
                  : totalPoints > 0 
                    ? `${bestGrade} / ${totalPoints}` 
                    : formatGradeDisplay(bestGrade)}
              </span>
            </div>
            
             <div className="flex items-center justify-between text-sm">
               <div className="flex items-center text-muted-foreground">
                <FileCode className="w-4 h-4 mr-2" />
                <span>Language</span>
              </div>
              <Badge variant="default" className="uppercase font-mono text-xs">
                {assignment.language || "Python"}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Attempts List */}
        {attempts.length > 0 && (
          <Card className="flex-1 p-4 flex flex-col min-h-[200px]">
            <h3 className="text-sm font-semibold mb-3 flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              Recent Activity
            </h3>
            <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar pr-2">
              {attempts.slice().reverse().map((t, idx) => {
                  const realIdx = attempts.length - idx;
                  const earnedPoints = t.earned_points ?? t.grade ?? 0;
                  const displayPoints = totalPoints > 0 
                    ? `${earnedPoints} / ${totalPoints}` 
                    : formatGradeDisplay(t.grade);
                  return (
                    <div key={t.id} className="flex justify-between items-center text-sm p-3 rounded-lg bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
                      <span className="text-muted-foreground">Attempt #{realIdx}</span>
                      <span className="font-medium text-foreground">{displayPoints}</span>
                    </div>
                  );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Right Column: Editor, Test Cases, Submit (8 cols) */}
      <div className="lg:col-span-8 flex flex-col gap-4 h-full overflow-hidden">
        
        {/* 1. Code Editor Area (Flexible height) */}
        <Card className="flex-[3] flex flex-col p-0 overflow-hidden border-primary/20 shadow-xl relative min-h-[400px]">
          <div className="bg-muted/30 border-b border-border px-4 py-2 flex justify-between items-center backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {uploadedFile ? "File Upload Mode" : "Source Code"}
              </span>
              {uploadedFile && (
                <Badge variant="default" className="text-[10px] px-1.5 h-5">
                  Read-only
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
               <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileUpload}
                accept={getFileExtensions(assignment.language)}
                disabled={nowBlocked || limitReached}
              />
              <label 
                htmlFor="file-upload" 
                className={`cursor-pointer flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-200 ${
                  nowBlocked || limitReached 
                    ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground" 
                    : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                }`}
              >
                <Upload className="w-3 h-3" />
                Upload File
              </label>
            </div>
          </div>

          <div className="relative flex-1 bg-[#1e1e1e]">
            <Editor
              height="100%"
              defaultLanguage={getEditorLanguage(assignment.language)}
              theme="vs-dark"
              value={code}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                readOnly: !!uploadedFile || nowBlocked || limitReached,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                padding: { top: 16, bottom: 16 },
                lineNumbers: "on",
                renderLineHighlight: "all",
              }}
              loading={<div className="p-4 text-muted-foreground text-sm">Loading editor...</div>}
            />

            {/* File Upload Overlay */}
            {uploadedFile && (
              <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10 animate-in fade-in duration-200">
                <div className="bg-card border border-border p-8 rounded-xl shadow-2xl max-w-md w-full">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileCode className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">File Ready to Submit</h3>
                  <p className="text-muted-foreground mb-4 font-mono text-sm bg-muted p-2 rounded break-all border border-border/50">
                    {uploadedFile.name}
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    The code editor is disabled because you have selected a file to upload.
                  </p>
                  <Button variant="danger" size="sm" onClick={removeFile} className="w-full">
                    <X className="w-4 h-4 mr-2" />
                    Remove File & Edit Code
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 2. Test Cases (Bottom, fixed height or flex) */}
        <Card className="flex-[2] flex flex-col overflow-hidden border-border shadow-md min-h-[250px]">
          <div className="border-b border-border bg-muted/10 flex items-center px-2">
             <button
                onClick={() => setActiveTab("visible")}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "visible" 
                    ? "border-primary text-primary" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Visible Test Cases
              </button>
              <button
                onClick={() => setActiveTab("hidden")}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "hidden" 
                    ? "border-primary text-primary" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Hidden Test Cases
              </button>
              
              {/* Overall Result Badge in Header if available */}
              {lastResult?.result?.grading && (
                 <div className="ml-auto px-4 flex items-center gap-3">
                    <span className="text-sm text-muted-foreground hidden sm:inline">Result:</span>
                    <Badge variant={lastResult.result?.grading?.all_passed ? "success" : "danger"}>
                       {lastResult.result?.grading?.all_passed ? "PASS" : "FAIL"}
                    </Badge>
                 </div>
              )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-card/50 p-4">
            {activeTab === "visible" ? (
              /* Visible Test Cases - Always shown, even before submission */
              visibleTestCases.length > 0 ? (
                <div className="space-y-3">
                  {visibleTestCases.map((tc: any) => {
                    const result = testCaseResults.get(tc.id);
                    const passed = result?.passed ?? null;
                    const pointsEarned = result?.points_earned ?? null;
                    
                    return (
                      <div key={tc.id} className="bg-muted/20 border border-border/50 rounded-lg p-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {passed === true ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                            ) : passed === false ? (
                              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                            )}
                            <span className="font-medium text-foreground text-sm">Test Case {tc.order || tc.id}</span>
                          </div>
                          {pointsEarned !== null ? (
                            <Badge variant={passed ? "success" : "danger"} className="text-xs font-mono">
                              {pointsEarned} / {tc.point_value} pts
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-xs font-mono">
                              {tc.point_value} pts
                            </Badge>
                          )}
                        </div>
                        {tc.test_code && (
                          <div className="mt-2 ml-6">
                            <div className="bg-black/40 p-2.5 rounded border border-border/20 font-mono text-xs text-muted-foreground whitespace-pre-wrap overflow-x-auto">
                              {tc.test_code}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground/40">
                  <FileCode className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm">No visible test cases available</p>
                </div>
              )
            ) : (
              /* Hidden Test Cases - Summary format */
              hiddenTestCases.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Hidden Test Cases ({hiddenTestCases.length})
                  </div>
                  <div className="space-y-2">
                    {hiddenTestCases.map((tc: any) => {
                      const result = testCaseResults.get(tc.id);
                      const passed = result?.passed ?? null;
                      const pointsEarned = result?.points_earned ?? null;
                      
                      return (
                        <div key={tc.id} className="flex items-center justify-between p-2.5 bg-muted/10 border border-border/30 rounded text-sm">
                          <div className="flex items-center gap-2">
                            {passed === true ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                            ) : passed === false ? (
                              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                            )}
                            <span className="text-muted-foreground">
                              {passed !== null ? (passed ? "Passed" : "Failed") : "Not run"}
                            </span>
                          </div>
                          <Badge variant={passed === true ? "success" : passed === false ? "danger" : "default"} className="text-xs font-mono">
                            {pointsEarned !== null ? `${pointsEarned} / ` : ""}{tc.point_value} pts
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground/40">
                  <FileCode className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm">No hidden test cases available</p>
                </div>
              )
            )}
          </div>
        </Card>

        {/* 3. Submit Button Area */}
        <div className="shrink-0 pt-2">
           {submitMsg && (
            <div className={`mb-3 p-3 rounded-lg border text-sm font-medium flex items-center animate-in slide-in-from-bottom-2 ${
               submitMsg.includes("failed") || submitMsg.includes("Error") 
                 ? "bg-danger/10 text-danger border-danger/20" 
                 : "bg-success/10 text-success border-success/20"
            }`}>
               {submitMsg.includes("failed") || submitMsg.includes("Error") 
                 ? <XCircle className="w-4 h-4 mr-2" /> 
                 : <CheckCircle2 className="w-4 h-4 mr-2" />
               }
               {submitMsg}
            </div>
          )}

          {nowBlocked ? (
             <Button size="lg" disabled className="w-full py-6 text-lg">Submission Window Closed</Button>
          ) : limitReached ? (
             <Button size="lg" disabled className="w-full py-6 text-lg">Attempt Limit Reached</Button>
          ) : (
            <Button 
              size="lg" 
              onClick={onSubmit} 
              disabled={loading || (!code.trim() && !uploadedFile)}
              className="w-full btn-primary font-bold text-lg shadow-glow py-6 hover:scale-[1.01] transition-transform"
            >
              {loading ? "Grading Solution..." : "Submit Solution"}
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
