import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchJson } from "../api/client";
import Editor, { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Button, Input, Label, Card, Alert, RichTextEditor } from "../components/ui";
import { ArrowLeft, Plus, Trash2, GripVertical, X, AlertTriangle, AlertCircle } from "lucide-react";
import InstructionsManager from "../components/ui/InstructionsManager";
import type { Assignment } from "../types/assignments";

type SyntaxError = {
  line: number;
  column?: number;
  message: string;
};

type EditTestCase = {
  id: number;
  code: string;
  points: number;
  visible: boolean;
  order: number;
  isNew?: boolean;
};

type SupportedLanguage = {
  id: string;
  name: string;
  piston_name: string;
};

export default function EditAssignmentPage() {
  const { assignment_id = "" } = useParams<{ assignment_id: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();

  // Get sessionStorage key for this assignment and user
  const getStorageKey = React.useCallback(() => {
    if (!assignment_id || !userId) return null;
    return `edit_assignment_${assignment_id}_${userId}`;
  }, [assignment_id, userId]);

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

  // Load saved data on mount
  const savedData = React.useMemo(() => loadFromStorage(), [loadFromStorage]);

  // Assignment data
  const [assignment, setAssignment] = React.useState<Assignment | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // Form state - initialize from saved data if available, otherwise defaults
  const [title, setTitle] = React.useState(savedData?.title || "");
  const [description, setDescription] = React.useState<any>(savedData?.description || null); // TipTap JSON content
  const [language, setLanguage] = React.useState(savedData?.language || "python");
  const [languages, setLanguages] = React.useState<SupportedLanguage[]>([]);
  const [languagesLoading, setLanguagesLoading] = React.useState(true);
  const [instructions, setInstructions] = React.useState<any>(savedData?.instructions || null);
  const [subLimit, setSubLimit] = React.useState<string>(savedData?.subLimit || "");
  const [start, setStart] = React.useState<string>(savedData?.start || "");
  const [stop, setStop] = React.useState<string>(savedData?.stop || "");
  const [testCases, setTestCases] = React.useState<EditTestCase[]>(savedData?.testCases || []);
  const [testCasesLoading, setTestCasesLoading] = React.useState(false);
  const [hasLoadedFromServer, setHasLoadedFromServer] = React.useState(false);
  
  const [msg, setMsg] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  
  // Syntax validation state
  const [syntaxErrors, setSyntaxErrors] = React.useState<Record<number, SyntaxError[]>>({});
  const [validatingSyntax, setValidatingSyntax] = React.useState<Record<number, boolean>>({});
  const editorRefs = React.useRef<Record<number, editor.IStandaloneCodeEditor>>({});
  const monacoRef = React.useRef<Monaco | null>(null);

  // Helper to parse description from backend (handles both JSON string and plain text)
  const parseDescription = (desc: string | null | undefined): any => {
    if (!desc) return null;
    try {
      // Try to parse as JSON (new format)
      const parsed = JSON.parse(desc);
      if (parsed && typeof parsed === 'object' && parsed.type) {
        return parsed; // Valid TipTap JSON
      }
      // Not a valid TipTap structure, wrap as plain text
      return {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: desc }] }]
      };
    } catch {
      // Plain text (old format) - wrap in TipTap structure
      return {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: desc }] }]
      };
    }
  };

  // Fetch supported languages on mount
  React.useEffect(() => {
    async function loadLanguages() {
      try {
        const langs = await fetchJson<SupportedLanguage[]>("/api/v1/languages");
        setLanguages(langs);
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

  // Fetch assignment data
  React.useEffect(() => {
    async function loadAssignment() {
      if (!assignment_id) return;
      
      setLoading(true);
      setErr(null);
      
      try {
        const data = await fetchJson<Assignment>(
          `/api/v1/assignments/${encodeURIComponent(assignment_id)}`
        );
        setAssignment(data);
        
        // Populate form fields from server (only if no saved data from sessionStorage)
        if (!savedData) {
          setTitle(data.title || "");
          setDescription(parseDescription(data.description));
          setLanguage(data.language || "python");
          setSubLimit(data.sub_limit?.toString() || "");
          setStart(data.start ? new Date(data.start).toISOString().slice(0, 16) : "");
          setStop(data.stop ? new Date(data.stop).toISOString().slice(0, 16) : "");
          setInstructions(data.instructions || null);
        }
        
        // Fetch test cases from server (only if no saved data from sessionStorage)
        if (!savedData?.testCases || savedData.testCases.length === 0) {
          setTestCasesLoading(true);
          try {
            const testCasesData: any[] = await fetchJson(
              `/api/v1/assignments/${data.id}/test-cases?include_hidden=true&user_id=${userId}`
            );
            setTestCases(testCasesData.map((tc: any, index: number) => ({
              id: tc.id,
              code: tc.test_code,
              points: tc.point_value,
              visible: tc.visibility,
              order: index + 1
            })));
          } catch (error) {
            console.error("Failed to fetch test cases:", error);
            if (!savedData?.testCases) {
              setTestCases([]);
            }
          } finally {
            setTestCasesLoading(false);
          }
        }
        setHasLoadedFromServer(true);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load assignment");
      } finally {
        setLoading(false);
      }
    }
    
    loadAssignment();
  }, [assignment_id, userId]);

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
  const validateSyntax = React.useCallback(async (testCaseId: number, code: string) => {
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
      const response = await fetchJson<{ valid: boolean; errors: SyntaxError[] }>(
        "/api/v1/syntax/validate",
        {
          method: "POST",
          body: JSON.stringify({ code, language }),
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
            const markers = response.errors.map(err => ({
              severity: monacoRef.current!.MarkerSeverity.Error,
              message: err.message,
              startLineNumber: err.line,
              startColumn: err.column || 1,
              endLineNumber: err.line,
              endColumn: err.column ? err.column + 10 : model.getLineMaxColumn(err.line),
            }));
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
  }, [language]);

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

  // Helper function to clean up instructions - removes empty list items
  // Same logic as InstructionsManager onBlur
  const cleanupInstructions = (json: any): any => {
    if (!json) return json;
    
    const removeEmptyItems = (node: any): any => {
      if (node.type === 'bulletList') {
        if (node.content && Array.isArray(node.content)) {
          const processedContent: any[] = [];
          
          node.content.forEach((listItem: any) => {
            if (listItem.type === 'listItem') {
              const paragraph = listItem.content?.find((c: any) => c.type === 'paragraph');
              const hasText = paragraph?.content?.some((c: any) => c.type === 'text' && c.text?.trim());
              const nestedBulletList = listItem.content?.find((c: any) => c.type === 'bulletList');
              const hasNestedChildren = nestedBulletList && nestedBulletList.content && nestedBulletList.content.length > 0;
              
              if (!hasText) {
                if (hasNestedChildren) {
                  nestedBulletList.content.forEach((nestedItem: any) => {
                    const processed = removeEmptyItems(nestedItem);
                    if (processed) processedContent.push(processed);
                  });
                }
              } else {
                const processed = removeEmptyItems(listItem);
                if (processed) processedContent.push(processed);
              }
            } else {
              const processed = removeEmptyItems(listItem);
              if (processed) processedContent.push(processed);
            }
          });
          
          return { ...node, content: processedContent };
        }
      } else if (node.type === 'listItem') {
        if (node.content && Array.isArray(node.content)) {
          const processedContent: any[] = [];
          node.content.forEach((child: any) => {
            if (child.type === 'bulletList') {
              const processed = removeEmptyItems(child);
              if (processed) processedContent.push(processed);
            } else {
              processedContent.push(child);
            }
          });
          return { ...node, content: processedContent };
        }
      } else if (node.type === 'doc') {
        if (node.content && Array.isArray(node.content)) {
          const processedContent = node.content
            .map((child: any) => removeEmptyItems(child))
            .filter((child: any) => child !== null);
          return { ...node, content: processedContent };
        }
      }
      return node;
    };
    
    return removeEmptyItems(json);
  };

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
    const cleanedInstructions = cleanupInstructions(instructions);
    if (!hasInstructionsContent(cleanedInstructions)) {
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

  async function saveChanges(e: React.FormEvent) {
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
      // Clean up instructions before submitting (remove empty bullet points)
      const cleanedInstructions = cleanupInstructions(instructions);
      
      // Update assignment details
      const payload: any = {
        title: title.trim(),
      };

      // Description is required - serialize as JSON string for backend storage
      payload.description = description ? JSON.stringify(description) : "";
      if (language) payload.language = language;
      
      // Handle submission limit - include empty string to clear
      if (subLimit.trim()) {
        payload.sub_limit = parseInt(subLimit);
      } else {
        payload.sub_limit = null; // Explicitly set to null to clear
      }
      
      // Handle dates - include empty string to clear
      payload.start = start || null;
      payload.stop = stop || null;
      
      payload.instructions = cleanedInstructions;

      await fetchJson(
        `/api/v1/assignments/${encodeURIComponent(assignment_id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      // Handle test cases
      const assignmentId = parseInt(assignment_id);

      // Get original test cases to compare
      const originalTestCases: any[] = await fetchJson(
        `/api/v1/assignments/${assignmentId}/test-cases?include_hidden=true&user_id=${userId}`
      );
      const originalIds = new Set(originalTestCases.map((tc: any) => tc.id));
      const currentIds = new Set(testCases.filter(tc => !tc.isNew).map(tc => tc.id));

      // Delete removed test cases
      for (const originalTc of originalTestCases) {
        if (!currentIds.has(originalTc.id)) {
          await fetchJson(
            `/api/v1/assignments/${assignmentId}/test-cases/${originalTc.id}`,
            { method: "DELETE" }
          );
        }
      }

      // Update existing and create new test cases
      for (const tc of testCases) {
        const tcPayload = {
          test_code: tc.code,
          point_value: tc.points,
          visibility: tc.visible,
          order: tc.order
        };

        if (tc.isNew) {
          // Create new test case
          await fetchJson(
            `/api/v1/assignments/${assignmentId}/test-cases`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(tcPayload),
            }
          );
        } else {
          // Update existing test case
          await fetchJson(
            `/api/v1/assignments/${assignmentId}/test-cases/${tc.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(tcPayload),
            }
          );
        }
      }

      // Clear saved form data from sessionStorage after successful update
      const key = getStorageKey();
      if (key) {
        try {
          sessionStorage.removeItem(key);
        } catch {
          // Ignore errors
        }
      }

      setMsg("Assignment updated successfully!");
      setTimeout(() => {
        navigate(`/assignments/${assignment_id}`);
      }, 1500);
    } catch (e: any) {
      setMsg(`Failed to update assignment: ${e?.message ?? "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteAssignment() {
    if (!assignment) return;

    setSubmitting(true);
    try {
      await fetchJson(
        `/api/v1/assignments/${encodeURIComponent(assignment_id)}`,
        { method: "DELETE" }
      );

      // Navigate back to the course page
      if (assignment.course_id) {
        navigate(`/courses/${assignment.course_id}`);
      } else {
        navigate("/courses");
      }
    } catch (e: any) {
      setMsg(`Failed to delete assignment: ${e?.message ?? "Unknown error"}`);
    } finally {
      setSubmitting(false);
      setShowDeleteConfirm(false);
    }
  }

  function addTestCase() {
    const newId = Date.now(); // Temporary ID for new test cases
    setTestCases(prev => [...prev, {
      id: newId,
      code: "",
      points: 10,
      visible: true,
      order: prev.length + 1,
      isNew: true
    }]);
  }

  function updateTestCase(id: number, field: string, value: any) {
    setTestCases(prev => prev.map(tc =>
      tc.id === id ? { ...tc, [field]: value } : tc
    ));
  }

  function deleteTestCase(id: number) {
    setTestCases(prev => prev.filter(tc => tc.id !== id));
  }

  function moveTestCase(fromIndex: number, toIndex: number) {
    setTestCases(prev => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      // Update order numbers
      return result.map((tc, index) => ({ ...tc, order: index + 1 }));
    });
  }

  function clearDate(field: "start" | "stop") {
    if (field === "start") {
      setStart("");
    } else {
      setStop("");
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading assignment...</p>
          </div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="page-container">
        <Alert variant="error">
          <p className="font-medium">{err}</p>
        </Alert>
        <div className="mt-4">
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          to={`/assignments/${assignment_id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Assignment
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="page-title">Edit Assignment</h1>
            <p className="page-subtitle">
              Update assignment details and test cases.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={submitting}
            className="shrink-0"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-danger" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Delete Assignment?</h3>
                  <p className="text-muted-foreground mb-6">
                    Are you sure you want to delete "<strong>{assignment?.title}</strong>"? 
                    This action cannot be undone and will delete all associated submissions and test cases.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      onClick={deleteAssignment}
                      disabled={submitting}
                    >
                      {submitting ? "Deleting..." : "Delete Assignment"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

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
          <Alert variant={msg.includes("Failed") || msg.includes("failed") ? "error" : "success"} className="mb-6">
            <p className="font-medium">{msg}</p>
          </Alert>
        )}

        <Card className="mb-8">
          <form onSubmit={saveChanges} className="space-y-6">
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
              <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
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
                <Label htmlFor="language">Language</Label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
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
              </div>

              <div>
                <Label htmlFor="subLimit">
                  Submission Limit <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="subLimit"
                  type="number"
                  min="1"
                  placeholder="Unlimited if empty"
                  value={subLimit}
                  onChange={(e) => setSubLimit(e.target.value)}
                  disabled={submitting}
                />
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
                onClick={() => navigate(`/assignments/${assignment_id}`)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!title.trim() || submitting}
                className="flex-1"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Test Cases Section */}
        <Card className="bg-card border-border">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Test Cases</h2>
                <p className="text-muted-foreground text-sm">
                  Edit test cases used to grade student submissions.
                  Test cases are written in {languages.find(l => l.id === language)?.name || language}.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addTestCase}
                disabled={testCasesLoading}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Test Case
              </Button>
            </div>

            {testCasesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                <p className="text-muted-foreground text-sm">Loading test cases...</p>
              </div>
            ) : testCases.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-xl">
                <p className="text-muted-foreground mb-3">No test cases yet.</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addTestCase}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Test Case
                </Button>
              </div>
            ) : (
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
                        {testCase.isNew && (
                          <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded">New</span>
                        )}
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
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

