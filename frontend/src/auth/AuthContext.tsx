import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

export type Role = "faculty" | "student";

type AuthState = { token: string | null; userId: string | null; role: Role | null };

type Ctx = AuthState & {
  login: (u: { userId: string; role: Role; token?: string | null }) => void;
  logout: () => void;
};

export const AuthContext = createContext<Ctx | undefined>(undefined);

const STORAGE_KEY = "auth";

export function AuthProvider({
  children,
  /** lets tests (or SSR) seed auth without calling login() */
  initial,
}: {
  children: React.ReactNode;
  initial?: Partial<AuthState>;
}) {
  // initial state (tests can pass role/userId here)
  const [token, setToken] = useState<string | null>(initial?.token ?? null);
  const [userId, setUserId] = useState<string | null>(initial?.userId ?? null);
  const [role, setRole] = useState<Role | null>(initial?.role ?? null);

  // hydrate from localStorage (only if not already provided by initial)
  useEffect(() => {
    if (initial?.role || initial?.userId || initial?.token) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AuthState>;
        setUserId(parsed.userId ?? null);
        setRole((parsed.role as Role) ?? null);
        setToken(parsed.token ?? null);
      }
    } catch {
      // ignore
    }
  }, [initial?.role, initial?.userId, initial?.token]);

  const login = ({ userId, role, token = null }: { userId: string; role: Role; token?: string | null }) => {
    setUserId(userId);
    setRole(role);
    setToken(token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, role, token }));
  };

  const logout = () => {
    setUserId(null);
    setRole(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(() => ({ token, userId, role, login, logout }), [token, userId, role]);

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

