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

    expect(await screen.findByText(/no courses available/i)).toBeInTheDocument();
  });

  test("shows student empty state messaging", async () => {
    renderCoursesPage({ role: "student", userId: "201" });

    const emptyHeading = await screen.findByRole("heading", { name: /no courses available/i });
    expect(emptyHeading).toBeInTheDocument();
    expect(screen.getByText(/There are no courses available for enrollment/i)).toBeInTheDocument();
  });
});

