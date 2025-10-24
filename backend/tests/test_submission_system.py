import subprocess
import pytest
from unittest.mock import patch, AsyncMock, Mock
from app.api.attempt_submission_test import (
    _validate_code_safety, _parse_pytest_output, _get_callable, _call_safely,
    _import_converter_module, _run_with_subprocess
)


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


def test_get_callable():
    """Test _get_callable function."""
    import tempfile
    import sys
    from app.api.attempt_submission_test import _get_callable

    # Create a temporary module
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write("""
def test_function():
    return "test"

class TestClass:
    def test_method(self):
        return "method"
""")
        temp_file = f.name

    try:
        # Import the module
        import importlib.util
        spec = importlib.util.spec_from_file_location("temp_module", temp_file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Test getting a function
        func = _get_callable(module, "test_function")
        assert callable(func)
        assert func() == "test"

        # Test getting a class (not a method, since _get_callable doesn't handle dotted names)
        cls = _get_callable(module, "TestClass")
        assert callable(cls)

        # Test getting non-existent function
        result = _get_callable(module, "non_existent")
        assert result is None

    finally:
        import os
        os.unlink(temp_file)


def test_import_converter_module():
    """Test _import_converter_module function."""
    from app.api.attempt_submission_test import _import_converter_module

    # This function should return a module or None
    result = _import_converter_module()
    # The function may return None if the converter module is not available
    assert result is None or hasattr(result, '__name__')


def test_call_safely():
    """Test _call_safely function."""
    import asyncio
    from app.api.attempt_submission_test import _call_safely

    async def test_function(x, y=10):
        return x + y

    async def failing_function():
        raise ValueError("Test error")

    async def test_call_safely():
        # Test successful call
        result = await _call_safely(test_function, 5, y=15)
        assert result == 20

        # Test call with exception
        try:
            await _call_safely(failing_function)
            assert False, "Should have raised exception"
        except ValueError as e:
            assert str(e) == "Test error"

    asyncio.run(test_call_safely())


def test_run_with_judge0_syntax_error():
    """Test _run_with_judge0 with syntax error in code."""
    import asyncio
    from app.api.attempt_submission_test import _run_with_judge0

    # Code with syntax error
    bad_code = "def test():\n    return invalid syntax here"

    async def run_test():
        # This should return an error result
        result = await _run_with_judge0(bad_code, "")
        assert result["status"]["id"] == 6  # Compilation Error
        assert "SyntaxError" in result["stderr"]

    asyncio.run(run_test())


def test_run_with_judge0_dangerous_code():
    """Test _run_with_judge0 with dangerous code."""
    import asyncio
    from app.api.attempt_submission_test import _run_with_judge0

    # Code with dangerous import
    dangerous_code = """
import os
os.system('echo dangerous')
"""

    async def run_test():
        # This should return an error result due to dangerous code detection
        result = await _run_with_judge0(dangerous_code, "")
        assert result["status"]["id"] == 6  # Compilation Error
        assert "dangerous constructs" in result["stderr"]

    asyncio.run(run_test())


def test_parse_pytest_output_edge_cases():
    """Test _parse_pytest_output with various edge cases."""
    from app.api.attempt_submission_test import _parse_pytest_output

    # Test with stderr content
    stdout = "PASSED: test_1\nFAILED: test_2"
    stderr = "Some error message"

    result = _parse_pytest_output(stdout, stderr)

    assert result["total_tests"] == 2
    assert result["passed_tests"] == 1
    assert result["failed_tests"] == 1
    assert result["all_passed"] is False


def test_parse_pytest_output_no_tests():
    """Test _parse_pytest_output when no tests are found."""
    from app.api.attempt_submission_test import _parse_pytest_output

    stdout = "Some random output\nNo tests here"
    stderr = ""

    result = _parse_pytest_output(stdout, stderr)

    assert result["total_tests"] == 0
    assert result["passed_tests"] == 0
    assert result["failed_tests"] == 0
    assert result["all_passed"] is False
    assert result["has_tests"] is False


def test_parse_pytest_output_complex_formats():
    """Test parsing various pytest output formats."""
    from app.api.attempt_submission_test import _parse_pytest_output

    # Test with different formats that the function actually handles
    test_cases = [
        # Individual test results (main format the function handles)
        ("PASSED: test_1\nFAILED: test_2\nPASSED: test_3", {"total_tests": 3, "passed_tests": 2, "failed_tests": 1}),
        # With summary section (overrides individual counts)
        ("PASSED: test_1\n=== Test Results ===\nPassed: 5\nFailed: 2", {"total_tests": 7, "passed_tests": 5, "failed_tests": 2}),
        # No summary, just individual results
        ("PASSED: test_a\nPASSED: test_b\nFAILED: test_c", {"total_tests": 3, "passed_tests": 2, "failed_tests": 1}),
    ]

    for stdout, expected in test_cases:
        result = _parse_pytest_output(stdout, "")
        for key, value in expected.items():
            assert result[key] == value, f"Failed for stdout: {stdout}"

def test_validate_code_safety_edge_cases():
    """Test AST validation with various edge cases."""
    from app.api.attempt_submission_test import _validate_code_safety
    import ast

    # Test with various dangerous constructs
    dangerous_cases = [
        "exec('print(1)')",  # exec call
        "__import__('os')",  # __import__ call
        "eval('2+2')",       # eval call
        "open('file.txt')",  # file operations
        "import os; os.system('ls')",  # os.system
        "import subprocess; subprocess.call(['ls'])",  # subprocess
    ]

    for code in dangerous_cases:
        tree = ast.parse(code)
        with pytest.raises(ValueError, match="dangerous constructs"):
            _validate_code_safety(tree)

    # Test safe code
    safe_cases = [
        "x = 1 + 2",
        "def func(): return True",
        "print('hello')",
        "import math; math.sqrt(4)",
    ]

    for code in safe_cases:
        tree = ast.parse(code)
        # Should not raise any exception
        _validate_code_safety(tree)

# NOTE: Subprocess-based tests have been removed since we now use Judge0 for code execution.
# Judge0 provides better security and isolation than local subprocess execution.
# The AST validation tests above are still relevant as they run before code is sent to Judge0.


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
    # This should work since we have the file_converter module
    try:
        mod = _import_converter_module()
        assert mod is not None
        assert hasattr(mod, 'file_to_text') or hasattr(mod, 'convert_to_string')
    except ImportError:
        # If the module doesn't exist, that's fine for this test
        pass


def test_import_converter_module_failure():
    """Test _import_converter_module when module doesn't exist."""
    # Mock the import to fail
    with patch('importlib.import_module', side_effect=ImportError("No module")):
        with pytest.raises(ImportError) as exc_info:
            _import_converter_module()
        assert "Could not import your converter module" in str(exc_info.value)


# Tests for subprocess execution (not currently used but still in codebase)
def test_run_with_subprocess_success():
    """Test _run_with_subprocess with successful execution."""
    code = "def add(a, b):\n    return a + b\n"
    tests = "def test_add():\n    assert add(1, 2) == 3\n    print('PASSED: test_add')\n\ndef test_fail():\n    assert add(1, 2) == 4\n    print('PASSED: test_fail')\n"

    expected_output = "PASSED: test_add\nFAILED: test_fail - AssertionError\n\n=== Test Results ===\nPassed: 1\nFailed: 1\nTotal: 2"

    with patch('subprocess.run') as mock_run:
        mock_run.return_value = type('MockResult', (), {
            'stdout': expected_output,
            'stderr': '',
            'returncode': 0
        })()

        result = _run_with_subprocess(code, tests)

        assert result['returncode'] == 0
        assert result['status']['id'] == 3  # Accepted
        assert result['grading']['passed_tests'] == 1
        assert result['grading']['failed_tests'] == 1
        assert result['grading']['total_tests'] == 2
        mock_run.assert_called_once()


def test_run_with_subprocess_syntax_error():
    """Test _run_with_subprocess with syntax error in code."""
    code = "def add(a, b\n    return a + b"  # Missing closing parenthesis
    tests = "def test_add():\n    assert add(1, 2) == 3\n"

    result = _run_with_subprocess(code, tests)

    assert result['returncode'] == 1
    assert result['status']['id'] == 6  # Compilation error
    assert 'SyntaxError' in result['stderr']


def test_run_with_subprocess_dangerous_code():
    """Test _run_with_subprocess with dangerous code."""
    code = "import os\nos.system('rm -rf /')"  # Dangerous import
    tests = "def test_something():\n    pass\n"

    result = _run_with_subprocess(code, tests)

    assert result['returncode'] == 1
    assert result['status']['id'] == 6  # Compilation error
    assert 'dangerous' in result['stderr'].lower()


def test_run_with_subprocess_timeout():
    """Test _run_with_subprocess with timeout."""
    code = "def infinite_loop():\n    while True:\n        pass\n"
    tests = "def test_loop():\n    infinite_loop()\n"

    with patch('subprocess.run', side_effect=subprocess.TimeoutExpired(['python'], 10)):
        result = _run_with_subprocess(code, tests)

        assert result['returncode'] == -1
        assert result['status']['id'] == 5  # Time Limit Exceeded
        assert 'Timeout' in result['stderr']


def test_run_with_subprocess_subprocess_error():
    """Test _run_with_subprocess with subprocess error."""
    code = "def add(a, b):\n    return a + b\n"
    tests = "def test_add():\n    assert add(1, 2) == 3\n"

    with patch('subprocess.run', side_effect=Exception("Subprocess failed")):
        result = _run_with_subprocess(code, tests)

        assert result['returncode'] == -1
        assert result['status']['id'] == 13  # Internal Error
        assert 'Subprocess failed' in result['stderr']


# Tests for bridge submission
@pytest.mark.asyncio
async def test_submit_to_bridge_success():
    """Test _submit_to_bridge with successful response."""
    import os
    from app.api.attempt_submission_test import _submit_to_bridge

    expected_response = {
        "stdout": "PASSED: test_example",
        "stderr": "",
        "compile_output": "",
        "returncode": 0,
        "status": {"id": 3},
        "time": 0.1,
        "memory": 1024,
        "language_id_used": 71,
        "grading": {"total_tests": 1, "passed_tests": 1, "failed_tests": 0}
    }

    with patch('httpx.AsyncClient') as mock_client:
        mock_response = Mock()
        mock_response.json = Mock(return_value=expected_response)
        mock_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        with patch.dict(os.environ, {"BRIDGE_URL": "http://localhost:5000"}):
            result = await _submit_to_bridge("code", "tests", "job1")

            assert result == expected_response
            mock_client.return_value.__aenter__.return_value.post.assert_called_once_with(
                "http://localhost:5000/grade",
                json={
                    "submission_code": "code",
                    "test_code": "tests",
                    "job_name": "job1"
                }
            )


@pytest.mark.asyncio
async def test_submit_to_bridge_default_job_name():
    """Test _submit_to_bridge with default job name."""
    import os
    from app.api.attempt_submission_test import _submit_to_bridge

    with patch('httpx.AsyncClient') as mock_client:
        mock_response = Mock()
        mock_response.json = Mock(return_value={"result": "success"})
        mock_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        with patch.dict(os.environ, {"BRIDGE_URL": "http://localhost:5000"}):
            await _submit_to_bridge("code", "tests")

            # Check that default job_name was used
            call_args = mock_client.return_value.__aenter__.return_value.post.call_args
            assert call_args[1]["json"]["job_name"] == "job"


@pytest.mark.asyncio
async def test_submit_to_bridge_http_error():
    """Test _submit_to_bridge with HTTP error."""
    import os
    from app.api.attempt_submission_test import _submit_to_bridge

    with patch('httpx.AsyncClient') as mock_client:
        mock_response = Mock()
        mock_response.raise_for_status = Mock(side_effect=Exception("HTTP 500"))

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        with patch.dict(os.environ, {"BRIDGE_URL": "http://localhost:5000"}):
            with pytest.raises(Exception, match="HTTP 500"):
                await _submit_to_bridge("code", "tests")


@pytest.mark.asyncio
async def test_submit_to_bridge_default_url():
    """Test _submit_to_bridge with default URL when BRIDGE_URL not set."""
    import os
    from app.api.attempt_submission_test import _submit_to_bridge

    with patch('httpx.AsyncClient') as mock_client:
        mock_response = Mock()
        mock_response.json = Mock(return_value={"result": "success"})
        mock_response.raise_for_status = Mock()

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        # Ensure BRIDGE_URL is not set
        with patch.dict(os.environ, {}, clear=True):
            await _submit_to_bridge("code", "tests")

            # Check that default URL was used
            call_args = mock_client.return_value.__aenter__.return_value.post.call_args
            assert call_args[0][0] == "http://localhost:5001/grade"