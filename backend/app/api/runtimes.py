from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models.models import Runtime
from app.schemas.schemas import RuntimeCreate, RuntimeOut
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
