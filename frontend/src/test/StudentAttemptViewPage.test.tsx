import React from "react";
import { Route, Routes } from "react-router-dom";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import StudentAttemptViewPage from "../webpages/StudentAttemptViewPage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";
import { resetDb } from "./handlers";

describe("StudentAttemptViewPage", () => {
  beforeEach(() => resetDb());

  const renderComponent = (assignmentId = "9001", submissionId = "1001") =>
    renderWithProviders(
      <Routes>
        <Route
          path="/assignments/:assignment_id/submissions/:submission_id"
          element={<StudentAttemptViewPage />}
        />
      </Routes>,
      {
        route: `/assignments/${assignmentId}/submissions/${submissionId}`,
        auth: { role: "faculty", userId: "301" }
      }
    );

  test("renders loading state initially", () => {
    renderComponent();

    expect(screen.getByText("Loading submission...")).toBeInTheDocument();
  });

  test("renders error state when API fails", async () => {
    // Override handler to return error
    server.use(
      http.get("**/api/v1/assignments/:assignment_id/submission-detail/:submission_id", () => {
        return HttpResponse.json({ detail: "Submission not found" }, { status: 404 });
      })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Submission not found/)).toBeInTheDocument();
    });
  });

  test("renders submission data successfully", async () => {
    renderComponent();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /submission view/i })).toBeInTheDocument();
    });

    // Check basic info
    expect(screen.getByRole("heading", { name: /submission view/i })).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByText("85/100")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();

    // Check assignment selector
    const assignmentSelect = screen.getByDisplayValue("Python Assignment 1");
    expect(assignmentSelect).toBeInTheDocument();

    // Check student selector
    const studentSelect = screen.getByDisplayValue("student1");
    expect(studentSelect).toBeInTheDocument();

    // Check that we have the expected number of selectors (assignment, student, attempt)
    const selectors = screen.getAllByRole("combobox");
    expect(selectors).toHaveLength(3);
  });

  test("shows download button and navigation controls", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /download code/i })).toBeInTheDocument();
    });

    // Check navigation buttons
    expect(screen.getByRole("button", { name: /prev/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();

    // Check selectors exist
    expect(screen.getByDisplayValue("Python Assignment 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("student1")).toBeInTheDocument();
  });

  test("displays code editor with correct language", async () => {
    renderComponent();

    await waitFor(() => {
      // Check that editor container exists (Monaco editor is hard to test directly)
      expect(screen.getByText("Submitted Code")).toBeInTheDocument();
      expect(screen.getByText("python")).toBeInTheDocument();
      expect(screen.getByText("Read-only")).toBeInTheDocument();
    });
  });

  test("handles null grade values", async () => {
    // Override handler to return null grade
    server.use(
      http.get("**/api/v1/assignments/:assignment_id/submission-detail/:submission_id", ({ params }) => {
        const { assignment_id, submission_id } = params;
        if (assignment_id === "9001" && submission_id === "1001") {
          return HttpResponse.json({
            submission: {
              id: 1001,
              earned_points: null,
              code: "# Sample Python code\nprint('Hello, World!')\n",
              created_at: "2024-12-05T10:30:00Z",
            },
            student: {
              id: 201,
              username: "student1",
            },
            assignment: {
              id: 9001,
              title: "Python Assignment 1",
              language: "python",
              total_points: 100,
            },
            course: {
              id: 1,
              name: "Computer Science 101",
              course_code: "CS101",
            },
            course_assignments: [
              { id: 9001, title: "Python Assignment 1" },
            ],
            attempt_number: 1,
            total_attempts: 1,
            all_attempts: [
              { id: 1001, earned_points: null },
            ],
            students_with_attempts: [
              { id: 201, username: "student1" },
            ],
          });
        }
        return HttpResponse.json(null, { status: 404 });
      })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("—")).toBeInTheDocument(); // Null grade displays as em dash
    });
  });

  test("handles null created_at", async () => {
    // Override handler to return null created_at
    server.use(
      http.get("**/api/v1/assignments/:assignment_id/submission-detail/:submission_id", ({ params }) => {
        const { assignment_id, submission_id } = params;
        if (assignment_id === "9001" && submission_id === "1001") {
          return HttpResponse.json({
            submission: {
              id: 1001,
              earned_points: 85,
              code: "# Sample Python code\nprint('Hello, World!')\n",
              created_at: null,
            },
            student: {
              id: 201,
              username: "student1",
            },
            assignment: {
              id: 9001,
              title: "Python Assignment 1",
              language: "python",
              total_points: 100,
            },
            course: {
              id: 1,
              name: "Computer Science 101",
              course_code: "CS101",
            },
            course_assignments: [
              { id: 9001, title: "Python Assignment 1" },
            ],
            attempt_number: 1,
            total_attempts: 1,
            all_attempts: [
              { id: 1001, earned_points: 85 },
            ],
            students_with_attempts: [
              { id: 201, username: "student1" },
            ],
          });
        }
        return HttpResponse.json(null, { status: 404 });
      })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("—")).toBeInTheDocument(); // Null date displays as em dash
    });
  });

  test("handles different programming languages", async () => {
    // Test various languages
    const languages = ["python", "java", "cpp", "javascript"];

    for (const lang of languages) {
      server.use(
        http.get("**/api/v1/assignments/:assignment_id/submission-detail/:submission_id", ({ params }) => {
          const { assignment_id, submission_id } = params;
          if (assignment_id === "9001" && submission_id === "1001") {
            return HttpResponse.json({
              submission: {
                id: 1001,
                earned_points: 85,
                code: "# Sample code\n",
                created_at: "2024-12-05T10:30:00Z",
              },
              student: {
                id: 201,
                username: "student1",
              },
              assignment: {
                id: 9001,
                title: `Test Assignment`,
                language: lang,
                total_points: 100,
              },
              course: {
                id: 1,
                name: "Test Course",
                course_code: "TEST",
              },
              course_assignments: [
                { id: 9001, title: "Test Assignment" },
              ],
              attempt_number: 1,
              total_attempts: 1,
              all_attempts: [
                { id: 1001, earned_points: 85 },
              ],
              students_with_attempts: [
                { id: 201, username: "student1" },
              ],
            });
          }
          return HttpResponse.json(null, { status: 404 });
        })
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(lang)).toBeInTheDocument();
      });
    }
  });

  test("handles navigation between attempts", async () => {
    // Test with multiple attempts to enable navigation
    server.use(
      http.get("**/api/v1/assignments/:assignment_id/submission-detail/:submission_id", ({ params }) => {
        const { assignment_id, submission_id } = params;
        if (assignment_id === "9001" && submission_id === "1001") {
          return HttpResponse.json({
            submission: {
              id: 1001,
              earned_points: 85,
              code: "# Sample code\n",
              created_at: "2024-12-05T10:30:00Z",
            },
            student: {
              id: 201,
              username: "student1",
            },
            assignment: {
              id: 9001,
              title: "Test Assignment",
              language: "python",
              total_points: 100,
            },
            course: {
              id: 1,
              name: "Test Course",
              course_code: "TEST",
            },
            course_assignments: [
              { id: 9001, title: "Test Assignment" },
            ],
            attempt_number: 2, // Second attempt
            total_attempts: 3,
            all_attempts: [
              { id: 1000, earned_points: 75 },
              { id: 1001, earned_points: 85 },
              { id: 1002, earned_points: 92 },
            ],
            students_with_attempts: [
              { id: 201, username: "student1" },
            ],
          });
        }
        return HttpResponse.json(null, { status: 404 });
      })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("2 of 3")).toBeInTheDocument();
    });

    // Check that both prev and next buttons are enabled
    const prevButton = screen.getByRole("button", { name: /prev/i });
    const nextButton = screen.getByRole("button", { name: /next/i });

    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  test("disables prev button on first attempt", async () => {
    // Test with first attempt
    server.use(
      http.get("**/api/v1/assignments/:assignment_id/submission-detail/:submission_id", ({ params }) => {
        const { assignment_id, submission_id } = params;
        if (assignment_id === "9001" && submission_id === "1001") {
          return HttpResponse.json({
            submission: {
              id: 1001,
              earned_points: 85,
              code: "# Sample code\n",
              created_at: "2024-12-05T10:30:00Z",
            },
            student: {
              id: 201,
              username: "student1",
            },
            assignment: {
              id: 9001,
              title: "Test Assignment",
              language: "python",
              total_points: 100,
            },
            course: {
              id: 1,
              name: "Test Course",
              course_code: "TEST",
            },
            course_assignments: [
              { id: 9001, title: "Test Assignment" },
            ],
            attempt_number: 1, // First attempt
            total_attempts: 3,
            all_attempts: [
              { id: 1001, earned_points: 85 },
              { id: 1002, earned_points: 92 },
              { id: 1003, earned_points: 95 },
            ],
            students_with_attempts: [
              { id: 201, username: "student1" },
            ],
          });
        }
        return HttpResponse.json(null, { status: 404 });
      })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("1 of 3")).toBeInTheDocument();
    });

    // Check that prev button is disabled and next is enabled
    const prevButton = screen.getByRole("button", { name: /prev/i });
    const nextButton = screen.getByRole("button", { name: /next/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  test("handles course with null course_code", async () => {
    // Test course display when course_code is null
    server.use(
      http.get("**/api/v1/assignments/:assignment_id/submission-detail/:submission_id", ({ params }) => {
        const { assignment_id, submission_id } = params;
        if (assignment_id === "9001" && submission_id === "1001") {
          return HttpResponse.json({
            submission: {
              id: 1001,
              earned_points: 85,
              code: "# Sample code\n",
              created_at: "2024-12-05T10:30:00Z",
            },
            student: {
              id: 201,
              username: "student1",
            },
            assignment: {
              id: 9001,
              title: "Test Assignment",
              language: "python",
              total_points: 100,
            },
            course: {
              id: 1,
              name: "Test Course",
              course_code: null, // Null course code
            },
            course_assignments: [
              { id: 9001, title: "Test Assignment" },
            ],
            attempt_number: 1,
            total_attempts: 1,
            all_attempts: [
              { id: 1001, earned_points: 85 },
            ],
            students_with_attempts: [
              { id: 201, username: "student1" },
            ],
          });
        }
        return HttpResponse.json(null, { status: 404 });
      })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /submission view – test course/i })).toBeInTheDocument();
    });
  });

  test("calculates grade percentage correctly", async () => {
    // Test grade percentage calculation
    server.use(
      http.get("**/api/v1/assignments/:assignment_id/submission-detail/:submission_id", ({ params }) => {
        const { assignment_id, submission_id } = params;
        if (assignment_id === "9001" && submission_id === "1001") {
          return HttpResponse.json({
            submission: {
              id: 1001,
              earned_points: 75, // 75% of 100
              code: "# Sample code\n",
              created_at: "2024-12-05T10:30:00Z",
            },
            student: {
              id: 201,
              username: "student1",
            },
            assignment: {
              id: 9001,
              title: "Test Assignment",
              language: "python",
              total_points: 100,
            },
            course: {
              id: 1,
              name: "Test Course",
              course_code: "TEST",
            },
            course_assignments: [
              { id: 9001, title: "Test Assignment" },
            ],
            attempt_number: 1,
            total_attempts: 1,
            all_attempts: [
              { id: 1001, earned_points: 75 },
            ],
            students_with_attempts: [
              { id: 201, username: "student1" },
            ],
          });
        }
        return HttpResponse.json(null, { status: 404 });
      })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("75/100")).toBeInTheDocument();
      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    // Check that it shows success badge for 75%
    const badge = screen.getByText("75%");
    expect(badge).toBeInTheDocument();
  });

  test("handles student selection change", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("student1")).toBeInTheDocument();
    });

    // Mock the API call for student change
    server.use(
      http.get("**/api/v1/assignments/:assignment_id/students/:student_id/attempts", ({ params }) => {
        const { assignment_id, student_id } = params;
        if (assignment_id === "9001" && student_id === "202") {
          return HttpResponse.json([
            { id: 2001, earned_points: 90, created_at: "2024-12-06T10:30:00Z" },
          ]);
        }
        return HttpResponse.json([]);
      })
    );

    // Change student selection
    const studentSelect = screen.getByDisplayValue("student1");
    fireEvent.change(studentSelect, { target: { value: "202" } });

    // The component should make API calls to load new student's attempts
    await waitFor(() => {
      expect(studentSelect).toHaveValue("202");
    });
  });

  test("shows all navigation selectors", async () => {
    renderComponent();

    await waitFor(() => {
      // Check that assignment and student selectors have the correct selected values
      const assignmentSelect = document.getElementById("assignment-select") as HTMLSelectElement;
      const studentSelect = document.getElementById("student-select") as HTMLSelectElement;
      expect(assignmentSelect).toHaveValue("9001");
      expect(studentSelect).toHaveValue("201");
    });

    // Check that we have all three selectors
    const selectors = screen.getAllByRole("combobox");
    expect(selectors).toHaveLength(3);

    // Check labels exist
    expect(screen.getByText("Assignment:")).toBeInTheDocument();
    expect(screen.getByText("Student:")).toBeInTheDocument();
    expect(screen.getByText("Attempt:")).toBeInTheDocument();
  });
});
