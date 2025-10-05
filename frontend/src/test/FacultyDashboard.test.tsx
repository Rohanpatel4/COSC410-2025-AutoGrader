// src/test/FacultyDashboard.test.tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import FacultyDashboard from "../webpages/FacultyDashboard";
import { renderPage } from "./test-utils";
import { expect } from "vitest";

describe("FacultyDashboard", () => {
  it("renders and loads my courses", async () => {
    renderPage(<FacultyDashboard />, { route: "/my", auth: { userId: "prof1", role: "faculty" } });

    expect(screen.getByRole("heading", { name: /faculty/i })).toBeInTheDocument();
    await screen.findByText(/my courses/i);

    // One of mocked courses appears
    const item = await screen.findByRole("listitem");
    expect(item).toBeInTheDocument();
  });

  it("creates a new course", async () => {
    const user = userEvent.setup();
    renderPage(<FacultyDashboard />, { route: "/my", auth: { userId: "prof1", role: "faculty" } });

    await user.type(screen.getByLabelText(/course id/i), "COSC-200");
    await user.type(screen.getByLabelText(/course name/i), "Data Structures");
    await user.type(screen.getByLabelText(/description/i), "DS course");
    await user.click(screen.getByRole("button", { name: /create course/i }));

    // Success message
    await screen.findByRole("status");
    expect(screen.getByRole("status")).toHaveTextContent(/created/i);

    // New course should now be visible in the list
    expect(await screen.findByText(/data structures/i)).toBeInTheDocument();
  });
});