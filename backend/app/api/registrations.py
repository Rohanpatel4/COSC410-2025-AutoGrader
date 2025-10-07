from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.core.db import get_db
from app.models.models import Course, User, StudentRegistration

router = APIRouter()

def _course_by_input(db: Session, *, course_id: int | None, course_tag: str | None) -> Course | None:
    if course_id is not None:
        c = db.get(Course, course_id)
        if c:
            return c
    if course_tag:
        return db.execute(select(Course).where(Course.course_tag == course_tag)).scalar_one_or_none()
    return None

@router.post("/registrations", response_model=dict, status_code=201)
def register(payload: dict, db: Session = Depends(get_db)):
    student_id = payload.get("student_id")
    course_id = payload.get("course_id")
    course_tag = payload.get("course_tag")

    if not isinstance(student_id, int):
        raise HTTPException(400, "student_id must be an integer")

    student = db.get(User, student_id)
    if not student:
        raise HTTPException(404, "Invalid student_id")

    course = _course_by_input(db, course_id=course_id, course_tag=course_tag)
    if not course:
        raise HTTPException(404, "Invalid course")

    # Check duplicate
    exists = db.execute(
        select(StudentRegistration).where(
            StudentRegistration.student_id == student_id,
            StudentRegistration.course_id == course.id,
        )
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(409, "Already registered")

    reg = StudentRegistration(student_id=student_id, course_id=course.id)
    db.add(reg)
    db.commit()
    db.refresh(reg)

    return {"id": reg.id, "student_id": student_id, "course_id": course.id}

@router.get("/students/{student_id}/courses", response_model=list[dict])
def student_courses(student_id: int, db: Session = Depends(get_db)):
    regs = db.execute(
        select(StudentRegistration).where(StudentRegistration.student_id == student_id)
    ).scalars().all()
    if not regs:
        return []

    course_ids = [r.course_id for r in regs]
    courses = db.execute(select(Course).where(Course.id.in_(course_ids))).scalars().all()
    return [{"id": c.id, "course_tag": c.course_tag, "name": c.name, "description": c.description} for c in courses]
