import React, { useEffect, useState } from "react"
import { fetchJson } from "../api/client"

export default function Runtimes(){
  const [list, setList] = useState<any[]>([])
  const [form, setForm] = useState<any>({ language:"python", version:"3.11", host_path:"/usr/bin/python3", run_cmd:"{entry}", enabled:true })

  useEffect(()=>{ fetchJson("/api/v1/runtimes").then(setList).catch(()=>{}) }, [])

  async function create(){
    const res = await fetchJson("/api/v1/runtimes", { method:"POST", body: JSON.stringify(form) })
    setList([...list, res])
  }

  return <div>
    <h2 className="text-xl font-semibold mb-2">Runtimes</h2>
    <div className="grid grid-cols-5 gap-2">
      {["language","version","host_path","run_cmd"].map(k=> <input key={k} placeholder={k} value={form[k]} onChange={e=>setForm({...form, [k]: e.target.value})} />)}
      <button onClick={create}>Add</button>
    </div>
    <ul className="mt-4">{list.map(x => <li key={x.id}>{x.language} {x.version} @ {x.host_path}</li>)}</ul>
  </div>
}
