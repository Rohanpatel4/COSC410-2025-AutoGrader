import React from "react";
import { render, screen } from "@testing-library/react";
import { ContentRow, ContentCard } from "../components/ui/content-row";

describe("ContentRow", () => {
  test("renders children", () => {
    render(
      <ContentRow>
        <div>Content Item 1</div>
        <div>Content Item 2</div>
      </ContentRow>
    );
    expect(screen.getByText("Content Item 1")).toBeInTheDocument();
    expect(screen.getByText("Content Item 2")).toBeInTheDocument();
  });

  test("renders title when provided", () => {
    render(
      <ContentRow title="Recent Assignments">
        <div>Assignment 1</div>
      </ContentRow>
    );
    expect(screen.getByRole("heading", { level: 2, name: "Recent Assignments" })).toBeInTheDocument();
  });

  test("does not render title when not provided", () => {
    render(
      <ContentRow>
        <div>Content</div>
      </ContentRow>
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  test("applies correct CSS classes", () => {
    render(
      <ContentRow>
        <div>Content</div>
      </ContentRow>
    );
    const row = screen.getByText("Content").closest(".content-row");
    expect(row).toHaveClass("content-row");
  });

  test("applies custom className", () => {
    render(
      <ContentRow className="custom-class">
        <div>Content</div>
      </ContentRow>
    );
    const row = screen.getByText("Content").closest(".content-row");
    expect(row).toHaveClass("custom-class");
  });

  test("renders title with correct class", () => {
    render(
      <ContentRow title="Test Title">
        <div>Content</div>
      </ContentRow>
    );
    const title = screen.getByRole("heading", { level: 2 });
    expect(title).toHaveClass("content-row-title");
  });

  test("renders children in flex container", () => {
    render(
      <ContentRow>
        <div>Item 1</div>
        <div>Item 2</div>
      </ContentRow>
    );

    const flexContainer = screen.getByText("Item 1").parentElement;
    expect(flexContainer).toHaveClass("flex", "gap-6", "overflow-x-auto", "pb-4", "scrollbar-hide");
  });
});

describe("ContentCard", () => {
  test("renders children", () => {
    render(
      <ContentCard>
        <h3>Card Title</h3>
        <p>Card content</p>
      </ContentCard>
    );
    expect(screen.getByText("Card Title")).toBeInTheDocument();
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  test("applies default CSS classes", () => {
    render(<ContentCard>Content</ContentCard>);
    const card = screen.getByText("Content");
    expect(card).toHaveClass(
      "flex-none",
      "w-72",
      "bg-card",
      "border",
      "border-border",
      "rounded-xl",
      "shadow-lg",
      "hover:shadow-xl",
      "transition-all",
      "duration-200",
      "cursor-pointer"
    );
  });

  test("applies custom className", () => {
    render(<ContentCard className="custom-card">Content</ContentCard>);
    const card = screen.getByText("Content");
    expect(card).toHaveClass("custom-card");
  });

  test("forwards HTML attributes", () => {
    render(
      <ContentCard data-testid="test-card" id="card-1">
        Content
      </ContentCard>
    );
    const card = screen.getByTestId("test-card");
    expect(card).toHaveAttribute("id", "card-1");
  });

  test("is clickable", () => {
    render(<ContentCard>Clickable content</ContentCard>);
    const card = screen.getByText("Clickable content");
    expect(card).toHaveClass("cursor-pointer");
  });

  test("has hover effects", () => {
    render(<ContentCard>Hover content</ContentCard>);
    const card = screen.getByText("Hover content");
    expect(card).toHaveClass("hover:shadow-xl");
  });
});