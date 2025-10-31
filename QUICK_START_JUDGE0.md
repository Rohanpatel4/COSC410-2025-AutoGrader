# Quick Start: Judge0 Integration

## 🚀 Quick Setup (5 Minutes)

### 1. Start Judge0 Locally

```bash
# Download official Judge0 docker-compose
curl -O https://raw.githubusercontent.com/judge0/judge0/master/docker-compose.yml

# Start Judge0
docker-compose up -d

# Verify it's running
curl http://localhost:2358/system_info
```

Expected output: JSON with Judge0 system information

### 2. Start AutoGrader

```bash
# From project root
cd COSC410-2025-AutoGrader

# Stop any running services
docker-compose down

# Clear backend cache
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# Build and start
docker-compose build --no-cache backend
docker-compose up -d

# Check backend can reach Judge0
docker-compose logs backend | grep -i judge
```

### 3. Test via Frontend

1. **Open:** http://localhost:5173
2. **Login as faculty:** prof.x@wofford.edu / secret
3. **Create assignment** with test file (use `manual_test_files/test_calculator.py`)
4. **Login as student:** alice@wofford.edu / secret
5. **Submit solution** (use `manual_test_files/submission_passes_all.py`)
6. **Verify:** Grading shows individual test results

## 📁 What Changed

### New Files Created
```
backend/app/services/judge0/
├── __init__.py          # Main entry point
├── client.py            # Judge0 HTTP client
├── test_splitter.py     # Splits tests into units
├── grader.py            # Grades and aggregates results
└── executor.py          # Orchestrates everything

JUDGE0_SETUP.md          # Detailed setup guide
JUDGE0_MIGRATION_SUMMARY.md  # Complete change log
```

### Files Deleted
```
backend/app/api/execute.py        # Unused DinD endpoint
backend/app/services/sandbox.py   # Unused DinD service
```

### Files Modified
```
backend/app/api/assignments.py    # Uses new judge0 service
backend/app/api/main.py           # Removed execute router
backend/app/core/settings.py      # Updated Judge0 URL
docker-compose.yml                # Simplified (no DinD)
```

## 🔧 Quick Commands

### Stop/Start AutoGrader
```bash
# Stop
docker-compose down

# Start
docker-compose up -d

# Restart
docker-compose restart backend
```

### Check Status
```bash
# Judge0 on host
curl http://localhost:2358/system_info

# Backend health
curl http://localhost:8000/docs

# Backend can reach Judge0?
docker-compose exec backend python -c "
import httpx, asyncio
async def test():
    async with httpx.AsyncClient() as client:
        r = await client.get('http://host.docker.internal:2358/system_info')
        print('✅ Judge0 accessible' if r.status_code == 200 else '❌ Failed')
asyncio.run(test())
"
```

### View Logs
```bash
# Backend logs
docker-compose logs -f backend

# Frontend logs
docker-compose logs -f frontend

# Judge0 logs
cd judge0  # or wherever you started Judge0
docker-compose logs -f judge0
```

### Clear Cache & Rebuild
```bash
# Full rebuild
docker-compose down
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
docker-compose build --no-cache
docker-compose up -d
```

## 🧪 Test Judge0 Directly

### Python Test Script
```python
#!/usr/bin/env python3
import requests, json, time

JUDGE0_URL = "http://localhost:2358"

# Simple Python code
code = """
def add(a, b):
    return a + b

assert add(2, 3) == 5
print("✅ Test passed!")
"""

# Submit
response = requests.post(
    f"{JUDGE0_URL}/submissions",
    headers={"Content-Type": "application/json"},
    json={
        "source_code": code,
        "language_id": 71,  # Python 3
    }
)

token = response.json()["token"]
print(f"Submitted: {token}")

# Poll for result
time.sleep(2)
result = requests.get(f"{JUDGE0_URL}/submissions/{token}").json()

print(f"Status: {result['status']['description']}")
print(f"Output: {result.get('stdout', '').strip()}")
```

