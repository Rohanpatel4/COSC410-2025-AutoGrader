# backend/app/api/attempt_submission_test.py
from typing import Any, Dict
import importlib, inspect, ast
import httpx
import asyncio
import base64
import tarfile
import io
import os

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from starlette import status
from app.core.settings import settings

# ----- converter import (robust) -----
def _validate_code_safety(tree: ast.AST) -> None:
    """Validate that the AST doesn't contain dangerous constructs."""
    dangerous_nodes = []

    class SafetyVisitor(ast.NodeVisitor):
        def visit_Call(self, node):
            # Check for dangerous function calls
            if isinstance(node.func, ast.Name):
                if node.func.id in ['eval', 'exec', 'compile', '__import__', 'open']:
                    dangerous_nodes.append(f"Call to dangerous function: {node.func.id}")
            elif isinstance(node.func, ast.Attribute):
                if isinstance(node.func.value, ast.Name):
                    # Check for os.system, subprocess.call, etc.
                    if node.func.value.id in ['os', 'subprocess', 'sys']:
                        dangerous_nodes.append(f"Call to potentially dangerous method: {node.func.value.id}.{node.func.attr}")
            self.generic_visit(node)

        def visit_Import(self, node):
            for alias in node.names:
                if alias.name in ['os', 'subprocess', 'sys', 'shutil']:
                    dangerous_nodes.append(f"Import of potentially dangerous module: {alias.name}")
            self.generic_visit(node)

        def visit_ImportFrom(self, node):
            if node.module in ['os', 'subprocess', 'sys', 'shutil']:
                dangerous_nodes.append(f"Import from potentially dangerous module: {node.module}")
            self.generic_visit(node)

    visitor = SafetyVisitor()
    visitor.visit(tree)

    if dangerous_nodes:
        raise ValueError(f"Code contains dangerous constructs: {dangerous_nodes}")

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

# ----- Code execution (will use Piston) -----
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
    """Execute code using subprocess in a cross-platform way."""
    import subprocess
    import tempfile
    import os
    import sys

    # Validate student code safety
    try:
        tree = ast.parse(code)
        _validate_code_safety(tree)
    except SyntaxError as e:
        return {
            "stdout": "",
            "stderr": f"SyntaxError: {e}",
            "returncode": 1,
            "status": {"id": 6},  # Compilation error
            "time": None,
            "memory": None,
            "language_id_used": PYTHON_LANG_ID
        }
    except ValueError as e:
        return {
            "stdout": "",
            "stderr": str(e),
            "returncode": 1,
            "status": {"id": 6},  # Compilation error
            "time": None,
            "memory": None,
            "language_id_used": PYTHON_LANG_ID
        }

    # Try to import resource (Unix-only); be graceful on Windows
    try:
        import resource  # type: ignore
        HAS_RESOURCE = True
    except Exception:
        resource = None  # type: ignore
        HAS_RESOURCE = False

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
        def set_limits():
            # Only apply on Unix if resource is available
            if not HAS_RESOURCE:
                return
            # 5s CPU, ~100MB RAM, no forking
            resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
            resource.setrlimit(resource.RLIMIT_AS, (100 * 1024 * 1024, 100 * 1024 * 1024))
            resource.setrlimit(resource.RLIMIT_NPROC, (0, 0))

        # Use current interpreter so Windows works (no 'python3' assumption)
        runner = [sys.executable, temp_file]

        result = subprocess.run(
            runner,
            capture_output=True,
            text=True,
            timeout=10,
            preexec_fn=(set_limits if (HAS_RESOURCE and os.name != 'nt') else None)
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

        grading = _parse_pytest_output(result.stdout, result.stderr)
        result_dict["grading"] = grading
        return result_dict

    except subprocess.TimeoutExpired:
        return {
            "stdout": "",
            "stderr": "Timeout: Code execution took too long",
            "returncode": -1,
            "status": {"id": 5},  # Time Limit Exceeded
            "time": None,
            "memory": None,
            "language_id_used": PYTHON_LANG_ID,
            "grading": {"total_tests": 0, "passed_tests": 0, "failed_tests": 0, "all_passed": False, "has_tests": False}
        }
    except Exception as e:
        return {
            "stdout": "",
            "stderr": f"Execution error: {e}",
            "returncode": -1,
            "status": {"id": 13},  # Internal Error
            "time": None,
            "memory": None,
            "language_id_used": PYTHON_LANG_ID,
            "grading": {"total_tests": 0, "passed_tests": 0, "failed_tests": 0, "all_passed": False, "has_tests": False}
        }
    finally:
        try:
            os.unlink(temp_file)
        except Exception:
            pass

router = APIRouter(tags=["attempts"])
print(f"[DEBUG] Router created: {router}", flush=True)
print(f"[DEBUG] About to define attempt_submission_test_bridge", flush=True)

@router.post("/bridge", status_code=status.HTTP_201_CREATED)
async def attempt_submission_test_bridge(
    submission: UploadFile = File(..., description="Student .py submission"),
    test_case: str = Form(..., description="Test case code (text)"),
    job_name: str = Form(default="submission", description="Optional job identifier"),
):
    """
    Submit code for grading via the Judge0 Integration Bridge.
    This splits tests into individual units and runs them in parallel.
    TODO: Replace with Piston implementation
    """
    raise HTTPException(
        status_code=501,
        detail="Judge0 Integration Bridge has been removed. This endpoint will be replaced with Piston."
    )


@router.get("/test-route")
async def test_route_registration():
    return {"message": "Test route works"}

@router.post("", status_code=status.HTTP_201_CREATED)
async def attempt_submission_test(
    submission: UploadFile = File(..., description="Student .py submission"),
    test_case: str = Form(..., description="Test case code (text)"),
):
    """
    Submit code for grading via Judge0.
    TODO: Replace with Piston implementation
    """
    raise HTTPException(
        status_code=501,
        detail="Judge0 integration has been removed. This endpoint will be replaced with Piston."
    )

@router.get("/")
def get_attempts():
    """Temporary stub route."""
    return {"message": "attempts route working"}

@router.post("/")
def create_attempt():
    """Temporary POST route stub."""
    return {"message": "attempt created"}
