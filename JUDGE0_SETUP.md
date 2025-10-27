# Judge0 Setup Guide

This guide explains how to set up and run Judge0 locally on Windows or Mac for the AutoGrader system.

## Overview

The AutoGrader now uses a **local Judge0 instance** running at `http://localhost:2358`. This approach is:
- ✅ **Windows-compatible** - works on both Windows and Mac
- ✅ **Simpler** - no Docker-in-Docker complexity
- ✅ **Faster** - direct HTTP communication
- ✅ **Easier to debug** - Judge0 runs on your host machine

## Prerequisites

- Docker and Docker Compose installed
- Port 2358 available on your machine

## Installation

### Option 1: Official Judge0 Docker Compose (Recommended)

1. **Download Judge0 Docker Compose**

   Clone the official Judge0 repository or download just the docker-compose file:
   
   ```bash
   # Option A: Clone the full repo
   git clone https://github.com/judge0/judge0.git
   cd judge0
   
   # Option B: Download just the docker-compose file
   curl -O https://raw.githubusercontent.com/judge0/judge0/master/docker-compose.yml
   ```

2. **Start Judge0**

   ```bash
   docker-compose up -d
   ```

3. **Verify Judge0 is running**

   ```bash
   curl http://localhost:2358/system_info
   ```
   
   You should see a JSON response with Judge0 system information.

### Option 2: Minimal Judge0 Setup

If you want a minimal setup, create a `judge0-compose.yml` file:

```yaml
version: '3'

services:
  judge0-db:
    image: postgres:13-alpine
    environment:
      POSTGRES_DB: judge0
      POSTGRES_USER: judge0
      POSTGRES_PASSWORD: judge0password
    volumes:
      - judge0-postgres:/var/lib/postgresql/data
    restart: always

  judge0-redis:
    image: redis:7-alpine
    restart: always

  judge0:
    image: judge0/judge0:latest
    environment:
      RAILS_ENV: production
      DATABASE_URL: postgres://judge0:judge0password@judge0-db:5432/judge0
      REDIS_URL: redis://judge0-redis:6379
    ports:
      - "2358:2358"
    depends_on:
      - judge0-db
      - judge0-redis
    restart: always

  judge0-workers:
    image: judge0/judge0:latest
    environment:
      RAILS_ENV: production
      DATABASE_URL: postgres://judge0:judge0password@judge0-db:5432/judge0
      REDIS_URL: redis://judge0-redis:6379
    command: ["./scripts/workers"]
    depends_on:
      - judge0-db
      - judge0-redis
    restart: always

volumes:
  judge0-postgres:
```

Then start it:

```bash
docker-compose -f judge0-compose.yml up -d
```

## Testing Judge0

### Test 1: System Info

```bash
curl http://localhost:2358/system_info
```

Expected: JSON response with Judge0 version and system information.

### Test 2: Simple Python Execution

Use the provided test script from the user's examples:

```python
#!/usr/bin/env python3
"""
Test script for Judge0 API
"""

import requests
import time
import json

JUDGE0_URL = "http://localhost:2358"
SUBMISSIONS_ENDPOINT = f"{JUDGE0_URL}/submissions"
HEADERS = {"Content-Type": "application/json"}

def test_judge0():
    """Test Judge0 by submitting and executing a simple Python program."""
    
    test_code = """
print("Hello from Judge0!")
print("Testing Python execution...")

# Basic arithmetic
a = 5
b = 10
print(f"Sum: {a + b}")

# List comprehension
numbers = [x for x in range(1, 6)]
print(f"Numbers: {numbers}")

# String manipulation
message = "JUDGE0 TEST SUCCESSFUL"
print(message.lower())
"""

    payload = {
        "source_code": test_code,
        "language_id": 71,  # Python 3
        "stdin": "",
        "cpu_time_limit": 5.0,
        "memory_limit": 128000,
    }

    print("🚀 Submitting code to Judge0...")
    print("=" * 50)

    try:
        # Submit the code
        response = requests.post(
            SUBMISSIONS_ENDPOINT,
            headers=HEADERS,
            data=json.dumps(payload),
            timeout=10
        )

        if response.status_code != 201:
            print(f"❌ Failed to submit code. Status: {response.status_code}")
            print(f"Response: {response.text}")
            return

        submission_data = response.json()
        token = submission_data.get("token")

        if not token:
            print("❌ No token received from Judge0")
            return

        print(f"✅ Submission created with token: {token}")
        print("⏳ Waiting for execution...")

        # Poll for results
        max_attempts = 30
        attempt = 0

        while attempt < max_attempts:
            time.sleep(1)

            result_response = requests.get(
                f"{SUBMISSIONS_ENDPOINT}/{token}",
                headers=HEADERS,
                timeout=10
            )

            if result_response.status_code != 200:
                print(f"❌ Failed to get result. Status: {result_response.status_code}")
                return

            result = result_response.json()
            status_id = result.get("status", {}).get("id")

            # Status IDs: 1=pending, 2=processing, 3=accepted
            if status_id == 1 or status_id == 2:
                attempt += 1
                if attempt % 5 == 0:
                    print(f"   Still processing... (attempt {attempt}/{max_attempts})")
                continue
            elif status_id == 3:
                print("✅ Execution completed successfully!")
                break
            else:
                print(f"❌ Execution failed with status: {result.get('status', {}).get('description', 'Unknown')}")
                break

        if attempt >= max_attempts:
            print("⏰ Timeout: Execution took too long")
            return

        # Display results
        print("\n" + "=" * 50)
        print("📊 EXECUTION RESULTS")
        print("=" * 50)

        print(f"Status: {result.get('status', {}).get('description', 'Unknown')}")

        stdout = result.get("stdout", "").strip()
        stderr = result.get("stderr", "").strip()

        if stdout:
            print(f"\n📝 Standard Output:\n{stdout}")

        if stderr:
            print(f"\n⚠️  Standard Error:\n{stderr}")

        time_used = result.get("time", "N/A")
        memory_used = result.get("memory", "N/A")

        print("\n📈 Resource Usage:")
        print(f"   Time: {time_used}s" if isinstance(time_used, (int, float)) else f"   Time: {time_used}")
        print(f"   Memory: {memory_used} KB" if isinstance(memory_used, (int, float)) else f"   Memory: {memory_used}")
        
        print("\n🎉 Test completed!")

    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    print("🧪 Testing Judge0 API...")
    test_judge0()
```

