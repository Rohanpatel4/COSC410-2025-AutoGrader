# Imports for test harness
import sys
import io
import traceback

# Save original stdout/stderr
_original_stdout = sys.stdout
_original_stderr = sys.stderr

# Capture any output from student code loading
_student_code_output = io.StringIO()
_student_code_error = io.StringIO()

sys.stdout = _student_code_output
sys.stderr = _student_code_error

_student_code_loaded = False
try:
    # Student code starts here
    exec('''
$student_code
''', globals())
    _student_code_loaded = True
except Exception as _load_err:
    print(f"Error: {_load_err}", file=_student_code_error)

sys.stdout = _original_stdout
sys.stderr = _original_stderr

# Print the dry run output (student code execution output)
_dry_run_out = _student_code_output.getvalue()
_dry_run_err = _student_code_error.getvalue()
if _dry_run_out or _dry_run_err:
    print("=== Console Output ===")
    if _dry_run_out:
        print(_dry_run_out, end='')
    if _dry_run_err:
        print(_dry_run_err, end='')
    print("=== End Console Output ===")

# Test results tracking
test_results = []

# Only run tests if student code loaded successfully
if _student_code_loaded:
$test_execution_code


# Summary output
passed = sum(1 for r in test_results if r["passed"])
failed = len(test_results) - passed
earned = sum(r["points"] for r in test_results if r["passed"])
total = sum(r["points"] for r in test_results)

print("\n=== Test Results ===")
print(f"Passed: {passed}")
print(f"Failed: {failed}")
print(f"Total: {len(test_results)}")
print(f"Earned: {earned}")
print(f"TotalPoints: {total}")

