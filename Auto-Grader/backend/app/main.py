"""
Auto-Grader Backend API
FastAPI application for secure code execution sandbox
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from .core.config import settings
from .core.database import create_db_and_tables
from .api.v1.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager"""
    # Startup
    await create_db_and_tables()
    yield
    # Shutdown
    # Add cleanup logic here if needed


def create_application() -> FastAPI:
    """Create and configure FastAPI application"""

    app = FastAPI(
        title="Auto-Grader API",
        description="Secure sandbox environment for running student code submissions",
        version="1.0.0",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # Set up CORS
    if settings.BACKEND_CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Add trusted host middleware for security
    if not settings.DEBUG:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.ALLOWED_HOSTS,
        )

    # Include API router
    app.include_router(api_router, prefix=settings.API_V1_STR)

    return app


# Create the FastAPI app instance
app = create_application()
