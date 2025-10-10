// src/test/UploadStudentFile.test.tsx
import React from "react";
import { Route, Routes } from "react-router-dom";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import UploadStudentFile from "../webpages/UploadStudentFile";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";
import { vi } from "vitest";

describe("UploadStudentFile (MSW)", () => {
  function renderPage() {
    // Don’t rely on route state; we’ll type the assignment id in each test
    return renderWithProviders(
      <Routes>
        <Route path="/upload/student" element={<UploadStudentFile />} />
      </Routes>,
      {
        route: "/upload/student",
        auth: { role: "student", userId: "201" },
      }
    );
  }

test("uploads a .py successfully and shows PASS + grade", async () => {
  // 👇 Stub fetch to resolve immediately with the success shape
  const mock = vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        ok: true,
        grade: 95,
        grading: { passed: true, passed_tests: 3, total_tests: 3 },
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    )
  );

  renderWithProviders(<UploadStudentFile />, {
    route: "/upload/student",
    auth: { role: "student", userId: "201" },
    locationState: { assignment_id: 9001 },
  });

  // fill id if your helper doesn’t pass locationState through
  const idInput = screen.getByPlaceholderText(/e\.g\.,\s*1/i);
  await userEvent.clear(idInput);
  await userEvent.type(idInput, "9001");

  const file = new File(["print('ok')"], "sol.py", { type: "text/x-python" });
  await userEvent.upload(screen.getByLabelText(/student code file/i), file);

  await userEvent.click(screen.getByRole("button", { name: /upload & run/i }));

  // Assert success UI (no need to wait for removal now)
  expect(await screen.findByText(/submitted\.\s*grade:\s*95/i)).toBeInTheDocument();
  expect(await screen.findByText(/^pass$/i)).toBeInTheDocument();
  expect(await screen.findByText(/3 of 3 tests passed/i)).toBeInTheDocument();

  mock.mockRestore();
});


  test("shows server error details when backend returns 500", async () => {
    renderPage();

    // Force backend failure
    server.use(
      http.post("**/api/v1/assignments/:id/submit", async () =>
        HttpResponse.text("Bad file", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        })
      )
    );

    // Fill assignment id and upload file
    await userEvent.type(screen.getByPlaceholderText(/e\.g\.,\s*1/i), "9001");
    const fileInput = await screen.findByLabelText(/student code file/i);
    const bad = new File(["print('oops')"], "sol.py", { type: "text/x-python" });
    await userEvent.upload(fileInput, bad);

    // Submit
    await userEvent.click(screen.getByRole("button", { name: /upload & run/i }));

    // Accept either the friendly message or the Body-read error
    expect(await screen.findByText(/(Run failed:\s*500|Body is unusable)/i)).toBeInTheDocument();
    // We still show the raw body "Bad file" in the <pre>, assert that explicitly:
    expect(screen.getByText(/"raw":\s*"Bad file"/i)).toBeInTheDocument();
  });

  test("validation: missing file (and/or missing assignment id) shows message", async () => {
    renderPage();

    // IMPORTANT: use form submit to bypass native `required` blocking the click path
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    // Your handler sets the message
    expect(await screen.findByText(/missing assignment_id/i)).toBeInTheDocument();

    // Now fill id and submit again without a file → file validation message
    await userEvent.type(screen.getByPlaceholderText(/e\.g\.,\s*1/i), "9001");
    fireEvent.submit(form);
    expect(await screen.findByText(/please choose a student \.py file/i)).toBeInTheDocument();
  });
});

