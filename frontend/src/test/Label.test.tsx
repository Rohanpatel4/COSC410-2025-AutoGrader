import React from "react";
import { render, screen } from "@testing-library/react";
import { Label } from "../components/ui/Label";

describe("Label", () => {
  test("renders with children", () => {
    render(<Label>Label text</Label>);
    expect(screen.getByText("Label text")).toBeInTheDocument();
  });

  test("forwards ref", () => {
    const ref = React.createRef<HTMLLabelElement>();
    render(<Label ref={ref}>Ref label</Label>);
    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
  });

  test("passes through label props", () => {
    render(<Label htmlFor="input-id" data-testid="test-label">Test label</Label>);
    const label = screen.getByTestId("test-label");
    expect(label).toHaveAttribute("for", "input-id");
  });

  test("merges className prop", () => {
    render(<Label className="custom-class">Custom label</Label>);
    const label = screen.getByText("Custom label");
    expect(label.className).toContain("custom-class");
  });

  test("renders with complex children", () => {
    render(
      <Label>
        <span>Icon</span>
        Label with icon
      </Label>
    );
    expect(screen.getByText("Icon")).toBeInTheDocument();
    expect(screen.getByText("Label with icon")).toBeInTheDocument();
  });

  test("associates with input via htmlFor", () => {
    render(
      <>
        <Label htmlFor="test-input">Test label</Label>
        <input id="test-input" data-testid="input" />
      </>
    );
    const label = screen.getByText("Test label");
    const input = screen.getByTestId("input");
    expect(label).toHaveAttribute("for", "test-input");
    expect(input).toHaveAttribute("id", "test-input");
  });
});