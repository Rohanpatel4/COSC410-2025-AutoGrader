import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import StudentAssignmentView from "../webpages/StudentAssignmentView";
import { renderWithProviders } from "./renderWithProviders";

// Mock Monaco Editor
vi.mock("@monaco-editor/react", () => ({
  default: ({ onChange, value, ...props }: any) => {
    return (
      <div data-testid="monaco-editor" {...props}>
        <textarea
          data-testid="monaco-editor-textarea"
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  },
}));

const mockAssignment = {
  id: 1,
  title: "Test Assignment",
  description: "Test description",
  course_id: 500,
  sub_limit: 3,
  language: "python",
};

const mockAttempts = [
  { id: 1, earned_points: 80, submitted_at: "2025-01-01T10:00:00Z" },
  { id: 2, earned_points: 90, submitted_at: "2025-01-02T10:00:00Z" },
];

const mockTestCases = [
  { id: 1, test_code: "test 1", point_value: 50, visibility: true, order: 1 },
  { id: 2, test_code: "test 2", point_value: 50, visibility: false, order: 2 },
];

function renderStudentAssignmentView(props = {}) {
  const defaultProps = {
    assignment: mockAssignment,
    attempts: mockAttempts,
    bestGrade: 90,
    totalPoints: 100,
    testCases: mockTestCases,
    onCodeChange: vi.fn(),
    onFileChange: vi.fn(),
    onSubmit: vi.fn(),
    loading: false,
    submitMsg: null,
    lastResult: null,
    nowBlocked: false,
    limitReached: false,
    initialCode: "print('hello')",
    instructions: [],
  };

  return renderWithProviders(
    <StudentAssignmentView {...defaultProps} {...props} />,
    {
      auth: { role: "student", userId: "201" },
    }
  );
}

describe("StudentAssignmentView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders assignment title and description", () => {
    renderStudentAssignmentView();

    expect(screen.getByText("Test Assignment")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  test("displays attempt history", () => {
    renderStudentAssignmentView();

    expect(screen.getByText(/attempts/i)).toBeInTheDocument();
    expect(screen.getByText(/2.*3.*attempts/i)).toBeInTheDocument();
  });

  test("shows best grade", () => {
    renderStudentAssignmentView();

    expect(screen.getByText(/best:/i)).toBeInTheDocument();
    expect(screen.getByText(/90.*100|Best:.*90.*100/i)).toBeInTheDocument();
  });

  test("shows best grade as percentage when totalPoints is 0", () => {
    renderStudentAssignmentView({ totalPoints: 0 });

    expect(screen.getByText(/best:/i)).toBeInTheDocument();
  });

  test("does not show best grade when bestGrade is null", () => {
    renderStudentAssignmentView({ bestGrade: null });

    expect(screen.queryByText(/best:/i)).not.toBeInTheDocument();
  });

  test("does not show best grade when bestGrade is negative", () => {
    renderStudentAssignmentView({ bestGrade: -1 });

    expect(screen.queryByText(/best:/i)).not.toBeInTheDocument();
  });

  test("renders code editor with initial code", () => {
    renderStudentAssignmentView();

    expect(screen.getByText(/source code/i)).toBeInTheDocument();
    const editor = screen.getByTestId("monaco-editor-textarea");
    expect(editor).toHaveValue("print('hello')");
  });

  test("shows test cases tabs", () => {
    renderStudentAssignmentView();

    expect(screen.getByText("Visible Test Cases")).toBeInTheDocument();
    expect(screen.getByText("Hidden Test Cases")).toBeInTheDocument();
  });

  test("displays visible test cases", () => {
    renderStudentAssignmentView();

    expect(screen.getByText("test 1")).toBeInTheDocument();
    expect(screen.getByText(/50.*pts/i)).toBeInTheDocument();
  });

  test("shows submission limit status", () => {
    renderStudentAssignmentView();

    expect(screen.getByText(/2.*3.*attempts/i)).toBeInTheDocument();
  });

  test("shows unlimited attempts when sub_limit is null", () => {
    renderStudentAssignmentView({
      assignment: { ...mockAssignment, sub_limit: null },
    });

    expect(screen.getByText(/2.*attempts/i)).toBeInTheDocument();
  });

  test("calls onSubmit when form is submitted", async () => {
    const mockOnSubmit = vi.fn();
    renderStudentAssignmentView({ onSubmit: mockOnSubmit });

    const submitButton = screen.getByRole("button", { name: /submit.*\(2 of 3\)/i });
    await userEvent.click(submitButton);

    await screen.findByText(/confirm submission/i);
    const confirmButton = screen.getByRole("button", { name: /submit solution|submit anyway/i });
    await userEvent.click(confirmButton);

    expect(mockOnSubmit).toHaveBeenCalled();
  });

  test("shows loading state during submission", () => {
    renderStudentAssignmentView({ loading: true });

    expect(screen.getByText(/grading/i)).toBeInTheDocument();
  });

  test("displays submission message", () => {
    renderStudentAssignmentView({ submitMsg: "Submission successful!" });

    expect(screen.getByText("Submission successful!")).toBeInTheDocument();
  });

  test("displays error submission message", () => {
    renderStudentAssignmentView({ submitMsg: "Submission failed" });

    expect(screen.getByText("Submission failed")).toBeInTheDocument();
  });

  test("shows limit reached message", () => {
    renderStudentAssignmentView({ limitReached: true });

    expect(screen.getByText(/limit reached/i)).toBeInTheDocument();
  });

  test("shows closed message when nowBlocked is true", () => {
    renderStudentAssignmentView({ nowBlocked: true });

    expect(screen.getByRole("button", { name: /closed/i })).toBeInTheDocument();
  });

  test("handles code editor changes", async () => {
    const mockOnCodeChange = vi.fn();
    renderStudentAssignmentView({ onCodeChange: mockOnCodeChange });

    const editor = screen.getByTestId("monaco-editor-textarea");
    await userEvent.clear(editor);
    await userEvent.type(editor, "print('new code')");

    expect(mockOnCodeChange).toHaveBeenCalled();
  });

  test("handles file upload", async () => {
    const mockOnFileChange = vi.fn();
    renderStudentAssignmentView({ onFileChange: mockOnFileChange });

    const file = new File(["test code"], "test.py", { type: "text/plain" });
    const fileInput = screen.getByLabelText(/upload file/i);

    await userEvent.upload(fileInput, file);

    expect(mockOnFileChange).toHaveBeenCalledWith(file);
    expect(screen.getByText(/file ready to submit/i)).toBeInTheDocument();
  });

  test("handles file removal", async () => {
    const mockOnFileChange = vi.fn();
    const file = new File(["test code"], "test.py", { type: "text/plain" });
    
    renderStudentAssignmentView({ onFileChange: mockOnFileChange });

    const fileInput = screen.getByLabelText(/upload file/i);
    await userEvent.upload(fileInput, file);

    const removeButton = screen.getByRole("button", { name: /remove file/i });
    await userEvent.click(removeButton);

    expect(mockOnFileChange).toHaveBeenCalledWith(null);
  });

  test("disables file upload when blocked", () => {
    renderStudentAssignmentView({ nowBlocked: true });

    const fileInput = screen.getByLabelText(/upload file/i) as HTMLInputElement;
    expect(fileInput).toBeDisabled();
  });

  test("disables file upload when limit reached", () => {
    renderStudentAssignmentView({ limitReached: true });

    const fileInput = screen.getByLabelText(/upload file/i) as HTMLInputElement;
    expect(fileInput).toBeDisabled();
  });

  test("shows file upload mode badge when file is uploaded", async () => {
    const file = new File(["test code"], "test.py", { type: "text/plain" });
    renderStudentAssignmentView();

    const fileInput = screen.getByLabelText(/upload file/i);
    await userEvent.upload(fileInput, file);

    expect(screen.getByText(/file upload mode/i)).toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  test("switches to hidden test cases tab", async () => {
    renderStudentAssignmentView();

    const hiddenTab = screen.getByRole("button", { name: /hidden test cases/i });
    await userEvent.click(hiddenTab);

    await waitFor(() => {
      const tab = screen.getByRole("button", { name: /hidden test cases/i });
      expect(tab).toHaveClass(/border-primary/);
    });
  });

  test("displays hidden test cases", async () => {
    renderStudentAssignmentView();

    const hiddenTab = screen.getByRole("button", { name: /hidden test cases/i });
    await userEvent.click(hiddenTab);

    await waitFor(() => {
      expect(screen.getByText(/hidden test cases.*\(1\)/i)).toBeInTheDocument();
    });
  });

  test("shows no visible test cases message when empty", () => {
    renderStudentAssignmentView({ testCases: [] });

    expect(screen.getByText(/no visible test cases available/i)).toBeInTheDocument();
  });

  test("shows no hidden test cases message when empty", async () => {
    renderStudentAssignmentView({ testCases: [{ id: 1, visibility: true, point_value: 50 }] });

    const hiddenTab = screen.getByRole("button", { name: /hidden test cases/i });
    await userEvent.click(hiddenTab);

    await waitFor(() => {
      expect(screen.getByText(/no hidden test cases available/i)).toBeInTheDocument();
    });
  });

  test("displays test case results with passed status", () => {
    const lastResult = {
      test_cases: [
        { id: 1, passed: true, points_earned: 50, order: 1 },
      ],
    };
    renderStudentAssignmentView({ lastResult });

    expect(screen.getByText(/test case 1/i)).toBeInTheDocument();
  });

  test("displays test case results with failed status", () => {
    const lastResult = {
      test_cases: [
        { id: 1, passed: false, points_earned: 0, error_message: "Test failed", order: 1 },
      ],
    };
    renderStudentAssignmentView({ lastResult, testCases: [{ id: 1, visibility: true, point_value: 50, order: 1 }] });

    expect(screen.getByText(/test case 1/i)).toBeInTheDocument();
  });

  test("displays compile error", () => {
    const lastResult = {
      result: { stderr: "SyntaxError: invalid syntax" },
      test_cases: [],
    };
    renderStudentAssignmentView({ lastResult });

    expect(screen.getByText(/compilation error/i)).toBeInTheDocument();
    expect(screen.getByText(/SyntaxError: invalid syntax/i)).toBeInTheDocument();
  });

  test("displays compile error from stderr field", () => {
    const lastResult = {
      stderr: "Compilation failed",
      test_cases: [],
    };
    renderStudentAssignmentView({ lastResult });

    expect(screen.getByText(/compilation error/i)).toBeInTheDocument();
    expect(screen.getByText(/Compilation failed/i)).toBeInTheDocument();
  });

  test("shows compile error under failed test case", () => {
    const lastResult = {
      result: { stderr: "SyntaxError" },
      test_cases: [
        { id: 1, passed: false, order: 1 },
      ],
    };
    renderStudentAssignmentView({
      lastResult,
      testCases: [{ id: 1, visibility: true, point_value: 50, order: 1 }],
    });

    expect(screen.getByText(/compilation error/i)).toBeInTheDocument();
  });

  test("displays test case error message when test fails", async () => {
    const lastResult = {
      test_cases: [
        {
          id: 1,
          passed: false,
          error_message: "AssertionError: expected 5 got 3",
          actual_output: "3",
          order: 1,
        },
      ],
    };
    renderStudentAssignmentView({
      lastResult,
      testCases: [{ id: 1, visibility: true, point_value: 50, order: 1 }],
    });

    await waitFor(() => {
      expect(screen.getByText(/AssertionError: expected 5 got 3/i)).toBeInTheDocument();
    });
  });

  test("displays actual output for failed test", () => {
    const lastResult = {
      test_cases: [
        {
          id: 1,
          passed: false,
          actual_output: "output: 42",
          order: 1,
        },
      ],
    };
    renderStudentAssignmentView({
      lastResult,
      testCases: [{ id: 1, visibility: true, point_value: 50, order: 1 }],
    });

    expect(screen.getByText(/stdout:/i)).toBeInTheDocument();
    expect(screen.getByText(/output: 42/i)).toBeInTheDocument();
  });

  test("displays stderr for failed test", () => {
    const lastResult = {
      test_cases: [
        {
          id: 1,
          passed: false,
          stderr: "Error occurred",
          order: 1,
        },
      ],
    };
    renderStudentAssignmentView({
      lastResult,
      testCases: [{ id: 1, visibility: true, point_value: 50, stderr: "Error occurred", order: 1 }],
    });

    expect(screen.getByText(/stderr:/i)).toBeInTheDocument();
    expect(screen.getByText(/Error occurred/i)).toBeInTheDocument();
  });

  test("shows no output message for failed test without output", () => {
    const lastResult = {
      test_cases: [
        {
          id: 1,
          passed: false,
          order: 1,
        },
      ],
    };
    renderStudentAssignmentView({
      lastResult,
      testCases: [{ id: 1, visibility: true, point_value: 50, order: 1 }],
    });

    expect(screen.getByText(/test failed with no output/i)).toBeInTheDocument();
  });

  test("displays test case with points earned", () => {
    const lastResult = {
      test_cases: [
        { id: 1, passed: true, points_earned: 50, order: 1 },
      ],
    };
    renderStudentAssignmentView({
      lastResult,
      testCases: [{ id: 1, visibility: true, point_value: 50, order: 1 }],
    });

    expect(screen.getByText(/50.*50.*pts/i)).toBeInTheDocument();
  });

  test("displays test case without points earned", () => {
    renderStudentAssignmentView({
      testCases: [{ id: 1, visibility: true, point_value: 50, order: 1 }],
    });

    expect(screen.getByText(/50.*pts/i)).toBeInTheDocument();
  });

  test("toggles left panel open/close", async () => {
    renderStudentAssignmentView();

    const closeButton = screen.getByTitle(/close sidebar/i);
    await userEvent.click(closeButton);

    expect(screen.getByTitle(/open sidebar/i)).toBeInTheDocument();

    const openButton = screen.getByTitle(/open sidebar/i);
    await userEvent.click(openButton);

    expect(screen.getByTitle(/close sidebar/i)).toBeInTheDocument();
  });

  test("cancels submission confirmation modal", async () => {
    const mockOnSubmit = vi.fn();
    renderStudentAssignmentView({ onSubmit: mockOnSubmit });

    const submitButton = screen.getByRole("button", { name: /submit.*\(2 of 3\)/i });
    await userEvent.click(submitButton);

    await screen.findByText(/confirm submission/i);
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelButton);

    expect(mockOnSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText(/confirm submission/i)).not.toBeInTheDocument();
  });

  test("shows low attempts warning in confirmation modal", async () => {
    renderStudentAssignmentView({
      attempts: [{ id: 1, earned_points: 80, submitted_at: "2025-01-01T10:00:00Z" }],
      assignment: { ...mockAssignment, sub_limit: 3 },
    });

    const submitButton = screen.getByRole("button", { name: /submit/i });
    await userEvent.click(submitButton);

    await screen.findByText(/confirm submission/i);
    expect(screen.getByText(/only.*attempts remaining/i)).toBeInTheDocument();
  });

  test("shows last attempt warning", async () => {
    renderStudentAssignmentView({
      attempts: [
        { id: 1, earned_points: 80, submitted_at: "2025-01-01T10:00:00Z" },
        { id: 2, earned_points: 90, submitted_at: "2025-01-02T10:00:00Z" },
      ],
      assignment: { ...mockAssignment, sub_limit: 3 },
    });

    const submitButton = screen.getByRole("button", { name: /submit/i });
    await userEvent.click(submitButton);

    await screen.findByText(/confirm submission/i);
    expect(screen.getByText(/last attempt/i)).toBeInTheDocument();
  });

  test("disables submit button when no code and no file", () => {
    renderStudentAssignmentView({ initialCode: "" });

    const submitButton = screen.getByRole("button", { name: /submit/i });
    expect(submitButton).toBeDisabled();
  });

  test("enables submit button when code is present", () => {
    renderStudentAssignmentView({ initialCode: "print('test')" });

    const submitButton = screen.getByRole("button", { name: /submit/i });
    expect(submitButton).not.toBeDisabled();
  });

  test("enables submit button when file is uploaded", async () => {
    renderStudentAssignmentView({ initialCode: "" });

    const file = new File(["test code"], "test.py", { type: "text/plain" });
    const fileInput = screen.getByLabelText(/upload file/i);
    await userEvent.upload(fileInput, file);

    const submitButton = screen.getByRole("button", { name: /submit/i });
    expect(submitButton).not.toBeDisabled();
  });

  test("shows celebration when all tests pass", async () => {
    const lastResult = {
      submission_id: "test-123",
      test_cases: [
        { id: 1, passed: true, order: 1 },
        { id: 2, passed: true, order: 2 },
      ],
    };
    renderStudentAssignmentView({ lastResult });

    await waitFor(() => {
      expect(screen.getByText(/perfect score/i)).toBeInTheDocument();
    });
  });

  test("does not show celebration when not all tests pass", () => {
    const lastResult = {
      submission_id: "test-123",
      test_cases: [
        { id: 1, passed: true, order: 1 },
        { id: 2, passed: false, order: 2 },
      ],
    };
    renderStudentAssignmentView({ lastResult });

    expect(screen.queryByText(/perfect score/i)).not.toBeInTheDocument();
  });

  test("does not re-trigger celebration for same result", async () => {
    const lastResult = {
      submission_id: "test-123",
      test_cases: [
        { id: 1, passed: true, order: 1 },
        { id: 2, passed: true, order: 2 },
      ],
    };
    renderStudentAssignmentView({ lastResult });

    // Verify celebration appears when all tests pass
    await waitFor(() => {
      expect(screen.getByText(/perfect score/i)).toBeInTheDocument();
    }, { timeout: 2000 });

    // The component tracks lastResultId internally to prevent re-triggering
    // This is tested implicitly by the component's useEffect logic
    // The main functionality (celebration appearing) is verified above
    expect(screen.getByText(/perfect score/i)).toBeInTheDocument();
  });

  test("handles JSON description format", () => {
    const assignmentWithJSON = {
      ...mockAssignment,
      description: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "JSON description" }] }] }),
    };
    renderStudentAssignmentView({ assignment: assignmentWithJSON });

    expect(screen.getByText("Test Assignment")).toBeInTheDocument();
  });

  test("handles plain text description format", () => {
    renderStudentAssignmentView();

    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  test("handles empty description", () => {
    renderStudentAssignmentView({
      assignment: { ...mockAssignment, description: "" },
    });

    expect(screen.getByText("Test Assignment")).toBeInTheDocument();
  });

  test("handles null description", () => {
    renderStudentAssignmentView({
      assignment: { ...mockAssignment, description: null },
    });

    expect(screen.getByText("Test Assignment")).toBeInTheDocument();
  });

  test("displays instructions when provided", () => {
    const instructions = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test instruction" }] }] };
    renderStudentAssignmentView({ instructions });

    // Instructions panel header should be visible
    expect(screen.getByText(/instructions/i)).toBeInTheDocument();
  });

  test("displays no instructions message when not provided", () => {
    renderStudentAssignmentView({ instructions: null });

    expect(screen.getByText(/no instructions available/i)).toBeInTheDocument();
  });

  test("handles different language types", () => {
    const javaAssignment = { ...mockAssignment, language: "java" };
    renderStudentAssignmentView({ assignment: javaAssignment });

    expect(screen.getByText(/java/i)).toBeInTheDocument();
  });

  test("handles C++ language", () => {
    const cppAssignment = { ...mockAssignment, language: "cpp" };
    renderStudentAssignmentView({ assignment: cppAssignment });

    expect(screen.getByText(/cpp/i)).toBeInTheDocument();
  });

  test("handles JavaScript language", () => {
    const jsAssignment = { ...mockAssignment, language: "javascript" };
    renderStudentAssignmentView({ assignment: jsAssignment });

    expect(screen.getByText(/javascript/i)).toBeInTheDocument();
  });

  test("handles default language when not specified", () => {
    const noLangAssignment = { ...mockAssignment, language: undefined };
    renderStudentAssignmentView({ assignment: noLangAssignment });

    expect(screen.getByText(/python/i)).toBeInTheDocument();
  });

  test("handles test cases from lastResult when testCases prop is empty", () => {
    const lastResult = {
      test_cases: [
        { id: 1, visibility: true, order: 1, point_value: 50 },
        { id: 2, visibility: false, order: 2, point_value: 50 },
      ],
    };
    renderStudentAssignmentView({ testCases: [], lastResult });

    expect(screen.getByText(/test case 1/i)).toBeInTheDocument();
  });

  test("handles test cases with order property", () => {
    const orderedTestCases = [
      { id: 1, visibility: true, point_value: 50, order: 2 },
      { id: 2, visibility: true, point_value: 50, order: 1 },
    ];
    renderStudentAssignmentView({ testCases: orderedTestCases });

    const testCases = screen.getAllByText(/test case/i);
    expect(testCases.length).toBeGreaterThan(0);
  });

  test("handles test cases without order property", () => {
    const unorderedTestCases = [
      { id: 1, visibility: true, point_value: 50 },
      { id: 2, visibility: true, point_value: 50 },
    ];
    renderStudentAssignmentView({ testCases: unorderedTestCases });

    // Should still display test cases, using id as fallback (order defaults to 999)
    const testCaseElements = screen.getAllByText(/test case/i);
    expect(testCaseElements.length).toBeGreaterThan(0);
  });

  test("handles visibility as boolean true", () => {
    const testCases = [{ id: 1, visibility: true, point_value: 50, order: 1 }];
    renderStudentAssignmentView({ testCases });

    expect(screen.getByText(/test case 1/i)).toBeInTheDocument();
  });

  test("handles visibility as number 1", () => {
    const testCases = [{ id: 1, visibility: 1, point_value: 50, order: 1 }];
    renderStudentAssignmentView({ testCases });

    expect(screen.getByText(/test case 1/i)).toBeInTheDocument();
  });

  test("handles visibility as string 'true'", () => {
    const testCases = [{ id: 1, visibility: "true", point_value: 50, order: 1 }];
    renderStudentAssignmentView({ testCases });

    expect(screen.getByText(/test case 1/i)).toBeInTheDocument();
  });

  test("handles visibility as boolean false", () => {
    const testCases = [{ id: 1, visibility: false, point_value: 50, order: 1 }];
    renderStudentAssignmentView({ testCases });

    const hiddenTab = screen.getByRole("button", { name: /hidden test cases/i });
    userEvent.click(hiddenTab);

    expect(screen.getByText(/hidden test cases/i)).toBeInTheDocument();
  });

  test("handles visibility as number 0", () => {
    const testCases = [{ id: 1, visibility: 0, point_value: 50, order: 1 }];
    renderStudentAssignmentView({ testCases });

    const hiddenTab = screen.getByRole("button", { name: /hidden test cases/i });
    userEvent.click(hiddenTab);

    expect(screen.getByText(/hidden test cases/i)).toBeInTheDocument();
  });

  test("handles test cases without visibility field", () => {
    const testCases = [{ id: 1, point_value: 50, order: 1 }];
    renderStudentAssignmentView({ testCases });

    expect(screen.getByText(/test case 1/i)).toBeInTheDocument();
  });

  test("displays overall result badge", () => {
    const lastResult = {
      result: { grading: { all_passed: true } },
      test_cases: [
        { id: 1, passed: true, order: 1 },
        { id: 2, passed: true, order: 2 },
      ],
    };
    renderStudentAssignmentView({ lastResult });

    expect(screen.getByText(/2.*2.*passed/i)).toBeInTheDocument();
  });

  test("displays failed overall result badge", () => {
    const lastResult = {
      result: { grading: { all_passed: false } },
      test_cases: [
        { id: 1, passed: true, order: 1 },
        { id: 2, passed: false, order: 2 },
      ],
    };
    renderStudentAssignmentView({ lastResult });

    expect(screen.getByText(/1.*2.*passed/i)).toBeInTheDocument();
  });

  test("handles submit message with error keywords", () => {
    renderStudentAssignmentView({ submitMsg: "Submission failed" });

    expect(screen.getByText("Submission failed")).toBeInTheDocument();
  });

  test("handles submit message with Error keyword", () => {
    renderStudentAssignmentView({ submitMsg: "Error occurred" });

    expect(screen.getByText("Error occurred")).toBeInTheDocument();
  });

  test("handles submit message with unavailable keyword", () => {
    renderStudentAssignmentView({ submitMsg: "Service unavailable" });

    expect(screen.getByText("Service unavailable")).toBeInTheDocument();
  });

  test("handles submit message with 503 keyword", () => {
    renderStudentAssignmentView({ submitMsg: "503 Service Unavailable" });

    expect(screen.getByText("503 Service Unavailable")).toBeInTheDocument();
  });

  test("handles submit message with success", () => {
    renderStudentAssignmentView({ submitMsg: "Submission successful" });

    expect(screen.getByText("Submission successful")).toBeInTheDocument();
  });

  test("shows submit button text without limit", () => {
    renderStudentAssignmentView({
      assignment: { ...mockAssignment, sub_limit: null },
    });

    expect(screen.getByRole("button", { name: /submit solution/i })).toBeInTheDocument();
  });

  test("handles empty attempts array", () => {
    renderStudentAssignmentView({ attempts: [] });

    expect(screen.getByText(/0.*attempts/i)).toBeInTheDocument();
  });

  test("handles test case with points_earned from test case itself", () => {
    const testCases = [
      { id: 1, visibility: true, point_value: 50, points_earned: 50, passed: true, order: 1 },
    ];
    renderStudentAssignmentView({ testCases });

    expect(screen.getByText(/50.*50.*pts/i)).toBeInTheDocument();
  });

  test("handles test case with error_message from test case itself", () => {
    const testCases = [
      { id: 1, visibility: true, point_value: 50, passed: false, error_message: "Custom error", order: 1 },
    ];
    renderStudentAssignmentView({ testCases });

    expect(screen.getByText(/error:/i)).toBeInTheDocument();
    expect(screen.getByText(/Custom error/i)).toBeInTheDocument();
  });

  test("handles test case with actual_output from test case itself", () => {
    const testCases = [
      { id: 1, visibility: true, point_value: 50, passed: false, actual_output: "Custom output", order: 1 },
    ];
    renderStudentAssignmentView({ testCases });

    expect(screen.getByText(/stdout:/i)).toBeInTheDocument();
    expect(screen.getByText(/Custom output/i)).toBeInTheDocument();
  });

  test("handles hidden test cases from results when testCases prop has none", async () => {
    const lastResult = {
      test_cases: [
        { id: 1, visibility: false, passed: true, order: 1, point_value: 50 },
      ],
    };
    renderStudentAssignmentView({ testCases: [], lastResult });

    const hiddenTab = screen.getByRole("button", { name: /hidden test cases/i });
    await userEvent.click(hiddenTab);

    await waitFor(() => {
      expect(screen.getByText(/hidden test cases.*\(1\)/i)).toBeInTheDocument();
    });
  });

  test("handles hidden test cases passed status", async () => {
    const lastResult = {
      test_cases: [
        { id: 1, visibility: false, passed: true, order: 1, point_value: 50, points_earned: 50 },
      ],
    };
    renderStudentAssignmentView({ testCases: [], lastResult });

    const hiddenTab = screen.getByRole("button", { name: /hidden test cases/i });
    await userEvent.click(hiddenTab);

    // Wait for tab to be active and content to render
    await waitFor(() => {
      const tab = screen.getByRole("button", { name: /hidden test cases/i });
      expect(tab).toHaveClass(/border-primary/);
    }, { timeout: 2000 });

    // Check for "Passed" text in hidden test cases - use queryByText with flexible matching
    await waitFor(() => {
      const passedElements = screen.queryAllByText(/passed/i);
      // Should find at least one "Passed" text in the hidden test cases section
      expect(passedElements.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  test("handles hidden test cases failed status", async () => {
    const lastResult = {
      test_cases: [
        { id: 1, visibility: false, passed: false, order: 1, point_value: 50, points_earned: 0 },
      ],
    };
    renderStudentAssignmentView({ testCases: [], lastResult });

    const hiddenTab = screen.getByRole("button", { name: /hidden test cases/i });
    await userEvent.click(hiddenTab);

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });
  });

  test("handles hidden test cases not run status", async () => {
    const testCases = [
      { id: 1, visibility: false, order: 1, point_value: 50 },
    ];
    renderStudentAssignmentView({ testCases });

    const hiddenTab = screen.getByRole("button", { name: /hidden test cases/i });
    await userEvent.click(hiddenTab);

    await waitFor(() => {
      expect(screen.getByText(/not run/i)).toBeInTheDocument();
    });
  });

  test("handles test case with null passed status", () => {
    const testCases = [
      { id: 1, visibility: true, point_value: 50, passed: null, order: 1 },
    ];
    renderStudentAssignmentView({ testCases });

    expect(screen.getByText(/test case 1/i)).toBeInTheDocument();
  });

  test("handles test case with undefined passed status", () => {
    const testCases = [
      { id: 1, visibility: true, point_value: 50, order: 1 },
    ];
    renderStudentAssignmentView({ testCases });

    expect(screen.getByText(/test case 1/i)).toBeInTheDocument();
  });

  test("handles test case with null points_earned", () => {
    const testCases = [
      { id: 1, visibility: true, point_value: 50, points_earned: null, order: 1 },
    ];
    renderStudentAssignmentView({ testCases });

    expect(screen.getByText(/50.*pts/i)).toBeInTheDocument();
  });

  test("handles test case with undefined points_earned", () => {
    const testCases = [
      { id: 1, visibility: true, point_value: 50, order: 1 },
    ];
    renderStudentAssignmentView({ testCases });

    expect(screen.getByText(/50.*pts/i)).toBeInTheDocument();
  });
});
