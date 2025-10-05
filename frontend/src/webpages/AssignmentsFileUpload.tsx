// Inside your assignment detail component, after fetching assignment & checking role:
const [file, setFile] = React.useState<File | null>(null);
const [uploading, setUploading] = React.useState(false);
const [message, setMessage] = React.useState<string | null>(null);

// Placeholder: replace with your auth/role logic
const isTeacher = true;

const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files?.[0]) setFile(e.target.files[0]);
};

const handleUpload = async () => {
  if (!file) return;
  setUploading(true);
  setMessage(null);
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch(`/api/v1/assignments/${assignment.id}/upload`, {
      method: "POST",
      body: formData,
      // If you use auth tokens, add headers here
    });
    if (!res.ok) throw new Error("Upload failed.");
    setMessage("Upload successful!");
  } catch (e: any) {
    setMessage("Upload failed.");
  } finally {
    setUploading(false);
  }
};

// In JSX:
{isTeacher && (
  <div style={{ marginTop: 24 }}>
    <h3>Upload Assignment File</h3>
    <input type="file" onChange={handleFileChange} />
    <button onClick={handleUpload} disabled={!file || uploading}>
      {uploading ? "Uploading..." : "Upload"}
    </button>
    {message && <div>{message}</div>}
    {file && <div>Selected: {file.name}</div>}
  </div>
)}