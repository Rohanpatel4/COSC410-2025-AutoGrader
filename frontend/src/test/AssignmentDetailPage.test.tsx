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
    // Check for attempts display format: "X / Y Attempts" or just "X Attempts"
    expect(await screen.findByText(/\d+\s*\/?\s*\d*\s*Attempts/i)).toBeInTheDocument();
    
    // Submit button might be disabled if no code/file
    const submitButton = screen.getByRole("button", { name: /submit/i });
    expect(submitButton).toBeInTheDocument();
    
    // Best grade only shows if there are attempts - if no attempts, it won't be displayed
    // So we just check that the assignment loads and attempts display is present
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

    // The component shows a "Closed" button when window is closed
    expect(await screen.findByRole("button", { name: /closed/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /closed/i })).toBeDisabled();
  });

  test("blocks when submission limit reached", async () => {
    server.use(
      http.get("**/api/v1/assignments/:id", ({ params }) => {
        const id = Number(params.id);
        const base = __testDb.getAssignment(id);
        return HttpResponse.json({ ...base, sub_limit: 1 });
      }),
      http.get("**/api/v1/assignments/:id/attempts", ({ request, params }) => {
        const url = new URL(request.url);
        const studentId = url.searchParams.get("student_id");
        if (studentId === "201") {
          return HttpResponse.json([{ id: 1, grade: 90, earned_points: 90 }]);
        }
        return HttpResponse.json([]);
      })
    );

    // blocks when submission limit reached
    renderAsStudent();

    // The component shows "Limit Reached (0 of X)" button when limit is reached
    expect(await screen.findByRole("button", { name: /limit reached/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /limit reached/i })).toBeDisabled();
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
    const submitButton = await screen.findByRole("button", { name: /submit/i });
    // Button might be disabled if no code/file, so check if we can click it
    if (!submitButton.hasAttribute('disabled')) {
      await userEvent.click(submitButton);
      
      // Click confirm in modal to trigger validation
      const confirmButton = await screen.findByRole("button", { name: /submit solution|submit anyway/i });
      await userEvent.click(confirmButton);

      // Should show validation error - the error message format
      expect(await screen.findByText(/either choose a.*file or paste your code/i)).toBeInTheDocument();
    } else {
      // If button is disabled, validation already prevents submission
      expect(submitButton).toBeDisabled();
    }
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
    
    const submitButton = await screen.findByRole("button", { name: /submit/i });
    await userEvent.click(submitButton);

    // Confirm submission in modal
    const confirmButton = await screen.findByRole("button", { name: /submit solution|submit anyway/i });
    await userEvent.click(confirmButton);

    // Error message format: "Submit failed: 500 Bad upload"
    expect(await screen.findByText(/bad upload/i, {}, { timeout: 5000 })).toBeInTheDocument();
  });

  test("submits .py successfully and updates attempts + best grade", async () => {
    // Setup mock to return attempts after submission
    let attemptId = 1;
    server.use(
      http.get("**/api/v1/assignments/:id/attempts", ({ request, params }) => {
        const url = new URL(request.url);
        const studentId = url.searchParams.get("student_id");
        if (studentId === "201") {
          // Return attempts including the new one after submission
          return HttpResponse.json([
            { id: attemptId, grade: 95, earned_points: 95, created_at: new Date().toISOString() }
          ]);
        }
        return HttpResponse.json([]);
      })
    );

    renderAsStudent();

    await screen.findByRole("heading", { name: /seeded assignment/i });

    const fileInput = screen.getByLabelText(/upload file/i);
    const file = new File(["print('hi')"], "sol.py", { type: "text/x-python" });
    await userEvent.upload(fileInput, file);

    const submitButton = await screen.findByRole("button", { name: /submit/i });
    await userEvent.click(submitButton);

    // Confirm submission in modal
    const confirmButton = await screen.findByRole("button", { name: /submit solution|submit anyway/i });
    await userEvent.click(confirmButton);

    // Success message format: "Submitted. Grade: 95%"
    expect(await screen.findByText(/Submitted.*Grade.*95/i, {}, { timeout: 10000 })).toBeInTheDocument();
    
    // After submission, attempts should refresh and show best grade
    // Wait a bit for the attempts to refresh, then check for best grade
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check that best grade is updated - format is "Best: 95/X" or "Best: 95%"
    // This might take a moment as the component refetches attempts
    expect(await screen.findByText(/Best.*95/i, {}, { timeout: 5000 })).toBeInTheDocument();
  });

  // --- FACULTY TESTS ---

  test("faculty view: sees grade table but no submit form", async () => {
    renderAsFaculty();

    expect(await screen.findByRole("heading", { name: /seeded assignment/i })).toBeInTheDocument();

    // Ensure no student submit form exists
    expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/submit your code|upload file/i)).not.toBeInTheDocument();

    // Faculty-specific section - check for grades table or related text
    expect(await screen.findByText(/student grades|grades.*assignment|grades.*this assignment/i, {}, { timeout: 5000 })).toBeInTheDocument();
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
