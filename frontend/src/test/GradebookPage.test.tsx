import React from "react";
import { screen } from "@testing-library/react";
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
          assignments: [{ id: 1, title: "Assignment 1" }],
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
    expect(screen.getByText(/85/i)).toBeInTheDocument();
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
});

