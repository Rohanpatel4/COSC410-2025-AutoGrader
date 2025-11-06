import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  GraduationCap,
  FileText,
  Home,
  BarChart3,
  X,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { cn } from "../../lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

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

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { role } = useAuth();
  const location = useLocation();

  const items = navigationItems[role as keyof typeof navigationItems] || [];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onToggle}
        ></div>
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-amber-800 to-orange-900 text-white shadow-xl transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between px-6">
          <Link to="/my" className="flex items-center gap-2 text-2xl font-bold">
            <GraduationCap className="h-8 w-8 text-yellow-300" />
            AutoGrader
          </Link>
          <button
            onClick={onToggle}
            className="text-white lg:hidden"
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
                      ? "bg-white/20 text-white"
                      : "hover:bg-white/10"
                  )}
                  onClick={onToggle}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
