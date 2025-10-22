# backend/app/api/execute.py
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.sandbox import run_pytest_job

router = APIRouter(prefix="/api/v1", tags=["execute"])

class ExecPayload(BaseModel):
    files: dict[str, str]     # {"student.py": "...", "tests/test_basic.py": "..."}
    timeout_sec: int = 5

@router.post("/execute")
def execute(payload: ExecPayload):
    result = run_pytest_job(payload.files, timeout_sec=payload.timeout_sec)
    return result
