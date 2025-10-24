import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Routes, Route } from "react-router-dom";

import CoursePage from "../webpages/CoursePage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";
import { resetDb, __testDb } from "./handlers";

function renderCourse({
  courseId = "500",
  auth,
}: {
  courseId?: string;
  auth: { role: "faculty" | "student"; userId: string };
}) {
  return renderWithProviders(
    <Routes>
      <Route path="/courses/:course_id" element={<CoursePage />} />
      <Route path="/assignments/:id" element={<div>ASSIGNMENT PAGE</div>} />
      <Route path="/my" element={<div>DASHBOARD</div>} />
    </Routes>,
    { route: `/courses/${courseId}`, auth }
  );
}

describe("CoursePage (updated to match new component)", () => {
  beforeEach(() => resetDb());

  test("faculty: loads course header, roster, and assignments; shows create toggle", async () => {
    renderCourse({ courseId: "500", auth: { role: "faculty", userId: "301" } });

    // Wait for course data to load
    expect(await screen.findByRole("heading", { name: /COSC-410/i })).toBeInTheDocument();

    // Course description
    expect(screen.getByText(/no description provided|course/i)).toBeInTheDocument();

    // Faculty section renders
    expect(await screen.findByRole('heading', { name: /faculty/i })).toBeInTheDocument();
    // Specific faculty member renders
    expect(screen.getByText(/Prof\.?\s+Ada/i)).toBeInTheDocument();
    expect(await screen.findByText(/Student Sam/i)).toBeInTheDocument();

    // Existing seeded assignment
    expect(await screen.findByRole("button", { name: /seeded assignment/i })).toBeInTheDocument();

    // Faculty can see Create + Gradebook buttons
    expect(screen.getByRole("button", { name: /create assignment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view gradebook/i })).toBeInTheDocument();

    // Toggle create form
    await userEvent.click(screen.getByRole("button", { name: /create assignment/i }));
    expect(screen.getByRole("button", { name: /save assignment/i })).toBeInTheDocument();

    // Cancel closes form
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("button", { name: /save assignment/i })).not.toBeInTheDocument();
  });

  test("student: sees same course header but no create toggle", async () => {
    renderCourse({ courseId: "500", auth: { role: "student", userId: "201" } });

    expect(await screen.findByRole("heading", { name: /COSC-410/i })).toBeInTheDocument();

    // Sees course description + lists
    expect(await screen.findByText(/student sam/i)).toBeInTheDocument();

    // Students should NOT see create/gradebook buttons
    expect(screen.queryByRole("button", { name: /create assignment/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /view gradebook/i })).toBeNull();
  });

  test("faculty: successfully creates an assignment", async () => {
    renderCourse({ courseId: "500", auth: { role: "faculty", userId: "301" } });

    // Wait for existing data
    await screen.findByText(/seeded assignment/i);

    // Open creation form
    await userEvent.click(screen.getByRole("button", { name: /create assignment/i }));

    // Fill required fields
    await userEvent.type(screen.getByLabelText(/title/i), "New Homework");
    await userEvent.type(screen.getByLabelText(/description/i), "Test assignment");

    // Optional test file upload
    const fileInput = screen.getByLabelText(/attach test file/i);
    const testFile = new File(["print('ok')"], "tests.py", { type: "text/x-python" });
    await userEvent.upload(fileInput, testFile);

    await userEvent.click(screen.getByRole("button", { name: /save assignment/i }));

    // Verify new assignment appears
    expect(await screen.findByRole("button", { name: /new homework/i })).toBeInTheDocument();
  });

  test("faculty: shows validation error when title is missing", async () => {
    renderCourse({ courseId: "500", auth: { role: "faculty", userId: "301" } });

    await userEvent.click(await screen.findByRole("button", { name: /create assignment/i }));

    // Submit with no title
    await userEvent.click(screen.getByRole("button", { name: /save assignment/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
  });

  test("faculty: shows error when POST /assignments fails", async () => {
    server.use(
      http.post("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.text("boom", { status: 500 })
      )
    );

    renderCourse({ courseId: "500", auth: { role: "faculty", userId: "301" } });

    await userEvent.click(await screen.findByRole("button", { name: /create assignment/i }));
    await userEvent.type(screen.getByLabelText(/title/i), "Bad HW");
    await userEvent.click(screen.getByRole("button", { name: /save assignment/i }));

    expect(await screen.findByText(/create failed|boom/i)).toBeInTheDocument();
  });

  test("handles GET failure (course or roster)", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/faculty", () =>
        HttpResponse.text("faculty broken", { status: 500 })
      )
    );

    renderCourse({ courseId: "500", auth: { role: "faculty", userId: "301" } });

    expect(await screen.findByText(/failed to load course page|faculty broken/i)).toBeInTheDocument();
  });

  test("shows empty states for faculty, students, and assignments", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id", () =>
        HttpResponse.json({
          id: 999,
          course_code: "BIO-100",
          name: "Intro Bio",
          description: null,
        })
      ),
      http.get("**/api/v1/courses/:course_id/faculty", () => HttpResponse.json([], { status: 200 })),
      http.get("**/api/v1/courses/:course_id/students", () => HttpResponse.json([], { status: 200 })),
      http.get("**/api/v1/courses/:course_id/assignments", () => HttpResponse.json([], { status: 200 }))
    );

    renderCourse({ courseId: "999", auth: { role: "faculty", userId: "301" } });

    expect(await screen.findByRole("heading", { name: /BIO-100/i })).toBeInTheDocument();
    expect(screen.getByText(/no description provided/i)).toBeInTheDocument();
    expect(screen.getByText(/no faculty listed/i)).toBeInTheDocument();
    expect(screen.getByText(/no students enrolled/i)).toBeInTheDocument();
    expect(screen.getByText(/no assignments/i)).toBeInTheDocument();
  });

  test("faculty: delete buttons appear but only show alerts", async () => {
    window.alert = vi.fn();
    renderCourse({ courseId: "500", auth: { role: "faculty", userId: "301" } });

    await screen.findByText(/seeded assignment/i);

    // Delete student and assignment buttons exist
    const deleteButtons = screen.getAllByTitle(/delete/i);
    expect(deleteButtons.length).toBeGreaterThan(0);

    // Simulate click
    await userEvent.click(deleteButtons[0]);
    expect(window.alert).toHaveBeenCalled();
  });
});
