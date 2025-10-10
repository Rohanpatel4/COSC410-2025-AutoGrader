// src/test/AssignmentDetailPage.test.tsx
import React from "react";
import { Route, Routes } from "react-router-dom";
import { screen, fireEvent, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import AssignmentDetailPage from "../webpages/AssignmentDetailPage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";
import { __testDb, resetDb } from "./handlers";

function PageStub() {
  const seeded = __testDb.getAssignment(9001);
  return <div>DETAIL STUB {seeded?.id}</div>;
}

describe("AssignmentDetailPage (MSW)", () => {
  beforeEach(() => resetDb());

  function renderAsStudent(id = 9001) {
    return renderWithProviders(
      <Routes>
        <Route path="/assignments/:assignment_id" element={<AssignmentDetailPage />} />
      </Routes>,
      { route: `/assignments/${id}`, auth: { role: "student", userId: "201" } }
    );
  }

  function renderAsFaculty(id = 9001) {
    return renderWithProviders(
      <Routes>
        <Route path="/assignments/:assignment_id" element={<AssignmentDetailPage />} />
      </Routes>,
      { route: `/assignments/${id}`, auth: { role: "faculty", userId: "301" } }
    );
  }

  test.skip("loads details (student) and submits .py successfully, attempts & best grade update", async () => {
    renderAsStudent();

  // details ready
    await screen.findByText(/Seeded Assignment/i);
    await screen.findByRole("button", { name: /submit/i });

  // choose file
    const fileInput = screen.getByLabelText(/submit your code/i, { selector: 'input[type="file"]' });
    const file = new File(["print('hi')"], "sol.py", { type: "text/x-python" });
    await userEvent.upload(fileInput, file);

  // submit
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

  // ✅ assert success parts separately (don’t require them to be in one node)
    await screen.findByText(/submitted/i);
    await screen.findByText(/grade:\s*95/i);

  // PASS badge area shows
    expect(await screen.findByText(/pass/i)).toBeInTheDocument();

  // Attempts list + best grade (if you assert these)
    expect(screen.getByText(/your attempts/i)).toBeInTheDocument();
    expect(screen.getByText(/best grade/i)).toBeInTheDocument();
});

  test("blocks when submission window is closed", async () => {
    // Force window closed (future start)
    server.use(
      http.get("**/api/v1/assignments/:id", ({ params }) => {
        const id = Number(params.id);
        const base = __testDb.getAssignment(id);
        const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        return HttpResponse.json({ ...base, start: future }, { status: 200 });
      })
    );

    renderAsStudent();

    // message and disabled controls
    expect(await screen.findByText(/submission window is closed/i)).toBeInTheDocument();
    const submitBtn = screen.getByRole("button", { name: /submit/i });
    expect(submitBtn).toBeDisabled();
  });

  test("blocks when submission limit reached", async () => {
    // sub_limit = 1 and one prior attempt
    server.use(
      http.get("**/api/v1/assignments/:id", ({ params }) => {
        const id = Number(params.id);
        const base = __testDb.getAssignment(id);
        return HttpResponse.json({ ...base, sub_limit: 1 }, { status: 200 });
      }),
      http.get("**/api/v1/assignments/:id/attempts", ({ request, params }) => {
        const id = Number(params.id);
        return HttpResponse.json([{ id: 1, grade: 80 }], { status: 200 });
      })
    );

    renderAsStudent();

    expect(await screen.findByText(/you’ve reached the submission limit/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
  });

  test("shows error if detail GET fails", async () => {
    server.use(
      http.get("**/api/v1/assignments/:id", () =>
        HttpResponse.text("whoops", { status: 500 })
      )
    );

    renderAsStudent();

    expect(await screen.findByText(/failed to load assignment|whoops/i)).toBeInTheDocument();
  });

  test("submit validation + network error shown", async () => {
    renderAsStudent();

    // Page ready
    await screen.findByText(/seeded assignment/i);
    await screen.findByRole("button", { name: /submit/i });

    // ⚠️ Button is disabled with no file; submit the form directly to trigger validation
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);
    expect(await screen.findByText(/choose a \.py file/i)).toBeInTheDocument();

    // Now upload a file to hit the network error
    server.use(
      http.post("**/api/v1/assignments/:id/submit", async () =>
        HttpResponse.text("Bad file", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        })
      )
    );

    const fileInput = screen.getByLabelText(/submit your code/i, { selector: 'input[type="file"]' });
    const bad = new File(["print('oops')"], "sol.py", { type: "text/x-python" });
    await userEvent.upload(fileInput, bad);

    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText(/submit failed:\s*500/i)).toBeInTheDocument();
    expect(screen.getByText(/bad file/i)).toBeInTheDocument();
  });

  test("faculty view: no submit form, sees faculty note", async () => {
    renderAsFaculty();

    expect(await screen.findByRole("heading", { name: /seeded assignment/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
    expect(screen.getByText(/\(faculty view here could show a gradebook later\.\)/i)).toBeInTheDocument();
  });
});
