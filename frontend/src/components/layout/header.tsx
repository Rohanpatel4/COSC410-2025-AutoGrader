import React from "react";
import { GraduationCap, Menu, User, LogOut } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../ui/button";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { userId, role, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-black border-b border-gray-800">
      <div className="flex h-24 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-yellow-400" />
            <span className="font-semibold text-lg text-white">AutoGrader</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-300">
            <User className="h-4 w-4" />
            <span className="text-white">{userId}</span>
            <span className="capitalize text-gray-300">({role})</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-gray-300 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
