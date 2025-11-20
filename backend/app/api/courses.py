# backend/app/api/courses.py
from datetime import datetime
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.models import (
    Assignment,
    Course,
    RoleEnum,
    StudentSubmission,
    User,
    user_course_association,
)

router = APIRouter()

ALNUM = string.ascii_uppercase + string.digits

# ---------- helpers ----------
def _generate_enrollment_key(db: Session, length: int = 12) -> str:
    """Generate a unique 12-char A–Z0–9 key."""
    for _ in range(20):
        key = "".join(secrets.choice(ALNUM) for _ in range(length))
        exists = db.execute(select(Course.id).where(Course.enrollment_key == key)).first()
        if not exists:
            return key
    raise HTTPException(500, "Failed to generate unique enrollment key")

def _course_by_key(db: Session, key: str) -> Course | None:
    """Fetch a course by numeric ID or course_code."""
    if key.isdigit():
        c = db.get(Course, int(key))
        if c:
            return c
    return db.execute(select(Course).where(Course.course_code == key)).scalar_one_or_none()


def _parse_dt(v):
    """Accept None, datetime, 'YYYY-MM-DDTHH:MM', or 'YYYY-MM-DD HH:MM'."""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            pass
        try:
            return datetime.strptime(s, "%Y-%m-%d %H:%M")
        except ValueError:
            return None
    return None


def _assignment_to_dict(
    a: Assignment,
    attempts_by_aid: dict[int, int] | None = None,
) -> dict:
    num_attempts = 0
    if attempts_by_aid is not None:
        num_attempts = int(attempts_by_aid.get(a.id, 0))
    language = getattr(a, "language", "python")  # Default to python for backward compatibility
    return {
        "id": a.id,
        "course_id": a.course_id,
        "title": a.title,
        "description": a.description,
        "language": language,
        "sub_limit": getattr(a, "sub_limit", None),
        "start": getattr(a, "start", None),
        "stop": getattr(a, "stop", None),
        "num_attempts": num_attempts,
    }


# Identity helper (reads headers set by the frontend fetch helper)
def get_identity(
    x_user_id: int | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> tuple[int | None, RoleEnum | None]:
    if not x_user_id or not x_user_role:
        return None, None
    try:
        role = RoleEnum(x_user_role)
    except ValueError:
        return None, None
    return x_user_id, role


# ---------- course CRUD / listing ----------
from app.schemas.schemas import AssignmentCreate, CourseCreate, CourseRead

@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    ident=Depends(get_identity),
    db: Session = Depends(get_db),
):
    course_code = (payload.course_code or "").strip()
    name = (payload.name or "").strip()
    description = payload.description or ""

    if not course_code or not name:
        raise HTTPException(400, "course_code and name are required")

    # Duplicate checks
    exists = db.execute(select(Course).where(Course.course_code == course_code)).scalar_one_or_none()
    if exists:
        raise HTTPException(409, "Course code already exists")

    enrollment_key = _generate_enrollment_key(db)

    course = Course(
        course_code=course_code,
        enrollment_key=enrollment_key,
        name=name,
        description=description,
    )
    db.add(course)
    db.flush()  # get course.id

    # Auto-link faculty creator to the course
    user_id, role = ident
    
    if user_id and role == RoleEnum.faculty:
        # Associate faculty creator with the course in the same transaction
        db.execute(
            user_course_association.insert().values(
                user_id=user_id, course_id=course.id
            )
        )

    db.commit()
    db.refresh(course)
    
    return {
        "id": course.id,
        "course_code": course.course_code,
        "enrollment_key": course.enrollment_key,
        "name": course.name,
        "description": course.description,
    }

from app.schemas.schemas import CourseRead
from typing import List

