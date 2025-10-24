# Manual Test Files

This folder contains test files for manually testing the assignment submission system.

## Files

### 1. `test_calculator.py` (Test Cases)
Upload this file as the test case when creating an assignment.
- Contains 8 test functions testing calculator operations
- Tests: add, multiply, subtract, divide

### 2. `submission_passes_all.py` (Perfect Solution)
Student submission that passes ALL 8 tests.
- Expected Grade: **100/100**
- Expected Result: 8 passed, 0 failed

### 3. `submission_passes_some.py` (Partial Solution)
Student submission that passes SOME tests (4 out of 8).
- Expected Grade: **0/100** (current grading logic)
- Expected Result: 4 passed, 4 failed
- Correct: `add()`, `subtract()`
- Wrong: `multiply()`, `divide()`

### 4. `submission_passes_none.py` (Wrong Solution)
Student submission that passes NO tests (0 out of 8).
- Expected Grade: **0/100**
- Expected Result: 0 passed, 8 failed
- All functions have wrong implementations

## How to Test Manually

### Step 1: Create an Assignment
```bash
curl -X POST http://localhost:8000/api/v1/courses/1/assignments \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Calculator Assignment",
    "description": "Implement basic calculator functions",
    "sub_limit": 10
  }'
```

Note the assignment ID returned (e.g., assignment ID 5).

### Step 2: Upload Test File
```bash
curl -X POST http://localhost:8000/api/v1/assignments/5/test-file \
  -F "file=@manual_test_files/test_calculator.py"
```

### Step 3: Submit Each Student Solution

**Perfect Solution (should get 100):**
```bash
curl -X POST http://localhost:8000/api/v1/assignments/5/submit \
  -F "submission=@manual_test_files/submission_passes_all.py" \
  -F "student_id=201"
```

**Partial Solution (should get 0, but shows 4/8 passed):**
```bash
curl -X POST http://localhost:8000/api/v1/assignments/5/submit \
  -F "submission=@manual_test_files/submission_passes_some.py" \
  -F "student_id=202"
```

**Wrong Solution (should get 0, shows 0/8 passed):**
```bash
curl -X POST http://localhost:8000/api/v1/assignments/5/submit \
  -F "submission=@manual_test_files/submission_passes_none.py" \
  -F "student_id=201"
```

### Step 4: Check Results
```bash
# View all grades for the assignment
curl "http://localhost:8000/api/v1/assignments/5/grades"

# View specific student's attempts
curl "http://localhost:8000/api/v1/assignments/5/attempts?student_id=201"
```

## Expected Test Results

| File | Tests Passed | Tests Failed | Grade | Status |
|------|--------------|--------------|-------|--------|
| `submission_passes_all.py` | 8/8 | 0/8 | 100 | ✅ All Correct |
| `submission_passes_some.py` | 4/8 | 4/8 | 0 | ⚠️ Partially Correct |
| `submission_passes_none.py` | 0/8 | 8/8 | 0 | ❌ All Wrong |

## Notes
- Current grading logic: 100 if all tests pass, 0 otherwise
- The system correctly identifies which specific tests pass/fail
- All submissions are stored in the database with their grade
- Students can submit multiple times (controlled by `sub_limit`)

