// src/test/LoginPage.test.tsx
import React from "react";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import LoginPage from "../webpages/LoginPage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";

describe("LoginPage", () => {
  afterEach(() => {
    localStorage.clear();
  });

  function renderAtLogin() {
    return renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/my" element={<div>MY DASH</div>} />
      </Routes>,
      { route: "/login" }
    );
  }

  test("logs in as student and redirects to /my, storing auth", async () => {
  server.use(
    http.post("**/api/v1/login", async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json(
        { userId: 201, role: body?.role ?? "student", token: "tok123" },
        { status: 200 }
      );
    })
  );

  renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/my" element={<div>MY DASH</div>} />
    </Routes>,
    { route: "/login" }
  );

  await userEvent.type(screen.getByLabelText(/email/i), "s@wofford.edu");
  await userEvent.type(screen.getByLabelText(/password/i), "pw123");
  await userEvent.click(screen.getByRole("button", { name: /enter/i }));

  // ✅ Just assert the final state (redirect + localStorage), not the transient label
  expect(await screen.findByText(/my dash/i)).toBeInTheDocument();

  const stored = JSON.parse(localStorage.getItem("auth") || "{}");
  expect(stored).toMatchObject({ userId: "201", role: "student", token: "tok123" });
});

test("shows error on bad credentials and does not persist auth", async () => {
  server.use(
    http.post("**/api/v1/login", async () =>
      HttpResponse.json({ message: "invalid credentials" }, { status: 401 })
    )
  );

  renderWithProviders(<LoginPage />, { route: "/login" });

  await userEvent.type(screen.getByLabelText(/email/i), "wrong@wofford.edu");
  await userEvent.type(screen.getByLabelText(/password/i), "badpw");
  await userEvent.click(screen.getByRole("button", { name: /enter/i }));

  // ✅ Assert final error state
  expect(await screen.findByText(/login failed|invalid credentials/i)).toBeInTheDocument();

  // stays on login page
  expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();

  // no auth persisted
  expect(localStorage.getItem("auth")).toBeNull();

  // button label should be back to "Enter"
  expect(screen.getByRole("button", { name: /enter/i })).toBeEnabled();
});

  test("logging in as faculty stores role 'faculty'", async () => {
    server.use(
      http.post("**/api/v1/login", async ({ request }) => {
        const body = await request.json() as any;
        return HttpResponse.json(
          {
            userId: 301,
            // even if backend echoes back something else, your code prefers server role
            role: body?.role ?? "faculty",
            token: "tok_fac",
          },
          { status: 200 }
        );
      })
    );

    renderAtLogin();

    // change role
    await userEvent.selectOptions(screen.getByLabelText(/select role/i), "faculty");

    // fill fields
    await userEvent.type(screen.getByLabelText(/email/i), "prof@wofford.edu");
    await userEvent.type(screen.getByLabelText(/password/i), "pw");

    await userEvent.click(screen.getByRole("button", { name: /enter/i }));

    // redirected
    expect(await screen.findByText(/my dash/i)).toBeInTheDocument();

    // persisted as faculty
    const auth = JSON.parse(localStorage.getItem("auth")!);
    expect(auth).toMatchObject({ userId: "301", role: "faculty", token: "tok_fac" });
  });
});
