import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Input } from "../components/ui/Input";

describe("Input", () => {
  test("renders with default props", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(input.className).toContain("w-full");
    expect(input.className).toContain("rounded-xl");
  });

  test("applies default styling", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("border");
    expect(input.className).toContain("bg-background");
    expect(input.className).toContain("px-4");
  });

  test("applies error styling when error prop is true", () => {
    render(<Input error />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("border-danger");
    expect(input.className).toContain("focus:ring-danger/25");
  });

  test("does not apply error styling when error prop is false", () => {
    render(<Input error={false} />);
    const input = screen.getByRole("textbox");
    expect(input.className).not.toContain("border-danger");
    expect(input.className).not.toContain("focus:ring-danger/25");
  });

  test("applies focus styling", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("focus:border-primary");
    expect(input.className).toContain("focus:ring-4");
    expect(input.className).toContain("focus:ring-ring/25");
  });

  test("forwards ref", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  test("passes through input props", () => {
    render(<Input type="email" placeholder="Enter email" data-testid="email-input" />);
    const input = screen.getByTestId("email-input");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("placeholder", "Enter email");
  });

  test("handles user input", async () => {
    const user = userEvent.setup();
    render(<Input />);
    const input = screen.getByRole("textbox");

    await user.type(input, "test input");
    expect(input).toHaveValue("test input");
  });

  test("merges className prop", () => {
    render(<Input className="custom-class" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("w-full");
    expect(input.className).toContain("custom-class");
  });

  test("handles onChange events", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<Input onChange={handleChange} />);
    const input = screen.getByRole("textbox");

    await user.type(input, "a");
    expect(handleChange).toHaveBeenCalled();
  });

  test("renders with different input types", () => {
    const { rerender } = render(<Input type="text" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("type", "text");

    rerender(<Input type="password" />);
    expect(screen.getByDisplayValue("")).toHaveAttribute("type", "password");

    rerender(<Input type="email" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");
  });
});