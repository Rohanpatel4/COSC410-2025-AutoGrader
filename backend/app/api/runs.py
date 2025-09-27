from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models.models import Run, RunStatus
from app.schemas.schemas import RunCreate, RunOut
from app.services.services import create_run, execute_run

router = APIRouter()

@router.post("", response_model=RunOut)
def create(payload: RunCreate, db: Session = Depends(get_db)):
    r = create_run(db, payload.submission_id, payload.testsuite_id, payload.runtime_id)
    return r

@router.get("/{id}", response_model=RunOut)
def get_one(id: str, db: Session = Depends(get_db)):
    r = db.get(Run, id)
    if not r: raise HTTPException(404)
    return r

@router.post("/{id}/execute", response_model=RunOut)
def trigger(id: str, db: Session = Depends(get_db)):
    r = db.get(Run, id)
    if not r: raise HTTPException(404)
    return execute_run(db, r)

@router.delete("/{id}")
def delete(id: str, db: Session = Depends(get_db)):
    r = db.get(Run, id)
    if not r: raise HTTPException(404)
    db.delete(r); db.commit()
    return {"ok": True}
