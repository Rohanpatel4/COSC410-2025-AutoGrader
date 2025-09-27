import React, { useEffect, useState } from "react"
import { fetchJson } from "../api/client"

export default function ManageTestSuites(){
  const [files, setFiles] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [name, setName] = useState("")
  const [list, setList] = useState<any[]>([])

  useEffect(()=>{ fetchJson("/api/v1/files?category=TEST_CASE").then(setFiles).catch(()=>{}) ; fetchJson("/api/v1/test-suites").then(setList).catch(()=>{}) }, [])

  async function create(){
    const res = await fetchJson("/api/v1/test-suites", { method: "POST", body: JSON.stringify({ name, file_ids: selected }) })
    setList([...list, res])
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Create Test Suite</h2>
      <input placeholder="name" value={name} onChange={e=>setName(e.target.value)} />
      <div className="my-2">
        {files.map(f => (
          <label key={f.id} className="block">
            <input type="checkbox" onChange={e=> setSelected(prev => e.target.checked ? [...prev, f.id] : prev.filter(x=>x!==f.id))} /> {f.name}
          </label>
        ))}
      </div>
      <button onClick={create} disabled={!name || selected.length<1}>Create</button>

      <h3 className="text-lg font-semibold mt-6">Existing</h3>
      <ul>{list.map(ts => <li key={ts.id}>{ts.name} ({ts.file_ids.length} files)</li>)}</ul>
    </div>
  )
}
