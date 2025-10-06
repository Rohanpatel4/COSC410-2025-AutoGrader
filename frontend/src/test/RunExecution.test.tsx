import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import RunExecution from "../pages (delete later)/RunExecution";
import { renderPage } from "./test-utils";

test("runs an execution and shows completion", async () => {
  renderPage(<RunExecution />, { auth: { role: "student" } });

  const subSel = await screen.findByLabelText(/submission/i);
  const tsSel  = await screen.findByLabelText(/test suite/i);
  const rtSel  = await screen.findByLabelText(/runtime/i);

  // these values come from the MSW mock options
  await userEvent.selectOptions(subSel, "s1");
  await userEvent.selectOptions(tsSel,  "ts1");
  await userEvent.selectOptions(rtSel,  "rt_py_3_11");

  await userEvent.click(screen.getByRole("button", { name: /create run/i }));

  // after run is created, your component renders an "Execute" button
  await userEvent.click(await screen.findByRole("button", { name: /execute/i }));

  expect(await screen.findByText(/COMPLETED/i)).toBeInTheDocument();
  // only assert logs if your MSW execute handler returns them and your UI renders them
  // expect(screen.getByText(/All green/i)).toBeInTheDocument();
});
