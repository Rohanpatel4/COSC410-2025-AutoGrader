import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Select } from "../components/ui/Select";

describe("Select", () => {
  test("renders with default props", () => {
    render(<Select />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(select.className).toContain("w-full");
    expect(select.className).toContain("rounded-xl");
  });

  test("applies default styling", () => {
    render(<Select />);
    const select = screen.getByRole("combobox");
    expect(select.className).toContain("border");
    expect(select.className).toContain("bg-background");
    expect(select.className).toContain("px-4");
  });

  test("applies error styling when error prop is true", () => {
    render(<Select error />);
    const select = screen.getByRole("combobox");
    expect(select.className).toContain("border-danger");
    expect(select.className).toContain("focus:ring-danger/25");
  });

  test("does not apply error styling when error prop is false", () => {
    render(<Select error={false} />);
    const select = screen.getByRole("combobox");
    expect(select.className).not.toContain("border-danger");
    expect(select.className).not.toContain("focus:ring-danger/25");
  });

  test("applies focus styling", () => {
    render(<Select />);
    const select = screen.getByRole("combobox");
    expect(select.className).toContain("focus:border-primary");
    expect(select.className).toContain("focus:ring-4");
    expect(select.className).toContain("focus:ring-ring/25");
  });

  test("forwards ref", () => {
    const ref = React.createRef<HTMLSelectElement>();
    render(<Select ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  test("passes through select props", () => {
    render(<Select data-testid="test-select" disabled />);
    const select = screen.getByTestId("test-select");
    expect(select).toBeDisabled();
  });

  test("renders with options", () => {
    render(
      <Select>
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
      </Select>
    );
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
  });

  test("handles value changes", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Select onChange={handleChange}>
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
      </Select>
    );

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "2");

    expect(handleChange).toHaveBeenCalled();
    expect(select).toHaveValue("2");
  });

  test("merges className prop", () => {
    render(<Select className="custom-class" />);
    const select = screen.getByRole("combobox");
    expect(select.className).toContain("w-full");
    expect(select.className).toContain("custom-class");
  });

  test("supports controlled value", () => {
    render(
      <Select value="2">
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
      </Select>
    );
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("2");
  });

  test("handles multiple prop", () => {
    render(<Select multiple />);
    const select = screen.getByRole("listbox");
    expect(select).toHaveAttribute("multiple");
  });
});