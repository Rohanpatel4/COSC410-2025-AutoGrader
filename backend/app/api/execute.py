# backend/app/api/execute.py
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.sandbox import run_pytest_job, run_job
from app.core.settings import settings

router = APIRouter(prefix="/execute", tags=["execute"])

class ExecPayload(BaseModel):
    files: dict[str, str]     # {"student.py": "...", "tests/test_basic.py": "..."}
    timeout_sec: int = 5

@router.post("/execute")
def execute(payload: ExecPayload):
    # choose runner based on settings (PISTON vs local docker inner-runner)
    result = run_job(payload.files, timeout_sec=payload.timeout_sec)
    return result
