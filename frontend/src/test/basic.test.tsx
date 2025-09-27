import { render, screen } from "@testing-library/react"
import React from "react"
import UploadFiles from "../pages/UploadFiles"

test("renders upload form labels", () => {
  render(<UploadFiles />)
  expect(screen.getByText(/Category/i)).toBeInTheDocument()
  expect(screen.getByText(/File/i)).toBeInTheDocument()
})
