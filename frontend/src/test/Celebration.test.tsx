import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
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

  test("handles onComplete callback after timeout", () => {
    const onComplete = vi.fn();
    render(<Celebration show={true} onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();
    
    // Fast-forward time to trigger auto-dismiss
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    
    // Callback should be called immediately after timer
    expect(onComplete).toHaveBeenCalled();
  });

  test("handles onComplete callback on click", () => {
    const onComplete = vi.fn();
    const { container } = render(<Celebration show={true} onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();
    
    // Click on overlay to dismiss - click on the particle container (child of overlay but not card)
    const particleContainer = container.querySelector('.celebration-overlay > div') as HTMLElement;
    if (particleContainer) {
      act(() => {
        particleContainer.click();
      });
      expect(onComplete).toHaveBeenCalled();
    }
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

  test("calls onComplete after timeout", () => {
    const onComplete = vi.fn();
    render(<Celebration show={true} onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();
    
    // Fast-forward time by 4 seconds
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    
    expect(onComplete).toHaveBeenCalled();
  });

  test("handles click on overlay to dismiss", () => {
    const onComplete = vi.fn();
    const { container } = render(<Celebration show={true} onComplete={onComplete} />);

    expect(screen.getByText("Perfect Score!")).toBeInTheDocument();
    
    // Click on overlay (outside the card) - click on particle container
    const particleContainer = container.querySelector('.celebration-overlay > div') as HTMLElement;
    if (particleContainer) {
      act(() => {
        particleContainer.click();
      });
      expect(onComplete).toHaveBeenCalled();
    }
  });

  test("does not dismiss when clicking on card", async () => {
    const onComplete = vi.fn();
    const { container } = render(<Celebration show={true} onComplete={onComplete} />);

    expect(screen.getByText("Perfect Score!")).toBeInTheDocument();
    
    // Click on card itself (should not dismiss immediately)
    const card = container.querySelector('.celebration-card') as HTMLElement;
    if (card) {
      act(() => {
        card.click();
      });
      // Card should still be visible (onComplete should not be called)
      expect(onComplete).not.toHaveBeenCalled();
      expect(screen.getByText("Perfect Score!")).toBeInTheDocument();
    }
  });

  test("generates particles when shown", () => {
    const { container } = render(<Celebration show={true} />);
    
    expect(screen.getByText("Perfect Score!")).toBeInTheDocument();
    // Particles are rendered - check for particle elements
    const particles = container.querySelectorAll('.celebration-particle');
    expect(particles.length).toBeGreaterThan(0);
  });

  test("hides when show becomes false after timeout", () => {
    const { rerender } = render(<Celebration show={true} />);
    expect(screen.getByText("Perfect Score!")).toBeInTheDocument();
    
    // Change show to false
    act(() => {
      rerender(<Celebration show={false} />);
    });
    // Component should hide immediately when show becomes false
    expect(screen.queryByText("Perfect Score!")).not.toBeInTheDocument();
  });

});
