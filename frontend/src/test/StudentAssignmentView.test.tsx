import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import StudentAssignmentView from "../webpages/StudentAssignmentView";
import { renderWithProviders } from "./renderWithProviders";

const mockAssignment = {
  id: 1,
  title: "Test Assignment",
  description: "Test description",
  course_id: 500,
  sub_limit: 3,
};

const mockAttempts = [
  { id: 1, earned_points: 80, submitted_at: "2025-01-01T10:00:00Z" },
  { id: 2, earned_points: 90, submitted_at: "2025-01-02T10:00:00Z" },
];

const mockTestCases = [
  { id: 1, test_code: "test 1", point_value: 50, visibility: true },
  { id: 2, test_code: "test 2", point_value: 50, visibility: false },
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
  test("renders assignment title and description", () => {
    renderStudentAssignmentView();

    expect(screen.getByText("Test Assignment")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  test("displays attempt history", () => {
    renderStudentAssignmentView();

    expect(screen.getByText(/attempts/i)).toBeInTheDocument();
    expect(screen.getByText(/2.*3.*attempts/i)).toBeInTheDocument(); // "2 / 3 Attempts"
  });

  test("shows best grade", () => {
    renderStudentAssignmentView();

    expect(screen.getByText(/best:/i)).toBeInTheDocument();
    // The grade might be in a separate element, so check for it more flexibly
    expect(screen.getByText(/90.*100|Best:.*90.*100/i)).toBeInTheDocument();
  });

  test("renders code editor with initial code", () => {
    renderStudentAssignmentView();

    // Monaco editor might not be immediately available, check for editor container
    // The editor is rendered by Monaco, so we check for the presence of the editor component structure
    expect(screen.getByText(/source code/i)).toBeInTheDocument();
  });

  test("shows test cases tabs", () => {
    renderStudentAssignmentView();

    expect(screen.getByText("Visible Test Cases")).toBeInTheDocument();
    expect(screen.getByText("Hidden Test Cases")).toBeInTheDocument();
  });

  test("displays visible test cases", () => {
    renderStudentAssignmentView();

    expect(screen.getByText("test 1")).toBeInTheDocument();
    expect(screen.getByText(/50.*pts/i)).toBeInTheDocument(); // "50 pts" format
  });

  test("shows submission limit status", () => {
    renderStudentAssignmentView();

    expect(screen.getByText(/2.*3.*attempts/i)).toBeInTheDocument(); // "2 / 3 Attempts"
  });

  test("calls onSubmit when form is submitted", async () => {
    const mockOnSubmit = vi.fn();
    renderStudentAssignmentView({ onSubmit: mockOnSubmit });

    // Button text is "Submit (2 of 3)" when there's a limit
    const submitButton = screen.getByRole("button", { name: /submit.*\(2 of 3\)/i });
    await userEvent.click(submitButton);

    // The component shows a confirmation modal, wait for it and confirm
    // Modal should appear with "Submit Solution" or "Confirm Submission" button
    await screen.findByText(/confirm submission/i);
    const confirmButton = screen.getByRole("button", { name: /submit solution|submit anyway/i });
    await userEvent.click(confirmButton);

    expect(mockOnSubmit).toHaveBeenCalled();
  });

  test("shows loading state during submission", () => {
    renderStudentAssignmentView({ loading: true });

    expect(screen.getByText(/grading/i)).toBeInTheDocument(); // "Grading..."
  });

  test("displays submission message", () => {
    renderStudentAssignmentView({ submitMsg: "Submission successful!" });

    expect(screen.getByText("Submission successful!")).toBeInTheDocument();
  });

  test("shows limit reached message", () => {
    renderStudentAssignmentView({ limitReached: true });

    expect(screen.getByText(/limit reached/i)).toBeInTheDocument();
  });
});
