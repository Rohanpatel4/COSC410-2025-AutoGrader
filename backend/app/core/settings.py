from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
from pathlib import Path


# Calculate default database path relative to backend directory
def _get_default_database_url() -> str:
    # Get the backend directory (where this file is located)
    # backend/app/core/settings.py -> backend/
    backend_dir = Path(__file__).parent.parent.parent
    db_path = backend_dir / "app.db"
    return f"sqlite:///{db_path.absolute()}"


class Settings(BaseSettings):
    # --- Database ---
    # Use absolute path to ensure app.db is always in backend/ directory
    # regardless of where the app is run from
    # Can be overridden via environment variable
    DATABASE_URL: str = _get_default_database_url()

    # --- CORS ---
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # add your LAN URL if Vite shows one in the terminal:
        # "http://192.168.1.10:5173",
    ]

    PISTON_URL: str = "http://localhost:2000"

    # --- Debug ---
    DEBUG: bool = True

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v):
        """
        Parse CORS_ORIGINS from various formats:
          - JSON string: '["http://localhost:5173"]' or '["http://a.com","http://b.com"]'
          - Comma-separated string: "http://a.com,http://b.com"
          - List: ["http://a.com","http://b.com"]
          - Single string: "http://a.com"
        """
        if v is None:
            return []
        
        if isinstance(v, str):
            v = v.strip()
            # Try to parse as JSON first (handles docker-compose format)
            if v.startswith("[") and v.endswith("]"):
                try:
                    import json
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if item]
                    return [str(parsed).strip()]
                except (json.JSONDecodeError, ValueError):
                    # If JSON parsing fails, try comma-separated
                    pass
            
            # Handle comma-separated string
            if "," in v:
                return [s.strip() for s in v.split(",") if s.strip()]
            
            # Single string
            return [v] if v else []
        
        if isinstance(v, (list, tuple)):
            return [str(item).strip() for item in v if item]
        
        return [str(v)] if v else []

    class Config:
        env_file = ".env"

settings = Settings()

