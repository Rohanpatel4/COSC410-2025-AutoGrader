import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  GraduationCap,
  FileText,
  Home,
  BarChart3,
  X,
  Menu,
  User,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";

const navigationItems = {
  faculty: [
    { name: "Dashboard", href: "/my", icon: Home },
    { name: "Courses", href: "/courses", icon: BookOpen },
    { name: "Gradebook", href: "/gradebook", icon: BarChart3 },
  ],
  student: [
    { name: "Dashboard", href: "/my", icon: Home },
    { name: "Assignments", href: "/assignments", icon: FileText },
    { name: "Courses", href: "/courses", icon: BookOpen },
  ],
};

export function Navigation() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { role, userId, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const items = navigationItems[role as keyof typeof navigationItems] || [];

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar - z-50 (higher) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-primary via-accent to-primary/90 text-primary-foreground shadow-xl transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-24 items-center justify-between px-6">
          <Link to="/my" className="flex items-center gap-2 text-2xl font-bold text-primary-foreground">
            <GraduationCap className="h-8 w-8 text-primary-foreground" />
            AutoGrader
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-primary-foreground lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-8 px-4">
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={cn(
                    "sidebar-item",
                    location.pathname === item.href
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "hover:bg-primary-foreground/10 text-primary-foreground/80"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Header - z-40 (below sidebar), offset for sidebar on desktop */}
      <header className="fixed top-0 left-0 right-0 lg:left-64 lg:w-[calc(100%-16rem)] z-40 w-full bg-card border-b border-border shadow-sm">
        <div className="flex h-24 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="text-foreground">{userId}</span>
              <span className="capitalize text-muted-foreground">({role})</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}

