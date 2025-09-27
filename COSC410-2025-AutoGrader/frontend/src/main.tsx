import React from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route, Link } from "react-router-dom"
import UploadFiles from "./pages/UploadFiles"
import ManageTestSuites from "./pages/ManageTestSuites"
import ManageSubmissions from "./pages/ManageSubmissions"
import RunExecution from "./pages/RunExecution"
import Runtimes from "./pages/Runtimes"
import "./styles/index.css"

function App() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Offline Sandbox</h1>
      <nav className="flex gap-4 mb-6 underline">
        <Link to="/">Upload</Link>
        <Link to="/test-suites">Test Suites</Link>
        <Link to="/submissions">Submissions</Link>
        <Link to="/runs">Runs</Link>
        <Link to="/runtimes">Runtimes</Link>
      </nav>
      <Routes>
        <Route path="/" element={<UploadFiles/>} />
        <Route path="/test-suites" element={<ManageTestSuites/>} />
        <Route path="/submissions" element={<ManageSubmissions/>} />
        <Route path="/runs" element={<RunExecution/>} />
        <Route path="/runtimes" element={<Runtimes/>} />
      </Routes>
    </div>
  )
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter><App/></BrowserRouter>
)
