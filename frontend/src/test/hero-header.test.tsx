import React from "react";
import { render, screen } from "@testing-library/react";
import { HeroHeader } from "../components/ui/hero-header";

describe("HeroHeader", () => {
  test("renders title", () => {
    render(<HeroHeader title="Welcome Back" />);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome Back" })).toBeInTheDocument();
  });

  test("renders subtitle when provided", () => {
    render(<HeroHeader title="Welcome Back" subtitle="Here's what's happening today" />);
    expect(screen.getByText("Here's what's happening today")).toBeInTheDocument();
  });

  test("does not render subtitle when not provided", () => {
    render(<HeroHeader title="Welcome Back" />);
    expect(screen.queryByText(/subtitle/)).not.toBeInTheDocument();
  });

  test("renders stats when provided", () => {
    const stats = [
      { label: "Courses", value: 5 },
      { label: "Students", value: 120 },
    ];

    render(<HeroHeader title="Dashboard" stats={stats} />);

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Courses")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("Students")).toBeInTheDocument();
  });

  test("does not render stats section when no stats provided", () => {
    render(<HeroHeader title="Dashboard" />);
    const statsSection = document.querySelector(".hero-stats");
    expect(statsSection).not.toBeInTheDocument();
  });

  test("renders children when provided", () => {
    render(
      <HeroHeader title="Dashboard">
        <button>Action Button</button>
      </HeroHeader>
    );
    expect(screen.getByRole("button", { name: "Action Button" })).toBeInTheDocument();
  });

  test("does not render children container when no children provided", () => {
    render(<HeroHeader title="Dashboard" />);
    // Should not have the extra container div
    const mainContent = screen.getByRole("heading", { level: 1 }).closest(".hero-header-improved");
    const childrenContainer = mainContent?.querySelector("div.mt-6");
    expect(childrenContainer).toBeNull();
  });

  test("applies correct CSS classes", () => {
    render(<HeroHeader title="Dashboard" />);
    const header = screen.getByRole("heading", { level: 1 }).closest(".hero-header-improved");
    expect(header).toHaveClass("hero-header-improved");
  });

  test("applies custom className", () => {
    render(<HeroHeader title="Dashboard" className="custom-class" />);
    const header = screen.getByRole("heading", { level: 1 }).closest(".hero-header-improved");
    expect(header).toHaveClass("custom-class");
  });

  test("renders title with correct class", () => {
    render(<HeroHeader title="Dashboard" />);
    const title = screen.getByRole("heading", { level: 1 });
    expect(title).toHaveClass("hero-title-improved");
  });

  test("renders subtitle with correct class", () => {
    render(<HeroHeader title="Dashboard" subtitle="Welcome message" />);
    const subtitle = screen.getByText("Welcome message");
    expect(subtitle).toHaveClass("hero-subtitle-improved");
  });

  test("renders stats with correct structure", () => {
    const stats = [
      { label: "Courses", value: 5 },
      { label: "Students", value: 120 },
    ];

    render(<HeroHeader title="Dashboard" stats={stats} />);

    const statsSection = document.querySelector(".hero-stats");
    expect(statsSection).toBeInTheDocument();

    const statCards = document.querySelectorAll(".hero-stat-card");
    expect(statCards).toHaveLength(2);

    // Check stat values have correct classes
    const statValues = screen.getAllByText(/5|120/);
    statValues.forEach(value => {
      expect(value).toHaveClass("text-3xl", "font-bold", "text-card-foreground");
    });

    // Check stat labels have correct classes
    expect(screen.getByText("Courses")).toHaveClass("text-sm", "font-medium", "text-card-foreground/80");
    expect(screen.getByText("Students")).toHaveClass("text-sm", "font-medium", "text-card-foreground/80");
  });

  test("handles string and number stat values", () => {
    const stats = [
      { label: "Status", value: "Active" },
      { label: "Count", value: 42 },
    ];

    render(<HeroHeader title="Dashboard" stats={stats} />);

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});