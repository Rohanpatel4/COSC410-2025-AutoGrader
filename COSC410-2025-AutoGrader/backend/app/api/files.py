from fastapi import APIRouter, UploadFile, File as UpFile, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models.models import File, FileCategory
from app.schemas.schemas import FileOut
from app.services.services import store_uploaded_file
import uuid

router = APIRouter()

@router.post("", response_model=FileOut)
async def upload_file(category: FileCategory = Form(...), f: UploadFile = UpFile(...), db: Session = Depends(get_db)):
    content = await f.read()
    fid, path, sha, size = store_uploaded_file(f.filename, content, category)
    entity = File(id=fid, name=f.filename, category=category, path=path, size_bytes=size, sha256=sha)
    db.add(entity); db.commit(); db.refresh(entity)
    return entity

@router.get("/{id}", response_model=FileOut)
def get_file(id: str, db: Session = Depends(get_db)):
    e = db.get(File, id)
    if not e: raise HTTPException(404)
    return e

@router.get("", response_model=list[FileOut])
def list_files(category: FileCategory | None = None, db: Session = Depends(get_db)):
    q = db.query(File)
    if category:
        q = q.filter(File.category==category)
    return q.order_by(File.created_at.desc()).all()

@router.delete("/{id}")
def delete_file(id: str, db: Session = Depends(get_db)):
    e = db.get(File, id)
    if not e: raise HTTPException(404)
    db.delete(e); db.commit()
    return {"ok": True}
