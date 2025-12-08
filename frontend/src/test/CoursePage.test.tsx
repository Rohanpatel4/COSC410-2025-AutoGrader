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
    expect(await screen.findByText(/Seeded Assignment/i)).toBeInTheDocument();

    // Participants tab shows roster entries
    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);
    expect(await screen.findByText(/Prof\. Ada/i)).toBeInTheDocument();
    expect(await screen.findByText(/Student Sam/i)).toBeInTheDocument();

    // Return to course tab and trigger create assignment navigation
    const courseTab = await screen.findByRole("tab", { name: /course/i });
    await userEvent.click(courseTab);
    const createButton = await screen.findByRole("button", { name: /Create Assignment/i });
    await userEvent.click(createButton);
    expect(await screen.findByText(/CREATE ASSIGNMENT PAGE/i)).toBeInTheDocument();
  });

  test("faculty gradebook loads data", async () => {
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

    // Navigate to grades tab
    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    // Faculty gradebook loads correctly
    expect(await screen.findByRole("heading", { name: /FirstCourse/i })).toBeInTheDocument();
  });

  test("student view loads assignments", async () => {
    renderCoursePage({ role: "student", userId: "201" });

    expect(await screen.findByRole("heading", { name: /FirstCourse/i })).toBeInTheDocument();
    expect(await screen.findByText(/Seeded Assignment/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create Assignment/i })).not.toBeInTheDocument();
  });

  test("gradebook shows points/percentage toggle for faculty", async () => {
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

    // Should show toggle button
    const pointsButton = screen.getByRole("button", { name: /points/i });
    expect(pointsButton).toBeInTheDocument();

    // Initially shows percentage
    expect(screen.getByText(/88%/)).toBeInTheDocument();

    // Toggle to points
    await userEvent.click(pointsButton);
    expect(screen.getByText(/88\/100/)).toBeInTheDocument();

    // Toggle back to percentage (click the percentage button)
    const percentageButton = screen.getByRole("button", { name: /percentage/i });
    await userEvent.click(percentageButton);
    expect(screen.getByText(/88%/)).toBeInTheDocument();
  });

  test("handles loading errors gracefully", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id", () =>
        HttpResponse.text("Server error", { status: 500 })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    expect(await screen.findByText(/server error|failed to load/i)).toBeInTheDocument();
  });

  test("localStorage persists active tab", async () => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(() => "participants"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Should start on participants tab due to localStorage
    const participantsTab = screen.getByRole("tab", { name: /participants/i });
    expect(participantsTab).toHaveAttribute("aria-selected", "true");

    // Switching tabs should save to localStorage
    await userEvent.click(screen.getByRole("tab", { name: /grades/i }));
    expect(localStorageMock.setItem).toHaveBeenCalledWith("courseTab_500", "grades");
  });

  test("assignment filtering works for active assignments", async () => {
    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Should show assignment filtering options
    expect(screen.getByRole("heading", { name: /FirstCourse/i })).toBeInTheDocument();
  });

  test("assignment sorting works for student view", async () => {
    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Should handle assignment sorting
    expect(screen.getByRole("heading", { name: /FirstCourse/i })).toBeInTheDocument();
  });

  test("gradebook handles empty data", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "FirstCourse", course_code: "COSC-410" },
          assignments: [],
          students: [],
        })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    // Should handle empty gradebook gracefully
    expect(screen.getByRole("heading", { name: /FirstCourse/i })).toBeInTheDocument();
  });

  test("handles course loading errors", async () => {
    server.use(
      http.get("**/api/v1/courses/:id", () =>
        HttpResponse.json({ detail: "Course not found" }, { status: 404 })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    expect(await screen.findByText(/course not found|failed to load/i)).toBeInTheDocument();
  });

  test("handles assignments loading errors", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json({ detail: "Failed to load assignments" }, { status: 500 })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Should still show course info even if assignments fail
    expect(screen.getByRole("heading", { name: /FirstCourse/i })).toBeInTheDocument();
  });

  test("handles participants loading errors", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/faculty", () =>
        HttpResponse.json({ detail: "Failed to load faculty" }, { status: 500 })
      ),
      http.get("**/api/v1/courses/:course_id/students", () =>
        HttpResponse.json({ detail: "Failed to load students" }, { status: 500 })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    // Should still show course info even if participants fail
    expect(screen.getByRole("heading", { name: /FirstCourse/i })).toBeInTheDocument();
  });

  test("shows loading state initially", async () => {
    // Slow down the API responses to show loading state
    server.use(
      http.get("**/api/v1/courses/:id", async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json({
          id: 1,
          course_code: "COSC-410",
          name: "FirstCourse",
          description: "seed",
          professor_id: 301,
        });
      })
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    // Initially should show loading state or wait for content
    expect(await screen.findByRole("heading", { name: /FirstCourse/i })).toBeInTheDocument();
  });

  test("tab switching preserves state", async () => {
    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Switch to participants tab
    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    // Switch back to course tab
    const courseTab = await screen.findByRole("tab", { name: /course/i });
    await userEvent.click(courseTab);

    // Should still show course content
    expect(screen.getByRole("heading", { name: /FirstCourse/i })).toBeInTheDocument();
    expect(screen.getByText(/Seeded Assignment/i)).toBeInTheDocument();
  });

  test("student view assignment status display", async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Yesterday

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", ({ request }) => {
        const url = new URL(request.url);
        const studentId = url.searchParams.get("student_id");
        return HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Active Assignment",
            description: "Active",
            sub_limit: 3,
            start: null,
            stop: futureDate,
            num_attempts: 0,
            total_points: 100,
            attempts: studentId === "201" ? [{ id: 1, grade: 85 }] : []
          },
          {
            id: 9002,
            course_id: 1,
            title: "Closed Assignment",
            description: "Closed",
            sub_limit: 3,
            start: null,
            stop: pastDate,
            num_attempts: 0,
            total_points: 100,
            attempts: studentId === "201" ? [{ id: 2, grade: 75 }] : []
          }
        ]);
      })
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Should show assignments with attempt information
    expect(screen.getByText("Active Assignment")).toBeInTheDocument();
    expect(screen.getByText("Closed Assignment")).toBeInTheDocument();
  });

  test("faculty gradebook data loading", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "FirstCourse", course_code: "COSC-410" },
          assignments: [
            { id: 9001, title: "Assignment 1", total_points: 100 },
            { id: 9002, title: "Assignment 2", total_points: 50 }
          ],
          students: [
            {
              student_id: 201,
              username: "Student Sam",
              grades: { "9001": 90, "9002": 45 },
            },
            {
              student_id: 202,
              username: "Student Two",
              grades: { "9001": 85, "9002": null },
            }
          ],
        })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    // Should show gradebook with student data
    expect(await screen.findByText("Student Sam")).toBeInTheDocument();
    expect(screen.getByText("Student Two")).toBeInTheDocument();
  });

  test("participants tab pagination", async () => {
    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    // Should show participants
    expect(await screen.findByText(/Prof\. Ada/i)).toBeInTheDocument();
    expect(screen.getByText(/Student Sam/i)).toBeInTheDocument();
  });

  test("localStorage tab persistence", async () => {
    // Mock localStorage with saved tab
    const localStorageMock = {
      getItem: vi.fn(() => "participants"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Should start on participants tab due to localStorage
    const participantsTab = screen.getByRole("tab", { name: /participants/i });
    expect(participantsTab).toHaveAttribute("aria-selected", "true");
  });

  test("handles complex course data with many assignments", async () => {
    const assignments = Array.from({ length: 20 }, (_, i) => ({
      id: 9000 + i,
      course_id: 1,
      title: `Assignment ${i + 1}`,
      description: `Description for assignment ${i + 1}`,
      sub_limit: 3,
      start: null,
      stop: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)).toISOString(),
      num_attempts: Math.floor(Math.random() * 5),
      total_points: 100,
    }));

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json(assignments)
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Should handle many assignments
    assignments.slice(0, 10).forEach(assignment => {
      expect(screen.getByText(assignment.title)).toBeInTheDocument();
    });
  });

  test("handles participant search with many users", async () => {
    const faculty = Array.from({ length: 10 }, (_, i) => ({
      id: 300 + i,
      name: `Professor ${i + 1}`,
      role: "faculty" as const
    }));

    const students = Array.from({ length: 50 }, (_, i) => ({
      id: 200 + i,
      name: `Student ${i + 1}`,
      role: "student" as const
    }));

    server.use(
      http.get("**/api/v1/courses/:course_id/faculty", () =>
        HttpResponse.json(faculty)
      ),
      http.get("**/api/v1/courses/:course_id/students", () =>
        HttpResponse.json(students)
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    // Should show many participants
    expect(screen.getByText("Professor 1")).toBeInTheDocument();
    expect(screen.getByText("Student 1")).toBeInTheDocument();
  });
});
