# Judge0 Integration Bridge Setup Guide

## Overview

The system now has **two ways** to grade submissions:

1. **Direct Judge0** (`POST /api/v1/attempts`) - Combines all tests in one file
2. **Integration Bridge** (`POST /api/v1/attempts/bridge`) - Splits tests into units, runs in parallel ✨ **NEW**

## Architecture

```
┌─────────────┐
│   Student   │
│   Browser   │
└──────┬──────┘
       │ HTTP
       ↓
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React/Vite) - Port 5173                          │
└──────┬──────────────────────────────────────────────────────┘
       │ POST /api/v1/attempts/bridge
       ↓
┌─────────────────────────────────────────────────────────────┐
│  Backend (FastAPI) - Port 8000                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ POST /api/v1/attempts/bridge                         │   │
│  │ 1. Receives: submission file + test_case string      │   │
│  │ 2. Converts file to text (FileConverter)             │   │
│  │ 3. Sends to Bridge: {submission_code, test_code}     │   │
│  └──────────────────────────────────────────────────────┘   │
└──────┬──────────────────────────────────────────────────────┘
       │ POST http://dind:5000/grade
       ↓
┌─────────────────────────────────────────────────────────────┐
│  DinD Container - Ports 2358, 5000                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Integration Bridge (Flask) - Port 5000              │    │
│  │ POST /grade                                          │    │
│  │ 1. Receives submission_code + test_code             │    │
│  │ 2. Writes to files in io/inbound/                   │    │
│  │ 3. Splits tests into individual assert units        │    │
│  │ 4. For each unit:                                    │    │
│  │    - Combines submission + harness                   │    │
│  │    - Submits to Judge0                               │    │
│  │    - Collects result                                 │    │
│  │ 5. Aggregates all results                            │    │
│  │ 6. Returns: {passed, failed, score_pct, units[]}    │    │
│  └──────────┬──────────────────────────────────────────┘    │
│             │ POST http://server:2358/submissions            │
│             ↓                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Judge0 (Rails) - Port 2358                          │    │
│  │ - Executes code in isolate sandbox                  │    │
│  │ - Returns: status, stdout, stderr, time, memory     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Setup Commands

### 1. Stop Everything
```bash
cd /Users/rohan/Desktop/school/Computer\ Science/COSC\ 410/COSC410-2025-AutoGrader
docker-compose down
```

### 2. Start Everything
```bash
docker-compose up -d
```

### 3. Restart j0ctl (Important!)
```bash
# Wait 15 seconds for DinD to be ready
sleep 15
docker-compose restart j0ctl
```

### 4. Wait for Services to Start
```bash
# Wait 2-3 minutes on first run (downloading images)
# Or 30-60 seconds on subsequent runs
sleep 120
```

### 5. Verify Services

**Check Judge0:**
```bash
curl -s http://localhost:2358/about | python3 -m json.tool
```

**Check Integration Bridge:**
```bash
curl -s http://localhost:5000/health | python3 -m json.tool
```

Expected output:
```json
{
  "status": "healthy",
  "service": "judge0-integration-bridge"
}
```

## Complete One-Line Startup

```bash
cd /Users/rohan/Desktop/school/Computer\ Science/COSC\ 410/COSC410-2025-AutoGrader && \
docker-compose down && \
docker-compose up -d && \
sleep 15 && \
docker-compose restart j0ctl && \
echo "Waiting for services (2 min)..." && \
sleep 120 && \
echo "Testing Judge0..." && \
curl -s http://localhost:2358/about && \
echo "\nTesting Bridge..." && \
curl -s http://localhost:5000/health
```

## Usage Examples

### Test the Bridge Directly

```bash
curl -X POST http://localhost:5000/grade \
  -H "Content-Type: application/json" \
  -d '{
    "submission_code": "def add(a, b):\n    return a + b",
    "test_code": "from submission import add\nassert add(1, 2) == 3\nassert add(0, 0) == 0",
    "job_name": "test_add"
  }' | python3 -m json.tool
```

### Test via Backend API

Create a test file `student_submission.py`:
```python
def add(a, b):
    return a + b

def subtract(a, b):
    return a - b
```

Create a test case string:
```python
from submission import add, subtract
assert add(1, 2) == 3
assert add(0, 0) == 0
assert subtract(5, 3) == 2
```

Submit via backend:
```bash
curl -X POST http://localhost:8000/api/v1/attempts/bridge \
  -F "submission=@student_submission.py" \
  -F "test_case=from submission import add, subtract
assert add(1, 2) == 3
assert add(0, 0) == 0
assert subtract(5, 3) == 2" \
  -F "job_name=assignment_1" | python3 -m json.tool
