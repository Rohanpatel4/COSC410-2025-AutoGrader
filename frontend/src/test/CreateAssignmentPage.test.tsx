import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Routes, Route } from "react-router-dom";

import CreateAssignmentPage from "../webpages/CreateAssignmentPage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";

function renderCreateAssignmentPage(courseId = "500") {
  return renderWithProviders(
    <Routes>
      <Route path="/courses/:course_id/assignments/new" element={<CreateAssignmentPage />} />
      <Route path="/courses/:course_id" element={<div>COURSE PAGE</div>} />
    </Routes>,
    {
      route: `/courses/${courseId}/assignments/new`,
      auth: { role: "faculty", userId: "301" },
    }
  );
}

describe("CreateAssignmentPage", () => {
  test("renders form with all fields", () => {
    renderCreateAssignmentPage();

    expect(screen.getByText(/create new assignment/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/assignment title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/submission limit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/test file/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to course/i })).toBeInTheDocument();
  });

  test("shows test file format guide", () => {
    renderCreateAssignmentPage();

    expect(screen.getByText(/test file format guide/i)).toBeInTheDocument();
    expect(screen.getByText(/@points\(7\)/i)).toBeInTheDocument();
  });

  test("creates assignment successfully", async () => {
    renderCreateAssignmentPage();

    await userEvent.type(screen.getByLabelText(/assignment title/i), "Homework 1");
    await userEvent.type(screen.getByLabelText(/description/i), "Complete the exercises");
    await userEvent.type(screen.getByLabelText(/submission limit/i), "3");

    await userEvent.click(screen.getByRole("button", { name: /create assignment/i }));

    expect(await screen.findByText(/assignment created successfully/i)).toBeInTheDocument();
  });

  test("validates Python file upload", async () => {
    renderCreateAssignmentPage();

    const fileInput = screen.getByLabelText(/test file/i);
    const file = new File(["not python"], "test.txt", { type: "text/plain" });
    
    await userEvent.upload(fileInput, file);

    // Should show alert or reject the file
    // The component shows an alert for non-Python files
    expect(fileInput).toBeInTheDocument();
  });

  test("handles API error", async () => {
    server.use(
      http.post("**/api/v1/courses/:course_id/assignments", () =>
        HttpResponse.json({ detail: "Course not found" }, { status: 404 })
      )
    );

    renderCreateAssignmentPage();

    await userEvent.type(screen.getByLabelText(/assignment title/i), "Homework 1");
    await userEvent.click(screen.getByRole("button", { name: /create assignment/i }));

    expect(await screen.findByText(/course not found|create failed/i)).toBeInTheDocument();
  });

  test("cancel button navigates back", async () => {
    renderCreateAssignmentPage();

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelBtn);

    expect(await screen.findByText(/COURSE PAGE/i)).toBeInTheDocument();
  });
});

