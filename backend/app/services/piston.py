# backend/app/services/piston.py
from typing import Any, Dict, Optional
import httpx
from app.core.settings import settings


async def _ensure_python312() -> str:
    """Ensure Python 3.12 exists on Piston. Return resolved version (e.g., '3.12.0') or '3.12.x' selector."""
    base = settings.PISTON_URL.rstrip("/")
    want = "3.12.x"
    async with httpx.AsyncClient(timeout=30.0) as client:
        # check
        try:
            r = await client.get(f"{base}/api/v2/runtimes")
            r.raise_for_status()
            for rt in r.json():
                if rt.get("language") == "python" and rt.get("version", "").startswith("3.12"):
                    return rt["version"]
        except Exception:
            pass
        # install (idempotent)
        try:
            r = await client.post(f"{base}/api/v2/packages", json={"language":"python","version":want})
            r.raise_for_status()
        except httpx.HTTPStatusError:
            pass
        # re-check
        r = await client.get(f"{base}/api/v2/runtimes")
        r.raise_for_status()
        for rt in r.json():
            if rt.get("language") == "python" and rt.get("version", "").startswith("3.12"):
                return rt["version"]
    return want  # fall back to selector

def _parse_pytest_output(stdout: str, stderr: str) -> Dict[str, Any]:
    """Parse test output to determine pass/fail status and test counts."""
    combined_output = (stdout or "") + "\n" + (stderr or "")

    lines = combined_output.split('\n')
    passed_tests = 0
    failed_tests = 0
    total_tests = 0

    # Count individual test results
    for line in lines:
        line = line.strip()
        if line.startswith('PASSED:'):
            passed_tests += 1
        elif line.startswith('FAILED:'):
            failed_tests += 1

    # Look for summary section
    in_summary = False
    for line in lines:
        line = line.strip()
        if line == "=== Test Results ===":
            in_summary = True
            continue
        if in_summary:
            if line.startswith('Passed:'):
                try:
                    passed_tests = int(line.split(':')[1].strip())
                except:
                    pass
            elif line.startswith('Failed:'):
                try:
                    failed_tests = int(line.split(':')[1].strip())
                except:
                    pass
            elif line.startswith('Total:'):
                try:
                    total_tests = int(line.split(':')[1].strip())
                except:
                    pass

    # If we didn't get totals from summary, calculate from individual counts
    if total_tests == 0:
        total_tests = passed_tests + failed_tests

    return {
        "total_tests": total_tests,
        "passed_tests": passed_tests,
        "failed_tests": failed_tests,
        "passed": failed_tests == 0 and total_tests > 0,  # Frontend compatibility
        "all_passed": failed_tests == 0 and total_tests > 0,
        "has_tests": total_tests > 0
    }


def _combine_code(student_code: str, test_code: str) -> str:
    """Combine student code and test code with unittest test runner."""
    return f"""import sys
import unittest

# Student code
{student_code}

# Test code
{test_code}

# Convert test functions to unittest test cases
class TestRunner(unittest.TestCase):
    pass

# Dynamically add test methods
test_functions = [obj for name, obj in globals().items()
                  if name.startswith('test_') and callable(obj)]

for test_func in test_functions:
    # Bind the test function as a method to the TestCase class
    # Use a closure to capture the specific function
    def make_test(func):
        return lambda self: func()
    setattr(TestRunner, test_func.__name__, make_test(test_func))

if __name__ == "__main__":
    # Run tests with unittest
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestRunner)
    runner = unittest.TextTestRunner(stream=sys.stdout, verbosity=2)
    result = runner.run(suite)
    
    # Print summary in our format
    print(f"\\n=== Test Results ===")
    print(f"Passed: {{result.testsRun - len(result.failures) - len(result.errors)}}")
    print(f"Failed: {{len(result.failures) + len(result.errors)}}")
    print(f"Total: {{result.testsRun}}")
    
    # Exit with appropriate code
    sys.exit(0 if result.wasSuccessful() else 1)
"""


def _map_status_to_judge0(returncode: int, timed_out: bool = False) -> int:
    """
    Map Piston execution result to Judge0-compatible status IDs.
    Maintains compatibility with existing grading logic.
    """
    if timed_out:
        return 5  # Time Limit Exceeded
    if returncode == 0:
        return 3  # Accepted
    return 4  # Wrong Answer


