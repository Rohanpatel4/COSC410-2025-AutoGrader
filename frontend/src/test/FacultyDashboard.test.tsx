// src/test/FacultyDashboard.test.tsx
import React from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes, useParams } from "react-router-dom";

import FacultyDashboard from "../webpages/FacultyDashboard";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";                 // <- only this server
import { __testDb, resetDb } from "./handlers";    // <- db helpers only

// A tiny dummy route so we can assert navigation works
function CourseStub() {
  const { course_tag = "" } = useParams();
  return <div>COURSE PAGE {course_tag}</div>;
}

describe("FacultyDashboard (MSW)", () => {
  beforeEach(() => {
    resetDb();
  });

  test("loads professor's courses and opens one", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<FacultyDashboard />} />
        <Route path="/courses/:course_tag" element={<CourseStub />} />
      </Routes>,
      {
        route: "/",
        auth: { role: "faculty", userId: "301" },
      }
    );

    // Seeded course is visible
    expect(await screen.findByText(/FirstCourse/i)).toBeInTheDocument();

    // Click Open and land on the stub route
    await userEvent.click(screen.getByRole("button", { name: /open/i }));

    // Confirm navigation by reading the stub content
    expect(await screen.findByText(/COURSE PAGE 500/i)).toBeInTheDocument();
  });

  test("creates a course and prepends it to the list", async () => {
    renderWithProviders(<FacultyDashboard />, {
      route: "/",
      auth: { role: "faculty", userId: "301" },
    });

    // Fill the form
    await userEvent.type(screen.getByLabelText(/course tag/i), "777");
    await userEvent.type(screen.getByLabelText(/course name/i), "NewCourse");
    await userEvent.type(screen.getByLabelText(/description/i), "desc");

    // Submit
    await userEvent.click(screen.getByRole("button", { name: /create course/i }));

    // Success status
    expect(await screen.findByRole("status")).toHaveTextContent(/course created!/i);

    // The new course is visible (and should appear first)
    const items = await screen.findAllByRole("button", { name: /open/i });
    const firstRow = items[0].closest("div")!;
    expect(within(firstRow).getByText(/777\s*-\s*NewCourse/i)).toBeInTheDocument();

    // DB has 2 items now for professor 301
    expect(__testDb.getAll(301)).toHaveLength(2);
  });

  test("validates required fields via disabled state before submit", async () => {
    renderWithProviders(<FacultyDashboard />, {
      route: "/",
      auth: { role: "faculty", userId: "301" },
    });

    const createBtn = screen.getByRole("button", { name: /create course/i });

    // Initially disabled
    expect(createBtn).toBeDisabled();

    // Type only one field -> still disabled
    await userEvent.type(screen.getByLabelText(/course tag/i), "777");
    expect(createBtn).toBeDisabled();

    // Fill the other required field -> enabled
    await userEvent.type(screen.getByLabelText(/course name/i), "NewCourse");
    expect(createBtn).toBeEnabled();
  });

  test("shows a backend error message if POST fails", async () => {
    // Force the POST to fail for this test only
    server.use(
      http.post("**/api/v1/courses", () =>
        HttpResponse.text("boom", { status: 500 })
      )
    );

    renderWithProviders(<FacultyDashboard />, {
      route: "/",
      auth: { role: "faculty", userId: "301" },
    });

    await userEvent.type(screen.getByLabelText(/course tag/i), "999");
    await userEvent.type(screen.getByLabelText(/course name/i), "BadCourse");
    await userEvent.click(screen.getByRole("button", { name: /create course/i }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/boom/i);
  });

  // ---------- NEW EDGE TESTS ----------

  test("shows an error message if GET /courses fails", async () => {
    server.use(
      http.get("**/api/v1/courses", () =>
        HttpResponse.text("load failed", { status: 500 })
      )
    );

    renderWithProviders(<FacultyDashboard />, {
      route: "/",
      auth: { role: "faculty", userId: "301" },
    });

    // Error bubble appears
    const status = await screen.findByRole("status");
    expect(status).toBeInTheDocument();

    // Since load failed, the list should be empty/zero total with empty-state copy
    expect(await screen.findByText(/0 total/i)).toBeInTheDocument();
    expect(screen.getByText(/no courses yet/i)).toBeInTheDocument();
  });

  test("renders empty state when professor has no courses", async () => {
    resetDb();
    __testDb.state.coursesByProfessor[301] = [];

    renderWithProviders(<FacultyDashboard />, {
      route: "/",
      auth: { role: "faculty", userId: "301" },
    });

    expect(await screen.findByText(/0 total/i)).toBeInTheDocument();
    expect(screen.getByText(/no courses yet/i)).toBeInTheDocument();
    expect(screen.getByText(/create your first course/i)).toBeInTheDocument();
  });
});
