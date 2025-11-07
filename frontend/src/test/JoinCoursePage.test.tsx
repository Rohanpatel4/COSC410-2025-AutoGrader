import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Routes, Route } from "react-router-dom";

import JoinCoursePage from "../webpages/JoinCoursePage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";

function renderJoinCoursePage() {
  return renderWithProviders(
    <Routes>
      <Route path="/courses/join" element={<JoinCoursePage />} />
      <Route path="/courses" element={<div>COURSES PAGE</div>} />
    </Routes>,
    {
      route: "/courses/join",
      auth: { role: "student", userId: "201" },
    }
  );
}

describe("JoinCoursePage", () => {
  test("renders enrollment key input", () => {
    renderJoinCoursePage();

    expect(screen.getByText(/join a course/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/enrollment key/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join course/i })).toBeInTheDocument();
  });

  test("joins course successfully", async () => {
    renderJoinCoursePage();

    await userEvent.type(screen.getByLabelText(/enrollment key/i), "ABC123XYZ789");
    await userEvent.click(screen.getByRole("button", { name: /join course/i }));

    expect(await screen.findByText(/Successfully registered for the course!/i)).toBeInTheDocument();
  });

  test("shows error for invalid key", async () => {
    server.use(
      http.post("**/api/v1/courses/enroll", () =>
         HttpResponse.json({ detail: "Invalid enrollment key" }, { status: 404 })
      )
    );

    renderJoinCoursePage();

    await userEvent.type(screen.getByLabelText(/enrollment key/i), "INVALID");
    await userEvent.click(screen.getByRole("button", { name: /join course/i }));

    expect(await screen.findByText(/Invalid enrollment key|Not Found|Registration failed/i)).toBeInTheDocument();
  });

  test("validates empty enrollment key", async () => {
    renderJoinCoursePage();

    const joinBtn = screen.getByRole("button", { name: /join course/i });
    expect(joinBtn).toBeDisabled();

    const input = screen.getByLabelText(/enrollment key/i);
    await userEvent.type(input, "   ");
    expect(joinBtn).toBeDisabled();
  });
});

