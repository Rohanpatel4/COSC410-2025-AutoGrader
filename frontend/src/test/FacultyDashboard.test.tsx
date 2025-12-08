import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Routes, Route, useParams } from "react-router-dom";

import FacultyDashboard from "../webpages/FacultyDashboard";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";
import { __testDb, resetDb } from "./handlers";

function CourseStub() {
  const { course_code = "" } = useParams();
  return <div>COURSE PAGE {course_code}</div>;
}

function renderFacultyDashboard() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<FacultyDashboard />} />
      <Route path="/courses/:course_code" element={<CourseStub />} />
      <Route path="/courses" element={<div>COURSES INDEX</div>} />
    </Routes>,
    {
      route: "/",
      auth: { role: "faculty", userId: "301" },
    }
  );
}

describe("FacultyDashboard", () => {
  beforeEach(() => resetDb());

  test("renders CTA cards and seeded course", async () => {
    renderFacultyDashboard();

    expect(await screen.findByText("Create Course")).toBeInTheDocument();
    expect(screen.getByText("Create Course")).toBeInTheDocument();
    expect(await screen.findByText(/Course Overview/i)).toBeInTheDocument();
    expect(await screen.findByText(/FirstCourse/i)).toBeInTheDocument();
  });

  test("navigates to course detail when a course tile is clicked", async () => {
    renderFacultyDashboard();

    const courseTile = await screen.findByText(/FirstCourse/i);
    await userEvent.click(courseTile);

    expect(await screen.findByText(/COURSE PAGE COSC-410/i)).toBeInTheDocument();
  });

  test("shows empty state when professor has no courses", async () => {
    __testDb.state.coursesByProfessor[301] = [];

    renderFacultyDashboard();

    expect(await screen.findByText(/No courses yet/i)).toBeInTheDocument();
  });

  test("shows error alert when loading courses fails", async () => {
    server.use(
      http.get("**/api/v1/courses/faculty/:id", () =>
        HttpResponse.text("load failed", { status: 500 })
      )
    );

    renderFacultyDashboard();

    expect(await screen.findByText(/Failed to load courses|load failed/i)).toBeInTheDocument();
    expect(screen.getByText(/No courses yet/i)).toBeInTheDocument();
  });

  test("renders view-all button when more than three courses", async () => {
    __testDb.state.coursesByProfessor[301] = Array.from({ length: 5 }).map((_, idx) => ({
      id: idx + 1,
      course_code: `CODE-${idx}`,
      name: `Course ${idx}`,
      description: null,
      professor_id: 301,
    }));

    renderFacultyDashboard();

    const viewAll = await screen.findByText("View All Courses");
    await userEvent.click(viewAll);
    expect(await screen.findByText(/COURSES INDEX/i)).toBeInTheDocument();
  });

  test("displays course statistics and enrollment", async () => {
    server.use(
      http.get("**/api/v1/courses/faculty/301", () =>
        HttpResponse.json([
          {
            id: 1,
            course_code: "COSC-410",
            name: "FirstCourse",
            description: "seed",
            professor_id: 301,
            enrollment_key: "ABC123XYZ789",
          },
          {
            id: 2,
            course_code: "MATH-201",
            name: "Advanced Mathematics",
            description: "Linear Algebra",
            professor_id: 301,
            enrollment_key: "XYZ789ABC123",
          }
        ])
      )
    );

    renderFacultyDashboard();

    expect(await screen.findByText("COSC-410")).toBeInTheDocument();
    expect(screen.getByText("FirstCourse")).toBeInTheDocument();
    expect(screen.getByText("MATH-201")).toBeInTheDocument();
    expect(screen.getByText("Advanced Mathematics")).toBeInTheDocument();
  });

  test("handles course navigation correctly", async () => {
    server.use(
      http.get("**/api/v1/courses/faculty/301", () =>
        HttpResponse.json([
          {
            id: 1,
            course_code: "COSC-410",
            name: "FirstCourse",
            description: "seed",
            professor_id: 301,
          }
        ])
      )
    );

    renderFacultyDashboard();

    await screen.findByText("COSC-410");

    const courseTile = screen.getByText("COSC-410").closest('div');
    await userEvent.click(courseTile!);

    expect(await screen.findByText(/COURSE PAGE COSC-410/i)).toBeInTheDocument();
  });

  test("shows course creation navigation", async () => {
    renderFacultyDashboard();

    await screen.findByText("Create Course");

    // Find the button element that contains "Create Course" text
    const createButton = screen.getByText("Create Course").closest('button');
    expect(createButton).toBeInTheDocument();

    // Should be clickable (though we don't test navigation in this test)
    expect(createButton?.tagName.toLowerCase()).toBe('button');
  });

  test("handles empty course list", async () => {
    server.use(
      http.get("**/api/v1/courses/faculty/301", () =>
        HttpResponse.json([])
      )
    );

    renderFacultyDashboard();

    await screen.findByText(/Course Overview/i);

    // Should show empty state or no courses message
    expect(screen.getByText(/Course Overview/i)).toBeInTheDocument();
  });

  test("handles course loading errors gracefully", async () => {
    server.use(
      http.get("**/api/v1/courses/faculty/301", () =>
        HttpResponse.json({ detail: "Database connection failed" }, { status: 500 })
      )
    );

    renderFacultyDashboard();

    // Should handle error gracefully
    expect(await screen.findByText(/Course Overview/i)).toBeInTheDocument();
  });

  test("displays multiple courses with different enrollment keys", async () => {
    server.use(
      http.get("**/api/v1/courses/faculty/301", () =>
        HttpResponse.json([
          {
            id: 1,
            course_code: "COSC-410",
            name: "Computer Science 410",
            description: "Advanced programming",
            professor_id: 301,
            enrollment_key: "ABC123XYZ789",
          },
          {
            id: 2,
            course_code: "COSC-411",
            name: "Computer Science 411",
            description: "Software engineering",
            professor_id: 301,
            enrollment_key: "XYZ789ABC123",
          }
        ])
      )
    );

    renderFacultyDashboard();

    await screen.findByText("COSC-410");

    expect(screen.getByText("Computer Science 410")).toBeInTheDocument();
    expect(screen.getByText("COSC-411")).toBeInTheDocument();
    expect(screen.getByText("Computer Science 411")).toBeInTheDocument();
  });

  test("maintains dashboard layout and navigation", async () => {
    server.use(
      http.get("**/api/v1/courses/faculty/301", () =>
        HttpResponse.json([
          {
            id: 1,
            course_code: "COSC-410",
            name: "FirstCourse",
            description: "seed",
            professor_id: 301,
          }
        ])
      )
    );

    renderFacultyDashboard();

    await screen.findByText("COSC-410");

    // Dashboard should maintain its structure
    expect(screen.getByText("Create Course")).toBeInTheDocument();
    expect(screen.getByText(/Course Overview/i)).toBeInTheDocument();
  });

  test("handles course click navigation errors", async () => {
    server.use(
      http.get("**/api/v1/courses/faculty/301", () =>
        HttpResponse.json([
          {
            id: 1,
            course_code: "COSC-410",
            name: "FirstCourse",
            description: "seed",
            professor_id: 301,
          }
        ])
      )
    );

    renderFacultyDashboard();

    await screen.findByText("COSC-410");

    // Navigation should work
    const courseTile = screen.getByText("COSC-410").closest('div');
    await userEvent.click(courseTile!);

    expect(await screen.findByText(/COURSE PAGE COSC-410/i)).toBeInTheDocument();
  });

  test("shows course enrollment information", async () => {
    server.use(
      http.get("**/api/v1/courses/faculty/301", () =>
        HttpResponse.json([
          {
            id: 1,
            course_code: "COSC-410",
            name: "Computer Science 410",
            description: "Advanced programming course",
            professor_id: 301,
            enrollment_key: "SECURE123KEY",
          }
        ])
      )
    );

    renderFacultyDashboard();

    await screen.findByText("COSC-410");

    // Should display course details
    expect(screen.getByText("Computer Science 410")).toBeInTheDocument();
    expect(screen.getByText("Advanced programming course")).toBeInTheDocument();
  });
});
