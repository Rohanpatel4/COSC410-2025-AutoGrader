# Calculator Demo

A basic calculator implementation scenario for testing the autograder system.

## Test Suite

**File**: `tests/calculator_basic.py`

Contains 10 test functions, each worth 10 points (100 points total):
- `test_add_positive` - Addition with positive numbers
- `test_add_negative` - Addition with negative numbers
- `test_subtract_positive` - Subtraction with positive numbers
- `test_subtract_negative` - Subtraction with negative numbers
- `test_multiply_positive` - Multiplication with positive numbers
- `test_multiply_negative` - Multiplication with negative numbers
- `test_divide_positive` - Division with positive numbers
- `test_divide_negative` - Division with negative numbers
- `test_power` - Exponentiation
- `test_modulo` - Modulo operation

## Submission Files

Six reference implementations with varying correctness:

| File | Score | Description |
|------|-------|-------------|
| `grade_100.py` | 100% | Perfect implementation of all functions |
| `grade_80.py` | 80% | Correct except power and modulo |
| `grade_60.py` | 60% | Only add and subtract work correctly |
| `grade_40.py` | 40% | Only add works correctly |
| `grade_20.py` | 20% | Only add works, all others return wrong values |
| `grade_00.py` | 0% | All functions return 0 |

## Usage

### Manual Testing

1. Create an assignment in a course
2. Upload `tests/calculator_basic.py` as the test file
3. Submit any of the `submissions/grade_*.py` files
4. Verify the grade matches the expected score

### Automated Demo

Use the `seed_prof_demo.py` script to create a full demo environment with:
- MATH-123 course with 15 students and 1 calculator assignment
- COSC-235 course with 4 students and 2 assignments (including calculator)
- Randomized submissions for all students

```bash
cd backend
PYTHONPATH=. python3 scripts/seed_prof_demo.py
```

## Required Functions

Student submissions must implement:
- `add(a, b)` - Return a + b
- `subtract(a, b)` - Return a - b
- `multiply(a, b)` - Return a * b
- `divide(a, b)` - Return a / b
- `power(a, b)` - Return a ** b
- `modulo(a, b)` - Return a % b

