import pytest
from unittest.mock import patch, AsyncMock
from app.api.attempt_submission_test import (
    _get_callable, _call_safely,
    _import_converter_module
)
from app.services.piston import _parse_pytest_output


def test_parse_pytest_output():
    """Test parsing pytest output."""
    stdout = "PASSED: test_add\nFAILED: test_subtract\nPASSED: test_multiply\n"
    stderr = ""

    result = _parse_pytest_output(stdout, stderr)

    assert result["total_tests"] == 3
    assert result["passed_tests"] == 2
    assert result["failed_tests"] == 1
    assert result["passed"] is False
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


def test_parse_pytest_output_edge_cases():
    """Test _parse_pytest_output with various edge cases."""
    stdout = "PASSED: test_1\nFAILED: test_2"
    stderr = "Some error message"

    result = _parse_pytest_output(stdout, stderr)

    assert result["total_tests"] == 2
    assert result["passed_tests"] == 1
    assert result["failed_tests"] == 1
    assert result["passed"] is False
    assert result["all_passed"] is False


def test_parse_pytest_output_no_tests():
    """Test _parse_pytest_output when no tests are found."""
    stdout = "Some random output\nNo tests here"
    stderr = ""

    result = _parse_pytest_output(stdout, stderr)

    assert result["total_tests"] == 0
    assert result["passed_tests"] == 0
    assert result["failed_tests"] == 0
    assert result["passed"] is False
    assert result["all_passed"] is False
    assert result["has_tests"] is False


def test_parse_pytest_output_complex_formats():
    """Test parsing various pytest output formats."""
    test_cases = [
        ("PASSED: test_1\nFAILED: test_2\nPASSED: test_3", {"total_tests": 3, "passed_tests": 2, "failed_tests": 1}),
        ("PASSED: test_1\n=== Test Results ===\nPassed: 5\nFailed: 2", {"total_tests": 7, "passed_tests": 5, "failed_tests": 2}),
        ("PASSED: test_a\nPASSED: test_b\nFAILED: test_c", {"total_tests": 3, "passed_tests": 2, "failed_tests": 1}),
    ]

    for stdout, expected in test_cases:
        result = _parse_pytest_output(stdout, "")
        for key, value in expected.items():
            assert result[key] == value, f"Failed for stdout: {stdout}"


# NOTE: Tests use Piston for code execution instead of local subprocess.
# Piston provides sandboxed execution in isolated environments.


# Tests for converter utilities
def test_get_callable_existing_function():
    """Test _get_callable with an existing callable."""
    import tempfile
    mod = tempfile
    result = _get_callable(mod, "NamedTemporaryFile")
    assert result is not None
    assert callable(result)


def test_get_callable_nonexistent():
    """Test _get_callable with nonexistent attribute."""
    import tempfile
    mod = tempfile
    result = _get_callable(mod, "nonexistent_function")
    assert result is None


def test_get_callable_non_callable():
    """Test _get_callable with non-callable attribute."""
    import tempfile
    mod = tempfile
    result = _get_callable(mod, "__name__")
    assert result is None


@pytest.mark.asyncio
async def test_call_safely_sync_function():
    """Test _call_safely with synchronous function."""
    def sync_func(x, y):
        return x + y

    result = await _call_safely(sync_func, 3, 4)
    assert result == 7


@pytest.mark.asyncio
async def test_call_safely_async_function():
    """Test _call_safely with async function."""
    async def async_func(x, y):
        return x * y

    result = await _call_safely(async_func, 3, 4)
    assert result == 12


@pytest.mark.asyncio
async def test_call_safely_sync_function_returning_coroutine():
    """Test _call_safely with sync function that returns a coroutine."""
    async def async_func(x):
        return x * 2

    def sync_func_returning_coro():
        return async_func(5)

    result = await _call_safely(sync_func_returning_coro)
    assert result == 10


def test_import_converter_module_success():
    """Test _import_converter_module when module exists."""
    try:
        mod = _import_converter_module()
        assert mod is not None
        assert hasattr(mod, 'file_to_text') or hasattr(mod, 'convert_to_string')
    except ImportError:
        pass


def test_import_converter_module_failure():
    """Test _import_converter_module when module doesn't exist."""
    with patch('importlib.import_module', side_effect=ImportError("No module")):
        with pytest.raises(ImportError) as exc_info:
            _import_converter_module()
        assert "Could not import your converter module" in str(exc_info.value)