async def _get_python_version() -> str:
    return await _ensure_python312()


async def execute_code(
    student_code: str,
    test_code: str,
    timeout_ms: int = 3000
) -> Dict[str, Any]:
    """
    Execute student code with tests using Piston API.
    
    Args:
        student_code: The student's submission code
        test_code: The test code to run
        timeout_ms: Execution timeout in milliseconds
        
    Returns:
        Dictionary with execution results in Judge0-compatible format
    """
    piston_url = settings.PISTON_URL
    
    # Combine code
    combined_code = _combine_code(student_code, test_code)
    
    # Get available Python version (or install if needed)
    python_version = await _get_python_version()
    
    # Piston API v2 execute endpoint
    # See: https://github.com/engineer-man/piston
    execute_url = f"{piston_url}/api/v2/execute"
    
    # Build request body for Piston
    # Piston has a max run_timeout of 3000ms, so cap it
    capped_timeout = min(timeout_ms, 3000)
    
    request_body = {
        "language": "python",
        "version": python_version,
        "files": [
            {
                "name": "main.py",
                "content": combined_code
            }
        ],
        "stdin": "",
        "args": [],
        "compile_timeout": 10000,
        "run_timeout": capped_timeout,
        "compile_memory_limit": -1,
        "run_memory_limit": -1
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(execute_url, json=request_body)
            if response.status_code == 400 and "runtime is unknown" in (response.text or ""):
                # race or fresh volume: install and retry once
                request_body["version"] = await _ensure_python312()
                response = await client.post(execute_url, json=request_body)
            response.raise_for_status()
            result = response.json()
            
            # Extract Piston response
            stdout = result.get("run", {}).get("stdout", "")
            stderr = result.get("run", {}).get("stderr", "")
            code = result.get("run", {}).get("code", -1)
            timed_out = "Timed out" in stderr or result.get("run", {}).get("signal", "") == "SIGKILL"
            
            # Parse test output for grading
            grading = _parse_pytest_output(stdout, stderr)
            
            # Build response in Judge0-compatible format
            return {
                "stdout": stdout,
                "stderr": stderr,
                "returncode": code,
                "status": {"id": _map_status_to_judge0(code, timed_out)},
                "time": None,  # Piston doesn't provide precise timing
                "memory": None,  # Piston doesn't provide precise memory
                "language_id_used": 71,  # Python 3
                "grading": grading
            }
            
    except httpx.TimeoutException:
        return {
            "stdout": "",
            "stderr": "Timeout: Code execution took too long",
            "returncode": -1,
            "status": {"id": 5},  # Time Limit Exceeded
            "time": None,
            "memory": None,
            "language_id_used": 71,
            "grading": {"total_tests": 0, "passed_tests": 0, "failed_tests": 0, "passed": False, "all_passed": False, "has_tests": False}
        }
    except httpx.HTTPStatusError as e:
        return {
            "stdout": "",
            "stderr": f"Piston API error: {e.response.status_code} - {e.response.text[:200]}",
            "returncode": -1,
            "status": {"id": 13},  # Internal Error
            "time": None,
            "memory": None,
            "language_id_used": 71,
            "grading": {"total_tests": 0, "passed_tests": 0, "failed_tests": 0, "passed": False, "all_passed": False, "has_tests": False}
        }
    except Exception as e:
        return {
            "stdout": "",
            "stderr": f"Execution error: {str(e)}",
            "returncode": -1,
            "status": {"id": 13},  # Internal Error
            "time": None,
            "memory": None,
            "language_id_used": 71,
            "grading": {"total_tests": 0, "passed_tests": 0, "failed_tests": 0, "passed": False, "all_passed": False, "has_tests": False}
        }


async def get_runtimes() -> Dict[str, Any]:
    """
    Fetch available runtimes from Piston API.
    
    Returns:
        Dictionary with available languages and versions
    """
    piston_url = settings.PISTON_URL
    runtimes_url = f"{piston_url}/api/v2/runtimes"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(runtimes_url)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        return {"error": str(e)}

