# backend/app/core/settings.py
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./app.db"


    CORS_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # add your LAN URL if Vite shows one in the terminal:
    # "http://192.168.1.10:5173",
]

    JUDGE0_URL: Optional[str] = None
    JUDGE0_ALLOWED_BASES: List[str] = [
        "http://localhost:2358",
        "http://judge0:2358",
    ]

   
    DEBUG: bool = True  



    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v):
        """
        Allow both:
          - comma-separated string: "http://a.com,http://b.com"
          - JSON-style list: ["http://a.com","http://b.com"]
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

    @field_validator("JUDGE0_URL", mode="after")
    @classmethod
    def _validate_judge0_url(cls, v, info):
        """
        Enforce allowlist when a URL is set; otherwise leave None to use defaults
        inside the Judge0 client.
        """
        if v is None:
            return v

        v = v.rstrip("/")

        allowed = info.data.get("JUDGE0_ALLOWED_BASES") or cls.model_fields["JUDGE0_ALLOWED_BASES"].default
        if v not in allowed:
            raise ValueError(
                f"Disallowed JUDGE0_URL: {v}. Allowed values: {', '.join(allowed)}"
            )
        return v

    class Config:
        env_file = ".env"  

settings = Settings()
