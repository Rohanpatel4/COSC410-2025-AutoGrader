import React from "react";
import { render, screen } from "@testing-library/react";
import { AppShell } from "../components/layout/AppShell";

describe("AppShell", () => {
  test("renders children correctly", () => {
    render(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );

    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  test("applies default classes", () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toContain("min-h-screen");
    expect(shell.className).toContain("bg-background");
    expect(shell.className).toContain("text-foreground");
  });

  test("applies custom className", () => {
    const { container } = render(
      <AppShell className="custom-class">
        <div>Content</div>
      </AppShell>
    );

    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toContain("custom-class");
    expect(shell.className).toContain("min-h-screen");
  });

  test("handles empty className gracefully", () => {
    const { container } = render(
      <AppShell className="">
        <div>Content</div>
      </AppShell>
    );

    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toContain("min-h-screen");
    expect(shell.className).not.toContain("  ");
  });
});