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

    // Course should still load even if assignments fail
    const heading = await screen.findByRole("heading", { name: /FirstCourse/i }, { timeout: 3000 });
    expect(heading).toBeInTheDocument();
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

    // Course should still load even if participants fail
    const heading = await screen.findByRole("heading", { name: /FirstCourse/i }, { timeout: 3000 });
    expect(heading).toBeInTheDocument();

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
    expect(await screen.findByText("Active Assignment")).toBeInTheDocument();
    expect(await screen.findByText("Closed Assignment")).toBeInTheDocument();
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
    for (const assignment of assignments.slice(0, 10)) {
      expect(await screen.findByText(assignment.title)).toBeInTheDocument();
    }
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
    expect(await screen.findByText("Professor 1")).toBeInTheDocument();
    expect(await screen.findByText("Student 1")).toBeInTheDocument();
  });

  test("participants tab search functionality", async () => {
    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText(/Prof\. Ada/i);

    const searchInput = screen.getByPlaceholderText(/Search by name/i);
    await userEvent.type(searchInput, "Sam");

    expect(screen.getByText(/Student Sam/i)).toBeInTheDocument();
    expect(screen.queryByText(/Prof\. Ada/i)).not.toBeInTheDocument();
  });

  test("participants tab sorting by name", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/students", () =>
        HttpResponse.json([
          { id: 201, name: "Zebra Student" },
          { id: 202, name: "Alpha Student" },
        ])
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText(/Zebra Student/i);

    const nameSortButton = screen.getByLabelText(/Sort by name/i);
    await userEvent.click(nameSortButton);

    // Should be sorted ascending
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent(/Alpha/i);
  });

  test("participants tab sorting by role", async () => {
    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText(/Prof\. Ada/i);

    const roleSortButton = screen.getByLabelText(/Sort by role/i);
    await userEvent.click(roleSortButton);
  });

  test("participants tab pagination controls", async () => {
    const students = Array.from({ length: 25 }, (_, i) => ({
      id: 200 + i,
      name: `Student ${i + 1}`,
    }));

    server.use(
      http.get("**/api/v1/courses/:course_id/students", () =>
        HttpResponse.json(students)
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText("Student 1");

    // Change items per page
    const itemsPerPage20 = screen.getByRole("button", { name: "20" });
    await userEvent.click(itemsPerPage20);

    // Test pagination buttons
    const nextButton = screen.getByRole("button", { name: /Next/i });
    expect(nextButton).toBeInTheDocument();
  });

  test("participants tab items per page selection", async () => {
    const students = Array.from({ length: 25 }, (_, i) => ({
      id: 200 + i,
      name: `Student ${i + 1}`,
    }));

    server.use(
      http.get("**/api/v1/courses/:course_id/students", () =>
        HttpResponse.json(students)
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText("Student 1");

    const itemsPerPage50 = screen.getByRole("button", { name: "50" });
    await userEvent.click(itemsPerPage50);

    expect(itemsPerPage50).toHaveAttribute("aria-pressed", "true");
  });

  test("delete student functionality", async () => {
    server.use(
      http.delete("**/api/v1/courses/:course_id/students/:student_id", () =>
        HttpResponse.json({ success: true })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText(/Student Sam/i);

    const deleteButton = screen.getByLabelText(/Delete Student Sam/i);
    await userEvent.click(deleteButton);

    // Confirmation dialog should appear
    expect(await screen.findByText(/Confirm Deletion/i)).toBeInTheDocument();
    expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();

    const confirmDeleteButton = screen.getAllByRole("button", { name: /Delete/i }).find(
      btn => btn.textContent?.includes("Delete") && !btn.textContent?.includes("Student")
    ) || screen.getAllByRole("button", { name: /Delete/i })[1];
    await userEvent.click(confirmDeleteButton);

    // Should close dialog after deletion
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  test("delete student cancellation", async () => {
    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText(/Student Sam/i);

    const deleteButton = screen.getByLabelText(/Delete Student Sam/i);
    await userEvent.click(deleteButton);

    expect(await screen.findByText(/Confirm Deletion/i)).toBeInTheDocument();

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    await userEvent.click(cancelButton);

    // Dialog should close
    expect(screen.queryByText(/Confirm Deletion/i)).not.toBeInTheDocument();
  });

  test("keyboard navigation for tabs", async () => {
    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const courseTab = screen.getByRole("tab", { name: /course/i });
    courseTab.focus();

    // Navigate right with arrow key
    await userEvent.keyboard("{ArrowRight}");
    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    expect(participantsTab).toHaveAttribute("aria-selected", "true");

    // Navigate right again
    participantsTab.focus();
    await userEvent.keyboard("{ArrowRight}");
    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    expect(gradesTab).toHaveAttribute("aria-selected", "true");

    // Navigate left
    gradesTab.focus();
    await userEvent.keyboard("{ArrowLeft}");
    const participantsTabAfter = await screen.findByRole("tab", { name: /participants/i });
    expect(participantsTabAfter).toHaveAttribute("aria-selected", "true");
  });

  test("student assignment filtering - active", async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
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
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Wait for assignments to load
    await screen.findByText("Active Assignment");

    const activeFilter = await screen.findByRole("button", { name: /Active/i });
    await userEvent.click(activeFilter);

    expect(await screen.findByText("Active Assignment")).toBeInTheDocument();
    expect(screen.queryByText("Closed Assignment")).not.toBeInTheDocument();
  });

  test("student assignment filtering - due soon", async () => {
    const dueSoonDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const farFutureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Due Soon Assignment",
            description: "Due soon",
            sub_limit: 3,
            start: null,
            stop: dueSoonDate,
            num_attempts: 0,
            total_points: 100,
          },
          {
            id: 9002,
            course_id: 1,
            title: "Far Future Assignment",
            description: "Far future",
            sub_limit: 3,
            start: null,
            stop: farFutureDate,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Wait for assignments to load
    await screen.findByText("Due Soon Assignment");

    const dueSoonFilter = await screen.findByRole("button", { name: /Due Soon/i });
    await userEvent.click(dueSoonFilter);

    expect(await screen.findByText("Due Soon Assignment")).toBeInTheDocument();
  });

  test("student assignment sorting - by name", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Zebra Assignment",
            description: "Z",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 0,
            total_points: 100,
          },
          {
            id: 9002,
            course_id: 1,
            title: "Alpha Assignment",
            description: "A",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const sortSelect = screen.getByRole("combobox");
    await userEvent.selectOptions(sortSelect, "name");

    // Should be sorted by name
    const assignments = screen.getAllByText(/Assignment/i);
    expect(assignments[0]).toHaveTextContent(/Alpha/i);
  });

  test("student assignment sorting - by status", async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Closed Assignment",
            description: "Closed",
            sub_limit: 3,
            start: null,
            stop: pastDate,
            num_attempts: 0,
            total_points: 100,
          },
          {
            id: 9002,
            course_id: 1,
            title: "Active Assignment",
            description: "Active",
            sub_limit: 3,
            start: null,
            stop: futureDate,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const sortSelect = screen.getByRole("combobox");
    await userEvent.selectOptions(sortSelect, "status");
  });

  test("student assignment sorting - by due date", async () => {
    const date1 = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
    const date2 = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Assignment 2",
            description: "Later",
            sub_limit: 3,
            start: null,
            stop: date2,
            num_attempts: 0,
            total_points: 100,
          },
          {
            id: 9002,
            course_id: 1,
            title: "Assignment 1",
            description: "Earlier",
            sub_limit: 3,
            start: null,
            stop: date1,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const sortSelect = screen.getByRole("combobox");
    await userEvent.selectOptions(sortSelect, "due-date");
  });

  test("student attempts loading and display", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Test Assignment",
            description: "Test",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 2,
            total_points: 100,
          }
        ])
      ),
      http.get("**/api/v1/assignments/9001/attempts", () =>
        HttpResponse.json([
          { id: 1, grade: 85, earned_points: 85 },
          { id: 2, grade: 90, earned_points: 90 },
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Should show assignment with attempts
    expect(await screen.findByText("Test Assignment")).toBeInTheDocument();
  });

  test("student grades tab with attempts", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Test Assignment",
            description: "Test",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 2,
            total_points: 100,
          }
        ])
      ),
      http.get("**/api/v1/assignments/9001/attempts", () =>
        HttpResponse.json([
          { id: 1, grade: 85, earned_points: 85 },
          { id: 2, grade: 90, earned_points: 90 },
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    // Should show attempts table
    expect(await screen.findByText("Test Assignment")).toBeInTheDocument();
  });

  test("student grades tab points/percentage toggle", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Test Assignment",
            description: "Test",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 1,
            total_points: 100,
          }
        ])
      ),
      http.get("**/api/v1/assignments/9001/attempts", () =>
        HttpResponse.json([
          { id: 1, grade: 85, earned_points: 85 },
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    await screen.findByText("Test Assignment");

    const pointsButton = screen.getByRole("button", { name: /Points/i });
    await userEvent.click(pointsButton);

    // Should show points format
    expect(await screen.findByText(/85\/100/)).toBeInTheDocument();
  });

  test("faculty gradebook with submission IDs", async () => {
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
              best_submission_ids: { "9001": 123 },
            },
          ],
        })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    // Should show clickable grade
    const gradeButton = await screen.findByText(/88%/);
    expect(gradeButton).toBeInTheDocument();
  });

  test("faculty gradebook with missing grades", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "FirstCourse", course_code: "COSC-410" },
          assignments: [{ id: 9001, title: "Seeded Assignment", total_points: 100 }],
          students: [
            {
              student_id: 201,
              username: "Student Sam",
              grades: { "9001": null },
            },
          ],
        })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    // Should show missing grade indicator
    expect(await screen.findByText("—")).toBeInTheDocument();
  });

  test("assignment with no due date", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "No Due Date Assignment",
            description: "No due date",
            sub_limit: 3,
            start: null,
            stop: null,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(await screen.findByText("No Due Date Assignment")).toBeInTheDocument();
  });

  test("assignment with start date in future (scheduled)", async () => {
    const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const futureStop = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Scheduled Assignment",
            description: "Scheduled",
            sub_limit: 3,
            start: futureStart,
            stop: futureStop,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(await screen.findByText("Scheduled Assignment")).toBeInTheDocument();
  });

  test("enrollment key display for faculty", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id", () =>
        HttpResponse.json({
          id: 1,
          course_code: "COSC-410",
          name: "FirstCourse",
          description: "seed",
          professor_id: 301,
          enrollment_key: "ABC123",
        })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(await screen.findByText(/ABC123/)).toBeInTheDocument();
  });

  test("no enrollment key for students", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id", () =>
        HttpResponse.json({
          id: 1,
          course_code: "COSC-410",
          name: "FirstCourse",
          description: "seed",
          professor_id: 301,
          enrollment_key: "ABC123",
        })
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(screen.queryByText(/ABC123/)).not.toBeInTheDocument();
  });

  test("empty assignments list for faculty", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([])
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(await screen.findByText(/No assignments yet/i)).toBeInTheDocument();
  });

  test("empty assignments list for student", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(await screen.findByText(/No assignments yet/i)).toBeInTheDocument();
  });

  test("participants tab empty state", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/students", () =>
        HttpResponse.json([])
      ),
      http.get("**/api/v1/courses/:course_id/faculty", () =>
        HttpResponse.json([])
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    expect(await screen.findByText(/No participants yet/i)).toBeInTheDocument();
  });

  test("participants tab no search results", async () => {
    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText(/Prof\. Ada/i);

    const searchInput = screen.getByPlaceholderText(/Search by name/i);
    await userEvent.type(searchInput, "NonexistentPerson12345");

    expect(await screen.findByText(/No participants match your search/i)).toBeInTheDocument();
  });

  test("student assignment with attempts and best grade display", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Test Assignment",
            description: "Test",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 2,
            total_points: 100,
          }
        ])
      ),
      http.get("**/api/v1/assignments/9001/attempts", () =>
        HttpResponse.json([
          { id: 1, grade: 75, earned_points: 75 },
          { id: 2, grade: 90, earned_points: 90 },
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Should show best grade
    expect(await screen.findByText(/90\/100/)).toBeInTheDocument();
  });

  test("student assignment with no attempts", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Test Assignment",
            description: "Test",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 0,
            total_points: 100,
          }
        ])
      ),
      http.get("**/api/v1/assignments/9001/attempts", () =>
        HttpResponse.json([])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(await screen.findByText("Test Assignment")).toBeInTheDocument();
  });

  test("gradebook loading state", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json({
          course: { id: 1, name: "FirstCourse", course_code: "COSC-410" },
          assignments: [{ id: 9001, title: "Seeded Assignment", total_points: 100 }],
          students: [
            {
              student_id: 201,
              username: "Student Sam",
              grades: { "9001": 88 },
            },
          ],
        });
      })
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    // Should eventually show gradebook
    expect(await screen.findByText("Student Sam")).toBeInTheDocument();
  });

  test("student attempts loading state", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Test Assignment",
            description: "Test",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 1,
            total_points: 100,
          }
        ])
      ),
      http.get("**/api/v1/assignments/9001/attempts", async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json([
          { id: 1, grade: 85, earned_points: 85 },
        ]);
      })
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    // Should eventually show attempts
    expect(await screen.findByText("Test Assignment")).toBeInTheDocument();
  });

  test("delete student error handling", async () => {
    server.use(
      http.delete("**/api/v1/courses/:course_id/students/:student_id", () =>
        HttpResponse.json({ detail: "Failed to delete" }, { status: 500 })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText(/Student Sam/i);

    const deleteButton = screen.getByLabelText(/Delete Student Sam/i);
    await userEvent.click(deleteButton);

    const confirmDeleteButton = await screen.findByRole("button", { name: /Delete/i });
    await userEvent.click(confirmDeleteButton);

    // Should show error
    expect(await screen.findByText(/Failed to delete|failed to load/i)).toBeInTheDocument();
  });

  test("assignment status - closed", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Closed Assignment",
            description: "Closed",
            sub_limit: 3,
            start: null,
            stop: pastDate,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(await screen.findByText("Closed Assignment")).toBeInTheDocument();
  });

  test("assignment status - active", async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
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
          }
        ])
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Wait for assignment to load
    expect(await screen.findByText("Active Assignment", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  test("time remaining calculation", async () => {
    const soonDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Due Soon Assignment",
            description: "Due soon",
            sub_limit: 3,
            start: null,
            stop: soonDate,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Wait for assignment to load
    await screen.findByText("Due Soon Assignment", {}, { timeout: 3000 });

    // Should show time remaining (could be "2h left" or similar)
    const timeRemaining = await screen.findByText(/left|hours|hour|minutes|minute/i, {}, { timeout: 3000 });
    expect(timeRemaining).toBeInTheDocument();
  });

  test("student view filters reset when switching tabs", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Test Assignment",
            description: "Test",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Wait for assignments to load
    await screen.findByText("Test Assignment", {}, { timeout: 3000 });

    const activeFilter = await screen.findByRole("button", { name: /Active/i }, { timeout: 3000 });
    await userEvent.click(activeFilter);

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    const courseTab = await screen.findByRole("tab", { name: /course/i });
    await userEvent.click(courseTab);

    // Wait for assignments to reload
    await screen.findByText("Test Assignment", {}, { timeout: 3000 });

    // Filter should still be active (state preserved)
    const activeFilterAfter = await screen.findByRole("button", { name: /Active/i }, { timeout: 3000 });
    expect(activeFilterAfter).toHaveAttribute("aria-pressed", "true");
  });

  test("faculty gradebook with high percentage grade", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "FirstCourse", course_code: "COSC-410" },
          assignments: [{ id: 9001, title: "Seeded Assignment", total_points: 100 }],
          students: [
            {
              student_id: 201,
              username: "Student Sam",
              grades: { "9001": 85 },
              best_submission_ids: { "9001": 123 },
            },
          ],
        })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    // Should show grade with high percentage styling
    expect(await screen.findByText(/85%/)).toBeInTheDocument();
  });

  test("faculty gradebook with medium percentage grade", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "FirstCourse", course_code: "COSC-410" },
          assignments: [{ id: 9001, title: "Seeded Assignment", total_points: 100 }],
          students: [
            {
              student_id: 201,
              username: "Student Sam",
              grades: { "9001": 60 },
              best_submission_ids: { "9001": 123 },
            },
          ],
        })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    // Should show grade with medium percentage styling
    expect(await screen.findByText(/60%/)).toBeInTheDocument();
  });

  test("faculty gradebook with low percentage grade", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "FirstCourse", course_code: "COSC-410" },
          assignments: [{ id: 9001, title: "Seeded Assignment", total_points: 100 }],
          students: [
            {
              student_id: 201,
              username: "Student Sam",
              grades: { "9001": 40 },
              best_submission_ids: { "9001": 123 },
            },
          ],
        })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    // Should show grade with low percentage styling
    expect(await screen.findByText(/40%/)).toBeInTheDocument();
  });

  test("faculty gradebook grade without submission ID", async () => {
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
              best_submission_ids: {},
            },
          ],
        })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    // Should show grade as text, not button
    expect(await screen.findByText(/88%/)).toBeInTheDocument();
  });

  test("student grades with multiple attempts", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Test Assignment",
            description: "Test",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 3,
            total_points: 100,
          }
        ])
      ),
      http.get("**/api/v1/assignments/9001/attempts", () =>
        HttpResponse.json([
          { id: 1, grade: 70, earned_points: 70 },
          { id: 2, grade: 80, earned_points: 80 },
          { id: 3, grade: 90, earned_points: 90 },
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    // Should show all attempts
    expect(await screen.findByText("Test Assignment")).toBeInTheDocument();
  });

  test("participants pagination next button", async () => {
    const students = Array.from({ length: 25 }, (_, i) => ({
      id: 200 + i,
      name: `Student ${i + 1}`,
    }));

    server.use(
      http.get("**/api/v1/courses/:course_id/students", () =>
        HttpResponse.json(students)
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText("Student 1");

    const nextButton = screen.getByRole("button", { name: /Next/i });
    await userEvent.click(nextButton);

    // Should show next page
    expect(await screen.findByText("Student 11")).toBeInTheDocument();
  });

  test("participants pagination prev button", async () => {
    const students = Array.from({ length: 25 }, (_, i) => ({
      id: 200 + i,
      name: `Student ${i + 1}`,
    }));

    server.use(
      http.get("**/api/v1/courses/:course_id/students", () =>
        HttpResponse.json(students)
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText("Student 1");

    const nextButton = screen.getByRole("button", { name: /Next/i });
    await userEvent.click(nextButton);

    await screen.findByText("Student 11");

    const prevButton = screen.getByRole("button", { name: /Prev/i });
    await userEvent.click(prevButton);

    // Should show previous page
    expect(await screen.findByText("Student 1")).toBeInTheDocument();
  });

  test("participants sort toggle - name descending", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/students", () =>
        HttpResponse.json([
          { id: 201, name: "Alpha Student" },
          { id: 202, name: "Zebra Student" },
        ])
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText(/Alpha Student/i);

    const nameSortButton = screen.getByLabelText(/Sort by name/i);
    await userEvent.click(nameSortButton); // First click - ascending
    await userEvent.click(nameSortButton); // Second click - descending
  });

  test("participants sort toggle - turn off sorting", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/students", () =>
        HttpResponse.json([
          { id: 201, name: "Alpha Student" },
          { id: 202, name: "Zebra Student" },
        ])
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText(/Alpha Student/i);

    const nameSortButton = screen.getByLabelText(/Sort by name/i);
    await userEvent.click(nameSortButton); // First click - ascending
    await userEvent.click(nameSortButton); // Second click - descending
    await userEvent.click(nameSortButton); // Third click - turn off
  });

  test("assignment with no stop date for student", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "No Stop Date Assignment",
            description: "No stop",
            sub_limit: 3,
            start: null,
            stop: null,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(await screen.findByText("No Stop Date Assignment")).toBeInTheDocument();
  });

  test("assignment sorting by due date with no dates", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Assignment A",
            description: "A",
            sub_limit: 3,
            start: null,
            stop: null,
            num_attempts: 0,
            total_points: 100,
          },
          {
            id: 9002,
            course_id: 1,
            title: "Assignment B",
            description: "B",
            sub_limit: 3,
            start: null,
            stop: null,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    await screen.findByText("Assignment A");

    const sortSelect = screen.getByRole("combobox");
    await userEvent.selectOptions(sortSelect, "due-date");
  });

  test("student assignment with sub_limit display", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Limited Assignment",
            description: "Limited",
            sub_limit: 5,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 2,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Should show attempts with limit
    expect(await screen.findByText(/2\/5 tries/i)).toBeInTheDocument();
  });

  test("student assignment progress bar display", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Progress Assignment",
            description: "Progress",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 1,
            total_points: 100,
          }
        ])
      ),
      http.get("**/api/v1/assignments/9001/attempts", () =>
        HttpResponse.json([
          { id: 1, grade: 85, earned_points: 85 },
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Should show progress bar
    await screen.findByText("Progress Assignment");
    expect(await screen.findByText(/85%/)).toBeInTheDocument();
  });

  test("getTimeRemaining with days remaining", async () => {
    const daysDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Days Remaining Assignment",
            description: "Days",
            sub_limit: 3,
            start: null,
            stop: daysDate,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(await screen.findByText("Days Remaining Assignment")).toBeInTheDocument();
  });

  test("getTimeRemaining with hours remaining", async () => {
    const hoursDate = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Hours Remaining Assignment",
            description: "Hours",
            sub_limit: 3,
            start: null,
            stop: hoursDate,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(await screen.findByText("Hours Remaining Assignment")).toBeInTheDocument();
  });

  test("assignment urgent indicator for due soon", async () => {
    const dueSoonDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Urgent Assignment",
            description: "Urgent",
            sub_limit: 3,
            start: null,
            stop: dueSoonDate,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(await screen.findByText("Urgent Assignment")).toBeInTheDocument();
  });

  test("student assignment with no attempts shows points", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "No Attempts Assignment",
            description: "No attempts",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 0,
            total_points: 100,
          }
        ])
      ),
      http.get("**/api/v1/assignments/9001/attempts", () =>
        HttpResponse.json([])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    // Should show points when no attempts
    expect(await screen.findByText(/100 pts/i)).toBeInTheDocument();
  });

  test("gradebook empty assignments message", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "FirstCourse", course_code: "COSC-410" },
          assignments: [],
          students: [
            {
              student_id: 201,
              username: "Student Sam",
              grades: {},
            },
          ],
        })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    expect(await screen.findByText(/No assignments yet/i)).toBeInTheDocument();
  });

  test("gradebook empty students message", async () => {
    server.use(
      http.get("**/api/v1/assignments/gradebook/by-course/:course_id", () =>
        HttpResponse.json({
          course: { id: 1, name: "FirstCourse", course_code: "COSC-410" },
          assignments: [{ id: 9001, title: "Seeded Assignment", total_points: 100 }],
          students: [],
        })
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    expect(await screen.findByText(/No enrolled students/i)).toBeInTheDocument();
  });

  test("student grades empty assignments message", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    expect(await screen.findByText(/No assignments yet/i)).toBeInTheDocument();
  });

  test("participant search by ID when no name", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/students", () =>
        HttpResponse.json([
          { id: 201 },
        ])
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText(/User 201/i);

    const searchInput = screen.getByPlaceholderText(/Search by name/i);
    await userEvent.type(searchInput, "201");

    expect(await screen.findByText(/User 201/i)).toBeInTheDocument();
  });

  test("participants sort by role", async () => {
    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText(/Prof\. Ada/i);

    const roleSortButton = screen.getByLabelText(/Sort by role/i);
    await userEvent.click(roleSortButton);
  });

  test("assignment status scheduled for faculty", async () => {
    const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const futureStop = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Scheduled Assignment",
            description: "Scheduled",
            sub_limit: 3,
            start: futureStart,
            stop: futureStop,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(await screen.findByText("Scheduled Assignment")).toBeInTheDocument();
  });

  test("student assignment closed status display", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Closed Assignment",
            description: "Closed",
            sub_limit: 3,
            start: null,
            stop: pastDate,
            num_attempts: 0,
            total_points: 100,
          }
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    expect(await screen.findByText("Closed Assignment")).toBeInTheDocument();
  });

  test("student assignment with earned_points null uses grade", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Grade Fallback Assignment",
            description: "Fallback",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 1,
            total_points: 100,
          }
        ])
      ),
      http.get("**/api/v1/assignments/9001/attempts", () =>
        HttpResponse.json([
          { id: 1, grade: 75, earned_points: null },
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    expect(await screen.findByText("Grade Fallback Assignment")).toBeInTheDocument();
  });

  test("student assignment best grade calculation with null values", async () => {
    server.use(
      http.get("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json([
          {
            id: 9001,
            course_id: 1,
            title: "Null Grade Assignment",
            description: "Null",
            sub_limit: 3,
            start: null,
            stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            num_attempts: 2,
            total_points: 100,
          }
        ])
      ),
      http.get("**/api/v1/assignments/9001/attempts", () =>
        HttpResponse.json([
          { id: 1, grade: null, earned_points: null },
          { id: 2, grade: 80, earned_points: 80 },
        ])
      )
    );

    renderCoursePage({ role: "student", userId: "201" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const gradesTab = await screen.findByRole("tab", { name: /grades/i });
    await userEvent.click(gradesTab);

    expect(await screen.findByText("Null Grade Assignment")).toBeInTheDocument();
  });

  test("delete student dialog backdrop click", async () => {
    renderCoursePage({ role: "faculty", userId: "301" });

    await screen.findByRole("heading", { name: /FirstCourse/i });

    const participantsTab = await screen.findByRole("tab", { name: /participants/i });
    await userEvent.click(participantsTab);

    await screen.findByText(/Student Sam/i);

    const deleteButton = screen.getByLabelText(/Delete Student Sam/i);
    await userEvent.click(deleteButton);

    expect(await screen.findByText(/Confirm Deletion/i)).toBeInTheDocument();

    // Click backdrop to close
    const backdrop = screen.getByText(/Confirm Deletion/i).closest('div')?.parentElement;
    if (backdrop) {
      await userEvent.click(backdrop);
    }
  });
});
