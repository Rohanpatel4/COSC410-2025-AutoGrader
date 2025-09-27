"""
Main API v1 router
"""
from fastapi import APIRouter

from .files import router as files_router
from .runs import router as runs_router
from .runtimes import router as runtimes_router
from .submissions import router as submissions_router
from .testsuites import router as testsuites_router

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(files_router, prefix="/files", tags=["files"])
api_router.include_router(testsuites_router, prefix="/test-suites", tags=["test-suites"])
api_router.include_router(submissions_router, prefix="/submissions", tags=["submissions"])
api_router.include_router(runtimes_router, prefix="/runtimes", tags=["runtimes"])
api_router.include_router(runs_router, prefix="/runs", tags=["runs"])
