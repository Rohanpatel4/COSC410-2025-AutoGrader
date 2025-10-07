# backend/app/api/assignments.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import Optional

from app.core.db import get_db
from app.models.models import Assignment, Course, StudentSubmission

router = APIRouter()

# ---- helpers ---------------------------------------------------------------

def _course_by_key(db: Session, key: str) -> Optional[Course]:
    """Fetch a course by numeric id or course_tag."""
    if key.isdigit():
        c = db.get(Course, int(key))
        if c:
            return c
    return db.execute(select(Course).where(Course.course_tag == key)).scalar_one_or_none()

def _to_iso_or_raw(v):
    """If it's a datetime, return ISO 8601; else return as-is (or None)."""
    if hasattr(v, "isoformat"):
        try:
            return v.isoformat()
        except Exception:
            return str(v)
    return v

def _serialize_assignment(db: Session, a: Assignment) -> dict:
    # SQLAlchemy 2.0 style count
    attempts = db.execute(
        select(func.count())
        .select_from(StudentSubmission)
        .where(StudentSubmission.assignment_id == a.id)
    ).scalar_one() or 0

    start = getattr(a, "start", None)
    stop = getattr(a, "stop", None)

    return {
        "id": a.id,
        "course_id": a.course_id,
        "title": a.title,
        "description": a.description,
        "sub_limit": getattr(a, "sub_limit", None),
        "start": _to_iso_or_raw(start),
        "stop": _to_iso_or_raw(stop),
        "num_attempts": int(attempts),
    }

# ---- list endpoints --------------------------------------------------------

@router.get("", response_model=list[dict])
def list_assignments(db: Session = Depends(get_db)):
    rows = db.execute(select(Assignment)).scalars().all()
    return [_serialize_assignment(db, a) for a in rows]

@router.get("/by-course/{course_key}", response_model=list[dict])
def list_assignments_for_course(course_key: str, db: Session = Depends(get_db)):
    c = _course_by_key(db, course_key)
    if not c:
        return []
    rows = db.execute(select(Assignment).where(Assignment.course_id == c.id)).scalars().all()
    return [_serialize_assignment(db, a) for a in rows]

# ---- get one ---------------------------------------------------------------

@router.get("/{assignment_id}", response_model=dict)
def get_one_assignment(assignment_id: int, db: Session = Depends(get_db)):
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return _serialize_assignment(db, a)

# ---- create / delete -------------------------------------------------------

@router.post("", response_model=dict, status_code=201)
def create_assignment(payload: dict, db: Session = Depends(get_db)):
    """
    Create an assignment.

    Expected payload:
      {
        "course_id": int,
        "title": str,
        "description": str|None,
        "sub_limit": int|None,
        "start": str|None,   # optional; if your ORM has the column
        "stop": str|None     # optional; if your ORM has the column
      }
    """
    course_id = payload.get("course_id")
    title = (payload.get("title") or "").strip()
    description = payload.get("description") or None
    sub_limit = payload.get("sub_limit", None)
    start = payload.get("start", None)
    stop = payload.get("stop", None)

    if not isinstance(course_id, int):
        raise HTTPException(400, "course_id must be an integer")
    if not title:
        raise HTTPException(400, "title is required")

    c = db.get(Course, course_id)
    if not c:
        raise HTTPException(404, "Course not found")

    a = Assignment(
        course_id=course_id,
        title=title,
        description=description,
        sub_limit=sub_limit,
    )

    # Only set start/stop if your ORM actually has them (safe no-ops if not)
    try:
        if hasattr(a, "start"):
            setattr(a, "start", start)
        if hasattr(a, "stop"):
            setattr(a, "stop", stop)
    except Exception:
        pass

    db.add(a)
    db.commit()
    db.refresh(a)
    return _serialize_assignment(db, a)

@router.delete("/{assignment_id}", response_model=dict)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(a)
    db.commit()
    return {"ok": True, "id": assignment_id}





