// src/test/LoginPage.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";

import LoginPage from "../webpages/LoginPage";
import { server } from "./server";
import { AuthProvider } from "../auth/AuthContext";
import { MemoryRouter } from "react-router-dom";

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/my" element={<div>MY DASH</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("validates email format before submitting", async () => {
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), "invalid-email");
    await userEvent.type(screen.getByLabelText(/password/i), "pw123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
    expect(localStorage.getItem("auth")).toBeNull();
  });

  test("successful login stores auth and navigates to dashboard", async () => {
    server.use(
      http.post("**/api/v1/login", async () =>
        HttpResponse.json({ user_id: 301, role: "faculty", token: "abc123" })
      )
    );

    renderLogin();

    await userEvent.selectOptions(screen.getByLabelText(/select role/i), "faculty");
    await userEvent.type(screen.getByLabelText(/email/i), "prof@wofford.edu");
    await userEvent.type(screen.getByLabelText(/password/i), "pw123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/MY DASH/i)).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("auth") ?? "{}");
    expect(stored.role).toBe("faculty");
    expect(stored.userId).toBe("301");
  });

  test("failed login shows error and clears password on next input", async () => {
    server.use(
      http.post("**/api/v1/login", () => HttpResponse.text("Unauthorized", { status: 401 }))
    );

    renderLogin();

    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(screen.getByLabelText(/email/i), "student@wofford.edu");
    await userEvent.type(passwordInput, "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument();

    // Next keystroke clears password field per UI logic
    await userEvent.type(passwordInput, "x");
    expect((passwordInput as HTMLInputElement).value).toBe("x");
    expect(localStorage.getItem("auth")).toBeNull();
  });
});
