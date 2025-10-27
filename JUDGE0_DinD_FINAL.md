# Judge0 Integration - Final Setup (DinD)

## ✅ Status: Working

Judge0 is running in Docker-in-Docker (DinD) as originally designed, with simplified backend code.

## Architecture

```
┌─────────────────┐
│   Browser       │
│   :5173         │
└────────┬────────┘
         │
         v
┌─────────────────┐
│   Frontend      │
│   (nginx)       │
└────────┬────────┘
         │
         v
┌─────────────────┐       ┌──────────────────────────┐
│   Backend       │──────>│   DinD Container         │
│   (FastAPI)     │ HTTP  │  ┌──────────────────┐    │
│                 │       │  │ Judge0 Server    │    │
│                 │       │  │ :2358            │    │
│                 │       │  └──────────────────┘    │
│                 │       │  ┌──────────────────┐    │
│                 │       │  │ Judge0 Workers   │    │
│                 │       │  └──────────────────┘    │
│                 │       │  ┌──────────────────┐    │
│                 │       │  │ PostgreSQL       │    │
│                 │       │  └──────────────────┘    │
│                 │       │  ┌──────────────────┐    │
│                 │       │  │ Redis            │    │
│                 │       │  └──────────────────┘    │
└─────────────────┘       └──────────────────────────┘
```

## What Changed

### ✅ Simplified Backend Code
- Created `backend/app/services/judge0/` with clean modules
  - `client.py` - HTTP client with polling (based on your test scripts)
  - `test_splitter.py` - Splits tests into individual assertions
  - `grader.py` - Grades results and aggregates scores
  - `executor.py` - Main orchestrator with parallel execution
  
### ✅ Removed Complexity
- Deleted unused routes (`/bridge`, `/test-route`, `/execute`)
- Deleted unused DinD sandbox service
- Cleaned up integration bridge API (Flask app no longer needed)

### ✅ Kept DinD Architecture
- Judge0 still runs inside DinD container
- Accessible at:
  - From host: `http://localhost:2358`
  - From backend: `http://dind:2358`
- Maintains isolation and cross-platform compatibility

## Quick Start

### 1. Start the System

```bash
cd COSC410-2025-AutoGrader

# Clear cache
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# Start services
docker-compose up -d

# Wait for Judge0 to be ready (~20 seconds)
sleep 20
```

### 2. Verify Judge0

```bash
# From host
curl http://localhost:2358/system_info

# From backend
docker-compose exec backend python -c "
import httpx, asyncio
async def test():
    async with httpx.AsyncClient() as client:
        r = await client.get('http://dind:2358/system_info')
        print(f'Status: {r.status_code}')
asyncio.run(test())
"
```

Expected: Both should return `Status: 200`

### 3. Test via Frontend

1. Open: http://localhost:5173
2. Login as faculty: `prof.x@wofford.edu` / `secret`
3. Create assignment with test file
4. Login as student: `alice@wofford.edu` / `secret`
5. Submit solution
6. Verify grading shows individual test results

## How It Works

### 1. Submission Flow

```
Frontend → Backend → judge0.executor.grade_submission()
                              ↓
                     Split tests into units
                              ↓
                     For each unit:
                       - Combine submission + test
                       - Submit to Judge0 (http://dind:2358)
                       - Poll for result
                              ↓
                     Grade and aggregate results
                              ↓
                     Return final score + details
```

### 2. Test Splitting

Original test file:
```python
from submission import add

assert add(2, 3) == 5
assert add(-1, 1) == 0
assert add(0, 0) == 0
```

Becomes 3 separate Judge0 submissions:
- Unit 1: `assert add(2, 3) == 5`
- Unit 2: `assert add(-1, 1) == 0`
- Unit 3: `assert add(0, 0) == 0`

### 3. Grading

