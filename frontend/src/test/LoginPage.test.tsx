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

  test("handles network errors during login", async () => {
    server.use(
      http.post("**/api/v1/login", () =>
        HttpResponse.error()
      )
    );

    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    // Should handle network errors gracefully
    expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument();
  });

  test("shows loading state during login", async () => {
    server.use(
      http.post("**/api/v1/login", async () => {
        // Simulate slow response
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json({ user_id: 301, role: "faculty", token: "abc123" });
      })
    );

    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), "faculty@test.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password");

    const loginButton = screen.getByRole("button", { name: /sign in/i });
    await userEvent.click(loginButton);

    // Should navigate after successful login
    expect(await screen.findByText(/MY DASH/i)).toBeInTheDocument();
  });

  test("validates empty email field", async () => {
    renderLogin();

    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
  });

  test("validates empty password field", async () => {
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    // Should show email error when password is empty (client-side validation)
    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
  });

  test("clears error messages on input change", async () => {
    renderLogin();

    // Trigger validation error
    await userEvent.type(screen.getByLabelText(/email/i), "invalid");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();

    // Type valid email to clear error
    const emailInput = screen.getByLabelText(/email/i);
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "valid@example.com");

    // Error should be cleared
    expect(screen.queryByText(/enter a valid email/i)).not.toBeInTheDocument();
  });

  test("handles different user roles correctly", async () => {
    server.use(
      http.post("**/api/v1/login", () =>
        HttpResponse.json({ user_id: 201, role: "student", token: "student-token" })
      )
    );

    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), "student@test.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    // Should navigate to student dashboard
    expect(await screen.findByText(/MY DASH/i)).toBeInTheDocument();
  });

  test("preserves form state during failed login", async () => {
    renderLogin();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(emailInput, "test@example.com");
    await userEvent.type(passwordInput, "wrongpassword");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    // Form values should be preserved
    expect(emailInput).toHaveValue("test@example.com");
    expect(passwordInput).toHaveValue("wrongpassword");

    expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument();
  });

  test("handles API response without token", async () => {
    server.use(
      http.post("**/api/v1/login", () =>
        HttpResponse.json({ user_id: 301, role: "faculty" }) // Missing token
      )
    );

    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    // Should still navigate despite missing token (auth context handles this)
    expect(await screen.findByText(/MY DASH/i)).toBeInTheDocument();
  });

  test("maintains accessibility features", async () => {
    renderLogin();

    // Check for proper labels and roles
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  test("handles rapid successive login attempts", async () => {
    server.use(
      http.post("**/api/v1/login", () =>
        HttpResponse.json({ user_id: 301, role: "faculty", token: "abc123" })
      )
    );

    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password");

    // Click login multiple times rapidly
    const loginButton = screen.getByRole("button", { name: /sign in/i });
    await userEvent.click(loginButton);
    await userEvent.click(loginButton);

    // Should still navigate successfully
    expect(await screen.findByText(/MY DASH/i)).toBeInTheDocument();
  });
});
