import React from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes, useParams } from "react-router-dom";

import AssignmentsPage from "../webpages/AssignmentsPage";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./server";       // MSW server
import { resetDb } from "./handlers";    // reset seed
import { __testDb } from "./handlers";

// Tiny stub so we can assert navigation
function AssignmentStub() {
  const { id = "" } = useParams();
  return <div>ASSIGNMENT PAGE {id}</div>;
}

describe("AssignmentsPage (MSW)", () => {
  beforeEach(() => {
    resetDb();
  });

  test("loads assignments and navigates on click", async () => {
    // Enroll student 201 in course 1 so they can see the assignment
    __testDb.state.enrollmentsByStudent[201] = [
      {
        id: 1,
        course_code: "COSC-410",
        name: "FirstCourse",
        description: "seed",
        professor_id: 301,
      },
    ];

    renderWithProviders(
      <Routes>
        <Route path="/" element={<AssignmentsPage />} />
        <Route path="/assignments/:id" element={<AssignmentStub />} />
      </Routes>,
      { route: "/", auth: { role: "student", userId: "201" } }
    );

    // seeded item shows up
    expect(await screen.findByText("Seeded Assignment")).toBeInTheDocument();

    // click navigates
    const assignmentLink = screen.getByText("Seeded Assignment").closest('a');
    await userEvent.click(assignmentLink);
    
    // use the seeded id so we don't hardcode it
    const seeded = __testDb.getAssignments("1")[0]; // first seeded assignment for course "1"
    const expectedId = seeded.id;

    // assert using the real id
    expect(
        await screen.findByText(new RegExp(`ASSIGNMENT PAGE\\s*${expectedId}`, "i"))
    ).toBeInTheDocument();
    });

  test("shows empty state when none", async () => {
    // Override global list to return empty
    server.use(
      http.get("**/api/v1/assignments", () => HttpResponse.json([], { status: 200 }))
    );

    renderWithProviders(<AssignmentsPage />, {
      route: "/",
      auth: { role: "student", userId: "201" },
    });

    expect(await screen.findByText("No assignments yet")).toBeInTheDocument();
  });

  test("when GET fails, it falls back to empty state", async () => {
    // Force a failure; component catches and shows empty state
    server.use(
      http.get("**/api/v1/assignments", () =>
        HttpResponse.text("boom", { status: 500 })
      )
    );

    renderWithProviders(<AssignmentsPage />, {
      route: "/",
      auth: { role: "student", userId: "201" },
    });

    expect(await screen.findByText("No assignments yet")).toBeInTheDocument();
  });

  test("date inputs reflect and update correctly", async () => {
    // Return one item with concrete start/stop so we can assert input values
    const isoStart = "2025-03-10T14:30:00.000Z"; // UTC; component converts to local input
    const isoStop  = "2025-03-11T16:45:00.000Z";

    server.use(
      http.get("**/api/v1/assignments", () =>
        HttpResponse.json(
          [
            {
              id: 202,
              course_id: 1,
              title: "With Dates",
              num_attempts: 2,
              sub_limit: null,
              start: isoStart,
              stop: isoStop,
            },
          ],
          { status: 200 }
        )
      )
    );

    renderWithProviders(<AssignmentsPage />, {
      route: "/",
      auth: { role: "faculty", userId: "301" },
    });

    const li = await screen.findByRole("listitem");
    // Inputs are labelled "Start" and "Stop"; get the ones in this row
    const startInput = within(li).getByLabelText(/start/i) as HTMLInputElement;
    const stopInput  = within(li).getByLabelText(/stop/i) as HTMLInputElement;

    // They should be prepopulated with a local datetime string. We can’t easily
    // assert the exact timezone conversion, but we can confirm they have some value.
    expect(startInput.value).not.toBe("");
    expect(stopInput.value).not.toBe("");

    // Update values and ensure the controlled value reflects the change
    const newStart = "2025-04-05T12:00";
    const newStop  = "2025-04-06T18:15";

    await userEvent.clear(startInput);
    await userEvent.type(startInput, newStart);
    expect(startInput.value).toBe(newStart);

    await userEvent.clear(stopInput);
    await userEvent.type(stopInput, newStop);
    expect(stopInput.value).toBe(newStop);
  });
});