Save this as `test_judge0.py` and run:

```bash
python test_judge0.py
```

## AutoGrader Integration

The AutoGrader backend is configured to use Judge0 at `http://localhost:2358`.

### For Development (Backend outside Docker)

If running the backend directly on your machine:

```bash
cd backend
export JUDGE0_URL=http://localhost:2358
uvicorn app.api.main:app --reload --host 0.0.0.0 --port 8000
```

### For Production (Backend in Docker)

The backend Docker container accesses Judge0 via `host.docker.internal:2358`:

```bash
docker-compose up -d
```

The `docker-compose.yml` is already configured with:
```yaml
environment:
  - JUDGE0_URL=http://host.docker.internal:2358
```

## How It Works

### 1. Test Splitting

The AutoGrader automatically splits test files into individual assertion units:

```python
# Original test file
from submission import add

assert add(2, 3) == 5
assert add(-1, 1) == 0
assert add(0, 0) == 0
```

Becomes 3 separate units:
- Unit 1: `assert add(2, 3) == 5`
- Unit 2: `assert add(-1, 1) == 0`
- Unit 3: `assert add(0, 0) == 0`

### 2. Execution

Each unit is combined with the student's submission and sent to Judge0:

```python
# Student code
def add(a, b):
    return a + b

# ---- TEST HARNESS ----
assert add(2, 3) == 5
```

### 3. Grading

Results are categorized by type:
- ✅ **PASSED** - Test passed
- ❌ **FAILED_ASSERTION** - Assertion failed
- ⏰ **TIMEOUT** - Exceeded time limit
- 💾 **MEMORY_ERROR** - Exceeded memory limit
- 🔧 **COMPILE_ERROR** - Syntax error
- 💥 **RUNTIME_ERROR** - Other runtime error

Final grade is calculated as: `(passed_units / total_units) * 100`

## Troubleshooting

### Judge0 not accessible

```bash
# Check if Judge0 containers are running
docker ps | grep judge0

# View Judge0 logs
docker-compose logs judge0

# Restart Judge0
docker-compose restart judge0
```

### Backend can't reach Judge0

**Windows/Mac (Backend in Docker):**
- Ensure `JUDGE0_URL=http://host.docker.internal:2358` in docker-compose.yml

**Linux (Backend in Docker):**
- Use `JUDGE0_URL=http://172.17.0.1:2358` (Docker bridge IP)
- Or add `--add-host=host.docker.internal:host-gateway` to docker run

**Backend outside Docker:**
- Use `JUDGE0_URL=http://localhost:2358`

### Port 2358 already in use

```bash
# Find what's using port 2358
# Mac/Linux:
lsof -i :2358

# Windows:
netstat -ano | findstr :2358

# Change Judge0 port in docker-compose.yml:
ports:
  - "2359:2358"  # Maps host:2359 to container:2358

# Update AutoGrader settings:
export JUDGE0_URL=http://localhost:2359
```

## Language Support

Judge0 supports 60+ languages. For AutoGrader, we primarily use:

- **Python 3** (language_id: 71) - Primary language
- **Java** (language_id: 62)
- **C** (language_id: 50)
- **C++** (language_id: 54)

Full list: https://github.com/judge0/judge0/blob/master/CHANGELOG.md#supported-languages

## Performance Tips

### Parallel Execution

The AutoGrader runs up to 4 test units in parallel by default. Adjust in code:

```python
result = await grade_submission(
    submission_code=student_code,
    test_code=test_code,
    max_workers=8  # Increase for faster grading
)
```

### Resource Limits

Judge0 default limits:
- CPU time: 5 seconds per submission
- Memory: 128 MB per submission

These can be adjusted in the submission payload.

## Additional Resources

- [Judge0 Documentation](https://ce.judge0.com/)
- [Judge0 GitHub](https://github.com/judge0/judge0)
- [Judge0 API Reference](https://ce.judge0.com/#submissions-submission)

## Summary

✅ Judge0 runs locally at `http://localhost:2358`  
✅ AutoGrader backend connects via `host.docker.internal:2358`  
✅ Works on Windows, Mac, and Linux  
✅ No Docker-in-Docker complexity  
✅ Simple to set up and debug