```

### Expected Response

```json
{
  "status": "ok",
  "submission_filename": "student_submission.py",
  "converter_used": "file_to_text",
  "sandbox_used": "judge0_integration_bridge",
  "grading": {
    "passed": true,
    "total_tests": 3,
    "passed_tests": 3,
    "failed_tests": 0,
    "score_pct": 100.0
  },
  "result": {
    "job_name": "assignment_1",
    "by_kind": {
      "PASSED": 3
    },
    "units": [
      {
        "status_id": 3,
        "status": "Accepted",
        "kind": "PASSED",
        "passed": 1,
        "failed": 0,
        "harness": "h_01.py",
        "assert": "assert add(1, 2) == 3",
        "stdout": "",
        "stderr": "",
        "time": "0.021",
        "memory": 3456
      },
      {
        "status_id": 3,
        "status": "Accepted",
        "kind": "PASSED",
        "passed": 1,
        "failed": 0,
        "harness": "h_02.py",
        "assert": "assert add(0, 0) == 0",
        "stdout": "",
        "stderr": "",
        "time": "0.019",
        "memory": 3412
      },
      {
        "status_id": 3,
        "status": "Accepted",
        "kind": "PASSED",
        "passed": 1,
        "failed": 0,
        "harness": "h_03.py",
        "assert": "assert subtract(5, 3) == 2",
        "stdout": "",
        "stderr": "",
        "time": "0.020",
        "memory": 3424
      }
    ]
  }
}
```

## API Endpoints

### Backend Endpoints

1. **`POST /api/v1/attempts/bridge`** - New! Uses Integration Bridge
   - Splits tests into units
   - Runs in parallel
   - Returns detailed per-unit results

2. **`POST /api/v1/attempts`** - Original direct Judge0
   - Combines all tests in one file
   - Single execution
   - Simpler but less detailed

### Bridge Endpoints

1. **`GET /health`** - Health check
2. **`POST /grade`** - Grade single submission
3. **`POST /batch`** - Grade multiple submissions

## Debugging

### Check Logs

```bash
# Bridge logs
docker-compose logs j0ctl --tail=50

# Judge0 logs
docker exec cosc410-2025-autograder-j0ctl-1 \
  docker logs j0-server-1 --tail=50

# Bridge container logs
docker exec cosc410-2025-autograder-j0ctl-1 \
  docker logs judge0-bridge --tail=50
```

### Check Running Services

```bash
# Check services inside DinD
docker exec cosc410-2025-autograder-j0ctl-1 docker ps

# Should show:
# - j0-server-1 (Judge0)
# - j0-worker-1 (Judge0 worker)
# - j0-db-1 (Postgres)
# - j0-redis-1 (Redis)
# - judge0-bridge (Integration Bridge)
```

### Common Issues

**Bridge returns 503 "Could not connect"**
- Bridge is not running inside DinD
- Run: `docker-compose restart j0ctl`

**Bridge returns 500 "Judge0 error"**
- Judge0 is not accessible
- Check: `curl http://localhost:2358/about`

**Tests don't split properly**
- Make sure test file uses simple `assert` statements
- Multi-line asserts not supported yet

## File Locations

- **Bridge code**: `infra/judge0/integration_bridge/`
- **Backend endpoint**: `backend/app/api/attempt_submission_test.py`
- **Docker config**: `docker-compose.yml`
- **Bridge compose**: `infra/judge0/bridge-compose.yml`
- **Judge0 compose**: `infra/judge0/docker-compose.yml`

## Environment Variables

### Backend
- `BRIDGE_URL` - Bridge URL (default: `http://dind:5000`)
- `JUDGE0_URL` - Judge0 URL (default: `http://dind:2358`)

### Bridge
- `J0_URL` - Judge0 URL from bridge (default: `http://server:2358`)
- `BRIDGE_PORT` - Port to listen on (default: `5000`)
- `IB_MAX_WORKERS` - Parallel workers (default: `4`)

## Database Integration

To save results to database, update the endpoint:

```python
@router.post("/bridge", status_code=status.HTTP_201_CREATED)
async def attempt_submission_test_bridge(
    submission: UploadFile = File(...),
    test_case: str = Form(...),
    assignment_id: int = Form(...),  # Add this
    student_id: int = Form(...),      # Add this
    db: Session = Depends(get_db),    # Add this
):
    # ... existing code ...
    
    result = await _submit_to_bridge(...)
    
    # Save to database
    db_submission = StudentSubmission(
        student_id=student_id,
        assignment_id=assignment_id,
        grade=result.get("score_pct", 0)
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    
    return {
        "status": "ok",
        "submission_id": db_submission.id,
        "grading": {...}
    }
```

## Next Steps

1. **Frontend Integration**: Update frontend to call `/api/v1/attempts/bridge`
2. **Database**: Add code to save results to `StudentSubmission` table
3. **UI Display**: Show per-unit test results in a nice format
4. **Error Handling**: Add retry logic for transient failures
5. **Monitoring**: Add metrics/logging for performance tracking

## Advantages of Bridge Approach

✅ **Parallel Execution** - Tests run simultaneously, faster results  
✅ **Detailed Feedback** - See exactly which test failed and why  
✅ **Error Classification** - Know if it's assertion, timeout, memory, etc.  
✅ **Scalable** - Easy to add more test types and runners  
✅ **Flexible** - Can switch between direct Judge0 and bridge  

## Troubleshooting

If something doesn't work:

1. **Stop everything**: `docker-compose down`
2. **Clean volumes** (if needed): `docker volume rm cosc410-2025-autograder_dind-data`
3. **Restart**: Follow setup commands above
4. **Check logs**: `docker-compose logs j0ctl`
5. **Test manually**: Use curl commands above

Good luck! 🚀