Results are categorized:
- ✅ **PASSED** - Test passed
- ❌ **FAILED_ASSERTION** - Assertion failed
- ⏰ **TIMEOUT** - Exceeded time limit
- 💾 **MEMORY_ERROR** - Exceeded memory limit
- 🔧 **COMPILE_ERROR** - Syntax error
- 💥 **RUNTIME_ERROR** - Other error

Final grade: `(passed_units / total_units) * 100`

## Configuration

### Settings

**File:** `backend/app/core/settings.py`

```python
JUDGE0_URL: str = "http://dind:2358"
```

**File:** `docker-compose.yml`

```yaml
backend:
  environment:
    - JUDGE0_URL=http://dind:2358
  depends_on:
    - dind
    - j0ctl
```

### Adjust Parallel Workers

**File:** `backend/app/services/judge0/executor.py`

```python
async def grade_submission(
    submission_code: str,
    test_code: str,
    judge0_url: str = None,
    max_workers: int = 4,  # Increase for faster grading
):
```

## Commands

### Start/Stop

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart backend only
docker-compose restart backend

# Restart Judge0 bootstrap
docker-compose restart j0ctl
```

### View Logs

```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Judge0 bootstrap
docker-compose logs j0ctl

# Judge0 server (inside DinD)
docker-compose exec dind docker logs j0-server-1
```

### Full Rebuild

```bash
# Stop everything
docker-compose down

# Clear cache
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find backend -name "*.pyc" -delete

# Rebuild
docker-compose build --no-cache backend

# Start
docker-compose up -d
```

### Test Judge0 Directly

Create `test_judge0.py`:

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

Run: `python test_judge0.py`

## Troubleshooting

### Judge0 not starting

**Symptom:** `Cannot connect to the Docker daemon at tcp://dind:2375`

**Solution:**
```bash
# DinD needs more time to start
# Already increased to 15 seconds in j0ctl

# Or restart j0ctl
docker-compose restart j0ctl

# Wait 20 seconds
sleep 20

# Check logs
docker-compose logs j0ctl | tail -20
```

### Backend can't reach Judge0

**Symptom:** `Connection refused` in backend logs

**Solution:**
```bash
# Verify Judge0 is running
curl http://localhost:2358/system_info

# Check backend logs
docker-compose logs backend | grep -i judge

# Verify backend has correct URL
docker-compose exec backend env | grep JUDGE0
```

### Slow grading

**Symptom:** Takes >10 seconds per submission

**Solution:**
```python
# Increase parallel workers in executor.py
max_workers: int = 8  # or 16
```

## Files Changed

### Created
- `backend/app/services/judge0/__init__.py`
- `backend/app/services/judge0/client.py`
- `backend/app/services/judge0/test_splitter.py`
- `backend/app/services/judge0/grader.py`
- `backend/app/services/judge0/executor.py`

### Modified
- `backend/app/api/assignments.py` - Uses new judge0 service
- `backend/app/api/attempt_submission_test.py` - Removed unused endpoints
- `backend/app/api/main.py` - Removed execute router
- `backend/app/core/settings.py` - Kept `JUDGE0_URL=http://dind:2358`
- `docker-compose.yml` - Increased j0ctl wait time to 15 seconds

### Deleted
- `backend/app/api/execute.py`
- `backend/app/services/sandbox.py`

## Key Improvements

✅ **Cleaner Code** - Well-organized judge0 service modules  
✅ **Maintained DinD** - Judge0 still runs in isolation  
✅ **Test Splitting** - Granular per-assertion grading  
✅ **Parallel Execution** - Up to 4 tests run simultaneously  
✅ **Better Categorization** - Detailed failure types  
✅ **Cross-Platform** - Works on Mac and Windows (with DinD)

## Summary

The Judge0 integration has been simplified while maintaining the DinD architecture:

- ✅ Judge0 runs in DinD at `http://dind:2358`
- ✅ Backend uses new clean `judge0` service modules
- ✅ Test splitting for granular grading
- ✅ Parallel execution for performance
- ✅ Removed unused routes and complexity
- ✅ Comprehensive error categorization

**Status:** Production ready, fully tested ✅

