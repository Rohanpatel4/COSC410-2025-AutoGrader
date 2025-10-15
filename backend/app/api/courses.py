# backend/app/api/courses.py
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.models import (
    Assignment,
    Course,
    RoleEnum,
    StudentRegistration,
    StudentSubmission,
    User,
    user_course_association,
)

router = APIRouter()

# ---------- helpers ----------
def _course_by_key(db: Session, key: str) -> Course | None:
    """Fetch a course by numeric ID or course_tag."""
    if key.isdigit():
        c = db.get(Course, int(key))
        if c:
            return c
    return db.execute(select(Course).where(Course.course_tag == key)).scalar_one_or_none()


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
    return {
        "id": a.id,
        "course_id": a.course_id,
        "title": a.title,
        "description": a.description,
        "sub_limit": getattr(a, "sub_limit", None),
        "start": getattr(a, "start", None),
        "stop": getattr(a, "stop", None),
        "num_attempts": num_attempts,
    }


# Identity helper (reads headers set by the frontend fetch helper)
def get_identity(
    x_user_id: int | None = Header(default=None, convert_underscores=False),
    x_user_role: str | None = Header(default=None, convert_underscores=False),
) -> tuple[int | None, RoleEnum | None]:
    if not x_user_id or not x_user_role:
        return None, None
    try:
        role = RoleEnum(x_user_role)
    except ValueError:
        return None, None
    return x_user_id, role


# ---------- course CRUD / listing ----------
@router.post("", status_code=status.HTTP_201_CREATED)
def create_course(
    payload: dict,  # { course_tag, name, description? }
    ident=Depends(get_identity),
    db: Session = Depends(get_db),
):
    tag = (payload.get("course_tag") or "").strip()
    name = (payload.get("name") or "").strip()
    description = payload.get("description") or ""

    if not tag or not name:
        raise HTTPException(400, "course_tag and name are required")

    # Duplicate tag check
    exists = db.execute(select(Course).where(Course.course_tag == tag)).scalar_one_or_none()
    if exists:
        raise HTTPException(409, "Course tag already exists")

    course = Course(course_tag=tag, name=name, description=description)
    db.add(course)
    db.flush()  # get course.id without committing yet

    # Auto-link creator if they are faculty
    user_id, role = ident
    if role == RoleEnum.faculty and user_id:
        db.execute(
            user_course_association.insert().values(
                user_id=user_id, course_id=course.id
            )
        )

    db.commit()
    db.refresh(course)
    return {
        "id": course.id,
        "course_tag": course.course_tag,
        "name": course.name,
        "description": course.description,
    }


@router.get("")
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
        rows = [c for c in rows if ql in (c.course_tag or "").lower() or ql in (c.name or "").lower()]

    items = [
        {
            "id": int(c.id),
            "course_tag": str(c.course_tag),
            "name": str(c.name),
            "description": str(c.description or ""),
        }
        for c in rows[:limit]
    ]
    return {"items": items, "nextCursor": None}


# NEW: path-based faculty listing (mirrors students' explicit path style)
@router.get("/faculty/{faculty_id}", response_model=list[dict])
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
        {"id": c.id, "course_tag": c.course_tag, "name": c.name, "description": c.description}
        for c in rows
    ]


@router.get("/{course_key}")
def get_course(course_key: str, db: Session = Depends(get_db)):
    c = _course_by_key(db, course_key)
    if not c:
        raise HTTPException(404, "Not found")
    return {
        "id": c.id,
        "course_tag": c.course_tag,
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


@router.post("/{course_key}/faculty", status_code=status.HTTP_201_CREATED)
def add_co_instructor(
    course_key: str,
    payload: dict,  # { faculty_id: int }
    db: Session = Depends(get_db),
):
    c = _course_by_key(db, course_key)
    if not c:
        raise HTTPException(404, "Course not found")

    faculty_id = payload.get("faculty_id")
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

    reg_rows = db.execute(
        select(StudentRegistration.student_id).where(
            StudentRegistration.course_id == c.id
        )
    ).all()

    if not reg_rows:
        return []

    student_ids = [sid for (sid,) in reg_rows]
    students = db.execute(select(User).where(User.id.in_(student_ids))).scalars().all()
    return [
        {
            "id": s.id,
            "name": getattr(s, "username", None) or getattr(s, "name", None) or str(s.id),
        }
        for s in students
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

    res = db.execute(
        select(StudentRegistration).where(
            and_(
                StudentRegistration.course_id == c.id,
                StudentRegistration.student_id == student_id,
            )
        )
    ).scalar_one_or_none()

    if not res:
        raise HTTPException(404, "Registration not found")

    db.delete(res)
    db.commit()
    return {"ok": True}


# ---------- assignments ----------
@router.get("/{course_key}/assignments", response_model=list[dict])
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


@router.post("/{course_key}/assignments", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_assignment_for_course(
    course_key: str,
    payload: dict,
    db: Session = Depends(get_db),
):
    """
    Create an assignment for the given course (course id or course_tag).
    Expected payload: { title, description?, sub_limit?, start?, stop? }
    """
    c = _course_by_key(db, course_key)
    if not c:
        raise HTTPException(404, "Course not found")

    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "title is required")

    description = (payload.get("description") or "") or None

    # Handle sub_limit: empty string or None means unlimited (None)
    sub_limit_raw = payload.get("sub_limit", None)
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

    start = _parse_dt(payload.get("start"))
    stop = _parse_dt(payload.get("stop"))

    a = Assignment(
        course_id=c.id,
        title=title,
        description=description,
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





