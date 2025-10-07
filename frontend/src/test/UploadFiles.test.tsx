// src/test/UploadFiles.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, afterEach } from "vitest";
import UploadFiles from "../webpages/UploadTestFile.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("uploads a file via mock backend and shows success UI", async () => {
  const fetchSpy = vi
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: "f_1", name: "hello.py", category: "SUBMISSION" }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );

  const { container } = render(<UploadFiles />);

  // Category select (no accessible name now)
  const categorySelect = screen.getByRole("combobox");
  await userEvent.selectOptions(categorySelect, "SUBMISSION");

  // File input (no label association now)
  const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File(["print('hi')"], "hello.py", { type: "text/x-python" });
  await userEvent.upload(fileInput, file);

  // Submit
  await userEvent.click(screen.getByRole("button", { name: /upload/i }));

  // Assert fetch was called
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  const calledUrl = String(fetchSpy.mock.calls[0][0]);
  expect(calledUrl).toMatch(/\/api\/v1\/files$/);

  // Success message (component renders plain <p> without testid now)
  await waitFor(() => expect(screen.getByText(/uploaded!/i)).toBeInTheDocument());
});
