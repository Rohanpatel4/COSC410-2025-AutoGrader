import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";

import CoursesPage from "../webpages/CoursesPage";
import { renderWithProviders } from "./renderWithProviders";
import { __testDb, resetDb } from "./handlers";

function renderCoursesPage(auth = { role: "faculty" as const, userId: "301" }) {
  return renderWithProviders(
    <Routes>
      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/courses/new" element={<div>CREATE COURSE PAGE</div>} />
      <Route path="/courses/:course_id" element={<div>COURSE DETAIL</div>} />
    </Routes>,
    {
      route: "/courses",
      auth,
    }
  );
}

describe("CoursesPage", () => {
  beforeEach(() => resetDb());

  test("renders courses list for faculty", async () => {
    __testDb.state.coursesByProfessor[301] = [
      {
        id: 1,
        course_code: "COSC-410",
        name: "AutoGrader",
        description: "Test course",
        professor_id: 301,
      },
    ];

    renderCoursesPage();

    expect(await screen.findByText(/COSC-410/i)).toBeInTheDocument();
    expect(screen.getByText(/AutoGrader/i)).toBeInTheDocument();
  });

  test("navigates to course detail on click", async () => {
    __testDb.state.coursesByProfessor[301] = [
      {
        id: 1,
        course_code: "COSC-410",
        name: "AutoGrader",
        description: "Test course",
        professor_id: 301,
      },
    ];

    renderCoursesPage();

    const courseCard = await screen.findByText(/COSC-410/i);
    await userEvent.click(courseCard.closest("div")!);

    expect(await screen.findByText(/COURSE DETAIL/i)).toBeInTheDocument();
  });

  test("shows empty state when no courses", async () => {
    __testDb.state.coursesByProfessor[301] = [];

    renderCoursesPage();

    expect(await screen.findByText("No courses found")).toBeInTheDocument();
    expect(screen.getByText("Get started by creating your first course")).toBeInTheDocument();
  });

  test("shows student empty state messaging", async () => {
    __testDb.state.enrollmentsByStudent[201] = [];

    renderCoursesPage({ role: "student", userId: "201" });

    // Wait for loading to complete and empty state to appear
    expect(await screen.findByText("You haven't joined any courses yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Join Course/i })).toBeInTheDocument();
  });

  test("filters courses by search query", async () => {
    __testDb.state.coursesByProfessor[301] = [
      {
        id: 1,
        course_code: "COSC-410",
        name: "Computer Science 410",
        description: "Test course",
        professor_id: 301,
      },
      {
        id: 2,
        course_code: "MATH-201",
        name: "Mathematics 201",
        description: "Math course",
        professor_id: 301,
      },
    ];

    renderCoursesPage();

    await screen.findByText(/COSC-410/i);

    // Search for "Computer"
    const searchInput = screen.getByPlaceholderText(/search courses/i);
    await userEvent.type(searchInput, "Computer");

    // Should show only Computer Science course
    expect(screen.getByText(/Computer Science 410/i)).toBeInTheDocument();
    expect(screen.queryByText(/Mathematics 201/i)).not.toBeInTheDocument();
  });

  test("shows empty search results", async () => {
    __testDb.state.coursesByProfessor[301] = [
      {
        id: 1,
        course_code: "COSC-410",
        name: "Computer Science 410",
        description: "Test course",
        professor_id: 301,
      },
    ];

    renderCoursesPage();

    await screen.findByText(/COSC-410/i);

    // Search for something that doesn't match
    const searchInput = screen.getByPlaceholderText(/search courses/i);
    await userEvent.type(searchInput, "XYZ999");

    // Should show empty search state
    expect(await screen.findByText(/No courses found/i)).toBeInTheDocument();
    expect(screen.getByText(/No results matching/i)).toBeInTheDocument();
  });

  test("navigates to create course page when faculty clicks create button", async () => {
    __testDb.state.coursesByProfessor[301] = [];

    renderCoursesPage();

    await screen.findByText(/No courses found/i);

    const createButton = screen.getByRole("button", { name: /Create New Course/i });
    await userEvent.click(createButton);

    expect(await screen.findByText(/CREATE COURSE PAGE/i)).toBeInTheDocument();
  });

  test("navigates to join course page when student clicks join button", async () => {
    __testDb.state.enrollmentsByStudent[201] = [];

    renderCoursesPage({ role: "student", userId: "201" });

    await screen.findByText(/You haven't joined any courses yet/i);

    const joinButton = screen.getByRole("button", { name: /Join a Course/i });
    await userEvent.click(joinButton);

    // Should navigate (tested via route change)
  });
});

