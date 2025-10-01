from fastapi import APIRouter, UploadFile, File as UpFile, Form, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.db import get_db
from app.models.models import File, FileCategory
from app.schemas.schemas import FileOut
from app.services.services import store_uploaded_file
import traceback

router = APIRouter()

@router.post("", response_model=FileOut, status_code=201)
async def upload_file(
    category: FileCategory = Form(...),
    # Accept either form key "f" (current frontend) or "file" (common default)
    f: Optional[UploadFile] = UpFile(None),
    file: Optional[UploadFile] = UpFile(None),
    db: Session = Depends(get_db),
):
    up = f or file
    if up is None:
        raise HTTPException(status_code=422, detail='file field required (use "f" or "file")')
    try:
        content = await up.read()
        fid, path, sha, size = store_uploaded_file(up.filename, content, category)

        entity = File(
            id=fid,
            name=up.filename,
            category=category,
            path=path,
            size_bytes=size,
            sha256=sha,
        )
        db.add(entity)
        db.commit()
        db.refresh(entity)
        return entity

    except IntegrityError:
        db.rollback()
        # Likely UNIQUE constraint on sha256 (duplicate upload)
        raise HTTPException(status_code=409, detail="duplicate file (sha256)")
    except HTTPException:
        # Re-raise explicit HTTP errors (422, etc.)
        raise
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"upload failed: {e}")

@router.get("/{id}", response_model=FileOut)
def get_file(id: str, db: Session = Depends(get_db)):
    e = db.get(File, id)
    if not e:
        raise HTTPException(404)
    return e

@router.get("", response_model=list[FileOut])
def list_files(category: FileCategory | None = None, db: Session = Depends(get_db)):
    q = db.query(File)
    if category:
        q = q.filter(File.category == category)
    return q.order_by(File.created_at.desc()).all()

@router.delete("/{id}")
def delete_file(id: str, db: Session = Depends(get_db)):
    e = db.get(File, id)
    if not e:
        raise HTTPException(404)
    db.delete(e)
    db.commit()
    return {"ok": True}