@router.get("", response_model=dict)
def list_courses(
    # Back-compat: allow query param filtering if provided
    professor_id: int | None = Query(None, alias="professor_id"),
    q: str | None = None,
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Returns: { items: Course[], nextCursor: null }
    """
    rows = db.execute(select(Course)).scalars().all()

    if professor_id is not None:
        course_ids = [
            cid
            for (cid,) in db.execute(
                select(user_course_association.c.course_id).where(
                    user_course_association.c.user_id == professor_id
                )
            ).all()
        ]
        rows = [c for c in rows if c.id in course_ids]

    if q:
        ql = q.lower()
        rows = [c for c in rows if ql in (c.course_code or "").lower() or ql in (c.name or "").lower()]

    items = []
    for c in rows[:limit]:
        item = {
            "id": int(c.id),
            "course_code": str(c.course_code),
            "name": str(c.name),
            "description": str(c.description or ""),
        }
        # Optional: include enrollment_key only for filtered faculty views
        if professor_id is not None:
            item["enrollment_key"] = c.enrollment_key
        items.append(item)

    return {"items": items, "nextCursor": None}


# NEW: path-based faculty listing (mirrors students' explicit path style)
@router.get("/faculty/{faculty_id}", response_model=List[CourseRead])
def faculty_courses(faculty_id: int, db: Session = Depends(get_db)):
    rows = (
        db.execute(
            select(Course)
            .join(
                user_course_association,
                user_course_association.c.course_id == Course.id,
            )
            .where(user_course_association.c.user_id == faculty_id)
        )
        .scalars()
        .all()
    )
    return [
        {
            "id": c.id,
            "course_code": c.course_code,
            "enrollment_key": c.enrollment_key,  # faculty can copy this
            "name": c.name,
            "description": c.description,
        }
        for c in rows
    ]


@router.get("/{course_key}", response_model=CourseRead)
def get_course(course_key: str, db: Session = Depends(get_db)):
    c = _course_by_key(db, course_key)
    if not c:
        raise HTTPException(404, "Not found")
    return {
        "id": c.id,
        "course_code": c.course_code,
        "enrollment_key": c.enrollment_key,
        "name": c.name,
        "description": c.description,
    }


# ---------- faculty management ----------
@router.get("/{course_key}/faculty")
def course_faculty(course_key: str, db: Session = Depends(get_db)):
    c = _course_by_key(db, course_key)
    if not c:
        raise HTTPException(404, "Not found")

    prof_ids = [
        uid
        for (uid,) in db.execute(
            select(user_course_association.c.user_id).where(
                user_course_association.c.course_id == c.id
            )
        ).all()
    ]
    users = db.execute(select(User).where(User.id.in_(prof_ids))).scalars().all()
    return [
        {
            "id": u.id,
            "name": getattr(u, "username", None) or getattr(u, "name", None) or str(u.id),
        }
        for u in users
        if u.role == RoleEnum.faculty
    ]


#from app.schemas.schemas import FacultyAddRequest  # You'll need to create this simple schema
# Or use a simple Pydantic model inline:
from pydantic import BaseModel
class FacultyAddRequest(BaseModel):
    faculty_id: int

@router.post("/{course_key}/faculty", status_code=status.HTTP_201_CREATED)
def add_co_instructor(
    course_key: str,
    payload: FacultyAddRequest,
    db: Session = Depends(get_db),
):
    c = _course_by_key(db, course_key)
    if not c:
        raise HTTPException(404, "Course not found")

    faculty_id = payload.faculty_id
    if not isinstance(faculty_id, int):
        raise HTTPException(400, "faculty_id must be an integer")

    u = db.get(User, faculty_id)
    if not u or u.role != RoleEnum.faculty:
        raise HTTPException(404, "Faculty user not found")

    exists = db.execute(
        select(user_course_association).where(
            and_(
                user_course_association.c.user_id == faculty_id,
                user_course_association.c.course_id == c.id,
            )
        )
    ).first()
    if exists:
        raise HTTPException(409, "Faculty already linked to course")

    db.execute(
        user_course_association.insert().values(
            user_id=faculty_id, course_id=c.id
        )
    )
    db.commit()
    return {"ok": True}


@router.delete("/{course_key}/faculty/{faculty_id}")
def remove_co_instructor(
    course_key: str,
    faculty_id: int,
    db: Session = Depends(get_db),
):
    c = _course_by_key(db, course_key)
    if not c:
        raise HTTPException(404, "Course not found")

    res = db.execute(
        user_course_association.delete().where(
            and_(
                user_course_association.c.user_id == faculty_id,
                user_course_association.c.course_id == c.id,
            )
        )
    )
    if res.rowcount == 0:
        raise HTTPException(404, "Link not found")
    db.commit()
    return {"ok": True}


# ---------- students ----------
@router.get("/{course_key}/students")
def course_students(course_key: str, db: Session = Depends(get_db)):
    c = _course_by_key(db, course_key)
    if not c:
        raise HTTPException(404, "Not found")

    # Query user_course_association and filter by role=student
    student_rows = db.execute(
        select(User)
        .join(user_course_association, user_course_association.c.user_id == User.id)
        .where(
            user_course_association.c.course_id == c.id,
            User.role == RoleEnum.student
        )
    ).scalars().all()

    return [
        {
            "id": s.id,
            "name": getattr(s, "username", None) or getattr(s, "name", None) or str(s.id),
        }
        for s in student_rows
    ]


@router.delete("/{course_key}/students/{student_id}")
def remove_student_from_course(
    course_key: str,
    student_id: int,
    db: Session = Depends(get_db),
):
    c = _course_by_key(db, course_key)
    if not c:
        raise HTTPException(404, "Course not found")

    # Delete from user_course_association
    res = db.execute(
        user_course_association.delete().where(
            and_(
                user_course_association.c.course_id == c.id,
                user_course_association.c.user_id == student_id,
            )
        )
    )
    
    if res.rowcount == 0:
        raise HTTPException(404, "Enrollment not found")

    db.commit()
    return {"ok": True}


# ---------- assignments ----------
from app.schemas.schemas import AssignmentRead

@router.get("/{course_key}/assignments", response_model=List[AssignmentRead])
def list_assignments_for_course(
    course_key: str,
    student_id: int | None = None,
    db: Session = Depends(get_db),
):
    c = _course_by_key(db, course_key)
    if not c:
        return []

    rows = db.execute(select(Assignment).where(Assignment.course_id == c.id)).scalars().all()

    # If student_id is provided, count attempts per student, otherwise count all attempts
    if student_id is not None:
        attempts = dict(
            db.execute(
                select(StudentSubmission.assignment_id, func.count())
                .where(StudentSubmission.student_id == student_id)
                .group_by(StudentSubmission.assignment_id)
            ).all()
        )
    else:
        attempts = dict(
            db.execute(
                select(StudentSubmission.assignment_id, func.count())
                .group_by(StudentSubmission.assignment_id)
            ).all()
        )

    return [_assignment_to_dict(a, attempts) for a in rows]


@router.post("/{course_key}/assignments", response_model=AssignmentRead, status_code=status.HTTP_201_CREATED)
def create_assignment_for_course(
    course_key: str,
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
):
    """
    Create an assignment for the given course (course id or course_code).
    Expected payload: { title, description?, language?, sub_limit?, start?, stop? }
    """
    c = _course_by_key(db, course_key)
    if not c:
        raise HTTPException(404, "Course not found")

    title = (payload.title or "").strip()
    if not title:
        raise HTTPException(400, "title is required")

    description = payload.description or None
    language = (payload.language or "").strip().lower()
    if not language:
        raise HTTPException(400, "language is required")

    # Handle sub_limit: empty string or None means unlimited (None)
    sub_limit_raw = payload.sub_limit
    if sub_limit_raw == "" or sub_limit_raw is None:
        sub_limit = None
    elif isinstance(sub_limit_raw, int):
        sub_limit = sub_limit_raw
    elif isinstance(sub_limit_raw, str):
        try:
            sub_limit = int(sub_limit_raw) if sub_limit_raw.strip() else None
        except ValueError:
            raise HTTPException(400, "sub_limit must be a valid integer or empty for unlimited")
    else:
        sub_limit = None

    start = _parse_dt(payload.start) if payload.start else None
    stop = _parse_dt(payload.stop) if payload.stop else None

    a = Assignment(
        course_id=c.id,
        title=title,
        description=description,
        language=language,
        sub_limit=sub_limit,
    )
    if hasattr(a, "start"):
        a.start = start
    if hasattr(a, "stop"):
        a.stop = stop

    db.add(a)
    db.commit()
    db.refresh(a)

    return _assignment_to_dict(a, attempts_by_aid={})


@router.delete("/{course_key}/assignments/{assignment_id}")
def delete_assignment(
    course_key: str,
    assignment_id: int,
    db: Session = Depends(get_db),
):
    c = _course_by_key(db, course_key)
    if not c:
        raise HTTPException(404, "Course not found")

    a = db.get(Assignment, assignment_id)
    if not a or a.course_id != c.id:
        raise HTTPException(404, "Assignment not found")

    db.delete(a)
    db.commit()
    return {"ok": True}





