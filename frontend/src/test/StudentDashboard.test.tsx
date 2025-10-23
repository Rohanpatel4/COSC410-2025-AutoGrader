import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes, useParams } from "react-router-dom";

import StudentDashboard from "../webpages/StudentDashboard";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";
import { resetDb, __testDb } from "./handlers";

// Tiny stub route to confirm navigation
function CourseStub() {
  const { course_code = "" } = useParams();
  return <div>COURSE PAGE {course_code}</div>;
}

describe("StudentDashboard (MSW)", () => {
  beforeEach(() => {
    resetDb(); // start clean (no enrollments for any student)
  });

  test("shows empty state, registers by course_tag, and opens course", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<StudentDashboard />} />
        <Route path="/courses/:course_tag" element={<CourseStub />} />
      </Routes>,
      { route: "/", auth: { role: "student", userId: "201" } }
    );

    // Empty state first
    expect(await screen.findByText(/not enrolled/i)).toBeInTheDocument();

    // Button disabled until a tag is entered
    const btn = screen.getByRole("button", { name: /register/i });
    expect(btn).toBeDisabled();

    // Enter known seeded tag "500" (FirstCourse)
    await userEvent.type(
      screen.getByLabelText(/course tag/i),
      "500"
    );
    expect(btn).toBeEnabled();

    // Register
    await userEvent.click(btn);

    // Input clears after successful register
    await screen.findByDisplayValue(""); // or:
    expect((screen.getByLabelText(/course tag/i) as HTMLInputElement).value).toBe("");

    // Course appears in list
    expect(await screen.findByText(/500\s*-\s*FirstCourse/i)).toBeInTheDocument();

    // Click Open -> navigate to stub
    await userEvent.click(screen.getByRole("button", { name: /open/i }));
    expect(await screen.findByText(/COURSE PAGE 500/i)).toBeInTheDocument();

    // DB reflects enrollment
    expect(__testDb.getStudentCourses(201)).toHaveLength(1);
  });

  test("button disabled with empty/blank input", async () => {
    renderWithProviders(<StudentDashboard />, {
      route: "/",
      auth: { role: "student", userId: "201" },
    });

    const btn = screen.getByRole("button", { name: /register/i });
    expect(btn).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/course tag/i), "   ");
    expect(btn).toBeDisabled();

    await userEvent.clear(screen.getByLabelText(/course tag/i));
    await userEvent.type(screen.getByLabelText(/course tag/i), "500");
    expect(btn).toBeEnabled();

    await userEvent.clear(screen.getByLabelText(/course tag/i));
    expect(btn).toBeDisabled();
  });

  test("shows an error message if GET /students/:id/courses fails", async () => {
    server.use(
      http.get("**/api/v1/students/:id/courses", () =>
        HttpResponse.text("whoops", { status: 500 })
      )
    );

    renderWithProviders(<StudentDashboard />, {
      route: "/",
      auth: { role: "student", userId: "201" },
    });

    const status = await screen.findByRole("status");
    expect(status.textContent?.toLowerCase()).toMatch(/whoops|failed/);
  });

  test("shows backend error if POST /registrations fails", async () => {
    server.use(
      http.post("**/api/v1/registrations", () =>
        HttpResponse.text("boom", { status: 500 })
      )
    );

    renderWithProviders(<StudentDashboard />, {
      route: "/",
      auth: { role: "student", userId: "201" },
    });

    await userEvent.type(screen.getByLabelText(/course tag/i), "500");
    await userEvent.click(screen.getByRole("button", { name: /register/i }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/boom/i);
  });

  test("handles unknown course_tag (404 from server)", async () => {
    renderWithProviders(<StudentDashboard />, {
      route: "/",
      auth: { role: "student", userId: "201" },
    });

    await userEvent.type(screen.getByLabelText(/course tag/i), "999999");
    await userEvent.click(screen.getByRole("button", { name: /register/i }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/not found|failed|course/i);
  });
});
