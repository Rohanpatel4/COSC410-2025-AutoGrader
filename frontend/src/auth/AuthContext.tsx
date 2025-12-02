import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

export type Role = "faculty" | "student";

type AuthState = { token: string | null; userId: string | null; userEmail: string | null; role: Role | null };

type Ctx = AuthState & {
  login: (u: { userId: string; role: Role; token?: string | null; userEmail?: string | null }) => void;
  logout: () => void;
};

export const AuthContext = createContext<Ctx | undefined>(undefined);

const STORAGE_KEY = "auth";

// Helper function to load auth state from localStorage synchronously
function loadAuthFromStorage(): Partial<AuthState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as Partial<AuthState>;
    }
  } catch {
    // ignore
  }
  return {};
}

export function AuthProvider({
  children,
  /** lets tests (or SSR) seed auth without calling login() */
  initial,
}: {
  children: React.ReactNode;
  initial?: Partial<AuthState>;
}) {
  // Load from localStorage synchronously on initial render to prevent race conditions
  // Only use localStorage if initial values are not provided (for tests)
  const storedAuth = initial?.role || initial?.userId || initial?.token ? {} : loadAuthFromStorage();
  
  // initial state (tests can pass role/userId here, otherwise use localStorage)
  const [token, setToken] = useState<string | null>(initial?.token ?? storedAuth.token ?? null);
  const [userId, setUserId] = useState<string | null>(initial?.userId ?? storedAuth.userId ?? null);
  const [userEmail, setUserEmail] = useState<string | null>(initial?.userEmail ?? storedAuth.userEmail ?? null);
  const [role, setRole] = useState<Role | null>(initial?.role ?? (storedAuth.role as Role) ?? null);

  const login = ({ userId, role, token = null, userEmail: email = null }: { userId: string; role: Role; token?: string | null; userEmail?: string | null }) => {
    setUserId(userId);
    setUserEmail(email);
    setRole(role);
    setToken(token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, role, token, userEmail: email }));
  };

  const logout = () => {
    setUserId(null);
    setUserEmail(null);
    setRole(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(() => ({ token, userId, userEmail, role, login, logout }), [token, userId, userEmail, role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}

/** Simple gate used in routing layouts; redirects to login when not authenticated. */
export function Protected({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (!role) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

