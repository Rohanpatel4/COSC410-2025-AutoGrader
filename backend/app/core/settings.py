from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    # --- Database ---
    # Use absolute path to avoid confusion between multiple app.db files
    DATABASE_URL: str = "sqlite:////Users/rohan/Desktop/school/Computer Science/COSC 410/COSC410-2025-AutoGrader/backend/app.db"

    # --- CORS ---
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # add your LAN URL if Vite shows one in the terminal:
        # "http://192.168.1.10:5173",
    ]



    # --- Debug ---
    DEBUG: bool = True

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v):
        """
        Allow:
          - "http://a.com,http://b.com"
          - ["http://a.com","http://b.com"]
          - already-a-list
        """
        if v is None:
            return []
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    import json
                    return json.loads(v)
                except Exception:
                    return [s.strip() for s in v.split(",") if s.strip()]
            return [s.strip() for s in v.split(",") if s.strip()]
        if isinstance(v, (list, tuple)):
            return list(v)
        return [str(v)]

    class Config:
        env_file = ".env"

settings = Settings()

