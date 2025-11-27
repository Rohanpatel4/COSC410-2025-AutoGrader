import React from "react";
import { Navigation } from "./Navigation";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
  fullScreen?: boolean;
}

export function Layout({ children, title, actions, fullScreen }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="lg:pl-64 pt-24">
        {fullScreen ? (
          children
        ) : (
          <div className="py-6">
            {/* Header removed as per design requirement */}
            {children}
          </div>
        )}
      </main>
    </div>
  );
}
