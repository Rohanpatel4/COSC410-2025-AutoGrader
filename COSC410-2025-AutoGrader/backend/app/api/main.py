from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.settings import settings
from app.core.db import Base, engine
from .routers import files, testsuites, submissions, runtimes, runs

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sandbox API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGINS],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files.router, prefix="/api/v1/files", tags=["files"])
app.include_router(testsuites.router, prefix="/api/v1/test-suites", tags=["test-suites"])
app.include_router(submissions.router, prefix="/api/v1/submissions", tags=["submissions"])
app.include_router(runtimes.router, prefix="/api/v1/runtimes", tags=["runtimes"])
app.include_router(runs.router, prefix="/api/v1/runs", tags=["runs"])
