import React from "react";
import { render, screen } from "@testing-library/react";
import { Card } from "../components/ui/Card";

describe("Card", () => {
  test("renders with default props", () => {
    render(<Card>Card content</Card>);
    const card = screen.getByText("Card content");
    expect(card).toBeInTheDocument();
    expect(card.className).toContain("card");
  });

  test("applies default variant", () => {
    render(<Card>Default card</Card>);
    const card = screen.getByText("Default card");
    expect(card.className).toContain("card");
  });

  test("applies muted variant", () => {
    render(<Card variant="muted">Muted card</Card>);
    const card = screen.getByText("Muted card");
    expect(card.className).toContain("card-muted");
  });

  test("applies glass variant", () => {
    render(<Card variant="glass">Glass card</Card>);
    const card = screen.getByText("Glass card");
    expect(card.className).toContain("surface-glass");
  });

  test("forwards ref", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Card ref={ref}>Ref card</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  test("passes through additional props", () => {
    render(<Card data-testid="custom-card" id="test-id">Test card</Card>);
    const card = screen.getByTestId("custom-card");
    expect(card).toHaveAttribute("id", "test-id");
  });

  test("merges className prop", () => {
    render(<Card className="custom-class">Custom card</Card>);
    const card = screen.getByText("Custom card");
    expect(card.className).toContain("card");
    expect(card.className).toContain("custom-class");
  });

  test("renders children correctly", () => {
    render(
      <Card>
        <h1>Title</h1>
        <p>Description</p>
      </Card>
    );
    expect(screen.getByRole("heading", { name: /title/i })).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });
});