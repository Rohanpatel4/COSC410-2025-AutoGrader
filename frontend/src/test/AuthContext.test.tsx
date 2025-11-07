import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth, Protected } from "../auth/AuthContext";

function TestComponent() {
  const { userId, role, token, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="userId">{userId || "null"}</div>
      <div data-testid="role">{role || "null"}</div>
      <div data-testid="token">{token || "null"}</div>
      <button onClick={() => login({ userId: "123", role: "faculty", token: "new-token" })}>
        Login
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("provides initial auth state", () => {
    render(
      <AuthProvider initial={{ userId: "301", role: "faculty", token: "token123" }}>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId("userId")).toHaveTextContent("301");
    expect(screen.getByTestId("role")).toHaveTextContent("faculty");
    expect(screen.getByTestId("token")).toHaveTextContent("token123");
  });

  test("hydrates from localStorage when no initial provided", () => {
    localStorage.setItem("auth", JSON.stringify({
      userId: "201",
      role: "student",
      token: "stored-token",
    }));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId("userId")).toHaveTextContent("201");
    expect(screen.getByTestId("role")).toHaveTextContent("student");
  });

  test("login updates state and localStorage", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(screen.getByTestId("userId")).toHaveTextContent("123");
    expect(screen.getByTestId("role")).toHaveTextContent("faculty");
    expect(localStorage.getItem("auth")).toContain("123");
  });

  test("logout clears state and localStorage", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider initial={{ userId: "301", role: "faculty" }}>
        <TestComponent />
      </AuthProvider>
    );

    await user.click(screen.getByRole("button", { name: /logout/i }));

    expect(screen.getByTestId("userId")).toHaveTextContent("null");
    expect(screen.getByTestId("role")).toHaveTextContent("null");
    expect(localStorage.getItem("auth")).toBeNull();
  });

  test("Protected redirects when not authenticated", () => {
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <AuthProvider>
          <Protected>
            <div>Protected Content</div>
          </Protected>
        </AuthProvider>
      </MemoryRouter>
    );

    // Should redirect to login (Navigate component)
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  test("Protected renders children when authenticated", () => {
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <AuthProvider initial={{ role: "faculty" }}>
          <Protected>
            <div>Protected Content</div>
          </Protected>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  test("useAuth throws when used outside provider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow(/must be used within/i);

    consoleSpy.mockRestore();
  });
});

