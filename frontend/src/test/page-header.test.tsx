import React from "react";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "../components/ui/page-header";

describe("PageHeader", () => {
  test("renders title", () => {
    render(<PageHeader title="Test Page" />);
    expect(screen.getByRole("heading", { level: 1, name: "Test Page" })).toBeInTheDocument();
  });

  test("renders subtitle when provided", () => {
    render(<PageHeader title="Test Page" subtitle="This is a test subtitle" />);
    expect(screen.getByText("This is a test subtitle")).toBeInTheDocument();
  });

  test("does not render subtitle when not provided", () => {
    render(<PageHeader title="Test Page" />);
    expect(screen.queryByText(/subtitle/)).not.toBeInTheDocument();
  });

  test("renders actions when provided", () => {
    render(
      <PageHeader
        title="Test Page"
        actions={<button>Action Button</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Action Button" })).toBeInTheDocument();
  });

  test("does not render actions container when no actions provided", () => {
    render(<PageHeader title="Test Page" />);
    const actionsContainer = document.querySelector('[class*="flex items-center gap-3"]');
    expect(actionsContainer).not.toBeInTheDocument();
  });

  test("applies correct CSS classes", () => {
    render(<PageHeader title="Test Page" />);
    const header = screen.getByRole("heading", { level: 1 }).closest("[class*='mb-8']");
    expect(header).toHaveClass("mb-8", "pb-6", "border-b", "border-border");
  });

  test("applies custom className", () => {
    render(<PageHeader title="Test Page" className="custom-class" />);
    const header = screen.getByRole("heading", { level: 1 }).closest("[class*='mb-8']");
    expect(header).toHaveClass("custom-class");
  });

  test("renders title with correct typography classes", () => {
    render(<PageHeader title="Test Page" />);
    const title = screen.getByRole("heading", { level: 1 });
    expect(title).toHaveClass("text-3xl", "md:text-4xl", "font-bold", "tracking-tight", "text-foreground");
  });

  test("renders subtitle with correct typography classes", () => {
    render(<PageHeader title="Test Page" subtitle="Test subtitle" />);
    const subtitle = screen.getByText("Test subtitle");
    expect(subtitle).toHaveClass("text-base", "text-muted-foreground", "max-w-2xl");
  });

  test("renders complex actions", () => {
    render(
      <PageHeader
        title="Test Page"
        actions={
          <>
            <button>Save</button>
            <button>Cancel</button>
          </>
        }
      />
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  test("has proper layout structure", () => {
    render(<PageHeader title="Test Page" />);
    const header = screen.getByRole("heading", { level: 1 }).closest("[class*='mb-8']");

    // Should have flex layout
    expect(header?.firstElementChild).toHaveClass("flex", "items-start", "justify-between", "gap-4");
  });
});