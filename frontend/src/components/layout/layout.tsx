import React from "react";
import { Navigation } from "./Navigation";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export function Layout({ children, title, actions }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="lg:pl-64 pt-24">
        <div className="py-6">
          {(title || actions) && (
            <div className="mb-6 flex items-center justify-between">
              {title && (
                <div className="ml-8">
                  <div className="bg-card border border-border rounded-lg p-6 shadow-sm inline-block">
                    <h1 className="text-3xl font-bold text-foreground">{title}</h1>
                  </div>
                </div>
              )}
              {actions && (
                <div className="flex justify-end">
                  {actions}
                </div>
              )}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
