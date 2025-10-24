import React from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Routes, Route, useParams } from "react-router-dom";

import FacultyDashboard from "../webpages/FacultyDashboard";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";
import { __testDb, resetDb } from "./handlers";

// Dummy route to verify navigation
function CourseStub() {
  const { course_code = "" } = useParams();
  return <div>COURSE PAGE {course_code}</div>;
}

function renderFacultyDashboard() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<FacultyDashboard />} />
      <Route path="/courses/:course_code" element={<CourseStub />} />
    </Routes>,
    {
      route: "/",
      auth: { role: "faculty", userId: "301" },
    }
  );
}

describe("FacultyDashboard (updated to match new component)", () => {
  beforeEach(() => resetDb());

  test("loads faculty’s courses and allows opening a course", async () => {
    // Seed one test course in mock DB
    __testDb.state.coursesByProfessor[301] = [
      {
        id: 1,
        course_code: "COSC-410",
        name: "AutoGrader",
        enrollment_key: "abc123",
        description: "Software design course",
      },
    ];

    renderFacultyDashboard();

    // Course appears after fetch
    expect(await screen.findByText(/COSC-410\s*–\s*AutoGrader/i)).toBeInTheDocument();
    expect(screen.getByText(/Key:\s*abc123/i)).toBeInTheDocument();
    expect(screen.getByText(/1 total/i)).toBeInTheDocument();

    // Click Open and land on course stub page
    await userEvent.click(screen.getByRole("button", { name: /open/i }));
    expect(await screen.findByText(/COURSE PAGE COSC-410/i)).toBeInTheDocument();
  });

  test("creates a course and prepends it to the list", async () => {
    renderFacultyDashboard();

    // Fill out the form
    await userEvent.type(screen.getByLabelText(/course code/i), "BIO-200");
    await userEvent.type(screen.getByLabelText(/course name/i), "Intro Biology");
    await userEvent.type(screen.getByLabelText(/description/i), "Biology basics");

    // Submit
    await userEvent.click(screen.getByRole("button", { name: /create course/i }));

    // Success message appears
    expect(await screen.findByRole("status")).toHaveTextContent(/course created/i);

    // Newly created course is visible at the top
    const openButtons = await screen.findAllByRole("button", { name: /open/i });
    const firstRow = openButtons[0].closest("div")!;
    expect(within(firstRow).getByText(/BIO-200\s*–\s*Intro Biology/i)).toBeInTheDocument();

    // Should reflect in mock DB
    expect(__testDb.getAll(301).length).toBeGreaterThanOrEqual(1);
  });

  test("disables the create button until required fields are filled", async () => {
    renderFacultyDashboard();
    const createBtn = screen.getByRole("button", { name: /create course/i });

    // Initially disabled
    expect(createBtn).toBeDisabled();

    // Type one field -> still disabled
    await userEvent.type(screen.getByLabelText(/course code/i), "COSC-300");
    expect(createBtn).toBeDisabled();

    // Fill second field -> enabled
    await userEvent.type(screen.getByLabelText(/course name/i), "Data Structures");
    expect(createBtn).toBeEnabled();
  });

  test("shows a backend error if POST /courses fails", async () => {
    server.use(
      http.post("**/api/v1/courses", () => HttpResponse.text("server exploded", { status: 500 }))
    );

    renderFacultyDashboard();

    await userEvent.type(screen.getByLabelText(/course code/i), "ERR-101");
    await userEvent.type(screen.getByLabelText(/course name/i), "Error Course");
    await userEvent.click(screen.getByRole("button", { name: /create course/i }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/server exploded|create failed/i);
  });

  test("shows an error if GET /courses/faculty/:id fails", async () => {
    server.use(
      http.get("**/api/v1/courses/faculty/:id", () =>
        HttpResponse.text("load failed", { status: 500 })
      )
    );

    renderFacultyDashboard();

    // Shows failure message and empty list
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/failed to load|load failed/i);

    expect(await screen.findByText(/0 total/i)).toBeInTheDocument();
    expect(screen.getByText(/no courses yet/i)).toBeInTheDocument();
  });

  test("renders empty state when professor has no courses", async () => {
    __testDb.state.coursesByProfessor[301] = [];

    renderFacultyDashboard();

    expect(await screen.findByText(/0 total/i)).toBeInTheDocument();
    expect(screen.getByText(/no courses yet/i)).toBeInTheDocument();
    expect(screen.getByText(/create your first course/i)).toBeInTheDocument();
  });

  test("shows logout button", async () => {
    renderFacultyDashboard();
    
    expect(await screen.findByRole("button", { name: /log out/i })).toBeInTheDocument();
  });
});
