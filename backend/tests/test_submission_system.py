import pytest
from app.api.attempt_submission_test import _validate_code_safety, _run_with_subprocess, _parse_pytest_output


def test_validate_code_safety_safe_code():
    """Test that safe code passes validation."""
    import ast

    safe_code = """
def add(a, b):
    return a + b

result = add(2, 3)
"""

    tree = ast.parse(safe_code)
    # Should not raise any exception
    _validate_code_safety(tree)


def test_validate_code_safety_dangerous_import():
    """Test that dangerous imports are blocked."""
    import ast

    dangerous_code = """
import os
os.system('ls')
"""

    tree = ast.parse(dangerous_code)
    with pytest.raises(ValueError, match="dangerous constructs"):
        _validate_code_safety(tree)


def test_validate_code_safety_dangerous_function():
    """Test that dangerous functions are blocked."""
    import ast

    dangerous_code = """
result = eval("2+2")
"""

    tree = ast.parse(dangerous_code)
    with pytest.raises(ValueError, match="dangerous constructs"):
        _validate_code_safety(tree)


def test_validate_code_safety_file_operations():
    """Test that file operations are blocked."""
    import ast

    dangerous_code = """
with open('file.txt', 'w') as f:
    f.write('test')
"""

    tree = ast.parse(dangerous_code)
    with pytest.raises(ValueError, match="dangerous constructs"):
        _validate_code_safety(tree)


def test_parse_pytest_output():
    """Test parsing pytest output."""
    stdout = "PASSED: test_add\nFAILED: test_subtract\nPASSED: test_multiply\n"
    stderr = ""

    result = _parse_pytest_output(stdout, stderr)

    assert result["total_tests"] == 3
    assert result["passed_tests"] == 2
    assert result["failed_tests"] == 1
    assert result["all_passed"] is False


def test_parse_pytest_output_with_summary():
    """Test parsing pytest output with summary section."""
    stdout = """
PASSED: test_add
FAILED: test_subtract

=== Results ===
Passed: 1
Failed: 1
Total: 2
"""
    stderr = ""

    result = _parse_pytest_output(stdout, stderr)

    assert result["total_tests"] == 2
    assert result["passed_tests"] == 1
    assert result["failed_tests"] == 1
    assert result["all_passed"] is False


def test_run_with_subprocess_syntax_error():
    """Test handling of syntax errors in student code."""
    invalid_code = """
def add(a, b)
    return a + b  # Missing colon
"""

    result = _run_with_subprocess(invalid_code, "def test_dummy(): pass")

    assert result["returncode"] == 1
    assert "SyntaxError" in result["stderr"]
    assert result["status"]["id"] == 6  # Compilation error


def test_run_with_subprocess_security_violation():
    """Test handling of security violations in student code."""
    dangerous_code = """
import os
os.system('echo test')
"""

    result = _run_with_subprocess(dangerous_code, "def test_dummy(): pass")

    assert result["returncode"] == 1
    assert "dangerous constructs" in result["stderr"]
    assert result["status"]["id"] == 6  # Compilation error


def test_import_converter_module():
    """Test converter module import functionality."""
    from app.api.attempt_submission_test import _import_converter_module

    # This should not raise an exception
    converter = _import_converter_module()
    assert converter is not None

def test_validate_code_safety_no_violations():
    """Test that safe code passes validation without raising exceptions."""
    from app.api.attempt_submission_test import _validate_code_safety
    import ast

    safe_code = """
def add(a, b):
    return a + b

result = add(2, 3)
"""

    tree = ast.parse(safe_code)
    # Should not raise any exception
    _validate_code_safety(tree)

def test_validate_code_safety_eval_detected():
    """Test that eval() calls are detected."""
    from app.api.attempt_submission_test import _validate_code_safety
    import ast

    dangerous_code = """
result = eval("2+2")
"""

    tree = ast.parse(dangerous_code)
    with pytest.raises(ValueError, match="dangerous constructs"):
        _validate_code_safety(tree)

def test_validate_code_safety_import_from_detected():
    """Test that dangerous from imports are detected."""
    from app.api.attempt_submission_test import _validate_code_safety
    import ast

    dangerous_code = """
from os import system
system('ls')
"""

    tree = ast.parse(dangerous_code)
    with pytest.raises(ValueError, match="dangerous constructs"):
        _validate_code_safety(tree)

def test_run_with_subprocess_resource_limits():
    """Test that resource limits are attempted to be set."""
    # This test mainly ensures the resource limit code path is executed
    # (though it may not actually work on Windows)
    safe_code = """
def test_example():
    return 42
"""

    result = _run_with_subprocess(safe_code, "def test_dummy(): pass")
    # The code should run successfully regardless of resource limits
    assert result["returncode"] == 0

