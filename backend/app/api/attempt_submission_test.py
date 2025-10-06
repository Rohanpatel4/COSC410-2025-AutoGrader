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

def _run_with_judge0(code: str, tests: str) -> Dict[str, Any]:
    from app.judge0_client import get_judge0_client
    client = get_judge0_client()
    stdin_value = tests if tests and tests.strip() else None
    token = client.create_submission(source_code=str(code), language_id=int(PYTHON_LANG_ID), stdin=stdin_value)
    return client.wait_for_completion(token, timeout=30)

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

    # 3) Run via Judge0
    try:
        result = _run_with_judge0(student_code, test_case)
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
    return {
        "status": "ok",
        "submission_filename": submission.filename,
        "converter_used": "file_to_text" if _get_callable(fc, "file_to_text") else "fallback",
        "sandbox_used": "judge0_inline",
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
