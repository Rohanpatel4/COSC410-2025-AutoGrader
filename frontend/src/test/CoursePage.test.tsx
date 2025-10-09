import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Routes, Route } from "react-router-dom";

import CoursePage from "../webpages/CoursePage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";
import { resetDb } from "./handlers";

// Helper to render CoursePage at a course route
function renderCourse({ courseId = "500", auth }: { courseId?: string; auth: { role: "faculty"|"student"; userId: string } }) {
  return renderWithProviders(
    <Routes>
      <Route path="/courses/:course_id" element={<CoursePage />} />
      <Route path="/assignments/:id" element={<div>ASSIGNMENT PAGE</div>} />
      <Route path="/my" element={<div>DASHBOARD</div>} />
    </Routes>,
    { route: `/courses/${courseId}`, auth }
  );
}

describe("CoursePage (MSW)", () => {
  beforeEach(() => resetDb());

  test("loads roster & assignments (faculty sees create toggle)", async () => {
    renderCourse({ courseId: "500", auth: { role: "faculty", userId: "301" } });

    // Faculty list, Students list, Assignments list (from seed)
    expect(await screen.findByText(/Prof\. Ada/i)).toBeInTheDocument();
    expect(await screen.findByText(/Student Sam/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /seeded assignment/i })).toBeInTheDocument();

    // Faculty can see/create assignments
    const toggle = screen.getByRole("button", { name: /create assignment/i });
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: /save assignment/i })).toBeInTheDocument();
  });

  test("student loads with student_id param (no create toggle)", async () => {
    renderCourse({ courseId: "500", auth: { role: "student", userId: "201" } });

    // Should show seeded content
    expect(await screen.findByText(/Prof\. Ada/i)).toBeInTheDocument();
    expect(await screen.findByText(/student sam/i)).toBeInTheDocument();
    // No "Create Assignment" button for students
    expect(screen.queryByRole("button", { name: /create assignment/i })).toBeNull();
  });

  test("faculty creates an assignment (with optional file)", async () => {
    renderCourse({ courseId: "500", auth: { role: "faculty", userId: "301" } });

    await userEvent.click(await screen.findByRole("button", { name: /create assignment/i }));
    await userEvent.type(screen.getByLabelText(/title/i), "New HW");
    await userEvent.type(screen.getByLabelText(/description/i), "desc");

    // Attach a file
    const fileInput = screen.getByLabelText(/attach test file/i);
    const file = new File(["print('ok')"], "tests.py", { type: "text/x-python" });
    await userEvent.upload(fileInput, file);

    await userEvent.click(screen.getByRole("button", { name: /save assignment/i }));

    // New assignment appears at the top
    expect(await screen.findByRole("button", { name: /new hw/i })).toBeInTheDocument();
  });

  test("shows error if any GET fails", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/students", () => HttpResponse.text("whoops", { status: 500 }))
    );

    renderCourse({ courseId: "500", auth: { role: "faculty", userId: "301" } });

    // Component renders an error paragraph (no role=status here)
    expect(await screen.findByText(/failed to load course page|whoops/i)).toBeInTheDocument();
  });

  test("shows error if POST /assignments fails", async () => {
    server.use(
      http.post("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.text("boom", { status: 500 })
      )
    );

    renderCourse({ courseId: "500", auth: { role: "faculty", userId: "301" } });

    await userEvent.click(await screen.findByRole("button", { name: /create assignment/i }));
    // leave title blank to prove our UI validation works first
    await userEvent.click(screen.getByRole("button", { name: /save assignment/i }));
    // err from validation
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();

    // Now type a title so network error is hit
    await userEvent.type(screen.getByLabelText(/title/i), "Fails");
    await userEvent.click(screen.getByRole("button", { name: /save assignment/i }));

    // Network error message (component sets crimson <p>)
    expect(await screen.findByText(/create failed|boom/i)).toBeInTheDocument();
  });

  test("empty states when course has no roster or assignments", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/students", () => HttpResponse.json([], { status: 200 })),
      http.get("**/api/v1/courses/:course_id/faculty", () => HttpResponse.json([], { status: 200 })),
      http.get("**/api/v1/courses/:course_id/assignments", () => HttpResponse.json([], { status: 200 })),
    );

    renderCourse({ courseId: "zzz", auth: { role: "faculty", userId: "301" } });

    expect(await screen.findByText(/no faculty listed/i)).toBeInTheDocument();
    expect(screen.getByText(/no students enrolled/i)).toBeInTheDocument();
    expect(screen.getByText(/no assignments/i)).toBeInTheDocument();
  });
});
