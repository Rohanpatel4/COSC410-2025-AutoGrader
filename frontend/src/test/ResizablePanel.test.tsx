import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { HorizontalResizablePanel, VerticalResizablePanel } from "../components/ui/ResizablePanel";

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe("HorizontalResizablePanel", () => {
  test("renders left and right content", () => {
    render(
      <HorizontalResizablePanel
        leftContent={<div>Left Panel</div>}
        rightContent={<div>Right Panel</div>}
      />
    );

    expect(screen.getByText("Left Panel")).toBeInTheDocument();
    expect(screen.getByText("Right Panel")).toBeInTheDocument();
  });

  test("applies initial left percentage", () => {
    render(
      <HorizontalResizablePanel
        leftContent={<div>Left</div>}
        rightContent={<div>Right</div>}
        initialLeftPercentage={30}
      />
    );

    const leftPanel = screen.getByText("Left").parentElement?.parentElement;
    expect(leftPanel).toHaveStyle({ width: "30%" });
  });

  test("shows collapse button when not collapsed", () => {
    render(
      <HorizontalResizablePanel
        leftContent={<div>Left</div>}
        rightContent={<div>Right</div>}
      />
    );

    const collapseButton = screen.getByTitle("Collapse instructions");
    expect(collapseButton).toBeInTheDocument();
  });

  test("hides collapse button when collapsed", () => {
    render(
      <HorizontalResizablePanel
        leftContent={<div>Left</div>}
        rightContent={<div>Right</div>}
      />
    );

    // Click collapse button
    const collapseButton = screen.getByTitle("Collapse instructions");
    fireEvent.click(collapseButton);

    // Collapse button should be hidden, expand button should be visible
    expect(screen.queryByTitle("Collapse instructions")).not.toBeInTheDocument();
    expect(screen.getByTitle("Expand instructions")).toBeInTheDocument();
  });

  test("calls onCollapse callback when collapsing", () => {
    const onCollapse = vi.fn();
    render(
      <HorizontalResizablePanel
        leftContent={<div>Left</div>}
        rightContent={<div>Right</div>}
        onCollapse={onCollapse}
      />
    );

    const collapseButton = screen.getByTitle("Collapse instructions");
    fireEvent.click(collapseButton);

    expect(onCollapse).toHaveBeenCalledWith(true);
  });

  test("calls onCollapse callback when expanding", () => {
    const onCollapse = vi.fn();
    render(
      <HorizontalResizablePanel
        leftContent={<div>Left</div>}
        rightContent={<div>Right</div>}
        onCollapse={onCollapse}
      />
    );

    // Collapse first
    const collapseButton = screen.getByTitle("Collapse instructions");
    fireEvent.click(collapseButton);

    // Then expand
    const expandButton = screen.getByTitle("Expand instructions");
    fireEvent.click(expandButton);

    expect(onCollapse).toHaveBeenCalledWith(false);
  });

  test("respects min and max percentages", () => {
    render(
      <HorizontalResizablePanel
        leftContent={<div>Left</div>}
        rightContent={<div>Right</div>}
        initialLeftPercentage={50}
        minLeftPercentage={30}
        maxLeftPercentage={70}
      />
    );

    const leftPanel = screen.getByText("Left").parentElement?.parentElement;
    expect(leftPanel).toHaveStyle({ width: "50%" });
  });

  test("shows resizer handle when not collapsed", () => {
    render(
      <HorizontalResizablePanel
        leftContent={<div>Left</div>}
        rightContent={<div>Right</div>}
      />
    );

    const resizer = document.querySelector('[class*="cursor-col-resize"]');
    expect(resizer).toBeInTheDocument();
  });

  test("hides resizer handle when collapsed", () => {
    render(
      <HorizontalResizablePanel
        leftContent={<div>Left</div>}
        rightContent={<div>Right</div>}
      />
    );

    // Click collapse
    const collapseButton = screen.getByTitle("Collapse instructions");
    fireEvent.click(collapseButton);

    const resizer = document.querySelector('[class*="cursor-col-resize"]');
    expect(resizer).not.toBeInTheDocument();
  });
});

describe("VerticalResizablePanel", () => {
  test("renders top and bottom content", () => {
    render(
      <VerticalResizablePanel
        topContent={<div>Top Panel</div>}
        bottomContent={<div>Bottom Panel</div>}
      />
    );

    expect(screen.getByText("Top Panel")).toBeInTheDocument();
    expect(screen.getByText("Bottom Panel")).toBeInTheDocument();
  });

  test("applies initial top percentage", () => {
    render(
      <VerticalResizablePanel
        topContent={<div>Top</div>}
        bottomContent={<div>Bottom</div>}
        initialTopPercentage={70}
      />
    );

    const topPanel = screen.getByText("Top").parentElement?.parentElement;
    expect(topPanel).toHaveStyle({ height: "70%" });
  });

  test("respects min and max percentages", () => {
    render(
      <VerticalResizablePanel
        topContent={<div>Top</div>}
        bottomContent={<div>Bottom</div>}
        initialTopPercentage={50}
        minTopPercentage={40}
        maxTopPercentage={60}
      />
    );

    const topPanel = screen.getByText("Top").parentElement?.parentElement;
    expect(topPanel).toHaveStyle({ height: "50%" });
  });

  test("shows vertical resizer handle", () => {
    render(
      <VerticalResizablePanel
        topContent={<div>Top</div>}
        bottomContent={<div>Bottom</div>}
      />
    );

    const resizer = document.querySelector('[class*="cursor-row-resize"]');
    expect(resizer).toBeInTheDocument();
  });
});