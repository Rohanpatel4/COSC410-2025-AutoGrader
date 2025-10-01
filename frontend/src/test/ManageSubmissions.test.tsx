import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import ManageSubmissions from "../pages/ManageSubmissions";
import { renderPage } from "./test-utils";

test("lists submissions and can create a new one", async () => {
  renderPage(<ManageSubmissions />, { auth: { role: "student" } });

  // initial list from mock
  expect(await screen.findByText(/Submission One/i)).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText(/name/i), "My New Submission");

  // select one file to enable the Create button
  // You can match by label text (the filename shown next to the checkbox)
  await userEvent.click(screen.getByLabelText(/solution1\.py/i));

  await userEvent.click(screen.getByRole("button", { name: /create/i }));

  expect(await screen.findByText(/My New Submission/i)).toBeInTheDocument();
});
