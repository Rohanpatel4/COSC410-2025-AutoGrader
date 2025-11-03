# backend/app/api/attempt_submission_test.py
from typing import Any, Dict
import importlib, inspect

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from starlette import status
from app.core.settings import settings
from app.services.piston import execute_code

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
    Submit code for grading via Piston.
    Direct execution with test cases.
    """
    # Validate file type
    if not submission.filename or not submission.filename.lower().endswith(".py"):
        raise HTTPException(415, "Only .py files are accepted")
    
    # Read student code
    try:
        sub_bytes = await submission.read()
        student_code = sub_bytes.decode("utf-8")
    except Exception as e:
        raise HTTPException(400, f"Failed to read submission: {e}")
    
    # Execute with Piston
    result = await execute_code(student_code, test_case)
    return result


@router.get("/test-route")
async def test_route_registration():
    return {"message": "Test route works"}

@router.post("", status_code=status.HTTP_201_CREATED)
async def attempt_submission_test(
    submission: UploadFile = File(..., description="Student .py submission"),
    test_case: str = Form(..., description="Test case code (text)"),
):
    """
    Submit code for grading via Piston.
    """
    # Validate file type
    if not submission.filename or not submission.filename.lower().endswith(".py"):
        raise HTTPException(415, "Only .py files are accepted")
    
    # Read student code
    try:
        sub_bytes = await submission.read()
        student_code = sub_bytes.decode("utf-8")
    except Exception as e:
        raise HTTPException(400, f"Failed to read submission: {e}")
    
    # Execute with Piston
    result = await execute_code(student_code, test_case)
    return result

@router.get("/")
def get_attempts():
    """Temporary stub route."""
    return {"message": "attempts route working"}

@router.post("/")
def create_attempt():
    """Temporary POST route stub."""
    return {"message": "attempt created"}
