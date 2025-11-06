import React, { useState } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />

      <main className="lg:pl-64">
        <div className="py-6">
          {title && (
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground">{title}</h1>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
