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
});
