import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      test_cases: [
        {
          id: 1,
          test_code: "def test_example():\n    assert True",
          point_value: 100,
          visibility: true,
        }
      ],
      instructions: [],
    };

    server.use(
      http.get("**/api/v1/assignments/1", () =>
        HttpResponse.json(mockAssignment)
      )
    );

    renderEditAssignmentPage();

    expect(await screen.findByDisplayValue("Test Assignment")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("3")).toBeInTheDocument();
    // Note: Description is loaded into RichTextEditor, not a simple input
  });

  test("navigates back to assignment", async () => {
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
      )
    );

    renderEditAssignmentPage();

    await screen.findByDisplayValue("Test Assignment");

    const backButton = screen.getByRole("link", { name: /back to assignment/i });
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute("href", "/assignments/1");
  });
});
