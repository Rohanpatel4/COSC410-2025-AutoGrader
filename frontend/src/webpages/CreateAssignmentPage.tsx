import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson, BASE } from "../api/client";
import Editor, { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

// Safe join function for URLs
function join(base: string, path: string) {
  if (!base) return path;
  return base.replace(/\/+$/, "") + path;
}
import { Button, Input, Label, Card, Alert, RichTextEditor } from "../components/ui";
import { ArrowLeft, Plus, Trash2, GripVertical, X, AlertCircle } from "lucide-react";
import InstructionsManager from "../components/ui/InstructionsManager";

type SyntaxError = {
  line: number;
  column?: number;
  message: string;
};

type TestCase = {
  id: number;
  code: string;
  visible: boolean;
  points: number;
};

type SupportedLanguage = {
  id: string;
  name: string;
  piston_name: string;
};

export default function CreateAssignmentPage() {
  const { course_id = "" } = useParams<{ course_id: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();

  // Get sessionStorage key for this course and user
  const getStorageKey = React.useCallback(() => {
    if (!course_id || !userId) return null;
    return `create_assignment_${course_id}_${userId}`;
  }, [course_id, userId]);

  // Load form data from sessionStorage helper
  const loadFromStorage = React.useCallback(() => {
    const key = getStorageKey();
    if (!key) return null;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore errors
    }
    return null;
  }, [getStorageKey]);

  // Initialize state - will be updated by useEffect if saved data exists
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState<any>(null); // TipTap JSON content
  const [language, setLanguage] = React.useState("python");
  const [languages, setLanguages] = React.useState<SupportedLanguage[]>([]);
  const [languagesLoading, setLanguagesLoading] = React.useState(true);
  const [instructions, setInstructions] = React.useState<any>(null);
  const [subLimit, setSubLimit] = React.useState<string>("");
  const [start, setStart] = React.useState<string>("");
  const [stop, setStop] = React.useState<string>("");
  const [testFile, setTestFile] = React.useState<File | null>(null);
  const [testCases, setTestCases] = React.useState<TestCase[]>([
    { id: 1, code: "", visible: true, points: 10 }
  ]);

  // Reload form data from sessionStorage when course_id or userId changes
  React.useEffect(() => {
    if (!course_id || !userId) return;
    
    const saved = loadFromStorage();
    if (saved) {
      if (saved.title !== undefined) setTitle(saved.title);
      if (saved.description !== undefined) setDescription(saved.description);
      if (saved.language !== undefined) setLanguage(saved.language);
      if (saved.instructions !== undefined) setInstructions(saved.instructions);
      if (saved.subLimit !== undefined) setSubLimit(saved.subLimit);
      if (saved.start !== undefined) setStart(saved.start);
      if (saved.stop !== undefined) setStop(saved.stop);
      if (saved.testCases && saved.testCases.length > 0) {
        setTestCases(saved.testCases);
      }
    }
  }, [course_id, userId, loadFromStorage]);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  
  // Syntax validation state
  const [syntaxErrors, setSyntaxErrors] = React.useState<Record<number, SyntaxError[]>>({});
  const [validatingSyntax, setValidatingSyntax] = React.useState<Record<number, boolean>>({});
  const editorRefs = React.useRef<Record<number, editor.IStandaloneCodeEditor>>({});
  const monacoRef = React.useRef<Monaco | null>(null);
  // Use a ref to always get the current language value, not the closure value
  const languageRef = React.useRef(language);
  
  // Keep the ref in sync with the language state
  React.useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Save form data to sessionStorage whenever it changes (with debouncing)
  React.useEffect(() => {
    const key = getStorageKey();
    if (!key) return;

    const timeoutId = setTimeout(() => {
      try {
        const dataToSave = {
          title,
          description,
          language,
          instructions,
          subLimit,
          start,
          stop,
          testCases,
        };
        sessionStorage.setItem(key, JSON.stringify(dataToSave));
      } catch (e) {
        console.warn("Failed to save form data to sessionStorage:", e);
      }
    }, 500); // Debounce saves

    return () => clearTimeout(timeoutId);
  }, [title, description, language, instructions, subLimit, start, stop, testCases, getStorageKey]);

  // Fetch supported languages on mount
  React.useEffect(() => {
    async function loadLanguages() {
      try {
        const langs = await fetchJson<SupportedLanguage[]>("/api/v1/languages");
        setLanguages(langs);
        if (langs.length > 0 && !langs.find(l => l.id === language)) {
          setLanguage(langs[0].id);
        }
      } catch (e) {
        console.error("Failed to load languages:", e);
        // Fallback to defaults
        setLanguages([
          { id: "python", name: "Python", piston_name: "python" },
          { id: "java", name: "Java", piston_name: "java" },
          { id: "cpp", name: "C++", piston_name: "c++" }
        ]);
      } finally {
        setLanguagesLoading(false);
      }
    }
    loadLanguages();
  }, []);

  // Get Monaco editor language from our language id
  const getMonacoLanguage = (lang: string): string => {
    switch (lang.toLowerCase()) {
      case "python": return "python";
      case "java": return "java";
      case "cpp":
      case "c++": return "cpp";
      case "javascript":
      case "js": return "javascript";
      case "typescript":
      case "ts": return "typescript";
      default: return "python";
    }
  };

  // Validate syntax for a test case
  // Don't include language in dependencies - use ref instead to always get current value
  const validateSyntax = React.useCallback(async (testCaseId: number, code: string) => {
    // Use the current language value from ref, not closure
    const currentLanguage = languageRef.current;
    console.log(`[CreateAssignment] validateSyntax called for test case ${testCaseId}, current language: ${currentLanguage}`);
    
    if (!code.trim()) {
      // Clear errors for empty code
      setSyntaxErrors(prev => {
        const next = { ...prev };
        delete next[testCaseId];
        return next;
      });
      // Clear markers
      const editor = editorRefs.current[testCaseId];
      if (editor && monacoRef.current) {
        const model = editor.getModel();
        if (model) {
          monacoRef.current.editor.setModelMarkers(model, 'syntax', []);
        }
      }
      return;
    }

    setValidatingSyntax(prev => ({ ...prev, [testCaseId]: true }));

    try {
      // Debug: log what we're sending
      console.log(`[CreateAssignment] Validating test case ${testCaseId} with language: ${currentLanguage}`, code.substring(0, 50));
      const response = await fetchJson<{ valid: boolean; errors: SyntaxError[] }>(
        "/api/v1/syntax/validate",
        {
          method: "POST",
          body: JSON.stringify({ code, language: currentLanguage }),
        }
      );

      if (response.valid) {
        setSyntaxErrors(prev => {
          const next = { ...prev };
          delete next[testCaseId];
          return next;
        });
        // Clear markers
        const editor = editorRefs.current[testCaseId];
        if (editor && monacoRef.current) {
          const model = editor.getModel();
          if (model) {
            monacoRef.current.editor.setModelMarkers(model, 'syntax', []);
          }
        }
      } else {
        setSyntaxErrors(prev => ({ ...prev, [testCaseId]: response.errors }));
        // Set markers in Monaco
        const editor = editorRefs.current[testCaseId];
        if (editor && monacoRef.current) {
          const model = editor.getModel();
          if (model) {
            const markers = response.errors
              .filter(err => err.line > 0 && err.line <= model.getLineCount()) // Only valid line numbers
              .map(err => {
                const lineNumber = Math.max(1, Math.min(err.line, model.getLineCount()));
                const column = err.column || 1;
                const maxColumn = model.getLineMaxColumn(lineNumber);
                return {
                  severity: monacoRef.current!.MarkerSeverity.Error,
                  message: err.message,
                  startLineNumber: lineNumber,
                  startColumn: Math.max(1, Math.min(column, maxColumn)),
                  endLineNumber: lineNumber,
                  endColumn: err.column ? Math.min(column + 10, maxColumn) : maxColumn,
                };
              });
            monacoRef.current.editor.setModelMarkers(model, 'syntax', markers);
          }
        }
      }
    } catch (error) {
      console.error("Syntax validation failed:", error);
      // Don't block on validation errors - just clear them
      setSyntaxErrors(prev => {
        const next = { ...prev };
        delete next[testCaseId];
        return next;
      });
    } finally {
      setValidatingSyntax(prev => ({ ...prev, [testCaseId]: false }));
    }
  }, []); // No dependencies - we use languageRef to get current language

  // Handle editor mount
  const handleEditorMount = (testCaseId: number, editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRefs.current[testCaseId] = editor;
    monacoRef.current = monaco;
    
    // Validate on blur
    editor.onDidBlurEditorText(() => {
      const code = editor.getValue();
      validateSyntax(testCaseId, code);
    });
  };

  // Clear syntax errors when language changes
  React.useEffect(() => {
    setSyntaxErrors({});
    // Clear all markers
    Object.entries(editorRefs.current).forEach(([id, editor]) => {
      if (monacoRef.current) {
        const model = editor.getModel();
        if (model) {
          monacoRef.current.editor.setModelMarkers(model, 'syntax', []);
        }
      }
    });
  }, [language]);

  // Helper function to check if TipTap content has actual text
  const hasTipTapContent = (json: any): boolean => {
    if (!json || !json.content) return false;
    
    const checkContent = (node: any): boolean => {
      if (node.type === 'text' && node.text?.trim()) return true;
      if (node.content && Array.isArray(node.content)) {
        return node.content.some((child: any) => checkContent(child));
      }
      return false;
    };
    
    return checkContent(json);
  };

  // Alias for instructions (for clarity)
  const hasInstructionsContent = hasTipTapContent;

  // Validate form before submission
  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!title.trim()) {
      errors.push("Title is required");
    }
    
    // Check if description has actual content
    if (!hasTipTapContent(description)) {
      errors.push("Description is required");
    }
    
    // Check if instructions have actual content
    if (!hasInstructionsContent(instructions)) {
      errors.push("At least one instruction is required");
    }
    
    // Check for empty test cases
    const emptyTestCases = testCases.filter(tc => !tc.code.trim());
    if (emptyTestCases.length > 0) {
      errors.push(`${emptyTestCases.length} test case(s) are empty. Please fill in all test cases or remove empty ones.`);
    }
    
    // Check for test cases with 0 or negative points
    const invalidPointsTestCases = testCases.filter(tc => tc.points <= 0);
    if (invalidPointsTestCases.length > 0) {
      errors.push(`${invalidPointsTestCases.length} test case(s) have invalid point values. Points must be greater than 0.`);
    }
    
    // Check for syntax errors
    const testCasesWithSyntaxErrors = Object.keys(syntaxErrors).length;
    if (testCasesWithSyntaxErrors > 0) {
      errors.push(`${testCasesWithSyntaxErrors} test case(s) have syntax errors. Please fix them before submitting.`);
    }
    
    return errors;
  };

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setValidationErrors([]);

    // First, validate all test cases syntax before form validation
    // This ensures we catch any syntax errors even if user didn't blur
    setSubmitting(true);
    const syntaxValidationPromises = testCases
      .filter(tc => tc.code.trim())
      .map(tc => validateSyntax(tc.id, tc.code));
    
    await Promise.all(syntaxValidationPromises);
    
    // Small delay to ensure state updates
    await new Promise(resolve => setTimeout(resolve, 100));
    setSubmitting(false);

    // Validate before submission
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      // Serialize description as JSON string for backend storage
      const descriptionStr = description ? JSON.stringify(description) : "";
      
      const payload: any = {
        title: title.trim(),
        description: descriptionStr,
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

      // Clear saved form data from sessionStorage after successful creation
      const key = getStorageKey();
      if (key) {
        try {
          sessionStorage.removeItem(key);
        } catch {
          // Ignore errors
        }
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

  function clearDate(field: "start" | "stop") {
    if (field === "start") {
      setStart("");
    } else {
      setStop("");
    }
  }

  return (
    <div className="page-container">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          to={`/courses/${course_id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Course
        </Link>

        <div className="text-center">
          <h1 className="page-title">Create New Assignment</h1>
          <p className="page-subtitle">
            Create a new assignment with test cases for automatic grading.
          </p>
          <a
            href="/TEST_CASE_GUIDE.pdf"
            download="Test_Case_Guide.pdf"
            className="text-primary hover:underline text-sm font-medium inline-flex items-center gap-1 mt-3"
          >
            📄 Download Test Case Guide
          </a>
        </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="error" className="mb-6">
          <div className="space-y-1">
            <p className="font-medium">Please fix the following issues:</p>
            <ul className="list-disc list-inside text-sm space-y-0.5">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        </Alert>
      )}

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
              Description <span className="text-red-500">*</span>
            </Label>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              disabled={submitting}
              placeholder="Enter assignment description and requirements..."
              minHeight="120px"
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
                onChange={(e) => {
                  const newLang = e.target.value;
                  console.log(`[CreateAssignment] Language changed from ${language} to ${newLang}`);
                  setLanguage(newLang);
                }}
                disabled={submitting || languagesLoading}
                className="flex h-10 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-foreground shadow-sm transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-ring/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {languagesLoading ? (
                  <option>Loading languages...</option>
                ) : (
                  languages.map(lang => (
                    <option key={lang.id} value={lang.id}>{lang.name}</option>
                  ))
                )}
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
              <div className="relative">
                <Input
                  id="start"
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  disabled={submitting}
                  className="pr-10 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                />
                {start && (
                  <button
                    type="button"
                    onClick={() => clearDate("start")}
                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Clear start date"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="stop">
                Due Date <span className="text-muted-foreground">(optional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="stop"
                  type="datetime-local"
                  value={stop}
                  onChange={(e) => setStop(e.target.value)}
                  disabled={submitting}
                  className="pr-10 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                />
                {stop && (
                  <button
                    type="button"
                    onClick={() => clearDate("stop")}
                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Clear due date"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
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
              Test cases are written in {languages.find(l => l.id === language)?.name || language}.
            </p>
          </div>

          <div className="space-y-6">
            {testCases.map((testCase, index) => {
              const hasEmptyCode = !testCase.code.trim();
              const hasSyntaxErrors = syntaxErrors[testCase.id]?.length > 0;
              const isValidating = validatingSyntax[testCase.id];
              
              return (
                <div
                  key={testCase.id}
                  className={`space-y-2 border rounded-xl p-4 transition-colors ${
                    hasSyntaxErrors ? "border-destructive/50 bg-destructive/5" :
                    hasEmptyCode ? "border-warning/50 bg-warning/5" : "border-border bg-muted/20"
                  }`}
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
                    {isValidating && (
                      <span className="text-xs text-muted-foreground animate-pulse">Checking syntax...</span>
                    )}
                    {!isValidating && hasSyntaxErrors && (
                      <span className="text-xs text-destructive font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Syntax Error
                      </span>
                    )}
                    {!isValidating && !hasSyntaxErrors && hasEmptyCode && (
                      <span className="text-xs text-warning font-medium">Empty</span>
                    )}
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
                          className="w-20 h-8 text-sm px-2"
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
                  
                  {/* Monaco Editor for test case code */}
                  <div className={`rounded-lg border relative ${hasSyntaxErrors ? 'border-destructive' : 'border-border'}`} style={{ zIndex: 1 }}>
                    <Editor
                      height="150px"
                      language={getMonacoLanguage(language)}
                      theme="vs-dark"
                      value={testCase.code}
                      onChange={(value) => updateTestCase(testCase.id, 'code', value || '')}
                      onMount={(editor, monaco) => handleEditorMount(testCase.id, editor, monaco)}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        padding: { top: 8, bottom: 8 },
                        lineNumbers: "on",
                        renderLineHighlight: "line",
                        scrollbar: {
                          vertical: "auto",
                          horizontal: "auto",
                          verticalScrollbarSize: 8,
                          horizontalScrollbarSize: 8,
                        },
                        wordWrap: "on",
                      }}
                      loading={
                        <div className="h-[150px] flex items-center justify-center bg-[#1e1e1e] text-muted-foreground text-sm">
                          Loading editor...
                        </div>
                      }
                    />
                  </div>
                  
                  {/* Syntax error messages */}
                  {hasSyntaxErrors && (
                    <div className="mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded-lg">
                      <div className="text-xs text-destructive space-y-1">
                        {syntaxErrors[testCase.id].map((err, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-destructive/70">Line {err.line}:</span>
                            <span>{err.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
    </div>
  );
}
