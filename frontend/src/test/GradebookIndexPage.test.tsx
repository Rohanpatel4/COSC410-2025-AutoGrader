import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";

import GradebookIndexPage from "../webpages/GradebookIndexPage";
import { renderWithProviders } from "./renderWithProviders";
import { __testDb, resetDb } from "./handlers";

function renderGradebookIndexPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/gradebook" element={<GradebookIndexPage />} />
      <Route path="/courses/:course_id/gradebook" element={<div>GRADEBOOK PAGE</div>} />
    </Routes>,
    {
      route: "/gradebook",
      auth: { role: "faculty", userId: "301" },
    }
  );
}

describe("GradebookIndexPage", () => {
  beforeEach(() => resetDb());

  test("renders course list for gradebook", async () => {
    __testDb.state.coursesByProfessor[301] = [
      {
        id: 1,
        course_code: "COSC-410",
        name: "AutoGrader",
        description: "Test course",
        professor_id: 301,
      },
    ];

    renderGradebookIndexPage();

    expect(await screen.findByText(/COSC-410/i)).toBeInTheDocument();
    expect(screen.getByText(/AutoGrader/i)).toBeInTheDocument();
  });

  test("navigates to gradebook on course click", async () => {
    __testDb.state.coursesByProfessor[301] = [
      {
        id: 1,
        course_code: "COSC-410",
        name: "AutoGrader",
        description: "Test course",
        professor_id: 301,
      },
    ];

    renderGradebookIndexPage();

    const courseCard = await screen.findByText(/COSC-410/i);
    await userEvent.click(courseCard.closest("div")!);

    expect(await screen.findByText(/GRADEBOOK PAGE/i)).toBeInTheDocument();
  });

  test("shows empty state when no courses", async () => {
    __testDb.state.coursesByProfessor[301] = [];

    renderGradebookIndexPage();

    expect(await screen.findByText(/no courses found/i)).toBeInTheDocument();
  });
});

