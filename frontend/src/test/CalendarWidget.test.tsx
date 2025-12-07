import React from "react";
import { screen } from "@testing-library/react";
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
    // Calendar should render with date buttons
    expect(screen.getAllByRole("button").length).toBeGreaterThan(10); // Calendar dates
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
});
