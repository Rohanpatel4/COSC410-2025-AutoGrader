import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Routes, Route } from "react-router-dom";

import CreateCoursePage from "../webpages/CreateCoursePage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";

function renderCreateCoursePage() {
  return renderWithProviders(
    <Routes>
      <Route path="/courses/new" element={<CreateCoursePage />} />
      <Route path="/courses" element={<div>COURSES PAGE</div>} />
      <Route path="/my" element={<div>MY DASH</div>} />
    </Routes>,
    {
      route: "/courses/new",
      auth: { role: "faculty", userId: "301" },
    }
  );
}

describe("CreateCoursePage", () => {
  test("renders form with all fields", () => {
    renderCreateCoursePage();

    expect(screen.getByText(/create new course/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/course code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/course name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create course/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to courses/i })).toBeInTheDocument();
  });


  test("creates course successfully", async () => {
    renderCreateCoursePage();

    await userEvent.type(screen.getByLabelText(/course code/i), "COSC-300");
    await userEvent.type(screen.getByLabelText(/course name/i), "Data Structures");
    await userEvent.type(screen.getByLabelText(/description/i), "Learn data structures");

    await userEvent.click(screen.getByRole("button", { name: /create course/i }));

    expect(await screen.findByText(/course created successfully/i)).toBeInTheDocument();
  });

  test("disables submit until required fields are filled", async () => {
    renderCreateCoursePage();

    const createBtn = screen.getByRole("button", { name: /create course/i });
    expect(createBtn).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/course code/i), "COSC-300");
    expect(createBtn).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/course name/i), "Data Structures");
    expect(createBtn).toBeEnabled();
  });

  test("handles API error", async () => {
    server.use(
      http.post("**/api/v1/courses", () =>
        HttpResponse.json({ detail: "Course code already exists" }, { status: 409 })
      )
    );

    renderCreateCoursePage();

    await userEvent.type(screen.getByLabelText(/course code/i), "COSC-300");
    await userEvent.type(screen.getByLabelText(/course name/i), "Data Structures");
    await userEvent.click(screen.getByRole("button", { name: /create course/i }));

    expect(await screen.findByText(/course code already exists/i)).toBeInTheDocument();
  });

  test("cancel button navigates back", async () => {
    renderCreateCoursePage();

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelBtn);

    expect(await screen.findByText(/MY DASH/i)).toBeInTheDocument();
  });
});

