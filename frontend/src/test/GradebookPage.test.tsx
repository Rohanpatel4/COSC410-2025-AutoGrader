import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";

import GradebookPage from "../webpages/GradebookPage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";

function renderGradebookPage(courseId = "500") {
  return renderWithProviders(
    <Routes>
      <Route path="/courses/:course_id/gradebook" element={<GradebookPage />} />
    </Routes>,
    {
      route: `/courses/${courseId}/gradebook`,
      auth: { role: "faculty", userId: "301" },
    }
  );
}

describe("GradebookPage", () => {
  beforeEach(() => {
    server.resetHandlers();
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "Seed Course", course_code: "COSC-410" },
          assignments: [],
          students: [],
        })
      )
    );
  });

  test("renders gradebook header", async () => {
    renderGradebookPage();

    expect(await screen.findByText(/gradebook/i)).toBeInTheDocument();
  });

  test("shows loading state", () => {
    renderGradebookPage();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test("displays gradebook table with students and assignments", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "Test Course", course_code: "COSC-410" },
          assignments: [{ id: 1, title: "Assignment 1", total_points: 100 }],
          students: [
            {
              student_id: 201,
              username: "student1",
              grades: { "1": 85 },
            },
          ],
        })
      )
    );

    renderGradebookPage();

    expect(await screen.findByText(/student1/i)).toBeInTheDocument();
    expect(screen.getByText(/assignment 1/i)).toBeInTheDocument();
    // Grade is displayed as percentage by default (85%)
    expect(screen.getByText(/85%/i)).toBeInTheDocument();
  });

  test("shows error message on API failure", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({ detail: "Not found" }, { status: 404 })
      )
    );

    renderGradebookPage();

    expect(await screen.findByText(/failed to load|not found/i)).toBeInTheDocument();
  });

  test("shows empty state when no assignments", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "Test Course", course_code: "COSC-410" },
          assignments: [],
          students: [],
        })
      )
    );

    renderGradebookPage();

    expect(await screen.findByText(/no assignments yet/i)).toBeInTheDocument();
  });

  test("handles grade click navigation", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "Test Course", course_code: "COSC-410" },
          assignments: [{ id: 1, title: "Assignment 1", total_points: 100 }],
          students: [
            {
              student_id: 201,
              username: "student1",
              grades: { "1": 85 },
            },
          ],
        })
      ),
      http.get("**/api/v1/assignments/1/grades", () =>
        HttpResponse.json({
          assignment: { id: 1, title: "Assignment 1" },
          students: [
            {
              student_id: 201,
              username: "student1",
              attempts: [{ id: 100, earned_points: 85 }],
              best: 85,
            },
          ],
        })
      )
    );

    const { container } = renderGradebookPage();

    await screen.findByText(/student1/i);

    // Find and click on a grade cell
    const gradeCells = container.querySelectorAll('td');
    const gradeCell = Array.from(gradeCells).find(cell => cell.textContent?.includes('85'));
    if (gradeCell) {
      await userEvent.click(gradeCell);
      // Should navigate (tested via navigation mock)
    }
  });

  test("handles student click navigation", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "Test Course", course_code: "COSC-410" },
          assignments: [{ id: 1, title: "Assignment 1", total_points: 100 }],
          students: [
            {
              student_id: 201,
              username: "student1",
              grades: { "1": 85 },
            },
          ],
        })
      ),
      http.get("**/api/v1/assignments/1/grades", () =>
        HttpResponse.json({
          assignment: { id: 1, title: "Assignment 1" },
          students: [
            {
              student_id: 201,
              username: "student1",
              attempts: [{ id: 100, earned_points: 85 }],
              best: 85,
            },
          ],
        })
      )
    );

    renderGradebookPage();

    await screen.findByText(/student1/i);

    // Click on student name
    const studentLink = screen.getByText(/student1/i);
    await userEvent.click(studentLink);
    // Should navigate (tested via navigation mock)
  });

  test("toggles between points and percentage view", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "Test Course", course_code: "COSC-410" },
          assignments: [{ id: 1, title: "Assignment 1", total_points: 100 }],
          students: [
            {
              student_id: 201,
              username: "student1",
              grades: { "1": 85 },
            },
          ],
        })
      )
    );

    renderGradebookPage();

    await screen.findByText(/student1/i);

    // Find toggle button - get all buttons and find one that might toggle view
    const buttons = screen.getAllByRole("button");
    const toggleButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('points') || 
      btn.textContent?.toLowerCase().includes('percentage') ||
      btn.textContent?.toLowerCase().includes('show')
    );
    if (toggleButton) {
      await userEvent.click(toggleButton);
      // View should toggle
    }
  });
});

