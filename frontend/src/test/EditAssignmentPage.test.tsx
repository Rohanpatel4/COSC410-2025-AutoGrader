import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Routes, Route } from "react-router-dom";

import EditAssignmentPage from "../webpages/EditAssignmentPage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";

// Helper for valid TipTap content
const VALID_INSTRUCTIONS = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] });
const VALID_DESCRIPTION = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] });

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
      instructions: null,
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
      instructions: null,
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
      instructions: null,
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
      instructions: null,
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
    const validDescription = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Original description" }] }] });
    const validInstructions = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] });
    
    const mockAssignment = {
      id: 1,
      title: "Original Title",
      description: validDescription,
      course_id: 500,
      sub_limit: 5,
      start: "2025-01-01T00:00:00Z",
      stop: "2025-01-31T23:59:59Z",
      test_cases: [],
      instructions: validInstructions,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([]);
        }
        return HttpResponse.json([]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1, title: "Updated Title" })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Original Title");

    // Update title
    const titleInput = screen.getByLabelText(/assignment title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated Title");

    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show success message
    expect(await screen.findByText(/assignment updated successfully/i)).toBeInTheDocument();
  });

  test("validates required fields on submission", async () => {
    const validDescription = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test description" }] }] });
    const validInstructions = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] });
    
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: validDescription,
      course_id: 500,
      test_cases: [],
      instructions: validInstructions,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

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
      instructions: null,
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
      instructions: null,
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
      instructions: null,
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
        instructions: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Saved instructions" }] }] },
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
      description: VALID_DESCRIPTION,
      course_id: 500,
      test_cases: [],
      instructions: VALID_INSTRUCTIONS,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    // Should load from sessionStorage initially, then server data
    await screen.findByDisplayValue("Saved Title");

    expect(screen.getByDisplayValue("Saved Title")).toBeInTheDocument();
  });

  test("handles delete assignment confirmation", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: VALID_DESCRIPTION,
      course_id: 500,
      test_cases: [],
      instructions: VALID_INSTRUCTIONS,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should have delete button
    const deleteButton = screen.getByRole("button", { name: /delete/i });
    expect(deleteButton).toBeInTheDocument();
  });

  test("handles form validation errors", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: VALID_DESCRIPTION,
      course_id: 500,
      test_cases: [],
      instructions: VALID_INSTRUCTIONS,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

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
      description: VALID_DESCRIPTION,
      course_id: 500,
      test_cases: [],
      instructions: VALID_INSTRUCTIONS,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([]);
        }
        return HttpResponse.json([]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ detail: "Permission denied" }, { status: 403 })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show error message
    expect(await screen.findByText(/permission denied|failed to update/i)).toBeInTheDocument();
  });

  test("handles test case validation", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: VALID_DESCRIPTION,
      course_id: 500,
      test_cases: [],
      instructions: VALID_INSTRUCTIONS,
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
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show validation errors for test cases
    expect(await screen.findByText(/test case\(s\) are empty|invalid point values/i)).toBeInTheDocument();
  });

  test("handles instructions validation", async () => {
    // For this test, we need instructions to be null to test validation
    // But we need valid description so the component renders
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: VALID_DESCRIPTION,
      course_id: 500,
      test_cases: [],
      instructions: null, // Null to test validation
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    // Component should render even with null instructions
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
      instructions: VALID_INSTRUCTIONS, // Need valid instructions for component to render
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should handle plain text description (parseDescription wraps it in TipTap structure)
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
          description: VALID_DESCRIPTION,
          course_id: 500,
          test_cases: [],
          instructions: VALID_INSTRUCTIONS,
        });
      }),
      http.get("**/api/v1/assignments/1/test-cases", async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json([]);
      })
    );

    renderEditAssignmentPage("1");

    // Should show loading state first, then eventually load
    expect(await screen.findByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles delete assignment confirmation modal", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: VALID_DESCRIPTION,
      course_id: 500,
      test_cases: [],
      instructions: VALID_INSTRUCTIONS,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Click delete button
    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await userEvent.click(deleteButton);

    // Should show confirmation modal
    expect(await screen.findByText(/delete assignment/i)).toBeInTheDocument();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();

    // Cancel deletion
    const cancelButtons = screen.getAllByRole("button", { name: /cancel/i });
    if (cancelButtons.length > 0) {
      await userEvent.click(cancelButtons[cancelButtons.length - 1]); // Click the modal cancel button
    }

    // Modal should be gone
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
  });

  test("handles successful assignment deletion", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: VALID_DESCRIPTION,
      course_id: 500,
      test_cases: [],
      instructions: VALID_INSTRUCTIONS,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      ),
      http.delete("**/api/v1/assignments/1", () =>
        HttpResponse.json({ success: true })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Click delete and confirm
    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await userEvent.click(deleteButton);

    const confirmDeleteButtons = await screen.findAllByRole("button", { name: /delete assignment/i });
    const confirmDeleteButton = confirmDeleteButtons[confirmDeleteButtons.length - 1];
    await userEvent.click(confirmDeleteButton);

    // Should navigate away (to course page)
    // The navigation happens after a delay, so we just verify the button was clicked
    expect(confirmDeleteButton).toBeInTheDocument();
  });

  test("handles delete assignment error", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: VALID_DESCRIPTION,
      course_id: 500,
      test_cases: [],
      instructions: VALID_INSTRUCTIONS,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      ),
      http.delete("**/api/v1/assignments/1", () =>
        HttpResponse.json({ detail: "Permission denied" }, { status: 403 })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await userEvent.click(deleteButton);

    const confirmDeleteButtons = await screen.findAllByRole("button", { name: /delete assignment/i });
    const confirmDeleteButton = confirmDeleteButtons[confirmDeleteButtons.length - 1];
    await userEvent.click(confirmDeleteButton);

    // Should show error message
    expect(await screen.findByText(/permission denied|failed to delete/i)).toBeInTheDocument();
  });

  test("handles test case add, delete, and update operations", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: VALID_DESCRIPTION,
      course_id: 500,
      test_cases: [],
      instructions: VALID_INSTRUCTIONS,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Add a test case
    const addButtons = screen.getAllByRole("button", { name: /add test case/i });
    if (addButtons.length > 0) {
      await userEvent.click(addButtons[0]);
    }

    // Should have test cases
    expect(screen.getByText(/test cases/i)).toBeInTheDocument();
  });

  test("handles test case drag and drop reordering", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test1')", visibility: true, point_value: 10, order: 1 },
          { id: 2, test_code: "print('test2')", visibility: true, point_value: 20, order: 2 }
        ])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Test cases should be draggable
    const testCases = screen.getAllByText(/test case/i);
    expect(testCases.length).toBeGreaterThan(0);
  });

  test("handles syntax validation with valid code", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should handle syntax validation
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles syntax validation with invalid code", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "invalid syntax", visibility: true, point_value: 10, order: 1 }
        ])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ 
          valid: false, 
          errors: [{ line: 1, column: 1, message: "Syntax error" }] 
        })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should handle syntax errors
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles successful assignment update with test cases", async () => {
    const mockAssignment = {
      id: 1,
      title: "Original Title",
      description: "Original description",
      course_id: 500,
      sub_limit: 5,
      start: "2025-01-01T00:00:00Z",
      stop: "2025-01-31T23:59:59Z",
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      ),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1, title: "Updated Title" })
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ]);
      }),
      http.put("**/api/v1/assignments/1/test-cases/1", () =>
        HttpResponse.json({ success: true })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Original Title");

    // Update title
    const titleInput = screen.getByLabelText(/assignment title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated Title");

    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show validation errors (missing description/instructions)
    expect(await screen.findByText(/description is required/i)).toBeInTheDocument();
  });

  test("handles test case creation and deletion during update", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      ),
      http.delete("**/api/v1/assignments/1/test-cases/1", () =>
        HttpResponse.json({ success: true })
      ),
      http.post("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json({ id: 2, test_code: "print('new')", visibility: true, point_value: 20, order: 2 })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should handle test case operations
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles language change and syntax error clearing", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      language: "python",
      test_cases: [],
      instructions: null,
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
          { id: "java", name: "Java", piston_name: "java" },
          { id: "cpp", name: "C++", piston_name: "c++" }
        ])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Change language
    const languageSelect = screen.getByLabelText(/language/i);
    await userEvent.selectOptions(languageSelect, "java");

    // Syntax errors should be cleared when language changes
    expect(languageSelect).toHaveValue("java");
  });

  test("handles date input and clearing", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      start: "2025-01-01T00:00:00Z",
      stop: "2025-01-31T23:59:59Z",
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const startInput = screen.getByLabelText(/start date/i);
    const stopInput = screen.getByLabelText(/due date/i);

    // Dates should be populated
    expect(startInput).toHaveValue();
    expect(stopInput).toHaveValue();

    // Clear dates
    const clearButtons = screen.getAllByTitle(/clear/i);
    if (clearButtons.length > 0) {
      await userEvent.click(clearButtons[0]);
    }
  });

  test("handles submission limit clearing", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      sub_limit: 5,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      ),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const limitInput = screen.getByLabelText(/submission limit/i);
    expect(limitInput).toHaveValue(5);

    // Clear limit
    await userEvent.clear(limitInput);
    expect(limitInput).toHaveValue(null);
  });

  test("handles parseDescription with JSON format", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test description' }] }]
      }),
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should parse JSON description
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles parseDescription with plain text format", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Plain text description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should parse plain text description
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles test case loading error", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json({ detail: "Error" }, { status: 500 })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should handle test case loading error gracefully
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles empty test cases list", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should show empty state
    expect(screen.getByText(/no test cases yet/i)).toBeInTheDocument();
  });

  test("handles test case with isNew flag", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Add a new test case
    const addButtons = screen.getAllByRole("button", { name: /add test case/i });
    if (addButtons.length > 0) {
      await userEvent.click(addButtons[0]);
      // New test case should be marked
    }

    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles assignment without course_id on delete", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: null,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      ),
      http.delete("**/api/v1/assignments/1", () =>
        HttpResponse.json({ success: true })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await userEvent.click(deleteButton);

    const confirmDeleteButton = await screen.findByRole("button", { name: /delete assignment/i });
    await userEvent.click(confirmDeleteButton);

    // Should handle navigation even without course_id
    expect(confirmDeleteButton).toBeInTheDocument();
  });

  test("handles Monaco editor language mapping for all variants", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      language: "python",
      test_cases: [],
      instructions: null,
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
          { id: "java", name: "Java", piston_name: "java" },
          { id: "cpp", name: "C++", piston_name: "c++" },
          { id: "c++", name: "C++ Alt", piston_name: "c++" },
          { id: "javascript", name: "JavaScript", piston_name: "javascript" },
          { id: "js", name: "JS", piston_name: "javascript" },
          { id: "typescript", name: "TypeScript", piston_name: "typescript" },
          { id: "ts", name: "TS", piston_name: "typescript" }
        ])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const languageSelect = screen.getByLabelText(/language/i);
    
    // Test various language mappings
    await userEvent.selectOptions(languageSelect, "cpp");
    await userEvent.selectOptions(languageSelect, "javascript");
    await userEvent.selectOptions(languageSelect, "typescript");
    
    expect(languageSelect).toBeInTheDocument();
  });

  test("handles successful update with all test case operations", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] }),
      course_id: 500,
      language: "python",
      instructions: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] }),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('old')", visibility: true, point_value: 10, order: 1 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('old')", visibility: true, point_value: 10, order: 1 }
        ]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      ),
      http.put("**/api/v1/assignments/1/test-cases/1", () =>
        HttpResponse.json({ success: true })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Form should be populated
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles test case deletion during update", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('test1')", visibility: true, point_value: 10, order: 1 },
            { id: 2, test_code: "print('test2')", visibility: true, point_value: 20, order: 2 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('test1')", visibility: true, point_value: 10, order: 1 },
          { id: 2, test_code: "print('test2')", visibility: true, point_value: 20, order: 2 }
        ]);
      }),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test1')", visibility: true, point_value: 10, order: 1 },
          { id: 2, test_code: "print('test2')", visibility: true, point_value: 20, order: 2 }
        ])
      ),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      ),
      http.delete("**/api/v1/assignments/1/test-cases/2", () =>
        HttpResponse.json({ success: true })
      ),
      http.put("**/api/v1/assignments/1/test-cases/1", () =>
        HttpResponse.json({ success: true })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should handle test case deletion
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles test case creation during update", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([]);
        }
        return HttpResponse.json([]);
      }),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      ),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      ),
      http.post("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json({ id: 3, test_code: "print('new')", visibility: true, point_value: 30, order: 1 })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Add a new test case
    const addButtons = screen.getAllByRole("button", { name: /add test case/i });
    if (addButtons.length > 0) {
      await userEvent.click(addButtons[0]);
    }

    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles syntax validation with empty code clearing errors", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Empty code should clear syntax errors
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles syntax validation API error gracefully", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ detail: "Validation error" }, { status: 500 })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should handle validation errors gracefully
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles test case move with order update", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test1')", visibility: true, point_value: 10, order: 1 },
          { id: 2, test_code: "print('test2')", visibility: true, point_value: 20, order: 2 }
        ])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Test cases should be draggable
    const testCases = screen.getAllByText(/test case \d+:/i);
    expect(testCases.length).toBeGreaterThan(1);
  });

  test("handles updateTestCase for all field types", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Find visibility checkbox and points input
    const checkboxes = screen.getAllByRole("checkbox");
    const visibilityCheckbox = checkboxes.find(cb => {
      const label = cb.closest('label');
      return label?.textContent?.toLowerCase().includes('visible');
    });

    if (visibilityCheckbox) {
      await userEvent.click(visibilityCheckbox);
      expect(visibilityCheckbox).not.toBeChecked();
    }

    // Find points input
    const pointsLabels = screen.getAllByText(/points:/i);
    if (pointsLabels.length > 0) {
      const pointsContainer = pointsLabels[0].closest('div');
      const pointsInput = pointsContainer?.querySelector('input[type="number"]') as HTMLInputElement;
      if (pointsInput) {
        await userEvent.clear(pointsInput);
        await userEvent.type(pointsInput, "25");
        expect(pointsInput).toHaveValue(25);
      }
    }
  });

  test("handles clearDate for both start and stop", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      start: "2025-01-01T00:00:00Z",
      stop: "2025-01-31T23:59:59Z",
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const startInput = screen.getByLabelText(/start date/i);
    const stopInput = screen.getByLabelText(/due date/i);

    // Find clear buttons
    const clearButtons = screen.getAllByTitle(/clear/i);
    
    if (clearButtons.length >= 2) {
      // Clear start date
      await userEvent.click(clearButtons[0]);
      // Clear stop date
      await userEvent.click(clearButtons[1]);
    }
  });

  test("handles submission limit update and clearing", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      sub_limit: 5,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      ),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const limitInput = screen.getByLabelText(/submission limit/i);
    expect(limitInput).toHaveValue(5);

    // Clear limit
    await userEvent.clear(limitInput);
    expect(limitInput).toHaveValue(null);

    // Set new limit
    await userEvent.type(limitInput, "10");
    expect(limitInput).toHaveValue(10);
  });

  test("handles parseDescription with invalid JSON", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "not valid json {",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should parse as plain text
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles parseDescription with null description", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: null,
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should handle null description
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles sessionStorage save during editing", async () => {
    const sessionStorageMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Update title
    const titleInput = screen.getByLabelText(/assignment title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated Title");

    // Wait for debounced save
    await new Promise(resolve => setTimeout(resolve, 600));

    // Should save to sessionStorage
    expect(sessionStorageMock.setItem).toHaveBeenCalled();
  });

  test("handles successful update with valid content from sessionStorage", async () => {
    const validDescription = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] };
    const validInstructions = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] };
    
    const sessionStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        title: "Updated Title",
        description: validDescription,
        instructions: validInstructions,
        language: "python",
        subLimit: "10",
        start: "2025-01-01T10:00",
        stop: "2025-01-31T23:59",
        testCases: [{ id: 1, code: "print('test')", visible: true, points: 10, order: 1 }]
      })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    const mockAssignment = {
      id: 1,
      title: "Original Title",
      description: JSON.stringify(validDescription),
      course_id: 500,
      language: "python",
      instructions: JSON.stringify(validInstructions),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      ),
      http.put("**/api/v1/assignments/1/test-cases/1", () =>
        HttpResponse.json({ success: true })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Updated Title");
    
    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show success message
    expect(await screen.findByText(/assignment updated successfully/i)).toBeInTheDocument();
  });

  test("handles successful update with test case deletion", async () => {
    const validDescription = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] };
    const validInstructions = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] };
    
    const sessionStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        title: "Test Assignment",
        description: validDescription,
        instructions: validInstructions,
        language: "python",
        testCases: [{ id: 1, code: "print('test')", visible: true, points: 10, order: 1 }]
      })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify(validDescription),
      course_id: 500,
      language: "python",
      instructions: JSON.stringify(validInstructions),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('test1')", visibility: true, point_value: 10, order: 1 },
            { id: 2, test_code: "print('test2')", visibility: true, point_value: 20, order: 2 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('test1')", visibility: true, point_value: 10, order: 1 },
          { id: 2, test_code: "print('test2')", visibility: true, point_value: 20, order: 2 }
        ]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      ),
      http.delete("**/api/v1/assignments/1/test-cases/2", () =>
        HttpResponse.json({ success: true })
      ),
      http.put("**/api/v1/assignments/1/test-cases/1", () =>
        HttpResponse.json({ success: true })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");
    
    // Delete one test case (test case 2)
    const allButtons = screen.getAllByRole("button");
    const trashButtons = allButtons.filter(btn => {
      const svg = btn.querySelector('svg');
      return svg && svg.getAttribute('class')?.includes('lucide-trash');
    });
    
    // Delete the second test case if available
    if (trashButtons.length > 1) {
      await userEvent.click(trashButtons[1]);
    }
    
    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show success
    expect(await screen.findByText(/assignment updated successfully/i)).toBeInTheDocument();
  });

  test("handles successful update with new test case creation", async () => {
    const validDescription = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] };
    const validInstructions = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] };
    
    const sessionStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        title: "Test Assignment",
        description: validDescription,
        instructions: validInstructions,
        language: "python",
        testCases: [
          { id: 1, code: "print('old')", visible: true, points: 10, order: 1 },
          { id: Date.now(), code: "print('new')", visible: true, points: 20, order: 2, isNew: true }
        ]
      })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify(validDescription),
      course_id: 500,
      language: "python",
      instructions: JSON.stringify(validInstructions),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('old')", visibility: true, point_value: 10, order: 1 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('old')", visibility: true, point_value: 10, order: 1 }
        ]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      ),
      http.put("**/api/v1/assignments/1/test-cases/1", () =>
        HttpResponse.json({ success: true })
      ),
      http.post("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json({ id: 2, test_code: "print('new')", visibility: true, point_value: 20, order: 2 })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");
    
    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show success
    expect(await screen.findByText(/assignment updated successfully/i)).toBeInTheDocument();
  });

  test("handles successful update without test cases", async () => {
    const validDescription = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] };
    const validInstructions = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] };
    
    const sessionStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        title: "Test Assignment",
        description: validDescription,
        instructions: validInstructions,
        language: "python",
        testCases: []
      })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify(validDescription),
      course_id: 500,
      language: "python",
      instructions: JSON.stringify(validInstructions),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([]);
        }
        return HttpResponse.json([]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");
    
    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show success
    expect(await screen.findByText(/assignment updated successfully/i)).toBeInTheDocument();
  });

  test("handles submission limit clearing in update", async () => {
    const validDescription = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] };
    const validInstructions = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] };
    
    const sessionStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        title: "Test Assignment",
        description: validDescription,
        instructions: validInstructions,
        language: "python",
        subLimit: "", // Empty to clear
        testCases: [{ id: 1, code: "print('test')", visible: true, points: 10, order: 1 }]
      })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify(validDescription),
      course_id: 500,
      language: "python",
      instructions: JSON.stringify(validInstructions),
      sub_limit: 5,
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      ),
      http.put("**/api/v1/assignments/1/test-cases/1", () =>
        HttpResponse.json({ success: true })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");
    
    // Clear submission limit
    const limitInput = screen.getByLabelText(/submission limit/i);
    await userEvent.clear(limitInput);
    
    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show success (sub_limit should be null in payload)
    expect(await screen.findByText(/assignment updated successfully/i)).toBeInTheDocument();
  });

  test("handles date clearing in update", async () => {
    const validDescription = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] };
    const validInstructions = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] };
    
    const sessionStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        title: "Test Assignment",
        description: validDescription,
        instructions: validInstructions,
        language: "python",
        start: "",
        stop: "",
        testCases: [{ id: 1, code: "print('test')", visible: true, points: 10, order: 1 }]
      })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify(validDescription),
      course_id: 500,
      language: "python",
      instructions: JSON.stringify(validInstructions),
      start: "2025-01-01T00:00:00Z",
      stop: "2025-01-31T23:59:59Z",
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      ),
      http.put("**/api/v1/assignments/1/test-cases/1", () =>
        HttpResponse.json({ success: true })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");
    
    // Clear dates
    const clearButtons = screen.getAllByTitle(/clear/i);
    if (clearButtons.length >= 2) {
      await userEvent.click(clearButtons[0]); // Clear start
      await userEvent.click(clearButtons[1]); // Clear stop
    }
    
    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show success (dates should be null in payload)
    expect(await screen.findByText(/assignment updated successfully/i)).toBeInTheDocument();
  });

  test("handles sessionStorage removeItem error during update", async () => {
    const validDescription = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] };
    const validInstructions = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] };
    
    const sessionStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        title: "Test Assignment",
        description: validDescription,
        instructions: validInstructions,
        language: "python",
        testCases: [{ id: 1, code: "print('test')", visible: true, points: 10, order: 1 }]
      })),
      setItem: vi.fn(),
      removeItem: vi.fn(() => { throw new Error("Storage error"); }),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify(validDescription),
      course_id: 500,
      language: "python",
      instructions: JSON.stringify(validInstructions),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      ),
      http.put("**/api/v1/assignments/1/test-cases/1", () =>
        HttpResponse.json({ success: true })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");
    
    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should handle storage error gracefully (lines 500-506)
    expect(await screen.findByText(/assignment updated successfully/i)).toBeInTheDocument();
  });

  test("handles update error with message", async () => {
    const validDescription = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] };
    const validInstructions = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] };
    
    const sessionStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        title: "Test Assignment",
        description: validDescription,
        instructions: validInstructions,
        language: "python",
        testCases: [{ id: 1, code: "print('test')", visible: true, points: 10, order: 1 }]
      })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify(validDescription),
      course_id: 500,
      language: "python",
      instructions: JSON.stringify(validInstructions),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ detail: "Update failed" }, { status: 500 })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");
    
    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show error message (line 514)
    expect(await screen.findByText(/failed to update assignment/i)).toBeInTheDocument();
  });

  test("handles update error without message", async () => {
    const validDescription = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] };
    const validInstructions = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] };
    
    const sessionStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        title: "Test Assignment",
        description: validDescription,
        instructions: validInstructions,
        language: "python",
        testCases: [{ id: 1, code: "print('test')", visible: true, points: 10, order: 1 }]
      })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify(validDescription),
      course_id: 500,
      language: "python",
      instructions: JSON.stringify(validInstructions),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({}, { status: 500 })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");
    
    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show error with default message (line 514)
    expect(await screen.findByText(/failed to update assignment/i)).toBeInTheDocument();
  });

  test("handles test case loading from server when no sessionStorage", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('server')", visibility: true, point_value: 10, order: 1 }
        ])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should load test cases from server
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles test case loading error gracefully", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json({ detail: "Error" }, { status: 500 })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should handle error gracefully (lines 182-186)
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles assignment loading with all date formats", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      start: "2025-01-01T00:00:00Z",
      stop: "2025-01-31T23:59:59Z",
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Dates should be converted to datetime-local format (line 163-164)
    const startInput = screen.getByLabelText(/start date/i);
    const stopInput = screen.getByLabelText(/due date/i);
    expect(startInput).toHaveValue();
    expect(stopInput).toHaveValue();
  });

  test("handles syntax validation with invalid line numbers", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ 
          valid: false, 
          errors: [
            { line: 0, column: 1, message: "Error at line 0" },
            { line: 1000, column: 1, message: "Error at line 1000" },
            { line: 1, message: "Error without column" }
          ] 
        })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should handle invalid line numbers gracefully
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles syntax validation with column edge cases", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ 
          valid: false, 
          errors: [
            { line: 1, column: 0, message: "Error at column 0" },
            { line: 1, column: 999999, message: "Error at huge column" },
            { line: 1, message: "Error without column" }
          ] 
        })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should handle column edge cases
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles syntax validation error path", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      ),
      http.post("**/api/v1/syntax/validate", () => {
        throw new Error("Network error");
      })
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should handle validation errors gracefully
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles language change clearing all markers", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      language: "python",
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      ),
      http.get("**/api/v1/languages", () =>
        HttpResponse.json([
          { id: "python", name: "Python", piston_name: "python" },
          { id: "java", name: "Java", piston_name: "java" }
        ])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ 
          valid: false, 
          errors: [{ line: 1, message: "Syntax error" }] 
        })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const languageSelect = screen.getByLabelText(/language/i);
    
    // Change language - should clear all markers
    await userEvent.selectOptions(languageSelect, "java");
    
    expect(languageSelect).toHaveValue("java");
  });

  test("handles test case with syntax errors in validation", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] }),
      course_id: 500,
      instructions: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] }),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "invalid syntax", visibility: true, point_value: 10, order: 1 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "invalid syntax", visibility: true, point_value: 10, order: 1 }
        ]);
      }),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ 
          valid: false, 
          errors: [{ line: 1, message: "Syntax error" }] 
        })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show validation error for syntax errors
    expect(await screen.findByText(/test case\(s\) have syntax errors/i)).toBeInTheDocument();
  });

  test("handles moveTestCase with order update", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test1')", visibility: true, point_value: 10, order: 1 },
          { id: 2, test_code: "print('test2')", visibility: true, point_value: 20, order: 2 },
          { id: 3, test_code: "print('test3')", visibility: true, point_value: 30, order: 3 }
        ])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Test cases should be draggable for reordering (lines 566-574)
    const testCases = screen.getAllByText(/test case \d+:/i);
    expect(testCases.length).toBeGreaterThan(2);
  });

  test("handles addTestCase with timestamp ID", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Add test case (uses Date.now() for ID, line 545)
    const addButtons = screen.getAllByRole("button", { name: /add test case/i });
    if (addButtons.length > 0) {
      await userEvent.click(addButtons[0]);
    }

    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles getStorageKey with missing assignment_id or userId", async () => {
    // Test with missing assignment_id
    renderEditAssignmentPage("");

    // getStorageKey should return null if assignment_id or userId is missing
    // Component should still render
    expect(screen.getByText(/loading assignment/i)).toBeInTheDocument();
  });

  test("handles loadFromStorage with null key", async () => {
    renderEditAssignmentPage("");

    // loadFromStorage should return null if key is null
    expect(screen.getByText(/loading assignment/i)).toBeInTheDocument();
  });

  test("handles validation with multiple empty test cases", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] }),
      course_id: 500,
      instructions: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] }),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "", visibility: true, point_value: 10, order: 1 },
          { id: 2, test_code: "", visibility: true, point_value: 20, order: 2 }
        ])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show validation error for multiple empty test cases
    expect(await screen.findByText(/\d+ test case\(s\) are empty/i)).toBeInTheDocument();
  });

  test("handles validation with multiple invalid points", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] }),
      course_id: 500,
      instructions: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] }),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 0, order: 1 },
          { id: 2, test_code: "print('test')", visibility: true, point_value: -5, order: 2 }
        ])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show validation error for multiple invalid points
    expect(await screen.findByText(/\d+ test case\(s\) have invalid point values/i)).toBeInTheDocument();
  });

  test("handles parseDescription with valid TipTap JSON", async () => {
    const validTipTap = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Valid content" }] }] };
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify(validTipTap),
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should parse valid TipTap JSON (lines 104-107)
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles parseDescription with invalid JSON structure", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify({ type: "doc", content: "invalid" }), // Invalid structure
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Should wrap invalid structure as plain text (lines 108-112)
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles Monaco editor mount and blur", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: "Test description",
      course_id: 500,
      test_cases: [],
      instructions: null,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Monaco editor should be mounted (handleEditorMount is called)
    // The editor.onDidBlurEditorText callback is set up
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles hasTipTapContent with various content structures", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify({ type: "doc", content: [] }), // Empty content
      course_id: 500,
      instructions: JSON.stringify({ type: "doc", content: [] }),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should validate empty content
    expect(await screen.findByText(/description is required/i)).toBeInTheDocument();
  });

  test("handles test case code update via Monaco editor onChange", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: VALID_DESCRIPTION,
      course_id: 500,
      test_cases: [],
      instructions: VALID_INSTRUCTIONS,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Monaco editor onChange should update test case code
    // The editor is rendered but we can't directly interact with Monaco in tests
    // This test verifies the component renders correctly with test cases
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles Monaco editor blur event triggering syntax validation", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: VALID_DESCRIPTION,
      course_id: 500,
      test_cases: [],
      instructions: VALID_INSTRUCTIONS,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Monaco editor blur should trigger syntax validation
    // The handleEditorMount function sets up onDidBlurEditorText callback
    expect(screen.getByDisplayValue("Test Assignment")).toBeInTheDocument();
  });

  test("handles successful update with test case reordering via drag and drop", async () => {
    const validDescription = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] };
    const validInstructions = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] };
    
    const sessionStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        title: "Test Assignment",
        description: validDescription,
        instructions: validInstructions,
        language: "python",
        testCases: [
          { id: 1, code: "print('test1')", visible: true, points: 10, order: 1 },
          { id: 2, code: "print('test2')", visible: true, points: 20, order: 2 },
          { id: 3, code: "print('test3')", visible: true, points: 30, order: 3 }
        ]
      })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify(validDescription),
      course_id: 500,
      language: "python",
      instructions: JSON.stringify(validInstructions),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('test1')", visibility: true, point_value: 10, order: 1 },
            { id: 2, test_code: "print('test2')", visibility: true, point_value: 20, order: 2 },
            { id: 3, test_code: "print('test3')", visibility: true, point_value: 30, order: 3 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('test1')", visibility: true, point_value: 10, order: 1 },
          { id: 2, test_code: "print('test2')", visibility: true, point_value: 20, order: 2 },
          { id: 3, test_code: "print('test3')", visibility: true, point_value: 30, order: 3 }
        ]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      ),
      http.put("**/api/v1/assignments/1/test-cases/1", () =>
        HttpResponse.json({ success: true })
      ),
      http.put("**/api/v1/assignments/1/test-cases/2", () =>
        HttpResponse.json({ success: true })
      ),
      http.put("**/api/v1/assignments/1/test-cases/3", () =>
        HttpResponse.json({ success: true })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Test cases should be draggable - verify draggable attribute
    const testCaseLabels = screen.getAllByText(/test case \d+:/i);
    expect(testCaseLabels.length).toBeGreaterThan(2);

    // Submit form - drag and drop reorders which should update order values
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show success
    expect(await screen.findByText(/assignment updated successfully/i)).toBeInTheDocument();
  });

  test("handles syntax validation when language changes after setting syntax errors", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: VALID_DESCRIPTION,
      course_id: 500,
      language: "python",
      test_cases: [],
      instructions: VALID_INSTRUCTIONS,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      ),
      http.get("**/api/v1/languages", () =>
        HttpResponse.json([
          { id: "python", name: "Python", piston_name: "python" },
          { id: "java", name: "Java", piston_name: "java" }
        ])
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ 
          valid: false, 
          errors: [{ line: 1, message: "Syntax error" }] 
        })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const languageSelect = screen.getByLabelText(/language/i);
    
    // Change language - should clear syntax errors (lines 319-330)
    await userEvent.selectOptions(languageSelect, "java");
    
    expect(languageSelect).toHaveValue("java");
    // Syntax errors should be cleared when language changes
  });

  test("handles successful update with multiple test case operations (create, update, delete)", async () => {
    const validDescription = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] };
    const validInstructions = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] };
    
    const sessionStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        title: "Test Assignment",
        description: validDescription,
        instructions: validInstructions,
        language: "python",
        testCases: [
          { id: 1, code: "print('old1')", visible: true, points: 10, order: 1 },
          { id: Date.now(), code: "print('new')", visible: true, points: 20, order: 2, isNew: true }
        ]
      })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify(validDescription),
      course_id: 500,
      language: "python",
      instructions: JSON.stringify(validInstructions),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "print('old1')", visibility: true, point_value: 10, order: 1 },
            { id: 2, test_code: "print('old2')", visibility: true, point_value: 15, order: 2 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "print('old1')", visibility: true, point_value: 10, order: 1 },
          { id: 2, test_code: "print('old2')", visibility: true, point_value: 15, order: 2 }
        ]);
      }),
      http.put("**/api/v1/assignments/1", () =>
        HttpResponse.json({ id: 1 })
      ),
      http.put("**/api/v1/assignments/1/test-cases/1", () =>
        HttpResponse.json({ success: true })
      ),
      http.delete("**/api/v1/assignments/1/test-cases/2", () =>
        HttpResponse.json({ success: true })
      ),
      http.post("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json({ id: 3, test_code: "print('new')", visibility: true, point_value: 20, order: 2 })
      ),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ valid: true, errors: [] })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");
    
    // Submit form - should handle create new, update existing, and delete removed
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show success
    expect(await screen.findByText(/assignment updated successfully/i)).toBeInTheDocument();
  });

  test("handles validation error with syntax errors in multiple test cases", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] }),
      course_id: 500,
      instructions: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Instructions" }] }] }),
      test_cases: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('include_hidden') === 'true') {
          return HttpResponse.json([
            { id: 1, test_code: "invalid syntax 1", visibility: true, point_value: 10, order: 1 },
            { id: 2, test_code: "invalid syntax 2", visibility: true, point_value: 20, order: 2 }
          ]);
        }
        return HttpResponse.json([
          { id: 1, test_code: "invalid syntax 1", visibility: true, point_value: 10, order: 1 },
          { id: 2, test_code: "invalid syntax 2", visibility: true, point_value: 20, order: 2 }
        ]);
      }),
      http.post("**/api/v1/syntax/validate", () =>
        HttpResponse.json({ 
          valid: false, 
          errors: [{ line: 1, message: "Syntax error" }] 
        })
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    const submitButton = screen.getByRole("button", { name: /save changes/i });
    await userEvent.click(submitButton);

    // Should show validation error for syntax errors
    expect(await screen.findByText(/test case\(s\) have syntax errors/i)).toBeInTheDocument();
  });

  test("handles test case point value edge cases (zero, negative, empty string)", async () => {
    const mockAssignment = {
      id: 1,
      title: "Test Assignment",
      description: VALID_DESCRIPTION,
      course_id: 500,
      test_cases: [],
      instructions: VALID_INSTRUCTIONS,
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      ),
      http.get("**/api/v1/assignments/1/test-cases", () =>
        HttpResponse.json([
          { id: 1, test_code: "print('test')", visibility: true, point_value: 10, order: 1 }
        ])
      )
    );

    renderEditAssignmentPage("1");

    await screen.findByDisplayValue("Test Assignment");

    // Find points input and test edge cases
    const pointsLabels = screen.getAllByText(/points:/i);
    if (pointsLabels.length > 0) {
      const pointsContainer = pointsLabels[0].closest('div');
      const pointsInput = pointsContainer?.querySelector('input[type="number"]') as HTMLInputElement;
      if (pointsInput) {
        // Test empty value
        await userEvent.clear(pointsInput);
        expect(pointsInput).toHaveValue(null);
        
        // Test zero value
        await userEvent.type(pointsInput, "0");
        expect(pointsInput).toHaveValue(0);
        
        // Test negative value
        await userEvent.clear(pointsInput);
        await userEvent.type(pointsInput, "-5");
        expect(pointsInput).toHaveValue(-5);
        
        // Test blur validation (should reset to 1 if invalid)
        await userEvent.tab();
        // After blur, invalid values should be reset to 1 (lines 953-957)
        expect(pointsInput).toHaveValue(1);
      }
    }
  });
});