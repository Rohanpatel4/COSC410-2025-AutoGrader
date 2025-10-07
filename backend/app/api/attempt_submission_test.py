# backend/app/api/attempt_submission_test.py
from typing import Any, Dict
import importlib, inspect

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from starlette import status
from app.core.settings import settings

# ----- converter import (robust) -----
def _import_converter_module():
    candidates = [
        "app.services.file_converter",
        "app.services.FileConverter",
        "app.services.filecoverter",
        "app.services.converter",
    ]
    last_err = None
    for mod in candidates:
        try:
            return importlib.import_module(mod)
        except (ModuleNotFoundError, ImportError) as e:
            last_err = e
    raise ImportError(
        "Could not import your converter module. Tried: "
        + ", ".join(candidates)
        + ". Ensure backend/app/services/file_converter.py exists and exports file_to_text(UploadFile)."
    ) from last_err

fc = _import_converter_module()

def _get_callable(mod, name: str):
    obj = getattr(mod, name, None)
    return obj if callable(obj) else None

async def _call_safely(fn, *args, **kwargs):
    if inspect.iscoroutinefunction(fn):
        return await fn(*args, **kwargs)
    res = fn(*args, **kwargs)
    if inspect.iscoroutine(res):
        return await res
    return res

# ----- Judge0 runner (Python 3.8.1 = id 71) -----
PYTHON_LANG_ID = 71

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
        "all_passed": failed_tests == 0 and total_tests > 0,
        "has_tests": total_tests > 0
    }

def _run_with_subprocess(code: str, tests: str) -> Dict[str, Any]:
    """Execute code using subprocess instead of Judge0 for more reliable execution."""
    import subprocess
    import tempfile
    import os
    import resource

    # Create combined code
    combined_code = f"""import sys

# Student code
{code}

# Test code
{tests}

# Simple test runner
def run_tests():
    passed = 0
    failed = 0

    # Get all test functions
    test_functions = [obj for name, obj in globals().items()
                     if name.startswith('test_') and callable(obj)]

    for test_func in test_functions:
        try:
            test_func()
            print(f"PASSED: {{test_func.__name__}}")
            passed += 1
        except Exception as e:
            print(f"FAILED: {{test_func.__name__}} - {{e}}")
            failed += 1

    print(f"\\n=== Test Results ===")
    print(f"Passed: {{passed}}")
    print(f"Failed: {{failed}}")
    print(f"Total: {{passed + failed}}")
    return passed, failed

if __name__ == "__main__":
    run_tests()
"""

    # Create temporary file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(combined_code)
        temp_file = f.name

    try:
        # Set resource limits for safety
        def set_limits():
            # 5 second CPU time limit
            resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
            # 100MB memory limit
            resource.setrlimit(resource.RLIMIT_AS, (100 * 1024 * 1024, 100 * 1024 * 1024))
            # No forking
            resource.setrlimit(resource.RLIMIT_NPROC, (0, 0))

        # Run the code
        result = subprocess.run(
            ['python3', temp_file],
            capture_output=True,
            text=True,
            timeout=10,
            preexec_fn=set_limits if os.name != 'nt' else None  # Only on Unix-like systems
        )

        result_dict = {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "status": {"id": 3 if result.returncode == 0 else 4},  # 3=Accepted, 4=Wrong Answer
            "time": None,
            "memory": None,
            "language_id_used": PYTHON_LANG_ID
        }

        # Add grading analysis
        grading = _parse_pytest_output(result.stdout, result.stderr)
        result_dict["grading"] = grading

        return result_dict

    except subprocess.TimeoutExpired:
        result_dict = {
            "stdout": "",
            "stderr": "Timeout: Code execution took too long",
            "returncode": -1,
            "status": {"id": 5},  # Time Limit Exceeded
            "time": None,
            "memory": None,
            "language_id_used": PYTHON_LANG_ID
        }
        # No grading for timeout
        result_dict["grading"] = {"total_tests": 0, "passed_tests": 0, "failed_tests": 0, "all_passed": False, "has_tests": False}
        return result_dict
    except Exception as e:
        result_dict = {
            "stdout": "",
            "stderr": f"Execution error: {e}",
            "returncode": -1,
            "status": {"id": 13},  # Internal Error
            "time": None,
            "memory": None,
            "language_id_used": PYTHON_LANG_ID
        }
        # No grading for execution error
        result_dict["grading"] = {"total_tests": 0, "passed_tests": 0, "failed_tests": 0, "all_passed": False, "has_tests": False}
        return result_dict
    finally:
        # Clean up temp file
        try:
            os.unlink(temp_file)
        except:
            pass

