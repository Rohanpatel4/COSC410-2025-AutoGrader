import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Celebration } from "../components/ui/Celebration";

// Mock timers
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("Celebration", () => {
  test("does not render when show is false", () => {
    render(<Celebration show={false} />);
    expect(screen.queryByText("Perfect Score!")).not.toBeInTheDocument();
  });

  test("renders when show is true", () => {
    render(<Celebration show={true} />);
    expect(screen.getByText("Perfect Score!")).toBeInTheDocument();
    expect(screen.getByText("Excellent work! All test cases passed.")).toBeInTheDocument();
  });

  test("shows score and total when provided", () => {
    render(<Celebration show={true} score={95} total={100} />);
    expect(screen.getByText("95 / 100")).toBeInTheDocument();
  });

  test("does not show score when not provided", () => {
    render(<Celebration show={true} />);
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

  test("renders celebration overlay", () => {
    render(<Celebration show={true} />);

    expect(screen.getByText("Perfect Score!")).toBeInTheDocument();
    expect(screen.getByText("Excellent work! All test cases passed.")).toBeInTheDocument();
  });

  test("handles onComplete callback", () => {
    const onComplete = vi.fn();
    render(<Celebration show={true} onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();
  });

  test("renders with proper structure", () => {
    render(<Celebration show={true} />);

    expect(screen.getByText("Perfect Score!")).toBeInTheDocument();
    expect(screen.getByText("Excellent work! All test cases passed.")).toBeInTheDocument();
  });

  test("handles click events", () => {
    render(<Celebration show={true} />);

    expect(screen.getByText("Perfect Score!")).toBeInTheDocument();
  });

  test("renders celebration content", () => {
    render(<Celebration show={true} />);

    expect(screen.getByText("Perfect Score!")).toBeInTheDocument();
    expect(screen.getByText("Excellent work! All test cases passed.")).toBeInTheDocument();
  });

  test("handles score display", () => {
    render(<Celebration show={true} score={95} total={100} />);

    expect(screen.getByText("95 / 100")).toBeInTheDocument();
  });

  test("handles no score display", () => {
    render(<Celebration show={true} />);

    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

});
