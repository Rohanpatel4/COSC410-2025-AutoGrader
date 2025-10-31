from fastapi import APIRouter

# Placeholder router so imports don't fail
router = APIRouter(prefix="/attempts", tags=["attempts"])

@router.get("/")
def get_attempts():
    """Temporary stub route."""
    return {"message": "attempts route working"}

@router.post("/")
def create_attempt():
    """Temporary POST route stub."""
    return {"message": "attempt created"}
