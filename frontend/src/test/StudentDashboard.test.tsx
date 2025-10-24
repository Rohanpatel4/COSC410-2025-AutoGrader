import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes, useParams } from "react-router-dom";

import StudentDashboard from "../webpages/StudentDashboard";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";
import { resetDb, __testDb } from "./handlers";

// Stub route to confirm navigation
function CourseStub() {
  const { course_code = "" } = useParams();
  return <div>COURSE PAGE {course_code}</div>;
}

describe("StudentDashboard (MSW, updated)", () => {
  beforeEach(() => {
    resetDb();
  });

  test("shows empty state, registers with enrollment key, and opens course", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<StudentDashboard />} />
        <Route path="/courses/:course_code" element={<CourseStub />} />
      </Routes>,
      { route: "/", auth: { role: "student", userId: "201" } }
    );

    // Empty state text
    expect(await screen.findByText(/not enrolled/i)).toBeInTheDocument();

    const registerBtn = screen.getByRole("button", { name: /register/i });
    expect(registerBtn).toBeDisabled();

    // Input labeled “Enrollment Key”
    const input = screen.getByLabelText(/enrollment key/i);
    await userEvent.type(input, "ABC123XYZ789"); // seeded key for COSC-410 / FirstCourse
    expect(registerBtn).toBeEnabled();

    // Submit registration
    await userEvent.click(registerBtn);

    // Confirm success message
    expect(await screen.findByText(/firstcourse/i)).toBeInTheDocument();

    expect((screen.getByLabelText(/enrollment key/i) as HTMLInputElement).value).toBe("");

    // Course list reloads and displays new course
    // UI shows "COSC-410 - FirstCourse"
    expect(await screen.findByText(/firstcourse/i)).toBeInTheDocument();

    // Open course navigation works (param is course_code)
    await userEvent.click(screen.getByRole("button", { name: /open/i }));
    expect(await screen.findByText(/COURSE PAGE COSC-410/i)).toBeInTheDocument();

    // DB shows new enrollment
    expect(__testDb.getStudentCourses(201)).toHaveLength(1);
  });

  test("disables register button when input is blank or whitespace", async () => {
    renderWithProviders(<StudentDashboard />, {
      route: "/",
      auth: { role: "student", userId: "201" },
    });

    const btn = screen.getByRole("button", { name: /register/i });
    expect(btn).toBeDisabled();

    const input = screen.getByLabelText(/enrollment key/i);
    await userEvent.type(input, "   ");
    expect(btn).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, "SOMEKEY");
    expect(btn).toBeEnabled();

    await userEvent.clear(input);
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

    const input = screen.getByLabelText(/enrollment key/i);
    await userEvent.type(input, "ABC123XYZ789");
    await userEvent.click(screen.getByRole("button", { name: /register/i }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/boom|failed/i);
  });

  test("handles unknown enrollment key (404 from server)", async () => {
    server.use(
      http.post("**/api/v1/registrations", () =>
        HttpResponse.text("Not Found", { status: 404 })
      )
    );

    renderWithProviders(<StudentDashboard />, {
      route: "/",
      auth: { role: "student", userId: "201" },
    });

    const input = screen.getByLabelText(/enrollment key/i);
    await userEvent.type(input, "INVALIDTAG123");
    await userEvent.click(screen.getByRole("button", { name: /register/i }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/not found|failed|course/i);
  });
});

