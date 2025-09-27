"""
Core configuration settings for the Auto-Grader backend
"""
import os
import secrets
from typing import List, Optional, Union

from pydantic import AnyHttpUrl, field_validator, ValidationInfo
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables
    """

    # API Configuration
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # Server Configuration
    SERVER_NAME: str = "Auto-Grader"
    SERVER_HOST: AnyHttpUrl = "http://localhost"
    DEBUG: bool = True

    # CORS Configuration
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative dev port
        "http://localhost:8080",  # Production frontend
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(
        cls, v: Union[str, List[str]]
    ) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Trusted Hosts
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1"]

    # Database Configuration
    DATABASE_URL: str = "sqlite:///./app.db"

    # File Upload Configuration
    MAX_UPLOAD_SIZE: int = 25 * 1024 * 1024  # 25MB
    UPLOAD_DIR: str = "./uploads"
    ALLOWED_MIME_TYPES: List[str] = [
        "text/plain",
        "text/x-python",
        "text/x-c",
        "text/x-c++",
        "text/x-java",
        "text/javascript",
        "application/json",
        "application/octet-stream",
    ]

    # Run Execution Configuration
    RUNS_DIR: str = "./runs"
    SANDBOX_USER: str = "sandbox"
    CPU_LIMIT: str = "1"  # 1 CPU core
    MEMORY_LIMIT: str = "256m"  # 256MB
    TIME_LIMIT: int = 30  # 30 seconds

    # Logging
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()
