# Test Splitter Fix - Pytest-Style Functions

## Problem

All submissions were passing 100% even when they were completely wrong.

### Root Cause

The test splitter (`backend/app/services/judge0/test_splitter.py`) was only looking for top-level `assert` statements like:

```python
assert add(2, 3) == 5
assert multiply(4, 5) == 20
```

But the test files in `manual_test_files/` use pytest-style test functions:

```python
def test_add_positive():
    assert add(5, 3) == 8

def test_add_negative():
    assert add(-2, -3) == -5
```

Since the asserts were INSIDE functions (indented), they were never extracted. The test splitter would return the entire test file unchanged, which just contained function definitions without any calls to those functions.

When Judge0 executed this code:
1. Student submission defines functions
2. Test file defines test functions  
3. No functions are called
4. No errors occur
5. Judge0 returns success
6. Everything gets 100% ✅ (incorrectly)

## Solution

Updated `test_splitter.py` to handle pytest-style test functions:

### 1. Added `collect_test_functions()`

Extracts all `def test_*()` functions from the test file with their complete content:

```python
def collect_test_functions(lines: List[str]) -> List[tuple[str, List[str]]]:
    """
    Extract test functions from the test file.
    Returns list of (function_name, function_lines) tuples.
    """
```

### 2. Updated `split_test_code()`

Now handles both pytest functions AND simple assert statements:

```python
# First, create units for pytest-style test functions
if test_functions:
    for func_name, func_lines in test_functions:
        # Include function definition
        unit_lines.extend(func_lines)
        
        # Add a CALL to the function (this was missing!)
        unit_lines.append(f"{func_name}()")
        
        test_units.append("\n".join(unit_lines))
```

### 3. Updated `extract_assert_text()`

Now extracts function names for better display:

```python
# Look for pytest-style function definition
if s.startswith("def test_"):
    func_name = s.split("(")[0].replace("def ", "")
    return func_name  # e.g., "test_add_positive"
```

## How It Works Now

### Input Test File

```python
def test_add_positive():
    assert add(5, 3) == 8

def test_multiply_positive():
    assert multiply(4, 5) == 20
```

### Generated Test Units

**Unit 1:**
```python
# Auto-generated test unit (pytest-style function)

def test_add_positive():
    assert add(5, 3) == 8

# Execute the test
test_add_positive()
```

**Unit 2:**
```python
# Auto-generated test unit (pytest-style function)

def test_multiply_positive():
    assert multiply(4, 5) == 20

# Execute the test
test_multiply_positive()
```

### Combined with Submission

Each unit is combined with the student's submission code:

```python
# Student's submission
def add(a, b):
    return a + b

def multiply(a, b):
    return a * b

# ---- TEST HARNESS ----

def test_add_positive():
    assert add(5, 3) == 8

# Execute the test
test_add_positive()
```

Now the test function is actually CALLED, so the assert executes and can fail!

## Verification

Tested with correct and wrong submissions:

### Correct Submission
```python
def add(a, b):
    return a + b

def multiply(a, b):
    return a * b
```

**Result:** ✅ 100% (2/2 tests passed)

### Wrong Submission
```python
def add(a, b):
    return a * b  # WRONG

def multiply(a, b):
    return a - b  # WRONG
```

**Result:** ❌ 0% (0/2 tests passed, both marked as FAILED_ASSERTION)

## Testing

You can now test with your manual test files:

### 1. Submission that Passes All
```bash
curl -X POST http://localhost:8000/api/v1/assignments/1/submit \
  -F "submission=@manual_test_files/submission_passes_all.py" \
  -H "Authorization: Bearer <student_token>"
```

Expected: 100% (8/8 tests passed)

### 2. Submission that Passes None
```bash
curl -X POST http://localhost:8000/api/v1/assignments/1/submit \
  -F "submission=@manual_test_files/submission_passes_none.py" \
  -H "Authorization: Bearer <student_token>"
```

Expected: 0% (0/8 tests passed)

### 3. Submission that Passes Some
```bash
curl -X POST http://localhost:8000/api/v1/assignments/1/submit \
  -F "submission=@manual_test_files/submission_passes_some.py" \
  -H "Authorization: Bearer <student_token>"
```

Expected: ~50% (4/8 tests passed)

## Files Changed

**Modified:**
- `backend/app/services/judge0/test_splitter.py`
  - Added `collect_test_functions()` - Extracts pytest functions
  - Updated `split_test_code()` - Handles both pytest and simple asserts
  - Updated `collect_assert_lines()` - Only finds top-level asserts
  - Updated `extract_assert_text()` - Better display for pytest functions

**No other changes required!**

The fix is isolated to the test splitter and doesn't affect:
- Judge0 integration
- Grading logic
- Database schema
- Frontend
- Docker setup

## Status

✅ **FIXED AND VERIFIED**

The grading system now correctly:
- Detects pytest-style test functions
- Executes each test individually
- Properly fails wrong submissions
- Properly passes correct submissions
- Shows individual test results with function names

## Commands Used

```bash
# Clear cache
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null

# Restart backend
docker-compose restart backend

# Test via frontend or API
# Results should now show correct pass/fail grades
```

---

**Fix Date:** October 27, 2025  
**Issue:** All submissions passing 100%  
**Root Cause:** Test functions not being called  
**Solution:** Extract and call pytest-style test functions  
**Status:** ✅ Verified working

