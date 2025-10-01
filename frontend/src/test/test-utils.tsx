import React from "react";
import { render } from "@testing-library/react";
import { AuthProvider } from "../auth/AuthContext";
import { MemoryRouter, MemoryRouterProps } from "react-router-dom";

type Options = {
  route?: string;
  routerProps?: Omit<MemoryRouterProps, "children">;
  auth?: { userId?: string; role?: "student" | "faculty"; token?: string | null };
};

export function renderPage(ui: React.ReactElement, opts: Options = {}) {
  const { route = "/", routerProps, auth } = opts;

  if (auth) {
    localStorage.setItem("auth", JSON.stringify({
      userId: auth.userId ?? "u1",
      role: auth.role ?? "student",
      token: auth.token ?? "test-token",
    }));
  } else {
    localStorage.removeItem("auth");
  }

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AuthProvider>
      <MemoryRouter initialEntries={[route]} {...routerProps}>
        {children}
      </MemoryRouter>
    </AuthProvider>
  );

  return render(ui, { wrapper: Wrapper as React.FC });
}