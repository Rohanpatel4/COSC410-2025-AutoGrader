import React from "react";
import { screen } from "@testing-library/react";

import { Alert } from "../components/ui/Alert";
import { renderWithProviders } from "./renderWithProviders";

describe("Alert", () => {
  test("renders with default variant", () => {
    renderWithProviders(<Alert>Default alert message</Alert>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Default alert message");
    expect(alert).toHaveClass("alert", "alert-info");
  });

  test("renders with success variant", () => {
    renderWithProviders(<Alert variant="success">Success message</Alert>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Success message");
    expect(alert).toHaveClass("alert", "alert-success");
  });

  test("renders with error variant", () => {
    renderWithProviders(<Alert variant="error">Error message</Alert>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Error message");
    expect(alert).toHaveClass("alert", "alert-error");
  });

  test("renders with warning variant", () => {
    renderWithProviders(<Alert variant="warning">Warning message</Alert>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Warning message");
    expect(alert).toHaveClass("alert", "alert-warning");
  });

  test("applies custom className", () => {
    renderWithProviders(<Alert className="custom-class">Custom alert</Alert>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("alert", "alert-info", "custom-class");
  });

  test("passes through other props", () => {
    renderWithProviders(<Alert data-testid="test-alert">Test alert</Alert>);

    expect(screen.getByTestId("test-alert")).toBeInTheDocument();
  });
});
