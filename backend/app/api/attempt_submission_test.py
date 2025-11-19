# backend/app/api/attempt_submission_test.py
import importlib, inspect

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from starlette import status
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

@router.get("/test-route")
def test_route_registration():
    """Test route endpoint for health checks."""
    return {"message": "Test route works"}

@router.post("/bridge", status_code=status.HTTP_201_CREATED)
async def attempt_submission_test_bridge(
    submission: UploadFile = File(..., description="Student code submission"),
    test_case: str = Form(..., description="Test case code (text)"),
    language: str = Form(default="python", description="Programming language"),
    job_name: str = Form(default="submission", description="Optional job identifier"),
):
    """
    Submit code for grading via Piston.
    Direct execution with test cases.
    Test/debug endpoint - defaults to Python for backward compatibility.
    """
    # Validate file extension (only .py files accepted)
    if submission.filename and not submission.filename.endswith('.py'):
        raise HTTPException(status_code=415, detail="Only .py files are accepted")
    
    # Read student code
    try:
        sub_bytes = await submission.read()
        student_code = sub_bytes.decode("utf-8")
    except Exception as e:
        raise HTTPException(400, f"Failed to read submission: {e}")
    
    # Convert test_case string to test_cases list format
    test_cases = [
        {
            "id": 1,
            "point_value": 1,  # Default to 1 point for test endpoint
            "test_code": test_case
        }
    ]
    
    # Execute with Piston using new template system
    try:
        result = await execute_code(language.lower(), student_code, test_cases)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")


@router.post("", status_code=status.HTTP_201_CREATED)
async def attempt_submission_test(
    submission: UploadFile = File(..., description="Student code submission"),
    test_case: str = Form(..., description="Test case code (text)"),
    language: str = Form(default="python", description="Programming language"),
):
    """
    Submit code for grading via Piston.
    Test/debug endpoint - defaults to Python for backward compatibility.
    """
    # Read student code
    try:
        sub_bytes = await submission.read()
        student_code = sub_bytes.decode("utf-8")
    except Exception as e:
        raise HTTPException(400, f"Failed to read submission: {e}")
    
    # Convert test_case string to test_cases list format
    test_cases = [
        {
            "id": 1,
            "point_value": 1,  # Default to 1 point for test endpoint
            "test_code": test_case
        }
    ]
    
    # Execute with Piston using new template system
    try:
        result = await execute_code(language.lower(), student_code, test_cases)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")
