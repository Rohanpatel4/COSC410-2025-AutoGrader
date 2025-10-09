import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, Role } from "../auth/AuthContext";

/**
 * Renders UI under MemoryRouter + AuthProvider. You can:
 * - set `route` (initial pathname)
 * - inject auth via `auth` (role/userId)
 * - define simple routes table if your component needs nested routes
 */
export function renderWithProviders(
  ui: React.ReactElement,
  {
    route = "/",
    auth = { role: "faculty" as Role, userId: "301" },
    routes,
  }: {
    route?: string;
    auth?: { role: Role; userId: string; token?: string | null };
    routes?: Array<{ path: string; element: React.ReactElement }>;
  } = {}
) {
  window.history.pushState({}, "Test", route);

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <AuthProvider initial={{ role: auth.role, userId: auth.userId, token: auth.token ?? null }}>
        {routes ? (
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              {routes.map((r, i) => (
                <Route key={i} path={r.path} element={r.element} />
              ))}
              {/* Fallback route to directly render the children */}
              <Route path="*" element={children as any} />
            </Routes>
          </MemoryRouter>
        ) : (
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        )}
      </AuthProvider>
    );
  };

  return render(ui, { wrapper: Wrapper as React.ComponentType });
}
