# backend/app/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.settings import settings
from app.core.db import Base, engine

# Feature modules (routers):
from .files import router as files_router
from .testsuites import router as testsuites_router
from .submissions import router as submissions_router
from .runtimes import router as runtimes_router
from .runs import router as runs_router
from .LoginPage import router as login_router  # <- matches filename capitalization

# Create DB tables once at startup (alembic migrations are better later)
Base.metadata.create_all(bind=engine)

# One app for everything
app = FastAPI(title="AutoGrader API", version="1.0.0")

# CORS (adjust as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGINS],  # or ["*"] during dev
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers (prefixes can live here or inside each router)
app.include_router(files_router,      prefix="/api/v1/files",       tags=["files"])
app.include_router(testsuites_router, prefix="/api/v1/test-suites", tags=["test-suites"])
app.include_router(submissions_router,prefix="/api/v1/submissions", tags=["submissions"])
app.include_router(runtimes_router,   prefix="/api/v1/runtimes",    tags=["runtimes"])
app.include_router(runs_router,       prefix="/api/v1/runs",        tags=["runs"])
app.include_router(login_router,      prefix="/api/v1",       tags=["login"])
