/**
 * Main App component
 */
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { FilesPage } from './pages/FilesPage';
import { TestSuitesPage } from './pages/TestSuitesPage';
import { SubmissionsPage } from './pages/SubmissionsPage';
import { RunsPage } from './pages/RunsPage';
import { RuntimesPage } from './pages/RuntimesPage';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/test-suites" element={<TestSuitesPage />} />
          <Route path="/submissions" element={<SubmissionsPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/runtimes" element={<RuntimesPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