Save as `test_judge0.py` and run: `python test_judge0.py`

## 🐛 Common Issues

### "Connection refused" from backend

**Problem:** Backend can't reach Judge0

**Solution:**
```bash
# Verify Judge0 is running
curl http://localhost:2358/system_info

# Check docker-compose.yml has:
environment:
  - JUDGE0_URL=http://host.docker.internal:2358

# On Linux, use instead:
  - JUDGE0_URL=http://172.17.0.1:2358
```

### "Module not found" errors

**Problem:** Python cache not cleared

**Solution:**
```bash
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find backend -name "*.pyc" -delete
docker-compose build --no-cache backend
docker-compose up -d
```

### Slow grading

**Problem:** Too many tests running serially

**Solution:**
```python
# Edit backend/app/services/judge0/executor.py
# Increase max_workers in grade_submission():
max_workers: int = 8  # Default is 4
```

### Port 2358 in use

**Problem:** Another service using port 2358

**Solution:**
```bash
# Find what's using it
lsof -i :2358  # Mac/Linux
netstat -ano | findstr :2358  # Windows

# Use different port in Judge0 docker-compose.yml:
ports:
  - "2359:2358"

# Update AutoGrader:
export JUDGE0_URL=http://localhost:2359
```

## 📚 Full Documentation

- **Setup Guide:** See `JUDGE0_SETUP.md`
- **Migration Details:** See `JUDGE0_MIGRATION_SUMMARY.md`
- **Manual Test Files:** See `manual_test_files/README.md`

## ✅ Verification Checklist

After setup, verify:

- [ ] Judge0 running: `curl http://localhost:2358/system_info`
- [ ] Backend running: `curl http://localhost:8000/docs`
- [ ] Frontend accessible: Open http://localhost:5173
- [ ] Can login as faculty: prof.x@wofford.edu / secret
- [ ] Can create assignment with test file
- [ ] Can login as student: alice@wofford.edu / secret
- [ ] Can submit solution
- [ ] Grading shows test results
- [ ] Database updates with grade

## 🎯 System Architecture

```
┌─────────────┐
│   Browser   │
│ :5173       │
└──────┬──────┘
       │ HTTP
       v
┌─────────────┐
│  Frontend   │
│  (nginx)    │
└──────┬──────┘
       │ HTTP
       v
┌─────────────┐      ┌──────────────┐
│   Backend   │─────>│   Judge0     │
│  (FastAPI)  │ HTTP │   :2358      │
│  (Docker)   │      │   (Host)     │
└──────┬──────┘      └──────────────┘
       │
       v
┌─────────────┐
│  SQLite DB  │
└─────────────┘
```

**Key Points:**
- Frontend in Docker → Backend in Docker (internal network)
- Backend in Docker → Judge0 on Host (via host.docker.internal)
- Judge0 runs directly on host machine (no Docker-in-Docker)

## 💡 Pro Tips

1. **Development mode:** Run backend outside Docker for faster iteration:
   ```bash
   cd backend
   export JUDGE0_URL=http://localhost:2358
   uvicorn app.api.main:app --reload
   ```

2. **Monitor Judge0:** Keep Judge0 logs open in a terminal:
   ```bash
   docker-compose logs -f judge0
   ```

3. **Test individual functions:** Use the new service directly:
   ```python
   from app.services.judge0 import grade_submission
   result = await grade_submission(student_code, test_code)
   ```

4. **Parallel testing:** Submit multiple tests at once:
   ```bash
   for file in manual_test_files/submission_*.py; do
     curl -X POST http://localhost:8000/api/v1/assignments/1/submit \
       -F "student_id=201" -F "submission=@$file" &
   done
   wait
   ```

---

**Need help?** Check:
1. `JUDGE0_SETUP.md` for detailed setup
2. `JUDGE0_MIGRATION_SUMMARY.md` for what changed
3. Judge0 logs: `docker-compose logs judge0`
4. Backend logs: `docker-compose logs backend`

