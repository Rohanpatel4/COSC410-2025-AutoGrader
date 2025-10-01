import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import LoginPage from "../webpages/LoginPage";
import { renderPage } from "./test-utils"; // wraps MemoryRouter + AuthProvider

test("logs in, persists auth, and finishes submitting state", async () => {
  // Render within router + auth provider context
  renderPage(<LoginPage />);

  // Fill the form
  await userEvent.selectOptions(screen.getByLabelText(/select role/i), "student");
  await userEvent.clear(screen.getByLabelText(/email/i));
  await userEvent.type(screen.getByLabelText(/email/i), "alice@example.com");
  await userEvent.clear(screen.getByLabelText(/password/i));
  await userEvent.type(screen.getByLabelText(/password/i), "secret");

  // Submit
  const button = screen.getByRole("button", { name: /enter/i });
  await userEvent.click(button);

  // Assert: auth persisted to localStorage (shape-agnostic)
  await waitFor(() => {
    const raw = localStorage.getItem("auth");
    expect(raw).toBeTruthy();
    const auth = JSON.parse(raw as string);
    // MSW returns { token, userId, role: "student" } and our page may normalize;
    // in either case, ensure the role landed as "student".
    expect(auth.role).toBe("student");
  });

  // Assert: the submit finished (button re-enabled and text back to "Enter")
  await waitFor(() => expect(button).toBeEnabled());
  expect(button).toHaveTextContent(/enter/i);

  // Assert: no error message rendered
  expect(screen.queryByText(/login failed/i)).not.toBeInTheDocument();
});
