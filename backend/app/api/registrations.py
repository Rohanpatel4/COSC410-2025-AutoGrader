from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.core.db import get_db
from app.models.models import Course, User, RoleEnum, user_course_association
# StudentRegistration is DEPRECATED - now using user_course_association for all enrollments

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

    # Check duplicate - query user_course_association
    exists = db.execute(
        select(user_course_association).where(
            and_(
                user_course_association.c.user_id == student_id,
                user_course_association.c.course_id == course.id,
            )
        )
    ).first()
    if exists:
        raise HTTPException(409, "Already registered")

    # Insert into user_course_association
    result = db.execute(
        user_course_association.insert().values(
            user_id=student_id, 
            course_id=course.id
        )
    )
    db.commit()

    # Get the inserted id
    inserted_id = result.lastrowid
    return {"id": inserted_id, "student_id": student_id, "course_id": course.id}

@router.get("/students/{student_id}/courses", response_model=list[dict])
def student_courses(student_id: int, db: Session = Depends(get_db)):
    # Query courses from user_course_association
    courses = db.execute(
        select(Course)
        .join(user_course_association, user_course_association.c.course_id == Course.id)
        .where(user_course_association.c.user_id == student_id)
    ).scalars().all()
    
    return [{"id": c.id, "course_tag": c.course_tag, "name": c.name, "description": c.description} for c in courses]
