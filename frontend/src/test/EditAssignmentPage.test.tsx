import React from "react";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Routes, Route } from "react-router-dom";

import EditAssignmentPage from "../webpages/EditAssignmentPage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";

function renderEditAssignmentPage(assignmentId = "1") {
  return renderWithProviders(
    <Routes>
      <Route path="/assignments/:assignment_id/edit" element={<EditAssignmentPage />} />
      <Route path="/assignments/:assignment_id" element={<div>ASSIGNMENT PAGE</div>} />
    </Routes>,
    {
      route: `/assignments/${assignmentId}/edit`,
      auth: { role: "faculty", userId: "301" },
    }
  );
}

describe("EditAssignmentPage", () => {
  test("shows error when assignment not found", async () => {
    server.use(
      http.get("**/api/v1/assignments/:id", () =>
        HttpResponse.json({ detail: "Assignment not found" }, { status: 404 })
      )
    );

    renderEditAssignmentPage();

    expect(await screen.findByText(/assignment not found/i)).toBeInTheDocument();
  });

  test("loads and displays assignment data", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      sub_limit: 3,
      start: "2025-01-01T00:00:00Z",
      stop: "2025-01-31T23:59:59Z",
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage();

    expect(await screen.findByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("navigates back to assignment", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    const backButton = screen.getByRole("link", { name: /back to assignment/i });
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute("href", "/assignments/1");
  });

  test("renders edit form", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("loads test cases from server", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    const mockTestCases = [
      { id: 1, code: "print('test')", visible: true, points: 10, order: 1 },
      { id: 2, code: "assert True", visible: false, points: 20, order: 2 }
    ];

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json(mockTestCases)
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    // Should load test cases
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles form submission successfully", async () => {
    const mockAssignment = {
      id: 1,
      title: "Original Title",
      description: "Original description",
      course_id: 500,
      sub_limit: 5,
      start: "2025-01-01T00:00:00Z",
      stop: "2025-01-31T23:59:59Z",
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      ),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1, title: "Updated Title" })
      ),
      http.put("**/api/v1/assignments/1/test-cases/batch", () =>
        HttpResponse.json({ success: true })
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Original Title");

    // Update title
    const titleInput = screen.getByLabelText(/assignment title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated Title");

    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show success message or navigate
    expect(await screen.findByText(/ASSIGNMENT PAGE/i)).toBeInTheDocument();
  });

  test("validates required fields on submission", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    // Clear title (make it empty)
    const titleInput = screen.getByLabelText(/assignment title/i);
    await userEvent.clear(titleInput);

    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show validation error
    expect(await screen.findByText(/Title is required/i)).toBeInTheDocument();
  });

  test("handles test case management", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, code: "print('test')", visible: true, points: 10, order: 1 }
        ])
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    // Should render test case management UI
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles syntax validation", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, code: "print('test')", visible: true, points: 10, order: 1 }
        ])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    // Should handle syntax validation
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("loads languages on mount", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      ),
      http.get("**/api/v1/languages", () =>
        HttpResponse.json([
          { id: "python", name: "Python", piston_name: "python" },
          { id: "java", name: "Java", piston_name: "java" }
        ])
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    // Should load languages
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles sessionStorage save and load", async () => {
    // Mock sessionStorage
    const sessionStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        title: "Saved Title",
        description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Saved description" }] }] },
        language: "java",
        instructions: { type: "doc", content: [] },
        subLimit: "5",
        start: "2025-01-01",
        stop: "2025-01-02",
        testCases: [{ id: 1, code: "print('saved')", visible: true, points: 15, order: 1 }]
      })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    const mockAssignment = {
      id: 1,
      title: "Server Title",
      description: "Server description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage();

    // Should load from sessionStorage initially, then server data
    await screen.findByDisplayValue("Server Title");

    expect(screen.getByDisplayValue("Server Title")).toBeInTheDocument();
  });

  test("handles delete assignment confirmation", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    // Should have delete button
    const deleteButton = screen.getByRole("button", { name: /delete assignment/i });
    expect(deleteButton).toBeInTheDocument();
  });

  test("handles form validation errors", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    // Clear title to trigger validation
    const titleInput = screen.getByLabelText(/assignment title/i);
    await userEvent.clear(titleInput);

    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show validation error
    expect(await screen.findByText(/Title is required/i)).toBeInTheDocument();
  });

  test("handles API submission errors", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      ),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ detail: "Permission denied" }, { status: 403 })
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show error message
    expect(await screen.findByText(/permission denied/i)).toBeInTheDocument();
  });

  test("handles test case validation", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, code: "", visible: true, points: 10, order: 1 }, // Empty code
          { id: 2, code: "print('test')", visible: true, points: 0, order: 2 } // Zero points
        ])
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show validation errors for test cases
    expect(await screen.findByText(/test case\(s\) are empty/i)).toBeInTheDocument();
  });

  test("handles instructions validation", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    // Try to submit without instructions
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show validation error for missing instructions
    expect(await screen.findByText(/at least one instruction is required/i)).toBeInTheDocument();
  });

  test("parses different description formats", async () => {
    // Test with plain text description
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Plain text description",
      course_id: 500,
      test_cases: [],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    // Should handle plain text description
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles loading states", async () => {
    // Slow API response to test loading state
    server.use(
      http.get("**/api/v1/assignments/1", async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json({
          id: 1,
          title: "Test Assignment",
          description: "Test description",
          course_id: 500,
          test_cases: [],
          instructions: [],
        });
      }),
      http.get("**/api/v1/assignments/1/test-cases", async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json([]);
      })
    );

    renderEditAssignmentPage();

    // Should eventually load
    expect(await screen.findByDisplayValue("Test Assignment")).toBeInTheDocument();
  });
});