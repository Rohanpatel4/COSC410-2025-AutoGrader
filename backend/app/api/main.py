from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.settings import settings
from app.core.db import Base, engine
from . import files, testsuites, submissions, runtimes, runs
from . import loginpage  # Import the loginpage router

# Create all database tables
Base.metadata.create_all(bind=engine)

# Initialize the main FastAPI app for the Sandbox API
sandbox_app = FastAPI(title="Sandbox API", version="1.0.0")

sandbox_app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGINS],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers for the Sandbox API
sandbox_app.include_router(files.router, prefix="/api/v1/files", tags=["files"])
sandbox_app.include_router(testsuites.router, prefix="/api/v1/test-suites", tags=["test-suites"])
sandbox_app.include_router(submissions.router, prefix="/api/v1/submissions", tags=["submissions"])
sandbox_app.include_router(runtimes.router, prefix="/api/v1/runtimes", tags=["runtimes"])
sandbox_app.include_router(runs.router, prefix="/api/v1/runs", tags=["runs"])




# THis part below is for the login page the stuff above was for the sandbox that we will get to later
# Initialize a separate FastAPI app for the login page
login_app = FastAPI(title="Login API", version="1.0.0")

# Include the loginpage router
login_app.include_router(loginpage.router, prefix="/api/v1/login", tags=["login"])