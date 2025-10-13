import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { http, HttpResponse } from "msw";

import UploadTestFile from "../webpages/UploadTestFile";
import { server } from "./server";

function StudentUploadPage() {
  const loc = useLocation() as any;
  return (
    <div>
      <h3>Student Upload Page</h3>
      <div data-testid="assignment-id">{String(loc?.state?.assignment_id ?? "")}</div>
    </div>
  );
}

function renderWithRouter(entryState?: any) {
  const initialEntry =
    entryState !== undefined
      ? { pathname: "/", state: entryState }
      : { pathname: "/", state: { assignment_id: "42" } };

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<UploadTestFile />} />
        <Route path="/upload/student" element={<StudentUploadPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("UploadTestFile", () => {
  it("renders labels/inputs", () => {
    renderWithRouter();
    expect(screen.getByRole("heading", { name: /upload test file/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/assignment id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/test file/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload test file/i })).toBeInTheDocument();
  });

  it("blocks non-.py files with a helpful message", async () => {
    renderWithRouter({ assignment_id: "123" });

    // Confirm assignment id is prefilled from location.state
    expect((screen.getByLabelText(/assignment id/i) as HTMLInputElement).value).toBe("123");

    // Upload a non-.py file
    const bad = new File(["stuff"], "notes.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText(/test file/i), bad);

    // Submit
    await userEvent.click(screen.getByRole("button", { name: /upload test file/i }));

    // Validation message
    await screen.findByText(/only \.py files are accepted/i);
  });

  it("shows validation for missing assignment_id", async () => {
    renderWithRouter({ assignment_id: "" });

    // Ensure empty assignment id
    const idInput = screen.getByLabelText(/assignment id/i) as HTMLInputElement;
    await userEvent.clear(idInput);

    // Valid .py file
    const py = new File(["print('ok')"], "suite.py", { type: "text/x-python" });
    await userEvent.upload(screen.getByLabelText(/test file/i), py);

    await userEvent.click(screen.getByRole("button", { name: /upload test file/i }));

    await screen.findByText(/missing assignment_id/i);
  });

  it("uploads a .py file and navigates to student page with state", async () => {
    server.use(
      http.post("*/api/v1/assignments/:assignment_id/test-file", async () => {
        return new HttpResponse("OK", { status: 200 });
      })
    );

    renderWithRouter({ assignment_id: "7" });

    const file = new File(["# tests"], "tests.py", { type: "text/x-python" });
    await userEvent.upload(screen.getByLabelText(/test file/i), file);

    await userEvent.click(screen.getByRole("button", { name: /upload test file/i }));

    await screen.findByText(/test uploaded\. redirecting/i);
    await screen.findByText(/student upload page/i);
    expect(screen.getByTestId("assignment-id")).toHaveTextContent("7");
  });

  it("surfaces server error text when upload fails", async () => {
    server.use(
      http.post("*/api/v1/assignments/:assignment_id/test-file", async () => {
        return new HttpResponse("Nope", { status: 400 });
      })
    );

    renderWithRouter({ assignment_id: "9" });

    const py = new File(["# ok"], "ok.py", { type: "text/x-python" });
    await userEvent.upload(screen.getByLabelText(/test file/i), py);

    await userEvent.click(screen.getByRole("button", { name: /upload test file/i }));

    await screen.findByText(/upload failed: 400/i);
  });
});