def test_parse_pytest_output_edge_cases():
    """Test parsing pytest output with various edge cases."""
    # Test with no PASSED/FAILED lines
    stdout = "Some other output\n=== Results ===\nPassed: 0\nFailed: 0\nTotal: 0"
    stderr = ""
    result = _parse_pytest_output(stdout, stderr)
    assert result["total_tests"] == 0
    assert result["passed_tests"] == 0
    assert result["failed_tests"] == 0

    # Test with malformed summary
    stdout = "PASSED: test1\nFAILED: test2\n=== Results ===\nPassed: invalid\nFailed: 1\nTotal: 2"
    result = _parse_pytest_output(stdout, stderr)
    assert result["total_tests"] == 2
    assert result["passed_tests"] == 1  # Found 1 PASSED
    assert result["failed_tests"] == 1  # Found 1 FAILED

def test_run_with_subprocess_timeout():
    """Test handling of code that runs too long."""
    # Use a sleep that's longer than our timeout
    slow_code = """
import time
time.sleep(20)  # This will timeout
"""

    result = _run_with_subprocess(slow_code, "def test_dummy(): pass")

    assert result["returncode"] == -1
    assert "Timeout" in result["stderr"]
    assert result["status"]["id"] == 5  # Time limit exceeded


def test_run_with_subprocess_success():
    """Test successful execution of valid code."""
    valid_code = """
def add(a, b):
    return a + b

def subtract(a, b):
    return a - b
"""

    test_code = """
def test_add():
    assert add(2, 3) == 5

def test_subtract():
    assert subtract(5, 3) == 2
"""

    result = _run_with_subprocess(valid_code, test_code)

    assert result["returncode"] == 0
    assert result["status"]["id"] == 3  # Accepted
    assert "PASSED: test_add" in result["stdout"]
    assert "PASSED: test_subtract" in result["stdout"]
    assert "grading" in result


def test_run_with_subprocess_empty_tests():
    """Test handling when no tests are provided."""
    valid_code = """
def add(a, b):
    return a + b
"""

    empty_test_code = ""

    result = _run_with_subprocess(valid_code, empty_test_code)

    assert result["returncode"] == 0
    # Should still execute but with no tests found
    assert "grading" in result

def test_parse_pytest_output_malformed_lines():
    """Test parsing pytest output with malformed lines."""
    stdout = "PASSED: test_add\nFailed: not_a_number\nTotal: also_not_a_number\n"
    stderr = ""

    result = _parse_pytest_output(stdout, stderr)

    # Should handle parsing errors gracefully
    assert result["total_tests"] == 1  # Falls back to passed + failed = 1 + 0
    assert result["passed_tests"] == 1  # Successfully parsed passed
    assert result["failed_tests"] == 0  # Failed to parse failed, defaults to 0
    assert result["all_passed"] is True  # 0 failed tests and total > 0

def test_run_with_subprocess_empty_code():
    """Test handling of empty student code."""
    empty_code = ""

    result = _run_with_subprocess(empty_code, "def test_dummy(): pass")

    # Should still validate and run, but code will be empty
    assert result["returncode"] == 0
    assert "grading" in result

def test_run_with_subprocess_large_code():
    """Test handling of large code submissions."""
    large_code = "# Large comment\n" * 1000 + "def test_func(): return True"

    result = _run_with_subprocess(large_code, "def test_dummy(): pass")

    # Should handle large code without issues
    assert result["returncode"] == 0
    assert "grading" in result

def test_run_with_subprocess_syntax_in_tests():
    """Test handling of syntax errors in test cases."""
    valid_code = "def add(a, b): return a + b"

    invalid_test_code = """
def test_add():
    assert add(2, 3) == 5
def invalid syntax here:
    pass
"""

    result = _run_with_subprocess(valid_code, invalid_test_code)

    # Should handle test syntax errors
    assert result["returncode"] == 1  # Syntax error in tests
    assert "Syntax Error" in result["stderr"] or "grading" in result

def test_run_with_subprocess_complex_tests():
    """Test with more complex test scenarios."""
    code = """
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

def is_prime(n):
    if n <= 1:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True
"""

    test_code = """
def test_factorial():
    assert factorial(0) == 1
    assert factorial(1) == 1
    assert factorial(5) == 120

def test_is_prime():
    assert is_prime(2) == True
    assert is_prime(3) == True
    assert is_prime(4) == False
    assert is_prime(9) == False
"""

    result = _run_with_subprocess(code, test_code)

    assert result["returncode"] == 0
    assert "PASSED: test_factorial" in result["stdout"]
    assert "PASSED: test_is_prime" in result["stdout"]
    assert result["grading"]["passed_tests"] == 2
    assert result["grading"]["failed_tests"] == 0
