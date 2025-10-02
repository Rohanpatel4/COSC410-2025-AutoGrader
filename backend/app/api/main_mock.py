# backend/app/api/main_mock.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# keep any real routers you still need in dev (files, runs, login, etc.)
from .files import router as files_router
from .testsuites import router as testsuites_router
from .submissions import router as submissions_router
from .runtimes import router as runtimes_router
from .runs import router as runs_router
from .LoginPage import router as login_router

# mock routers (same paths/shapes as real)
from .mock_courses import router as mock_courses_router
from .mock_registrations import router as mock_registrations_router

app = FastAPI(title="AutoGrader API (MOCK)", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount whatever “real” routers you still want in dev
app.include_router(files_router,       prefix="/api/v1/files",       tags=["files"])
app.include_router(testsuites_router,  prefix="/api/v1/test-suites", tags=["test-suites"])
app.include_router(submissions_router, prefix="/api/v1/submissions", tags=["submissions"])
app.include_router(runtimes_router,    prefix="/api/v1/runtimes",    tags=["runtimes"])
app.include_router(runs_router,        prefix="/api/v1/runs",        tags=["runs"])
app.include_router(login_router,       prefix="/api/v1",             tags=["login"])

# Mount mocks for the new domain
app.include_router(mock_courses_router,       prefix="/api/v1/courses", tags=["courses"])
app.include_router(mock_registrations_router, prefix="/api/v1",         tags=["registrations"])
