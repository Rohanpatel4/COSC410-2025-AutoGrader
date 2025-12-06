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
});

