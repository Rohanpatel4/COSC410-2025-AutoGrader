import React, { createContext, useContext, useMemo, useState } from "react";
import type { Role } from "../types/role";

type Role = "faculty" | "student";
type AuthState = { token: string | null; userId: string | null; role: Role | null };

type Ctx = AuthState & {
  login: (u: { userId: string; role: Role; token?: string | null }) => void;
  logout: () => void;
};

const AuthContext = createContext<Ctx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  const login = ({ userId, role, token = null }: { userId: string; role: Role; token?: string | null }) => {
    setUserId(userId);
    setRole(role);
    setToken(token);
    // optional: persist in localStorage if you want refresh to keep session
    localStorage.setItem("auth", JSON.stringify({ userId, role, token }));
  };

  const logout = () => {
    setUserId(null); setRole(null); setToken(null);
    localStorage.removeItem("auth");
  };

  const value = useMemo(() => ({ token, userId, role, login, logout }), [token, userId, role]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}

export function Protected({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (!role) return null; // router will redirect
  return <>{children}</>;
}
