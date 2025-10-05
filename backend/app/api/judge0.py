from fastapi import APIRouter, HTTPException
from app.judge0_client import get_judge0_client

router = APIRouter()

@router.get("/health")
def judge0_health():
    """Check Judge0 service health."""
    try:
        client = get_judge0_client()
        languages = client.get_languages()
        return {
            "status": "healthy",
            "languages_count": len(languages),
            "languages": [{"id": lang["id"], "name": lang["name"]} for lang in languages[:10]]  # First 10
        }
    except Exception as e:
        raise HTTPException(503, f"Judge0 service unhealthy: {str(e)}")

@router.get("/languages")
def list_judge0_languages():
    """List all available languages in Judge0."""
    try:
        client = get_judge0_client()
        languages = client.get_languages()
        return {"languages": languages}
    except Exception as e:
        raise HTTPException(503, f"Failed to fetch languages: {str(e)}")
