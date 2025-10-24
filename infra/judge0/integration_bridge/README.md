# Judge0 Integration Bridge

This service acts as a bridge between your backend and Judge0, providing advanced test splitting and grading capabilities.

## Architecture

```
Backend (FastAPI)
    ↓ POST /api/v1/attempts/bridge
Judge0 Integration Bridge (Flask)
    ↓ Splits tests into units
    ↓ Runs each unit through Judge0
    ↓ Aggregates results
Judge0 (Rails)
    ↓ Executes code in sandbox
    ↓ Returns execution results
```

## Features

- **Test Splitting**: Automatically splits test files with multiple `assert` statements into individual test units
- **Parallel Execution**: Runs multiple test units in parallel for faster grading
- **Detailed Results**: Returns detailed information about each test unit including:
  - Pass/Fail status
  - Error types (assertion failure, timeout, memory error, etc.)
  - Execution time and memory usage
  - Aggregated score percentage

## API Endpoints

### `POST /health`
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "service": "judge0-integration-bridge"
}
```

### `POST /grade`
Grade a single submission

**Request:**
```json
{
  "submission_code": "def add(a, b):\n    return a + b",
  "test_code": "from submission import add\nassert add(1, 2) == 3\nassert add(0, 0) == 0",
  "job_name": "assignment_1_student_123"
}
```

**Response:**
```json
{
  "job": "assignment_1_student_123",
  "total_units": 2,
  "passed": 2,
  "failed": 0,
  "score_pct": 100.0,
  "by_kind": {
    "PASSED": 2
  },
  "units": [
    {
      "status_id": 3,
      "status": "Accepted",
      "kind": "PASSED",
      "passed": 1,
      "failed": 0,
      "stdout": "",
      "stderr": "",
      "time": "0.021",
      "memory": 3456,
      "harness": "h_01.py",
      "assert": "assert add(1, 2) == 3"
    },
    {
      "status_id": 3,
      "status": "Accepted",
      "kind": "PASSED",
      "passed": 1,
      "failed": 0,
      "stdout": "",
      "stderr": "",
      "time": "0.019",
      "memory": 3412,
      "harness": "h_02.py",
      "assert": "assert add(0, 0) == 0"
    }
  ]
}
```

### `POST /batch`
Grade multiple submissions in one request

**Request:**
```json
{
  "jobs": [
    {
      "submission_code": "...",
      "test_code": "...",
      "job_name": "student_1"
    },
    {
      "submission_code": "...",
      "test_code": "...",
      "job_name": "student_2"
    }
  ]
}
```

**Response:**
```json
{
  "results": [...],
  "summary": {
    "total_jobs": 2,
    "total_units": 10,
    "passed": 8,
    "failed": 2,
    "score_pct": 80.0
  }
}
```

## Error Kinds

The bridge categorizes failures into specific types:

- `PASSED`: Test passed successfully
- `FAILED_ASSERTION`: Test failed due to assertion error (logical failure)
- `TIMEOUT`: Test exceeded time limit
- `MEMORY_ERROR`: Test exceeded memory limit
- `COMPILE_ERROR`: Code had syntax or compilation errors
- `RUNTIME_ERROR`: Other runtime errors (e.g., NameError, TypeError)

## Backend Integration

### Using the Bridge from Backend

```python
# In your backend code
import httpx

async def submit_to_bridge(submission_code: str, test_code: str):
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "http://dind:5000/grade",
            json={
                "submission_code": submission_code,
                "test_code": test_code,
                "job_name": "my_job"
            }
        )
        return response.json()
```

### FastAPI Endpoint Example

```python
@router.post("/bridge")
async def grade_via_bridge(
    submission: UploadFile = File(...),
    test_case: str = Form(...),
):
    student_code = await submission.read()
    result = await submit_to_bridge(
        submission_code=student_code.decode(),
        test_code=test_case
    )
    return result
```

## Environment Variables

- `J0_URL`: Judge0 API URL (default: `http://localhost:2358`)
- `BRIDGE_PORT`: Port to run the bridge on (default: `5000`)
- `IB_MAX_WORKERS`: Maximum parallel workers (default: `4`)
- `J0_POLL_INTERVAL`: Polling interval for Judge0 results (default: `0.3` seconds)

## Docker Setup

The bridge runs inside DinD (Docker-in-Docker) alongside Judge0:

```yaml
# Automatically started by j0ctl
services:
  bridge:
    build: ./integration_bridge
    environment:
      J0_URL: http://server:2358
      BRIDGE_PORT: 5000
    ports:
      - "5000:5000"
    depends_on:
      - server  # Judge0 server
```

## Testing

### Test the Bridge Directly

```bash
curl -X POST http://localhost:5000/health
```

```bash
curl -X POST http://localhost:5000/grade \
  -H "Content-Type: application/json" \
  -d '{
    "submission_code": "def add(a, b):\n    return a + b",
    "test_code": "assert add(1, 2) == 3",
    "job_name": "test"
  }'
```

### Test via Backend

```bash
curl -X POST http://localhost:8000/api/v1/attempts/bridge \
  -F "submission=@student_code.py" \
  -F "test_case=assert add(1, 2) == 3"
```

## Development

### Running Locally

```bash
cd integration_bridge
pip install -r requirements.txt
export J0_URL=http://localhost:2358
export BRIDGE_PORT=5000
python -m api_server
```

### Debugging

Set `IB_MAX_WORKERS=1` to run tests serially for easier debugging.

## File Structure

```
integration_bridge/
├── api_server.py          # Flask API server
├── main_bridge.py         # Original demo/batch processor
├── receive_job.py         # Job data structures
├── send_to_judge0.py      # Judge0 communication
├── grade_results.py       # Result parsing and grading
├── split_tests.py         # Test splitting logic
├── send_back.py           # File output helpers
├── io/
│   ├── inbound/           # Incoming jobs
│   ├── outbound/          # Graded results
│   └── tmp/               # Temporary harness files
├── examples/              # Demo test files
├── requirements.txt       # Python dependencies
└── Dockerfile            # Container image
```

## Notes

- Test files are split by `assert` statements
- Import statements from test files are preserved in each unit
- All units run in parallel (configurable via `IB_MAX_WORKERS`)
- Results include detailed timing and memory usage per unit
- The bridge is stateless - all data is passed via HTTP requests

