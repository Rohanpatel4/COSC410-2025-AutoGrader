from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models.models import Submission, FileCategory
from app.schemas.schemas import SubmissionCreate, SubmissionOut
from app.services.services import validate_file_ids
import uuid, json

router = APIRouter()

@router.post("", response_model=SubmissionOut)
def create(payload: SubmissionCreate, db: Session = Depends(get_db)):
    validate_file_ids(db, payload.file_ids, FileCategory.SUBMISSION)
    e = Submission(id=str(uuid.uuid4()), name=payload.name, file_ids=json.dumps(payload.file_ids))
    db.add(e); db.commit(); db.refresh(e)
    return SubmissionOut(id=e.id, name=e.name, file_ids=json.loads(e.file_ids), created_at=e.created_at)

@router.get("/{id}", response_model=SubmissionOut)
def get_one(id: str, db: Session = Depends(get_db)):
    e = db.get(Submission, id)
    if not e: raise HTTPException(404)
    return SubmissionOut(id=e.id, name=e.name, file_ids=json.loads(e.file_ids), created_at=e.created_at)

@router.get("", response_model=list[SubmissionOut])
def list_all(db: Session = Depends(get_db)):
    out = []
    for e in db.query(Submission).all():
        out.append(SubmissionOut(id=e.id, name=e.name, file_ids=json.loads(e.file_ids), created_at=e.created_at))
    return out

@router.delete("/{id}")
def delete(id: str, db: Session = Depends(get_db)):
    e = db.get(Submission, id)
    if not e: raise HTTPException(404)
    db.delete(e); db.commit()
    return {"ok": True}
