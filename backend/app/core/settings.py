from pydantic_settings import BaseSettings
from pydantic import field_validator, computed_field, Field
from typing import List


class Settings(BaseSettings):
    # --- Database ---
    # Relative path works in Docker (working_dir=/app/backend)
    # Can be overridden via environment variable
    DATABASE_URL: str = "sqlite:///./app.db"

    # --- CORS ---
    # Store as str to prevent Pydantic from auto-parsing JSON
    # Use Field(alias="CORS_ORIGINS") to map the env var name
    # Use computed_field to convert to List[str]
    cors_origins_raw: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="CORS_ORIGINS"
    )

    PISTON_URL: str = "http://localhost:2000"

    # --- Debug ---
    DEBUG: bool = True

    @field_validator("cors_origins_raw", mode="before")
    @classmethod
    def _parse_cors_origins_raw(cls, v) -> str:
        """Handle CORS_ORIGINS from environment variable."""
        if v is None:
            return "http://localhost:5173,http://127.0.0.1:5173"
        if isinstance(v, list):
            # If somehow passed as a list, convert to comma-separated string
            return ",".join(str(item) for item in v)
        return str(v)

    @computed_field
    @property
    def CORS_ORIGINS(self) -> List[str]:
        """
        Parse CORS_ORIGINS from various formats.
        Allows:
          - "http://a.com,http://b.com" (comma-separated string)
          - '["http://a.com","http://b.com"]' (JSON string)
        """
        v = self.cors_origins_raw.strip()
        if not v:
            return ["http://localhost:5173", "http://127.0.0.1:5173"]
        
        # Try JSON parsing if it looks like JSON
        if v.startswith("[") and v.endswith("]"):
            try:
                import json
                result = json.loads(v)
                if isinstance(result, list):
                    return [str(item).strip() for item in result if item]
            except (json.JSONDecodeError, ValueError, TypeError):
                pass  # Fall through to comma splitting
        
        # Split by comma
        return [s.strip() for s in v.split(",") if s.strip()]

    class Config:
        env_file = ".env"

settings = Settings()

