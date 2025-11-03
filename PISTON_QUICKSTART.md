# Piston Quick Start Guide

## Overview
This autograding system uses Piston for code execution instead of Judge0. Piston provides sandboxed, efficient code execution suitable for Docker Desktop on Windows.

## Quick Setup

### 1. Start All Services
```bash
docker compose up -d
```

Wait for all services to start (takes ~30 seconds).

### 2. Verify Piston is Running
```bash
# Check container status
docker compose ps

# Verify Piston API is responding
curl.exe http://127.0.0.1:2000/api/v2/runtimes
```

You should see Python 3.12.0 in the runtimes list. If not, install it:
```bash
curl.exe -X POST http://127.0.0.1:2000/api/v2/packages -H "Content-Type: application/json" -d '{\"language\":\"python\",\"version\":\"3\"}'
```

### 3. Test the System
```bash
# Create an assignment (use assignment ID 1)
curl.exe -X POST http://localhost:8000/api/v1/courses/1/assignments -H "Content-Type: application/json" -d '{\"title\":\"Calculator\",\"description\":\"Implement calc functions\"}'

# Upload test file
curl.exe -X POST http://localhost:8000/api/v1/assignments/1/test-file -F "file=@manual_test_files/test_calculator.py"

# Submit a student solution
curl.exe -X POST http://localhost:8000/api/v1/assignments/1/submit -F "submission=@manual_test_files/submission_passes_all.py" -F "student_id=201"

# Check results
curl.exe http://localhost:8000/api/v1/assignments/1/grades
```

## Architecture

```
┌─────────────┐
│   Browser   │
│  :5173      │
└──────┬──────┘
       │ HTTP
       v
┌─────────────┐         ┌──────────────┐
│  Frontend   │────────>│   Backend    │
│ (React)     │         │  (FastAPI)   │
└─────────────┘         │   :8000      │
                        └──────┬───────┘
                               │ HTTP
                               v
                        ┌──────────────┐
                        │   Piston     │
                        │   :2000      │
                        │ (Code Exec)  │
                        └──────────────┘
```

**Key Points:**
- Frontend in Docker → Backend in Docker (internal network)
- Backend in Docker → Piston in Docker (internal network)
- Piston runs with `--privileged` flag for sandboxing
- Uses named volume for Windows compatibility

## Features

### Unittest Integration
Tests are run using Python's unittest framework:
- Test functions starting with `test_` are automatically discovered
- Results formatted for display
- Pass/fail tracked per test

### Execution Environment
- **Language**: Python 3.12.0
- **Timeout**: 10 seconds (configurable)
- **Sandboxing**: Privileged container with cgroup isolation
- **Memory**: Unlimited (configurable)

### API Endpoints

**Assignment Submission:**
```
POST /api/v1/assignments/{id}/submit
Form data:
  - submission: .py file
  - student_id: integer

Response includes:
  - grade: 100 if all pass, 0 otherwise
  - result: execution details with test counts
```

**Direct Execution (for testing):**
```
POST /api/v1/attempts
Form data:
  - submission: .py file
  - test_case: test code as text

Returns: Execution result with test breakdown
```

## Windows-Specific Notes

### Required Docker Compose Settings
- `privileged: true` - Required for Piston's sandboxing
- Named volume (`piston_data:/piston`) instead of bind mount
- No healthcheck (Piston container doesn't have curl/wget)

### Manual Test Files
Use the files in `manual_test_files/` directory:
- `test_calculator.py` - Test cases
- `submission_passes_all.py` - Perfect solution (100 points)
- `submission_passes_some.py` - Partial solution (0 points)
- `submission_passes_none.py` - Wrong solution (0 points)

### Common Issues

**Issue**: Piston container won't start
- **Solution**: Ensure Docker Desktop is running with WSL2 backend
- **Solution**: Check that port 2000 is not in use

**Issue**: Python not available in Piston
- **Solution**: Install manually:
  ```bash
  curl.exe -X POST http://127.0.0.1:2000/api/v2/packages \
    -H "Content-Type: application/json" \
    -d '{\"language\":\"python\",\"version\":\"3\"}'
  ```

**Issue**: Tests run but grading fails
- **Solution**: Check backend logs: `docker compose logs backend`
- **Solution**: Verify Piston URL in settings: `http://piston:2000`

## Development

### Running Tests
```bash
cd backend
pytest
```

### Viewing Logs
```bash
# Backend logs
docker compose logs -f backend

# Piston logs
docker compose logs -f piston

# Frontend logs
docker compose logs -f frontend
```

### Restart Services
```bash
# Restart everything
docker compose restart

# Restart specific service
docker compose restart backend

# Rebuild and restart
docker compose up -d --build
```

## Testing Checklist

After setup, verify:
- [ ] Piston container is running
- [ ] Backend is healthy (check http://localhost:8000/docs)
- [ ] Frontend loads (http://localhost:5173)
- [ ] Can create assignment
- [ ] Can upload test file
- [ ] Can submit student code
- [ ] Grades are calculated correctly
- [ ] Database stores submission records

## Next Steps

1. Test with manual test files
2. Create courses and enrollments via frontend
3. Create assignments with custom test cases
4. Monitor execution through logs
5. Customize grading logic if needed

