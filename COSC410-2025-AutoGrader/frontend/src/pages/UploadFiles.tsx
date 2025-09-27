import React, { useState } from "react"

const UploadFiles: React.FC = () => {
  const [category, setCategory] = useState("TEST_CASE")
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return setMsg("Please choose a file")
    const fd = new FormData()
    fd.append("category", category)
    fd.append("f", file)
    const r = await fetch((import.meta as any).env.VITE_API_URL + "/api/v1/files", { method: "POST", body: fd })
    if (!r.ok) { setMsg("Upload failed"); return }
    setMsg("Uploaded!")
  }

  return (
    <form onSubmit={onSubmit}>
      <div>
        <label>Category</label>
        <select value={category} onChange={e=>setCategory(e.target.value)}>
          <option>TEST_CASE</option>
          <option>SUBMISSION</option>
        </select>
      </div>
      <div>
        <label>File</label>
        <input type="file" onChange={e=>setFile(e.target.files?.[0] || null)} />
      </div>
      <button type="submit">Upload</button>
      {msg && <p>{msg}</p>}
    </form>
  )
}
export default UploadFiles
