from sqlalchemy.orm import Session
from typing import List, Optional
from app.models import models as m
import json

def save(entity, db: Session):
    db.add(entity); db.commit(); db.refresh(entity); return entity

def get_by_id(model, db: Session, id: str):
    return db.get(model, id)

def list_files(db: Session, category: Optional[m.FileCategory] = None):
    q = db.query(m.File)
    if category:
        q = q.filter(m.File.category==category)
    return q.order_by(m.File.created_at.desc()).all()
