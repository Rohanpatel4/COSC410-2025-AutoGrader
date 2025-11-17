# Student code
$student_code

# Test results tracking
test_results = []

# Test execution
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

