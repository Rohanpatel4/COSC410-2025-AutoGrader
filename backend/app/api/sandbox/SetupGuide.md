# COSC410-2025 AutoGrader — Setup Guide

Works on macOS, Windows, and Linux. Choose **Docker-only** for the quickest start, or **Hybrid** for local backend development with live reload.

---

## 📘 Quick Links
1. [Requirements](#1-requirements)
2. [Docker-only](#2-run-with-docker-one-command)
3. [Hybrid (local backend)](#3-hybrid-local-backend--docker-judge0)
4. [Test](#4-test-the-whole-pipeline)
5. [Troubleshooting](#5-troubleshooting)
6. [Security Notes](#6-security-notes)
7. [Useful Links](#7-useful-links)

---

## 1) Requirements

**Option A — Docker-only (recommended):**
- Docker Desktop (macOS/Windows) or Docker Engine (Linux)
- Docker Compose (bundled with Docker Desktop; on Linux install the compose plugin)

**Option B — Hybrid (local backend + Docker Judge0):**
- Everything in Option A  
- Python 3.11+ with `pip`  
- *(Optional)* Node.js 18+ if you want to develop the frontend locally

---

## 2) Run with Docker (one command)

From the project root:

```bash
docker compose up -d --build
# Services (after startup):
# - Frontend: http://localhost:5173
# - Backend API docs: http://localhost:8000/docs
# - Judge0: http://localhost:2358/languages
```
> 💡 **Tip:** If you only need to run the grader, Docker-only is enough. For backend development with hot reload, use Hybrid below.

---

## 3) Hybrid: Local Backend + Docker Judge0

Run infra in Docker, but the backend locally with live reload.

### 3.1 Start infra only
```bash
docker compose up -d postgres redis judge0 judge0_workers
```

### 3.2 Create a Python venv & install dependencies

**macOS/Linux**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Windows PowerShell**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 3.3 (Optional) `backend/.env`
```env
CORS_ORIGINS=http://localhost:5173
JUDGE0_URL=http://localhost:2358
DEBUG=true
```

### 3.4 Run backend with reload
```bash
uvicorn app.api.main:app --reload --reload-dir app --port 8000
# Open API docs: http://localhost:8000/docs
```

---

## 4) Test the whole pipeline

Use tiny files (outside the backend folder so reload doesn’t trigger):

**Create files**
```bash
printf 'print(1+1)
' > /tmp/submission_add.py
printf 'print("hello from test")
' > /tmp/test_case_1.py
```

**Run via backend**
```bash
curl -iS -X POST "http://localhost:8000/api/v1/attempts"   -F "submission=@/tmp/submission_add.py;type=text/x-python"   --form-string "test_case=$(< /tmp/test_case_1.py)"
```

**Expected:**
- `201 Created`
- `status.id = 3` (Accepted)
- `stdout` contains `hello from test`

<details>
<summary>Windows PowerShell version</summary>

```powershell
# adjust paths as needed
curl -iS -X POST "http://localhost:8000/api/v1/attempts" `
  -F "submission=@C:\Temp\submission_add.py;type=text/x-python" `
  --form-string "test_case=$(Get-Content C:\Temp\test_case_1.py -Raw)"
```
</details>

---

## 5) Troubleshooting

**A) 500 with “In Queue → Timeout”**  
- Workers aren’t consuming. Start them: `docker compose up -d judge0_workers`  
- For dev, Judge0 also supports synchronous mode (`wait=true`) so workers aren’t required.

**B) 422 “source_code can’t be blank”**  
- Ensure the uploaded file isn’t empty; the backend avoids sending empty strings to Judge0.

**C) Auto-reload keeps restarting**  
- Put temp test files in `/tmp` (or outside `backend/`)  
- Run: `uvicorn ... --reload-dir app`

**D) Ports busy**  
- Stop container backend if you run local: `docker compose stop backend`

---

## 6) Security Notes

- Don’t expose Judge0 (`2358`) to the internet; keep it local or behind Docker network.  
- The backend enforces an allow-list for `JUDGE0_URL`.  
- Set `DEBUG=false` in production to avoid leaking error payload details.

---

## 7) Useful Links

- Frontend → http://localhost:5173  
- Backend docs → http://localhost:8000/docs  
- Judge0 languages → http://localhost:2358/languages
