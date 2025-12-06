import React from "react";
import { screen } from "@testing-library/react";

import { Badge } from "../components/ui/Badge";
import { renderWithProviders } from "./renderWithProviders";

describe("Badge", () => {
  test("renders with default variant", () => {
    renderWithProviders(<Badge>Default Badge</Badge>);

    const badge = screen.getByText("Default Badge");
    expect(badge).toHaveClass("inline-flex", "items-center", "gap-2", "rounded-full", "px-3", "py-1", "text-sm", "font-medium");
    expect(badge).toHaveClass("bg-primary/10", "text-primary");
  });

  test("renders with success variant", () => {
    renderWithProviders(<Badge variant="success">Success</Badge>);

    const badge = screen.getByText("Success");
    expect(badge).toHaveClass("bg-accent/10", "text-accent");
  });

  test("renders with warning variant", () => {
    renderWithProviders(<Badge variant="warning">Warning</Badge>);

    const badge = screen.getByText("Warning");
    expect(badge).toHaveClass("bg-warning/10", "text-warning");
  });

  test("renders with danger variant", () => {
    renderWithProviders(<Badge variant="danger">Danger</Badge>);

    const badge = screen.getByText("Danger");
    expect(badge).toHaveClass("bg-danger/10", "text-danger");
  });

  test("renders with info variant", () => {
    renderWithProviders(<Badge variant="info">Info</Badge>);

    const badge = screen.getByText("Info");
    expect(badge).toHaveClass("bg-primary/10", "text-primary");
  });

  test("applies custom className", () => {
    renderWithProviders(<Badge className="custom-class">Custom</Badge>);

    const badge = screen.getByText("Custom");
    expect(badge).toHaveClass("custom-class");
  });

  test("renders with icons", () => {
    renderWithProviders(
      <Badge>
        <span>Icon</span>
        Badge Text
      </Badge>
    );

    expect(screen.getByText("Icon")).toBeInTheDocument();
    expect(screen.getByText("Badge Text")).toBeInTheDocument();
  });
});