router = APIRouter(tags=["attempts"])

@router.post("", status_code=status.HTTP_201_CREATED)
async def attempt_submission_test(
    submission: UploadFile = File(..., description="Student .py submission"),
    test_case: str = Form(..., description="Test case code (text)"),
):
    # 1) Validate
    if not submission.filename or not submission.filename.lower().endswith(".py"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only .py files are accepted.")

    # 2) Convert UploadFile -> str
    try:
        conv = _get_callable(fc, "file_to_text")
        if conv:
            student_code = await _call_safely(conv, submission)
        else:
            sub_bytes = await submission.read()
            # fallbacks
            alt1 = _get_callable(fc, "py_bytes_to_string")
            alt2 = _get_callable(fc, "convert_py_bytes_to_string")
            alt3 = _get_callable(fc, "convert_to_string")
            if alt1:
                student_code = await _call_safely(alt1, submission.filename, sub_bytes)
            elif alt2:
                student_code = await _call_safely(alt2, submission.filename, sub_bytes)
            elif alt3:
                student_code = await _call_safely(alt3, sub_bytes)
            else:
                student_code = sub_bytes.decode("utf-8", errors="strict")

        if not isinstance(student_code, str):
            raise TypeError("converter did not return str")
        if not student_code.strip():
            raise ValueError("submission is empty after conversion")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Submission conversion failed: {e}")

    # 3) Run via subprocess (safer than Judge0)
    try:
        result = _run_with_subprocess(student_code, test_case)
    except Exception as e:
        err_payload = e.args[0] if (hasattr(e, "args") and e.args and isinstance(e.args[0], dict)) else {"error": repr(e)}
        preview = {
            "language_id": PYTHON_LANG_ID,
            "submission_filename": submission.filename,
            "source_code_preview": (student_code[:200] + "…") if len(student_code) > 200 else student_code,
            "stdin_preview": (test_case[:200] + "…") if len(test_case) > 200 else test_case,
        }
        detail: Dict[str, Any] = {"message": "Judge0 error"}
        if settings.DEBUG:
            detail["judge0_debug"] = err_payload  # url/status/response_text/(request_body if DEBUG)
            detail["payload_preview"] = preview
        raise HTTPException(status_code=500, detail=detail)

    # 4) Success payload
    grading = result.get("grading", {})
    return {
        "status": "ok",
        "submission_filename": submission.filename,
        "converter_used": "file_to_text" if _get_callable(fc, "file_to_text") else "fallback",
        "sandbox_used": "subprocess_safe",
        "grading": {
            "passed": grading.get("all_passed", False),
            "total_tests": grading.get("total_tests", 0),
            "passed_tests": grading.get("passed_tests", 0),
            "failed_tests": grading.get("failed_tests", 0),
        },
        "result": {
            "status": result.get("status", {}),
            "stdout": result.get("stdout") or "",
            "stderr": result.get("stderr") or "",
            "compile_output": result.get("compile_output") or "",
            "time": result.get("time", ""),
            "memory": result.get("memory", ""),
            "language_id_used": PYTHON_LANG_ID,
            "raw": result if settings.DEBUG else None,
        },
    }
