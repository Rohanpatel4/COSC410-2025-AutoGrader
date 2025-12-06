import React from "react";
import { Route, Routes } from "react-router-dom";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import AssignmentDetailPage from "../webpages/AssignmentDetailPage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";
import { __testDb, resetDb } from "./handlers";

describe("AssignmentDetailPage (MSW, updated)", () => {
  beforeEach(() => resetDb());

  const renderAsStudent = (id = 9001) =>
    renderWithProviders(
      <Routes>
        <Route
          path="/assignments/:assignment_id"
          element={<AssignmentDetailPage />}
        />
      </Routes>,
      { route: `/assignments/${id}`, auth: { role: "student", userId: "201" } }
    );

  const renderAsFaculty = (id = 9001) =>
    renderWithProviders(
      <Routes>
        <Route
          path="/assignments/:assignment_id"
          element={<AssignmentDetailPage />}
        />
      </Routes>,
      { route: `/assignments/${id}`, auth: { role: "faculty", userId: "301" } }
    );

  // --- STUDENT TESTS ---

  test("loads assignment details (student) and shows attempts", async () => {
    renderAsStudent();

    expect(await screen.findByRole("heading", { name: /seeded assignment/i })).toBeInTheDocument();
    expect(screen.getByText(/submission limit/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();

    // Attempts (from test DB)
    expect(await screen.findByText(/your attempts/i)).toBeInTheDocument();
    expect(screen.getByText(/best grade/i)).toBeInTheDocument();
  });

  test("blocks submission when window is closed", async () => {
    // Force a future start date to simulate closed window
    server.use(
      http.get("**/api/v1/assignments/:id", ({ params }) => {
        const id = Number(params.id);
        const base = __testDb.getAssignment(id);
        const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        return HttpResponse.json({ ...base, start: future });
      })
    );

    renderAsStudent();

    expect(await screen.findByText(/submission window is closed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
  });

  test("blocks when submission limit reached", async () => {
    server.use(
      http.get("**/api/v1/assignments/:id", ({ params }) => {
        const id = Number(params.id);
        const base = __testDb.getAssignment(id);
        return HttpResponse.json({ ...base, sub_limit: 1 });
      }),
      http.get("**/api/v1/assignments/:id/attempts", ({ params }) => {
        return HttpResponse.json([{ id: 1, grade: 90 }]);
      })
    );

    // blocks when submission limit reached
    renderAsStudent();

    expect(await screen.findByText(/^submission limit/i)).toBeInTheDocument(); // ← anchor start
    expect(await screen.findByText(/you've reached the submission limit/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
  });

  test("shows error if GET /assignments/:id fails", async () => {
    server.use(
      http.get("**/api/v1/assignments/:id", () =>
        HttpResponse.text("Server broke", { status: 500 })
      )
    );

    renderAsStudent();

    expect(await screen.findByText(/server broke|failed to load/i)).toBeInTheDocument();
  });

  test("submit validation shows error for missing file", async () => {
    renderAsStudent();

    await screen.findByRole("heading", { name: /seeded assignment/i });

    // Submit with no file → click submit button to open modal
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    // Click confirm in modal to trigger validation
    await userEvent.click(screen.getByRole("button", { name: /submit solution/i }));

    // Should show validation error
    expect(await screen.findByText(/either choose a \.py file or paste your code/i)).toBeInTheDocument();
  });

  test("failed POST displays correct error", async () => {
    // Mock failed submission
    server.use(
      http.post("**/api/v1/assignments/:id/submit", () =>
        HttpResponse.text("Bad upload", { status: 500 })
      )
    );

    renderAsStudent();

    await screen.findByRole("heading", { name: /seeded assignment/i });

    const fileInput = screen.getByLabelText(/upload file/i);
    const badFile = new File(["print('oops')"], "fail.py", { type: "text/x-python" });
    await userEvent.upload(fileInput, badFile);
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    // Confirm submission in modal
    await userEvent.click(screen.getByRole("button", { name: /submit solution/i }));

    expect(await screen.findByText(/bad upload/i)).toBeInTheDocument();
  });

  test("submits .py successfully and updates attempts + best grade", async () => {
    renderAsStudent();

    await screen.findByRole("heading", { name: /seeded assignment/i });

    const fileInput = screen.getByLabelText(/upload file/i);
    const file = new File(["print('hi')"], "sol.py", { type: "text/x-python" });
    await userEvent.upload(fileInput, file);

    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText(/Submitted\. Grade: 95/i)).toBeInTheDocument();
    expect(await screen.findByText(/^PASS$/i)).toBeInTheDocument();
    expect(await screen.findByText(/Attempt 1: Grade 95/i)).toBeInTheDocument();
    expect(await screen.findByText(/Best grade/i)).toHaveTextContent(/Best grade:\s*95/);
  });

  // --- FACULTY TESTS ---

  test("faculty view: sees grade table but no submit form", async () => {
    renderAsFaculty();

    expect(await screen.findByRole("heading", { name: /seeded assignment/i })).toBeInTheDocument();

    // Ensure no student submit form exists
    expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/submit your code/i)).not.toBeInTheDocument();

    // Faculty-specific section
    expect(await screen.findByText(/grades \(this assignment\)/i)).toBeInTheDocument();

    // Should show either data table or empty state
    const possible = await screen.findAllByText(/no enrolled students|student/i);
    expect(possible.length).toBeGreaterThan(0);
  });

  test("faculty view: shows error message if /grades fails", async () => {
    server.use(
      http.get("**/api/v1/assignments/:id/grades", () =>
        HttpResponse.text("Grades unavailable", { status: 500 })
      )
    );

    renderAsFaculty();

    expect(await screen.findByText(/student grades/i)).toBeInTheDocument();
    expect(await screen.findByText(/grades unavailable|failed to load/i)).toBeInTheDocument();
  });
});
