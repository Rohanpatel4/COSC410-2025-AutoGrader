/**
 * Test Suites page component
 */
import { useState, useEffect } from 'react';
import { TestSuite, listTestSuites, createTestSuite, deleteTestSuite, listFiles } from '../api';
import { File } from '../api';

export function TestSuitesPage() {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTestSuiteName, setNewTestSuiteName] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [testSuitesResult, filesResult] = await Promise.all([
        listTestSuites(),
        listFiles('TEST_CASE'),
      ]);
      setTestSuites(testSuitesResult.items);
      setFiles(filesResult.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTestSuite = async () => {
    if (!newTestSuiteName.trim() || selectedFileIds.length === 0) return;

    try {
      setCreating(true);
      await createTestSuite({
        name: newTestSuiteName.trim(),
        file_ids: selectedFileIds,
      });
      setNewTestSuiteName('');
      setSelectedFileIds([]);
      setShowCreateForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create test suite');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTestSuite = async (testSuiteId: string) => {
    if (!confirm('Are you sure you want to delete this test suite?')) return;

    try {
      await deleteTestSuite(testSuiteId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete test suite');
    }
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading test suites...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Test Suites
          </h2>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create Test Suite
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Create Test Suite Form */}
      {showCreateForm && (
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Create New Test Suite
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={newTestSuiteName}
                  onChange={(e) => setNewTestSuiteName(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Enter test suite name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Test Case Files ({selectedFileIds.length} selected)
                </label>
                <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md">
                  {files.length === 0 ? (
                    <p className="p-4 text-gray-500 text-center">
                      No test case files available. Upload some files first.
                    </p>
                  ) : (
                    files.map((file) => (
                      <div
                        key={file.id}
                        className={`p-3 cursor-pointer hover:bg-gray-50 ${
                          selectedFileIds.includes(file.id) ? 'bg-indigo-50' : ''
                        }`}
                        onClick={() => toggleFileSelection(file.id)}
                      >
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedFileIds.includes(file.id)}
                            onChange={() => {}} // Handled by parent div
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {file.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {(file.size_bytes / 1024).toFixed(2)} KB
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewTestSuiteName('');
                    setSelectedFileIds([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateTestSuite}
                  disabled={creating || !newTestSuiteName.trim() || selectedFileIds.length === 0}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Suites List */}
      <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-md">
        <ul role="list" className="divide-y divide-gray-200">
          {testSuites.length === 0 ? (
            <li className="px-6 py-4 text-center text-gray-500">
              No test suites created yet.
            </li>
          ) : (
            testSuites.map((testSuite) => (
              <li key={testSuite.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {testSuite.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {testSuite.file_ids.length} test case file{testSuite.file_ids.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteTestSuite(testSuite.id)}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
