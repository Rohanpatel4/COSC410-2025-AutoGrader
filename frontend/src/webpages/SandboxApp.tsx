import React from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";

import UploadFiles from "./UploadTestFile.tsx";
import ManageTestSuites from "../pages (delete later)/ManageTestSuites";
import ManageSubmissions from "../pages (delete later)/ManageSubmissions";
import RunExecution from "../pages (delete later)/RunExecution";
import Runtimes from "../pages (delete later)/Runtimes";
import "../styles/SandboxApp.css";


export default function SandboxApp() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Offline Sandbox</h1>

      <nav className="flex gap-4 mb-6 underline">
        <Link to="">Upload</Link>
        <Link to="test-suites">Test Suites</Link>
        <Link to="submissions">Submissions</Link>
        <Link to="runs">Runs</Link>
        <Link to="runtimes">Runtimes</Link>
      </nav>

      <Routes>
        <Route index element={<UploadFiles />} />
        <Route path="test-suites" element={<ManageTestSuites />} />
        <Route path="submissions" element={<ManageSubmissions />} />
        <Route path="runs" element={<RunExecution />} />
        <Route path="runtimes" element={<Runtimes />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </div>
  );
}
