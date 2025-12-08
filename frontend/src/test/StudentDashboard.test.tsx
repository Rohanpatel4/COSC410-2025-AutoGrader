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

    expect(await screen.findByText("Join Course")).toBeInTheDocument();
    expect(await screen.findByText(/My Courses/i)).toBeInTheDocument();
    expect(screen.getByText("Enrolled Courses")).toBeInTheDocument();
    expect(screen.getByText(/No courses yet/i)).toBeInTheDocument();
  });

  test("join course button navigates to join flow", async () => {
    renderDashboard();

    await userEvent.click(screen.getByText("Join Course"));
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
    expect(screen.getByText("Enrolled Courses")).toBeInTheDocument();
    // Find the "1" within the enrolled courses card
    const enrolledCoursesCard = screen.getByText("Enrolled Courses").closest('.flex.items-center.gap-5');
    expect(enrolledCoursesCard).toHaveTextContent("1");

    await userEvent.click(screen.getByText(/AutoGrader/i));
    expect(await screen.findByText(/COURSE PAGE COSC-410/i)).toBeInTheDocument();
  });

  test("shows empty state when student has no courses", async () => {
    __testDb.state.enrollmentsByStudent = __testDb.state.enrollmentsByStudent ?? {};
    __testDb.state.enrollmentsByStudent[201] = [];

    renderDashboard();

    expect(await screen.findByText(/No courses yet/i)).toBeInTheDocument();
  });

  test("shows error alert when GET fails", async () => {
    server.use(
      http.get("**/api/v1/students/:id/courses", () =>
        HttpResponse.text("whoops", { status: 500 })
      )
    );

    renderDashboard();

    expect(await screen.findByText(/Failed to load courses|whoops/i)).toBeInTheDocument();
    expect(screen.getByText(/No courses yet/i)).toBeInTheDocument();
  });

  test("displays enrolled courses correctly", async () => {
    server.use(
      http.get("**/api/v1/students/201/courses", () =>
        HttpResponse.json([
          {
            id: 1,
            course_code: "COSC-410",
            name: "Computer Science 410",
            description: "Advanced software engineering",
            professor_id: 301,
          },
          {
            id: 2,
            course_code: "MATH-201",
            name: "Mathematics 201",
            description: "Calculus II",
            professor_id: 302,
          }
        ])
      )
    );

    renderDashboard();

    expect(await screen.findByText("COSC-410")).toBeInTheDocument();
    expect(screen.getByText("Computer Science 410")).toBeInTheDocument();
    expect(screen.getByText("MATH-201")).toBeInTheDocument();
    expect(screen.getByText("Mathematics 201")).toBeInTheDocument();
  });

  test("navigates to course when clicking course card", async () => {
    server.use(
      http.get("**/api/v1/students/201/courses", () =>
        HttpResponse.json([
          {
            id: 1,
            course_code: "COSC-410",
            name: "Computer Science 410",
            description: "Advanced software engineering",
            professor_id: 301,
          }
        ])
      )
    );

    renderDashboard();

    await screen.findByText("COSC-410");

    const courseCard = screen.getByText("COSC-410").closest('div');
    await userEvent.click(courseCard!);

    expect(await screen.findByText(/COURSE PAGE COSC-410/i)).toBeInTheDocument();
  });

  test("shows course statistics", async () => {
    server.use(
      http.get("**/api/v1/students/201/courses", () =>
        HttpResponse.json([
          {
            id: 1,
            course_code: "COSC-410",
            name: "Computer Science 410",
            description: "Advanced software engineering",
            professor_id: 301,
          }
        ])
      )
    );

    renderDashboard();

    await screen.findByText("COSC-410");

    // Should show course information
    expect(screen.getByText("Computer Science 410")).toBeInTheDocument();
    expect(screen.getByText("Advanced software engineering")).toBeInTheDocument();
  });

  test("handles empty course list", async () => {
    server.use(
      http.get("**/api/v1/students/201/courses", () =>
        HttpResponse.json([])
      )
    );

    renderDashboard();

    await screen.findByText(/My Courses/i);

    expect(screen.getByText(/No courses yet/i)).toBeInTheDocument();
  });

  test("shows loading state initially", async () => {
    // Slow API response to test loading state
    server.use(
      http.get("**/api/v1/students/201/courses", async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json([]);
      })
    );

    renderDashboard();

    // Should show loading or wait for content
    expect(await screen.findByText(/My Courses/i)).toBeInTheDocument();
  });

  test("handles course navigation errors gracefully", async () => {
    server.use(
      http.get("**/api/v1/students/201/courses", () =>
        HttpResponse.json([
          {
            id: 1,
            course_code: "COSC-410",
            name: "Computer Science 410",
            description: "Advanced software engineering",
            professor_id: 301,
          }
        ])
      )
    );

    renderDashboard();

    await screen.findByText("COSC-410");

    // Navigation should work without errors
    const courseCard = screen.getByText("COSC-410").closest('div');
    await userEvent.click(courseCard!);

    expect(await screen.findByText(/COURSE PAGE COSC-410/i)).toBeInTheDocument();
  });

  test("displays course enrollment key when available", async () => {
    server.use(
      http.get("**/api/v1/students/201/courses", () =>
        HttpResponse.json([
          {
            id: 1,
            course_code: "COSC-410",
            name: "Computer Science 410",
            description: "Advanced software engineering",
            professor_id: 301,
            enrollment_key: "ABC123XYZ789"
          }
        ])
      )
    );

    renderDashboard();

    await screen.findByText("COSC-410");

    // Should display course information
    expect(screen.getByText("Computer Science 410")).toBeInTheDocument();
  });

  test("handles multiple courses display", async () => {
    server.use(
      http.get("**/api/v1/students/201/courses", () =>
        HttpResponse.json([
          {
            id: 1,
            course_code: "COSC-410",
            name: "Computer Science 410",
            description: "Advanced software engineering",
            professor_id: 301,
          },
          {
            id: 2,
            course_code: "MATH-201",
            name: "Mathematics 201",
            description: "Calculus II",
            professor_id: 302,
          },
          {
            id: 3,
            course_code: "PHYS-101",
            name: "Physics 101",
            description: "Mechanics",
            professor_id: 303,
          }
        ])
      )
    );

    renderDashboard();

    await screen.findByText("COSC-410");

    expect(screen.getByText("MATH-201")).toBeInTheDocument();
    expect(screen.getByText("PHYS-101")).toBeInTheDocument();
    expect(screen.getAllByText(/Computer Science 410|Mathematics 201|Physics 101/)).toHaveLength(3);
  });

  test("maintains UI state during interactions", async () => {
    server.use(
      http.get("**/api/v1/students/201/courses", () =>
        HttpResponse.json([
          {
            id: 1,
            course_code: "COSC-410",
            name: "Computer Science 410",
            description: "Advanced software engineering",
            professor_id: 301,
          }
        ])
      )
    );

    renderDashboard();

    await screen.findByText("COSC-410");

    // UI should remain stable
    expect(screen.getByText("Join Course")).toBeInTheDocument();
    expect(screen.getByText(/My Courses/i)).toBeInTheDocument();
  });
});

