import React, { useEffect, useState } from "react";
import { fetchJson } from "../api/client";

export default function RunExecution(){
  const [subs, setSubs] = useState<any[]>([]);
  const [suites, setSuites] = useState<any[]>([]);
  const [rts, setRts] = useState<any[]>([]);
  const [sel, setSel] = useState({ sub:"", ts:"", rt:"" });
  const [run, setRun] = useState<any|null>(null);

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
  }

  async function execute(){
    if (!run) return;
    const r = await fetchJson(`/api/v1/runs/${run.id}/execute`, { method:"POST" });
    setRun(r);
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Run Execution</h2>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="sel-sub">Submission</label>
          <select id="sel-sub" onChange={e=>setSel(s=>({...s, sub:e.target.value}))}>
            <option value="">Submission</option>
            {subs.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sel-ts">Test Suite</label>
          <select id="sel-ts" onChange={e=>setSel(s=>({...s, ts:e.target.value}))}>
            <option value="">Test Suite</option>
            {suites.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sel-rt">Runtime</label>
          <select id="sel-rt" onChange={e=>setSel(s=>({...s, rt:e.target.value}))}>
            <option value="">Runtime</option>
            {rts.map((x:any)=><option key={x.id} value={x.id}>{x.language} {x.version}</option>)}
          </select>
        </div>
      </div>

      <button className="mt-3" disabled={!sel.sub || !sel.ts || !sel.rt} onClick={createRun}>
        Create Run
      </button>

      {run && <div className="mt-4 border p-3 rounded">
        <div>ID: {run.id}</div>
        <div>Status: {run.status}</div>
        <div>Exit: {String(run.exit_code)}</div>
        <button onClick={execute}>Execute</button>
      </div>}
    </div>
  );
}

