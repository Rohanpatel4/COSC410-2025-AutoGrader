from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models.models import Runtime
from app.schemas.schemas import RuntimeCreate, RuntimeOut
from app.services.runtime_service import sync_runtimes_with_judge0, initialize_default_runtimes
import uuid

router = APIRouter()

@router.get("", response_model=list[RuntimeOut])
def list_all(db: Session = Depends(get_db)):
    return db.query(Runtime).all()

@router.post("", response_model=RuntimeOut)
def create(payload: RuntimeCreate, db: Session = Depends(get_db)):
    e = Runtime(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(e); db.commit(); db.refresh(e)
    return e

@router.patch("/{id}", response_model=RuntimeOut)
def update(id: str, payload: RuntimeCreate, db: Session = Depends(get_db)):
    e = db.get(Runtime, id)
    if not e: raise HTTPException(404)
    for k,v in payload.model_dump().items():
        setattr(e, k, v)
    db.commit(); db.refresh(e)
    return e

@router.post("/sync", response_model=list[RuntimeOut])
def sync_with_judge0(db: Session = Depends(get_db)):
    """Sync runtimes with available Judge0 languages."""
    try:
        synced_runtimes = sync_runtimes_with_judge0(db)
        # Return all runtimes after sync
        return db.query(Runtime).all()
    except Exception as e:
        raise HTTPException(500, f"Failed to sync runtimes: {str(e)}")

@router.post("/initialize")
def initialize_runtimes(db: Session = Depends(get_db)):
    """Initialize default runtimes if none exist."""
    try:
        initialize_default_runtimes(db)
        return {"message": "Runtimes initialized successfully"}
    except Exception as e:
        raise HTTPException(500, f"Failed to initialize runtimes: {str(e)}")
