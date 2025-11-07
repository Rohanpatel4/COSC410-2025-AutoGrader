import React from "react";

export interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * AppShell provides a consistent layout structure for all pages
 * - Handles min-height for full-page layouts
 * - Provides consistent background styling
 * - Can be extended with header/footer in the future
 */
export function AppShell({ children, className = "" }: AppShellProps) {
  return (
    <div className={`min-h-screen bg-background text-foreground ${className}`.trim()}>
      {children}
    </div>
  );
}

