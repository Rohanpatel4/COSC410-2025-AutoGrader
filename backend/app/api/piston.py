from fastapi import APIRouter
from app.utils.piston_client import run_code

router = APIRouter(prefix="/execute")

@router.post("/")
def execute(language: str, code: str):
    return run_code(language, code)
