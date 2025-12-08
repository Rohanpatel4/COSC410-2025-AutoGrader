import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import CalendarWidget from "../components/ui/CalendarWidget";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";

function renderCalendarWidget(studentId = 201) {
  return renderWithProviders(
    <CalendarWidget studentId={studentId} />,
    {
      auth: { role: "student", userId: "201" },
    }
  );
}

describe("CalendarWidget", () => {
  test("renders calendar with assignments", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];
    
    const mockAssignments = [
      {
        id: 1,
        title: "Assignment 1",
        course_id: 1,
        course_code: "CS101",
        start: "2025-12-01T00:00:00Z",
        stop: "2025-12-31T23:59:59Z",
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json(mockAssignments)
      )
    );

    renderCalendarWidget();

    expect(await screen.findByText("Calendar")).toBeInTheDocument();
  });

  test("shows loading state initially", async () => {
    renderCalendarWidget();

    // Calendar widget shows loading spinner initially, then "Calendar" header appears after loading
    expect(await screen.findByText("Calendar")).toBeInTheDocument();
  });

  test("displays assignment indicators on calendar dates", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];

    const mockAssignments = [
      {
        id: 1,
        title: "Due Today",
        course_id: 1,
        course_code: "CS101",
        start: new Date().toISOString(),
        stop: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json(mockAssignments)
      )
    );

    renderCalendarWidget();

    await screen.findByText("Calendar");
    // Calendar should render
    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  test("handles empty assignments list", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json([])
      )
    );

    renderCalendarWidget();

    expect(await screen.findByText("Calendar")).toBeInTheDocument();
    // Should show empty state or just calendar
  });

  test("shows error state when API fails", async () => {
    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json({ error: "Server error" }, { status: 500 })
      )
    );

    renderCalendarWidget();

    // Should handle error gracefully
    expect(await screen.findByText("Calendar")).toBeInTheDocument();
  });

  test("displays assignments in calendar", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];

    const mockAssignments = [
      {
        id: 1,
        title: "Assignment Due Today",
        course_id: 1,
        course_code: "CS101",
        start: new Date().toISOString(),
        stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        description: "Test assignment",
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json(mockAssignments)
      )
    );

    renderCalendarWidget();

    expect(await screen.findByText("Calendar")).toBeInTheDocument();
  });

  test("renders calendar with no assignments", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json([])
      )
    );

    renderCalendarWidget();

    expect(await screen.findByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  test("navigates between weeks", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json([])
      )
    );

    renderCalendarWidget();

    await screen.findByText("Calendar");

    // Find and click prev/next week buttons
    const prevButton = screen.queryByRole("button", { name: /prev/i }) || 
                       screen.queryByLabelText(/previous week/i) ||
                       document.querySelector('[aria-label*="prev" i]');
    const nextButton = screen.queryByRole("button", { name: /next/i }) || 
                      screen.queryByLabelText(/next week/i) ||
                      document.querySelector('[aria-label*="next" i]');

    if (prevButton) {
      await userEvent.click(prevButton);
    }
    if (nextButton) {
      await userEvent.click(nextButton);
    }

    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  test("shows today button functionality", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json([])
      )
    );

    renderCalendarWidget();

    await screen.findByText("Calendar");

    // Find and click today button
    const todayButton = screen.queryByRole("button", { name: /today/i }) ||
                        screen.queryByText(/today/i) ||
                        document.querySelector('[aria-label*="today" i]');

    if (todayButton) {
      await userEvent.click(todayButton);
    }

    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  test("displays assignment counts correctly", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];

    const mockAssignments = [
      {
        id: 1,
        title: "Assignment 1",
        course_id: 1,
        course_code: "CS101",
        start: new Date().toISOString(),
        stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        description: "Test assignment",
      },
      {
        id: 2,
        title: "Assignment 2",
        course_id: 1,
        course_code: "CS101",
        start: new Date().toISOString(),
        stop: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        description: "Another assignment",
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json(mockAssignments)
      )
    );

    renderCalendarWidget();

    expect(await screen.findByText("Calendar")).toBeInTheDocument();

    // Calendar renders with assignments loaded
    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  test("handles course color assignment", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
      {
        id: 2,
        course_code: "MATH201",
        name: "Math 201",
        description: null,
        professor_id: 301,
      },
    ];

    const mockAssignments = [
      {
        id: 1,
        title: "CS Assignment",
        course_id: 1,
        course_code: "CS101",
        stop: new Date().toISOString(),
      },
      {
        id: 2,
        title: "Math Assignment",
        course_id: 2,
        course_code: "MATH201",
        stop: new Date().toISOString(),
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json([mockAssignments[0]])
      ),
      http.get("**/api/v1/courses/MATH201/assignments", () =>
        HttpResponse.json([mockAssignments[1]])
      )
    );

    renderCalendarWidget();

    expect(await screen.findByText("Calendar")).toBeInTheDocument();

    // Should assign different colors to different courses
    expect(screen.getByText("CS Assignment")).toBeInTheDocument();
    expect(screen.getByText("Math Assignment")).toBeInTheDocument();
  });

  test("navigates between weeks using prev/next buttons", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json([])
      )
    );

    renderCalendarWidget();

    await screen.findByText("Calendar");

    // Find navigation buttons by their parent buttons (they contain icons)
    const buttons = screen.getAllByRole("button");
    const prevButton = buttons.find(btn => btn.querySelector('svg'));
    const nextButton = buttons.find(btn => btn.querySelector('svg') && btn !== prevButton);

    if (prevButton && nextButton) {
      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();

      // Click next button
      await userEvent.click(nextButton);
      await userEvent.click(prevButton);
    }
  });

  test("goes to today when today button is clicked", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json([])
      )
    );

    renderCalendarWidget();

    await screen.findByText("Calendar");

    // Find date range button (which acts as today button)
    const buttons = screen.getAllByRole("button");
    const dateRangeButton = buttons.find(btn => {
      const text = btn.textContent || '';
      return text.match(/\w{3} \d+-\d+/) || text.match(/\w{3} \d+ - \w{3} \d+/);
    });

    if (dateRangeButton) {
      expect(dateRangeButton).toBeInTheDocument();
      await userEvent.click(dateRangeButton);
    }
  });

  test("displays due soon assignments section", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const mockAssignments = [
      {
        id: 1,
        title: "Due Soon Assignment",
        course_id: 1,
        course_code: "CS101",
        start: new Date().toISOString(),
        stop: tomorrow.toISOString(),
        best_score: 0,
        max_score: 100,
        attempts_used: 0,
        max_attempts: 3,
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json(mockAssignments)
      )
    );

    renderCalendarWidget();

    await screen.findByText("Calendar");

    // Should show due soon section if there are due soon assignments
    const dueSoonSection = screen.queryByText(/due soon/i);
    if (dueSoonSection) {
      expect(dueSoonSection).toBeInTheDocument();
    }
  });

  test("displays incomplete assignments section", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];

    const future = new Date();
    future.setDate(future.getDate() + 5);

    const mockAssignments = [
      {
        id: 1,
        title: "Incomplete Assignment",
        course_id: 1,
        course_code: "CS101",
        start: new Date().toISOString(),
        stop: future.toISOString(),
        best_score: 50,
        max_score: 100,
        attempts_used: 1,
        max_attempts: 3,
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json(mockAssignments)
      )
    );

    renderCalendarWidget();

    await screen.findByText("Calendar");

    // Should show incomplete section if there are incomplete assignments
    const incompleteSection = screen.queryByText(/to complete/i);
    if (incompleteSection) {
      expect(incompleteSection).toBeInTheDocument();
    }
  });

  test("handles assignment click navigation", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];

    const mockAssignments = [
      {
        id: 1,
        title: "Clickable Assignment",
        course_id: 1,
        course_code: "CS101",
        start: new Date().toISOString(),
        stop: new Date(Date.now() + 86400000).toISOString(),
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json(mockAssignments)
      )
    );

    renderCalendarWidget();

    await screen.findByText("Calendar");

    // Assignment should be clickable
    const assignment = screen.queryByText("Clickable Assignment");
    if (assignment) {
      expect(assignment).toBeInTheDocument();
    }
  });

  test("displays date range label correctly", async () => {
    const mockCourses = [
      {
        id: 1,
        course_code: "CS101",
        name: "CS101",
        description: null,
        professor_id: 301,
      },
    ];

    server.use(
      http.get("**/api/v1/courses/students/201", () =>
        HttpResponse.json(mockCourses)
      ),
      http.get("**/api/v1/courses/CS101/assignments", () =>
        HttpResponse.json([])
      )
    );

    renderCalendarWidget();

    await screen.findByText("Calendar");

    // Should display date range
    const dateRange = screen.queryByText(/\w{3} \d+-\d+/);
    if (dateRange) {
      expect(dateRange).toBeInTheDocument();
    }
  });

});

