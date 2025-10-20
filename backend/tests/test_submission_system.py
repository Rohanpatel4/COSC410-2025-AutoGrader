import pytest
from app.api.attempt_submission_test import _validate_code_safety, _parse_pytest_output


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


# NOTE: Subprocess-based tests have been removed since we now use Judge0 for code execution.
# Judge0 provides better security and isolation than local subprocess execution.
# The AST validation tests above are still relevant as they run before code is sent to Judge0.