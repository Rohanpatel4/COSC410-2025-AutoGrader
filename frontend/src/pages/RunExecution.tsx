import React, { useEffect, useState } from "react";
import { fetchJson } from "../api/client";

export default function RunExecution(){
  const [subs, setSubs] = useState<any[]>([]);
  const [suites, setSuites] = useState<any[]>([]);
  const [rts, setRts] = useState<any[]>([]);
  const [sel, setSel] = useState({ sub:"", ts:"", rt:"" });
  const [run, setRun] = useState<any|null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    fetchJson("/api/v1/submissions").then(setSubs).catch(()=>{});
    fetchJson("/api/v1/test-suites").then(setSuites).catch(()=>{});
    fetchJson("/api/v1/runtimes").then(setRts).catch(()=>{});
  }, []);

  async function createRun(){
    const r = await fetchJson("/api/v1/runs", {
      method:"POST",
      body: JSON.stringify({ submission_id: sel.sub, testsuite_id: sel.ts, runtime_id: sel.rt })
    });
    setRun(r);
    setResults([]);
  }

  async function execute(){
    if (!run) return;
    setLoading(true);
    try {
      const r = await fetchJson(`/api/v1/runs/${run.id}/execute`, { method:"POST" });
      setRun(r);

      // If execution completed, fetch results
      if (r.status === 'SUCCEEDED' || r.status === 'FAILED') {
        await fetchResults(r);
      }
    } catch (error) {
      console.error("Execution failed:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchResults(runData: any) {
    if (runData.stdout_path) {
      try {
        const response = await fetch(`/api/v1/files/results/${runData.id}`);
        if (response.ok) {
          const resultData = await response.json();
          setResults(resultData);
        }
      } catch (error) {
        console.error("Failed to fetch results:", error);
      }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCEEDED': return 'text-green-600';
      case 'FAILED': return 'text-red-600';
      case 'RUNNING': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getTestStatusColor = (passed: boolean) => {
    return passed ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Code Execution Sandbox</h2>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Configure Execution</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="sel-sub" className="block text-sm font-medium text-gray-700 mb-2">
              Submission
            </label>
            <select
              id="sel-sub"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={e=>setSel(s=>({...s, sub:e.target.value}))}
              value={sel.sub}
            >
              <option value="">Select Submission</option>
              {subs.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="sel-ts" className="block text-sm font-medium text-gray-700 mb-2">
              Test Suite
            </label>
            <select
              id="sel-ts"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={e=>setSel(s=>({...s, ts:e.target.value}))}
              value={sel.ts}
            >
              <option value="">Select Test Suite</option>
              {suites.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="sel-rt" className="block text-sm font-medium text-gray-700 mb-2">
              Runtime
            </label>
            <select
              id="sel-rt"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={e=>setSel(s=>({...s, rt:e.target.value}))}
              value={sel.rt}
            >
              <option value="">Select Runtime</option>
              {rts.map((x:any)=><option key={x.id} value={x.id}>{x.language} {x.version}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            disabled={!sel.sub || !sel.ts || !sel.rt}
            onClick={createRun}
          >
            Create Run
          </button>
        </div>
      </div>

      {run && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Execution Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <span className="text-sm font-medium text-gray-700">Run ID:</span>
              <div className="font-mono text-sm">{run.id.slice(0, 8)}...</div>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Status:</span>
              <div className={`font-semibold ${getStatusColor(run.status)}`}>{run.status}</div>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Exit Code:</span>
              <div>{run.exit_code ?? 'N/A'}</div>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Duration:</span>
              <div>
                {run.started_at && run.finished_at ?
                  `${Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s` :
                  'N/A'
                }
              </div>
            </div>
          </div>

          <button
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400"
            onClick={execute}
            disabled={run.status === 'RUNNING' || loading}
          >
            {loading ? 'Executing...' : 'Execute'}
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Test Results</h3>
          <div className="space-y-4">
            {results.map((result: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-lg">{result.test_name}</h4>
                  <span className={`font-bold ${getTestStatusColor(result.passed)}`}>
                    {result.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Status:</span>
                    <div className="font-mono bg-gray-50 p-2 rounded mt-1">{result.status}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Performance:</span>
                    <div className="font-mono bg-gray-50 p-2 rounded mt-1">
                      Time: {result.time || 'N/A'} | Memory: {result.memory || 'N/A'}
                    </div>
                  </div>
                </div>

                {result.stdout && (
                  <div className="mt-3">
                    <span className="font-medium text-gray-700">Standard Output:</span>
                    <pre className="bg-gray-50 p-3 rounded mt-1 text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                      {result.stdout}
                    </pre>
                  </div>
                )}

                {result.stderr && (
                  <div className="mt-3">
                    <span className="font-medium text-gray-700">Standard Error:</span>
                    <pre className="bg-red-50 p-3 rounded mt-1 text-sm font-mono whitespace-pre-wrap overflow-x-auto text-red-800">
                      {result.stderr}
                    </pre>
                  </div>
                )}

                {result.compile_output && (
                  <div className="mt-3">
                    <span className="font-medium text-gray-700">Compilation Output:</span>
                    <pre className="bg-yellow-50 p-3 rounded mt-1 text-sm font-mono whitespace-pre-wrap overflow-x-auto text-yellow-800">
                      {result.compile_output}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="text-lg font-semibold">
              Summary: {results.filter(r => r.passed).length}/{results.length} tests passed
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

