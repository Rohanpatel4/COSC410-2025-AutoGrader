import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes, useParams } from "react-router-dom";

import StudentDashboard from "../webpages/StudentDashboard";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";
import { resetDb, __testDb } from "./handlers";

function CourseStub() {
  const { course_code = "" } = useParams();
  return <div>COURSE PAGE {course_code}</div>;
}

function JoinStub() {
  return <div>JOIN PAGE</div>;
}

describe("StudentDashboard", () => {
  beforeEach(() => resetDb());

  function renderDashboard() {
    return renderWithProviders(
      <Routes>
        <Route path="/" element={<StudentDashboard />} />
        <Route path="/courses/:course_code" element={<CourseStub />} />
        <Route path="/courses/join" element={<JoinStub />} />
      </Routes>,
      { route: "/", auth: { role: "student", userId: "201" } }
    );
  }

  test("renders CTA cards", async () => {
    renderDashboard();

    expect(await screen.findByText(/Join a Course/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Join Course/i })).toBeInTheDocument();
    expect(await screen.findByText(/My Courses/i)).toBeInTheDocument();
    expect(screen.getByText(/0 courses/i)).toBeInTheDocument();
    expect(screen.getByText(/No courses enrolled yet/i)).toBeInTheDocument();
  });

  test("join course button navigates to join flow", async () => {
    renderDashboard();

    await userEvent.click(screen.getByRole("button", { name: /Join Course/i }));
    expect(await screen.findByText(/JOIN PAGE/i)).toBeInTheDocument();
  });

  test("displays enrolled courses returned by the API", async () => {
    __testDb.state.enrollmentsByStudent = __testDb.state.enrollmentsByStudent ?? {};
    __testDb.state.enrollmentsByStudent[201] = [
      {
        id: 42,
        course_code: "COSC-410",
        name: "AutoGrader",
        description: "Testing course",
        professor_id: 301,
      },
    ];

    renderDashboard();

    expect(await screen.findByText(/AutoGrader/i)).toBeInTheDocument();
    expect(screen.getByText(/COSC-410/i)).toBeInTheDocument();
    expect(screen.getByText(/1 course/i)).toBeInTheDocument();

    await userEvent.click(screen.getByText(/AutoGrader/i));
    expect(await screen.findByText(/COURSE PAGE COSC-410/i)).toBeInTheDocument();
  });

  test("shows empty state when student has no courses", async () => {
    __testDb.state.enrollmentsByStudent = __testDb.state.enrollmentsByStudent ?? {};
    __testDb.state.enrollmentsByStudent[201] = [];

    renderDashboard();

    expect(await screen.findByText(/No courses enrolled yet/i)).toBeInTheDocument();
  });

  test("shows error alert when GET fails", async () => {
    server.use(
      http.get("**/api/v1/students/:id/courses", () =>
        HttpResponse.text("whoops", { status: 500 })
      )
    );

    renderDashboard();

    expect(await screen.findByText(/Failed to load courses|whoops/i)).toBeInTheDocument();
    expect(screen.getByText(/No courses enrolled yet/i)).toBeInTheDocument();
  });
});

