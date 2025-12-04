import React from "react";
import { Link } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { Assignment } from "../types/assignments";
import { Button, Badge, RichTextEditor } from "../components/ui";
import { formatGradeDisplay } from "../utils/formatGrade";
import { Upload, X, FileCode, CheckCircle2, XCircle, ChevronLeft, PanelLeftClose, PanelLeftOpen, CheckCircle, BookOpen, AlertTriangle } from "lucide-react";
import InstructionsManager from "../components/ui/InstructionsManager";
import { SplitPane } from "../components/ui/SplitPane";
import { Celebration } from "../components/ui/Celebration";

interface StudentAssignmentViewProps {
  assignment: Assignment;
  attempts: any[];
  bestGrade: number | null;
  totalPoints: number;
  testCases?: any[];
  onCodeChange: (code: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading?: boolean;
  submitMsg?: string | null;
  lastResult?: any;
  nowBlocked: boolean;
  limitReached: boolean;
  initialCode?: string;
  instructions?: any;
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
  instructions,
}: StudentAssignmentViewProps) {
  const [code, setCode] = React.useState(initialCode);
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [activeTab, setActiveTab] = React.useState<"visible" | "hidden">("visible");
  const [isLeftPanelOpen, setIsLeftPanelOpen] = React.useState(true);
  const [verticalSplit, setVerticalSplit] = React.useState(60); // Track vertical split for code/test cases
  const [showCelebration, setShowCelebration] = React.useState(false);
  const [lastResultId, setLastResultId] = React.useState<string | null>(null); // Track to avoid re-triggering
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Parse description from backend (handles both JSON string and plain text)
  const parsedDescription = React.useMemo(() => {
    const desc = assignment.description;
    if (!desc) return null;
    try {
      // Try to parse as JSON (new format)
      const parsed = JSON.parse(desc);
      if (parsed && typeof parsed === 'object' && parsed.type) {
        return parsed; // Valid TipTap JSON
      }
      return null; // Not a valid TipTap structure
    } catch {
      return null; // Plain text (old format)
    }
  }, [assignment.description]);

  // Calculate attempts info
  const attemptsUsed = attempts.length;
  const attemptsLimit = assignment.sub_limit || null;
  const attemptsRemaining = attemptsLimit ? attemptsLimit - attemptsUsed : null;
  const isLowOnAttempts = attemptsRemaining !== null && attemptsRemaining <= 3 && attemptsRemaining > 0;

  // Get compile error from lastResult if it exists
  const compileError = React.useMemo(() => {
    if (lastResult?.result?.stderr) return lastResult.result.stderr;
    if (lastResult?.stderr) return lastResult.stderr;
    return null;
  }, [lastResult]);

  // Handle submission with confirmation
  const handleSubmitClick = () => {
    setShowConfirmModal(true);
  };

  const confirmSubmit = (e: React.FormEvent) => {
    setShowConfirmModal(false);
    onSubmit(e);
  };

  // Separate visible and hidden test cases from the assignment
  const visibleTestCases = React.useMemo(() => {
    if (testCases && testCases.length > 0) {
      const hasVisibilityField = testCases.some((tc: any) => 'visibility' in tc);
      if (hasVisibilityField) {
        const visible = testCases
          .filter((tc: any) => tc.visibility === true || tc.visibility === 1 || tc.visibility === "true")
          .sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));
        if (visible.length > 0) return visible;
      } else {
        return testCases.sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));
      }
    }
    if (lastResult?.test_cases) {
      return lastResult.test_cases
        .filter((tc: any) => tc.visibility === true || tc.visibility === 1 || tc.visibility === "true" || tc.visibility === undefined)
        .sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));
    }
    return [];
  }, [testCases, lastResult]);

  const hiddenTestCasesFromResults = React.useMemo(() => {
    if (!lastResult?.test_cases) return [];
    return lastResult.test_cases
      .filter((tc: any) => tc.visibility === false || tc.visibility === 0)
      .sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));
  }, [lastResult]);

  const hiddenTestCases = React.useMemo(() => {
    const fromTestCases = testCases
      .filter((tc: any) => tc.visibility === false || tc.visibility === 0)
      .sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));
    if (fromTestCases.length > 0) return fromTestCases;
    return hiddenTestCasesFromResults;
  }, [testCases, hiddenTestCasesFromResults]);

  const testCaseResults = React.useMemo(() => {
    if (!lastResult?.test_cases) return new Map();
    const map = new Map();
    lastResult.test_cases.forEach((tc: any) => {
      map.set(tc.id, tc);
    });
    return map;
  }, [lastResult]);

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

  const passedCount = React.useMemo(() => {
    if (!lastResult?.test_cases) return 0;
    return lastResult.test_cases.filter((tc: any) => tc.passed).length;
  }, [lastResult]);
  
  const totalTestCasesCount = React.useMemo(() => {
    if (!lastResult?.test_cases) return 0;
    return lastResult.test_cases.length;
  }, [lastResult]);

  // Trigger celebration when user gets 100% (all tests passed)
  React.useEffect(() => {
    // Create a unique ID for this result to avoid re-triggering
    const resultId = lastResult?.submission_id || lastResult?.id || JSON.stringify(lastResult?.test_cases?.map((tc: any) => tc.id));
    
    if (
      lastResult?.test_cases &&
      totalTestCasesCount > 0 &&
      passedCount === totalTestCasesCount &&
      resultId !== lastResultId
    ) {
      setLastResultId(resultId);
      setShowCelebration(true);
    }
  }, [lastResult, passedCount, totalTestCasesCount, lastResultId]);

  // --- Render Assignment Panel (Top) ---
  const renderAssignmentPanel = () => (
    <div className="h-full flex flex-col overflow-hidden bg-card">
      {/* Header with back link */}
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-3 shrink-0">
        <BookOpen className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground tracking-wide">Assignment</span>
        <Link 
          to={`/courses/${assignment.course_id}`} 
          className="ml-auto text-xs text-primary hover:text-accent flex items-center gap-1 no-underline"
        >
          <ChevronLeft className="w-3 h-3" />
          Back to course
        </Link>
      </div>

      {/* Assignment Content - scrollable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-card">
        <div className="p-6 space-y-4">
          {/* Title with badges */}
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-foreground leading-tight">{assignment.title}</h1>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border">
                {attempts.length} {assignment.sub_limit ? `/ ${assignment.sub_limit}` : ""} Attempts
              </span>
              {bestGrade != null && bestGrade >= 0 && (
                <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
                  Best: {totalPoints > 0 ? `${bestGrade}/${totalPoints}` : `${formatGradeDisplay(bestGrade)}%`}
                </span>
              )}
            </div>
          </div>
          
          {/* Description */}
          {assignment.description && (
            <div className="text-[15px] leading-relaxed">
              {parsedDescription ? (
                <RichTextEditor
                  content={parsedDescription}
                  onChange={() => {}}
                  readOnly={true}
                />
              ) : (
                <p className="whitespace-pre-wrap text-muted-foreground">{assignment.description}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // --- Render Instructions Panel (Bottom) ---
  const renderInstructionsPanel = () => (
    <div className="h-full flex flex-col overflow-hidden bg-card">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-3 shrink-0">
        <CheckCircle className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground tracking-wide">Instructions</span>
      </div>

      {/* Instructions Content - scrollable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-card">
        <div className="p-6">
          {instructions ? (
            <div className="instructions-content text-sm text-foreground">
              <InstructionsManager 
                instructions={instructions} 
                onChange={() => {}} 
                readOnly={true} 
              />
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">No instructions available.</div>
          )}
        </div>
      </div>
    </div>
  );

  // --- Render Combined Left Panel with Draggable Divider ---
  const renderLeftPanel = () => (
    <div className="h-full flex flex-col overflow-hidden">
      <SplitPane direction="vertical" initialSplit={35} minSize={15}>
        {renderAssignmentPanel()}
        {renderInstructionsPanel()}
      </SplitPane>
    </div>
  );

  const renderRightPanel = () => (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Editor Header & Toolbar */}
      <div className="bg-muted/30 border-b border-border px-4 py-2 flex justify-between items-center backdrop-blur-sm shrink-0 h-12">
        <div className="flex items-center gap-3">
          {!isLeftPanelOpen && (
             <Button variant="ghost" size="sm" onClick={() => setIsLeftPanelOpen(true)} className="p-1 h-auto" title="Open Sidebar">
                <PanelLeftOpen className="w-4 h-4" />
             </Button>
          )}
          
          {isLeftPanelOpen && (
              <Button variant="ghost" size="sm" onClick={() => setIsLeftPanelOpen(false)} className="p-1 h-auto" title="Close Sidebar">
                  <PanelLeftClose className="w-4 h-4" />
              </Button>
          )}

          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {uploadedFile ? "File Upload Mode" : "Source Code"}
          </span>
          {/* Language Badge */}
          <Badge variant="info" className="text-[10px] px-2 h-5 font-mono capitalize">
            {assignment.language || "Python"}
          </Badge>
          {uploadedFile && (
            <Badge variant="default" className="text-[10px] px-1.5 h-5">
              Read-only
            </Badge>
          )}
        </div>
        
        {/* Submit Message Badge */}
        {submitMsg && (
            <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center animate-in fade-in ${
               submitMsg.includes("failed") || submitMsg.includes("Error") || submitMsg.includes("unavailable") || submitMsg.includes("503")
                 ? "bg-danger/10 text-danger border border-danger/20" 
                 : "bg-success/10 text-success border border-success/20"
            }`}>
               {submitMsg.includes("failed") || submitMsg.includes("Error") || submitMsg.includes("unavailable") || submitMsg.includes("503")
                 ? <XCircle className="w-3 h-3 mr-1.5" /> 
                 : <CheckCircle2 className="w-3 h-3 mr-1.5" />
               }
               {submitMsg}
            </div>
        )}

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

      {/* Editor Area */}
      <div className="flex-1 relative bg-[#1e1e1e] overflow-hidden">
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
            <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="bg-card border border-border p-8 rounded-xl shadow-2xl max-w-md w-full">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileCode className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">File Ready to Submit</h3>
                <p className="text-muted-foreground mb-4 font-mono text-sm bg-muted p-2 rounded break-all border border-border/50">
                {uploadedFile.name}
                </p>
                <Button variant="danger" size="sm" onClick={removeFile} className="w-full">
                <X className="w-4 h-4 mr-2" />
                Remove File & Edit Code
                </Button>
            </div>
            </div>
        )}
      </div>
    </div>
  );

  const renderBottomPanel = () => (
      <div className="h-full flex flex-col overflow-hidden bg-card">
          <div className="border-b border-border bg-muted/10 flex items-center px-2 h-12 shrink-0 justify-between">
            <div className="flex items-center">
                <button
                    onClick={() => setActiveTab("visible")}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "visible" 
                        ? "border-primary text-primary" 
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Visible Test Cases
                </button>
                <button
                    onClick={() => setActiveTab("hidden")}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "hidden" 
                        ? "border-primary text-primary" 
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Hidden Test Cases
                </button>
            </div>

            <div className="flex items-center gap-4 pr-2">
                {/* Overall Result Badge */}
                {lastResult?.result?.grading && (
                    <Badge variant={lastResult.result?.grading?.all_passed ? "success" : "danger"}>
                        {passedCount} / {totalTestCasesCount} Passed
                    </Badge>
                )}

                 {/* Submit Button with attempt counter */}
                 {nowBlocked ? (
                    <Button size="sm" disabled>Closed</Button>
                ) : limitReached ? (
                    <Button size="sm" disabled>Limit Reached (0 of {attemptsLimit})</Button>
                ) : (
                    <Button 
                      size="sm" 
                      onClick={handleSubmitClick} 
                      disabled={loading || (!code.trim() && !uploadedFile)}
                      className={`font-bold shadow-glow ${isLowOnAttempts ? 'ring-2 ring-warning/50' : ''}`}
                    >
                      {loading ? "Grading..." : (
                        attemptsLimit 
                          ? `Submit (${attemptsUsed} of ${attemptsLimit})` 
                          : "Submit Solution"
                      )}
                    </Button>
                )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-card/50 p-4">
            {activeTab === "visible" ? (
              <div className="space-y-3">
                {/* Show compile error at top if exists */}
                {compileError && (
                  <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4 text-danger shrink-0" />
                      <span className="font-semibold text-danger text-sm">Compilation Error</span>
                    </div>
                    <div className="bg-[#0d1117] rounded-lg p-3 font-mono text-xs text-red-400 whitespace-pre-wrap overflow-x-auto max-h-[200px] overflow-y-auto custom-scrollbar">
                      {compileError}
                    </div>
                  </div>
                )}
                
                {visibleTestCases.length > 0 ? (
                  visibleTestCases.map((tc: any) => {
                    const resultData = testCaseResults.get(tc.id);
                    const passed = tc.passed ?? (resultData?.passed ?? null);
                    const pointsEarned = tc.points_earned ?? (resultData?.points_earned ?? null);
                    const errorMessage = tc.error_message ?? resultData?.error_message;
                    const actualOutput = tc.actual_output ?? resultData?.actual_output;
                    
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
                        
                        {/* Show compile error under test case if exists and test failed */}
                        {passed === false && compileError && (
                          <div className="mt-3 ml-6">
                            <div className="bg-[#0d1117] border border-red-500/30 rounded-lg overflow-hidden">
                              <div className="p-3 font-mono text-xs leading-relaxed max-h-[150px] overflow-y-auto custom-scrollbar">
                                <div className="text-red-400">
                                  <span className="text-red-500">Compile Error: </span>See error above
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Show output/error for failed tests (non-compile errors) */}
                        {passed === false && !compileError && (errorMessage || actualOutput || tc.stderr) && (
                          <div className="mt-3 ml-6">
                            <div className="bg-[#0d1117] border border-red-500/30 rounded-lg overflow-hidden">
                              <div className="p-3 font-mono text-xs leading-relaxed max-h-[200px] overflow-y-auto custom-scrollbar">
                                {errorMessage && (
                                  <div className="text-red-400">
                                    <span className="text-red-500">Error: </span>{errorMessage}
                                  </div>
                                )}
                                {actualOutput && (
                                  <div className="text-amber-300 mt-1">
                                    <span className="text-muted-foreground">stdout: </span>{actualOutput}
                                  </div>
                                )}
                                {tc.stderr && (
                                  <div className="text-red-300 mt-1">
                                    <span className="text-muted-foreground">stderr: </span>{tc.stderr}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Show "no output" message for failed tests without any output and no compile error */}
                        {passed === false && !compileError && !errorMessage && !actualOutput && !tc.stderr && (
                          <div className="mt-3 ml-6">
                            <div className="text-xs text-muted-foreground italic">
                              Test failed with no output - check your function return value
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  !compileError && (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground/40">
                      <FileCode className="w-10 h-10 mb-2 opacity-20" />
                      <p className="text-sm">No visible test cases available</p>
                    </div>
                  )
                )}
              </div>
            ) : activeTab === "hidden" ? (
              hiddenTestCases.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Hidden Test Cases ({hiddenTestCases.length})
                  </div>
                  <div className="space-y-2">
                    {hiddenTestCases.map((tc: any) => {
                      const passed = tc.passed ?? (testCaseResults.get(tc.id)?.passed ?? null);
                      const pointsEarned = tc.points_earned ?? (testCaseResults.get(tc.id)?.points_earned ?? null);
                      
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
                            <span className={`font-medium ${passed === null ? 'text-muted-foreground' : passed ? 'text-green-500' : 'text-red-500'}`}>
                              {passed === true ? "Passed" : passed === false ? "Failed" : "Not run"}
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
            ) : null}
          </div>
      </div>
  );

  return (
    <>
      {/* Perfect Score Celebration */}
      <Celebration 
        show={showCelebration} 
        onComplete={() => setShowCelebration(false)}
        score={passedCount}
        total={totalTestCasesCount}
      />

      {/* Submission Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isLowOnAttempts ? 'bg-warning/20' : 'bg-primary/20'
              }`}>
                {isLowOnAttempts ? (
                  <AlertTriangle className="w-5 h-5 text-warning" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-primary" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Confirm Submission</h3>
                <p className="text-sm text-muted-foreground">
                  {attemptsLimit 
                    ? `${attemptsUsed} of ${attemptsLimit} attempts used`
                    : "Unlimited attempts"}
                </p>
              </div>
            </div>

            {/* Warning message if low on attempts */}
            {isLowOnAttempts && (
              <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-warning">
                      {attemptsRemaining === 1 
                        ? "Last Attempt!" 
                        : `Only ${attemptsRemaining} attempts remaining!`}
                    </p>
                    <p className="text-xs text-warning/80 mt-1">
                      Make sure your code is ready before submitting.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to submit your solution? This action will use one of your attempts.
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <Button 
                variant="ghost" 
                className="flex-1" 
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button 
                className={`flex-1 font-bold ${
                  isLowOnAttempts 
                    ? 'bg-warning hover:bg-warning/90 text-warning-foreground' 
                    : ''
                }`}
                onClick={confirmSubmit}
              >
                {isLowOnAttempts ? "Submit Anyway" : "Submit Solution"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="h-[calc(100vh-96px)] w-full overflow-hidden bg-background flex flex-col">
          {isLeftPanelOpen ? (
              <SplitPane direction="horizontal" initialSplit={35} minSize={20}>
                  {renderLeftPanel()}
                  <SplitPane 
                    direction="vertical" 
                    split={verticalSplit} 
                    onSplitChange={setVerticalSplit}
                    minSize={20}
                  >
                      {renderRightPanel()}
                      {renderBottomPanel()}
                  </SplitPane>
              </SplitPane>
          ) : (
               <SplitPane 
                 direction="vertical" 
                 split={verticalSplit} 
                 onSplitChange={setVerticalSplit}
                 minSize={20}
               >
                  {renderRightPanel()}
                  {renderBottomPanel()}
              </SplitPane>
          )}
      </div>
    </>
  );
}
