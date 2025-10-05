// src/test/StudentDashboard.test.tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import StudentDashboard from "../webpages/StudentDashboard";
import { renderPage } from "./test-utils";
import { expect } from "vitest";

describe("StudentDashboard", () => {
  it("renders basic UI", async () => {
    renderPage(<StudentDashboard />, { route: "/my", auth: { userId: "stu1", role: "student" } });

    expect(screen.getByRole("heading", { name: /student/i })).toBeInTheDocument();
    expect(screen.getByText(/User ID:/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to sandbox/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });

  it("loads and shows courses", async () => {
    renderPage(<StudentDashboard />, { route: "/my", auth: { userId: "stu1", role: "student" } });

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for list to appear
    const listItem = await screen.findByRole("listitem");
    expect(listItem).toBeInTheDocument();

    // Course link shape
    const link = listItem.querySelector("a");
    expect(link?.getAttribute("href")).toMatch(/^\/courses\//);
  });

  it("registers for a course and shows a success message", async () => {
    const user = userEvent.setup();
    renderPage(<StudentDashboard />, { route: "/my", auth: { userId: "stu1", role: "student" } });

    // Enter a course code and submit
    const input = await screen.findByPlaceholderText(/enter course id/i);
    await user.clear(input);
    await user.type(input, "COSC-410");
    await user.click(screen.getByRole("button", { name: /register/i }));

    // Success message appears (from component state)
    await screen.findByRole("status");
    expect(screen.getByRole("status")).toHaveTextContent(/registered!/i);

    // After register, list reloads; assert at least one item remains visible
    await waitFor(async () => {
      expect(await screen.findByRole("listitem")).toBeInTheDocument();
    });
  });
});