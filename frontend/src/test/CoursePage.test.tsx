import React from "react";
import { Routes, Route, useParams } from "react-router-dom";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import CoursePage from "../webpages/CoursePage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";
import { resetDb, __testDb } from "./handlers";

function AssignmentStub() {
  const { assignment_id = "" } = useParams();
  return <div>ASSIGNMENT PAGE {assignment_id}</div>;
}

function renderCoursePage(
  auth: { role: "faculty" | "student"; userId: string },
  courseId = "500"
) {
  return renderWithProviders(
    <Routes>
      <Route path="/courses/:course_id" element={<CoursePage />} />
      <Route path="/assignments/:assignment_id" element={<AssignmentStub />} />
      <Route path="/courses/:course_id/assignments/new" element={<div>CREATE ASSIGNMENT PAGE</div>} />
    </Routes>,
    { route: `/courses/${courseId}`, auth }
  );
}

describe("CoursePage", () => {
  beforeEach(() => resetDb());

  test("faculty view lists assignments, toggles tabs, and navigates to create page", async () => {
    renderCoursePage({ role: "faculty", userId: "301" });

    // Course header + seeded assignment render
    expect(await screen.findByRole("heading", { name: /FirstCourse/i })).toBeInTheDocument();
    expect(screen.getByText(/Seeded Assignment/i)).toBeInTheDocument();

    // Participants tab shows roster entries
    await userEvent.click(screen.getByRole("tab", { name: /participants/i }));
    expect(await screen.findByText(/Prof\. Ada/i)).toBeInTheDocument();
    expect(screen.getByText(/Student Sam/i)).toBeInTheDocument();

    // Return to course tab and trigger create assignment navigation
    await userEvent.click(screen.getByRole("tab", { name: /course/i }));
    await userEvent.click(screen.getByRole("button", { name: /Create Assignment/i }));
    expect(await screen.findByText(/CREATE ASSIGNMENT PAGE/i)).toBeInTheDocument();
  });

  test("faculty gradebook tab loads table data", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "FirstCourse", course_code: "COSC-410" },
          assignments: [{ id: 9001, title: "Seeded Assignment", total_points: 100 }],
          students: [
            {
              student_id: 201,
              username: "Student Sam",
              grades: { "9001": 88 },
            },
          ],
        })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    await userEvent.click(screen.getByRole("tab", { name: /grades/i }));

    expect(await screen.findByRole("columnheader", { name: /Seeded Assignment/i })).toBeInTheDocument();
    expect(screen.getByText(/Student Sam/i)).toBeInTheDocument();
    // Grade is displayed as percentage (88%)
    expect(screen.getByText(/88%/)).toBeInTheDocument();
  });

  test("student view hides faculty actions and shows attempts table", async () => {
    __testDb.state.attemptsByAsgStudent[9001] = {
      201: [
        { id: 1, grade: 75 },
        { id: 2, grade: 90 },
      ],
    };

    // Update assignment to include total_points
    __testDb.state.assignmentsByCourseTag["500"][0].total_points = 100;
    __testDb.state.assignmentById[9001].total_points = 100;

    // Mock the student attempts endpoint - CoursePage fetches attempts per assignment
    server.use(
      http.get("**/api/v1/assignments/:id/attempts", ({ request, params }) => {
        const id = Number(params.id);
        const url = new URL(request.url);
        const studentId = Number(url.searchParams.get("student_id"));
        if (id === 9001 && studentId === 201) {
          return HttpResponse.json([
            { id: 1, earned_points: 75, grade: 75, created_at: "2025-01-01T10:00:00Z" },
            { id: 2, earned_points: 90, grade: 90, created_at: "2025-01-02T10:00:00Z" },
          ]);
        }
        return HttpResponse.json([]);
      }),
      // Also update assignments endpoint to return total_points
      http.get("**/api/v1/courses/:course_id/assignments", ({ request, params }) => {
        const url = new URL(request.url);
        const studentId = url.searchParams.get("student_id");
        return HttpResponse.json([{
          id: 9001,
          course_id: 1,
          title: "Seeded Assignment",
          description: "Warm-up",
          sub_limit: 3,
          start: null,
          stop: null,
          num_attempts: 0,
          total_points: 100,
        }]);
      })
    );

    renderCoursePage({ role: "student", userId: "201" });

    expect(await screen.findByRole("heading", { name: /FirstCourse/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create Assignment/i })).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: /grades/i }));

    // Header is "BEST" not "Best Score"
    expect(await screen.findByText(/BEST/i)).toBeInTheDocument();
    expect(screen.getByText(/Seeded Assignment/i)).toBeInTheDocument();
    // Look for 90 in the grade display (could be "90/100" or "90%") - multiple instances exist
    expect(screen.getAllByText(/90/).length).toBeGreaterThanOrEqual(1);
  });
});
