# backend/app/api/assignments.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime
from collections import defaultdict

from app.core.db import get_db
from app.models.models import (
    Assignment, Course, StudentSubmission, TestCase,
    User, RoleEnum, user_course_association
)

router = APIRouter()

# ---- helpers ---------------------------------------------------------------

def _course_by_key(db: Session, key: str) -> Optional[Course]:
    """Fetch a course by numeric id or course_code."""
    if key.isdigit():
        c = db.get(Course, int(key))
        if c:
            return c
    return db.execute(select(Course).where(Course.course_code == key)).scalar_one_or_none()

def _to_iso_or_raw(v):
    if hasattr(v, "isoformat"):
        try:
            return v.isoformat()
        except Exception:
            return str(v)
    return v

def _serialize_assignment(db: Session, a: Assignment) -> dict:
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

def _parse_dt(v):
    """Accepts None, datetime, 'YYYY-MM-DDTHH:MM', or 'YYYY-MM-DD HH:MM'."""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        # primary: ISO8601 from <input type="datetime-local">
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            pass
        # fallback: space-separated
        try:
            return datetime.strptime(s, "%Y-%m-%d %H:%M")
        except ValueError:
            return None
    return None

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
    Expected payload: { course_id, title, description?, sub_limit?, start?, stop? }
    """
    course_id = payload.get("course_id")
    title = (payload.get("title") or "").strip()
    description = payload.get("description") or None

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

    start = _parse_dt(payload.get("start", None))
    stop = _parse_dt(payload.get("stop", None))

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
    # Only set if the columns exist (they do in your migration)
    if hasattr(a, "start"):
        a.start = start
    if hasattr(a, "stop"):
        a.stop = stop

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

# ======================================================================
# NEW: assignment-scoped test upload, attempts list, and submit endpoints
# ======================================================================

@router.post("/{assignment_id}/test-file", status_code=201)
async def upload_test_file_for_assignment(
    assignment_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Attach a test file to an assignment.
    For now we store the test code in test_files.filename (string column).
    """
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")

    if not file.filename or not file.filename.lower().endswith(".py"):
        raise HTTPException(415, "Only .py files are accepted")

    try:
        content_bytes = await file.read()
        content = content_bytes.decode("utf-8")
    except Exception as e:
        raise HTTPException(400, f"Failed to read test file: {e}")

    # Replace any existing test rows for this assignment (simple policy)
    db.query(TestCase).filter(TestCase.assignment_id == assignment_id).delete()

    tc = TestCase(assignment_id=assignment_id, filename=content)
    db.add(tc)
    db.commit()
    db.refresh(tc)

    return {
        "ok": True,
        "assignment_id": assignment_id,
        "test_case_id": tc.id,
        "filename": file.filename,
        "size": len(content_bytes),
    }

@router.get("/{assignment_id}/attempts", response_model=list[dict])
def list_attempts_for_assignment(
    assignment_id: int,
    student_id: int,
    db: Session = Depends(get_db)
):
    """
    Return attempts for a student for a given assignment.
    Always 200; empty list if none.
    """
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")

    rows = db.execute(
        select(StudentSubmission)
        .where(
            StudentSubmission.assignment_id == assignment_id,
            StudentSubmission.student_id == student_id,
        )
        .order_by(StudentSubmission.id.asc())
    ).scalars().all()

    return [{"id": s.id, "grade": s.grade} for s in rows]

@router.post("/{assignment_id}/submit", status_code=201)
async def submit_to_assignment(
    assignment_id: int,
    submission: UploadFile = File(..., description="Student .py submission"),
    student_id: int = Form(...),
    db: Session = Depends(get_db),
):
 
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")

    # lightweight enrollment/role check (dev-friendly)
    stu = db.get(User, student_id)
    if not stu:
        raise HTTPException(404, "Student not found")
    if stu.role not in (RoleEnum.student,):
        raise HTTPException(400, "Only students can submit")

    # optional: ensure enrollment via user_course_association (relaxed in dev)
    enrollment = db.execute(
        select(user_course_association).where(
            and_(
                user_course_association.c.user_id == student_id,
                user_course_association.c.course_id == a.course_id,
            )
        )
    ).first()
    # If not enrollment: allow for now.

    # fetch latest test code for this assignment
    tc = db.execute(
        select(TestCase)
        .where(TestCase.assignment_id == assignment_id)
        .order_by(TestCase.id.desc())
        .limit(1)
    ).scalar_one_or_none()
    if not tc or not (tc.filename or "").strip():
        raise HTTPException(409, "No test file attached to this assignment")

    if not submission.filename or not submission.filename.lower().endswith(".py"):
        raise HTTPException(415, "Only .py files are accepted")

    # read student code
    try:
        sub_bytes = await submission.read()
        student_code = sub_bytes.decode("utf-8")
    except Exception as e:
        raise HTTPException(400, f"Failed to read submission: {e}")

    # Calculate grade based on test results
    passed = grading.get("all_passed", False)
    total_tests = grading.get("total_tests", 0)
    grade = 100 if passed and total_tests > 0 else 0

    # persist attempt
    attempt = StudentSubmission(
        student_id=student_id,
        assignment_id=assignment_id,
        grade=grade,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return {
        "id": attempt.id,
        "assignment_id": assignment_id,
        "student_id": student_id,
        "grade": grade,
        "grading": {
            "passed": grading.get("all_passed", False),
            "total_tests": grading.get("total_tests", 0),
            "passed_tests": grading.get("passed_tests", 0),
            "failed_tests": grading.get("failed_tests", 0),
        },
        # this all originates from judge0
        "result": {
            "status": result.get("status", {}),
            "stdout": result.get("stdout", ""),
            "stderr": result.get("stderr") or "",
            "compile_output": result.get("compile_output") or "",
            "time": result.get("time", ""),
            "memory": result.get("memory", ""),
        },
    }

@router.get("/{assignment_id}/grades", response_model=dict)
def grades_for_assignment(assignment_id: int, db: Session = Depends(get_db)):
    """
    Faculty view: all students registered in this assignment’s course,
    their attempts for this assignment (id, grade), and their best grade.
    """
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")

    # enrolled students (role=student) from user_course_association
    stu_rows = db.execute(
        select(User.id, User.username)
        .join(user_course_association, user_course_association.c.user_id == User.id)
        .where(
            user_course_association.c.course_id == a.course_id,
            User.role == RoleEnum.student,
        )
        .order_by(User.username.asc())
    ).all()

    students = [{"student_id": sid, "username": uname} for (sid, uname) in stu_rows]
    stu_ids = [sid for (sid, _uname) in stu_rows]
    if not stu_ids:
        return {
            "assignment": {"id": a.id, "title": a.title},
            "students": [],
        }

    # attempts for this assignment by these students
    att_rows = db.execute(
        select(
            StudentSubmission.student_id,
            StudentSubmission.id,
            StudentSubmission.grade
        )
        .where(
            and_(
                StudentSubmission.assignment_id == assignment_id,
                StudentSubmission.student_id.in_(stu_ids),
            )
        )
        .order_by(StudentSubmission.student_id.asc(), StudentSubmission.id.asc())
    ).all()

    attempts_by_student: dict[int, list[dict]] = defaultdict(list)
    best_by_student: dict[int, int | None] = {}

    for sid, sub_id, grade in att_rows:
        attempts_by_student[sid].append({"id": sub_id, "grade": grade})
        if grade is not None:
            if sid not in best_by_student:
                best_by_student[sid] = grade
            else:
                best_by_student[sid] = max(best_by_student[sid], grade)

    out_students = []
    for s in students:
        sid = s["student_id"]
        atts = attempts_by_student.get(sid, [])
        best = best_by_student.get(sid, None)
        out_students.append({
            "student_id": sid,
            "username": s["username"],
            "attempts": atts,
            "best": best,
        })

    return {
        "assignment": {"id": a.id, "title": a.title},
        "students": out_students,
    }

@router.get("/gradebook/by-course/{course_key}", response_model=dict)
def gradebook_for_course(course_key: str, db: Session = Depends(get_db)):
    """
    Return a full grade matrix for a course:
      - assignments: [{id, title}]
      - students: [{student_id, username, grades: {<assignment_id_as_string>: best_grade|null}}]
    """
    c = _course_by_key(db, course_key)
    if not c:
        raise HTTPException(404, "Course not found")

    # columns
    assigns = db.execute(
        select(Assignment.id, Assignment.title)
        .where(Assignment.course_id == c.id)
        .order_by(Assignment.id.asc())
    ).all()
    assignments = [{"id": aid, "title": title} for (aid, title) in assigns]
    a_ids = [a["id"] for a in assignments]

    # rows - query from user_course_association
    stu_rows = db.execute(
        select(User.id, User.username)
        .join(user_course_association, user_course_association.c.user_id == User.id)
        .where(
            user_course_association.c.course_id == c.id,
            User.role == RoleEnum.student,
        )
        .order_by(User.username.asc())
    ).all()
    students = [{"student_id": sid, "username": uname} for (sid, uname) in stu_rows]
    s_ids = [s["student_id"] for s in students]

    if not a_ids or not s_ids:
        return {
            "course": {"id": c.id, "name": c.name, "course_code": c.course_code},
            "assignments": assignments,
            "students": [],
        }

    # best grade per (student, assignment)
    best_rows = db.execute(
        select(
            StudentSubmission.student_id,
            StudentSubmission.assignment_id,
            func.max(StudentSubmission.grade)
        )
        .where(
            StudentSubmission.assignment_id.in_(a_ids),
            StudentSubmission.student_id.in_(s_ids),
        )
        .group_by(StudentSubmission.student_id, StudentSubmission.assignment_id)
    ).all()

    best_map: dict[tuple[int, int], int | None] = {}
    for sid, aid, best in best_rows:
        best_map[(sid, aid)] = best

    out_students = []
    for s in students:
        sid = s["student_id"]
        grades = {str(aid): best_map.get((sid, aid), None) for aid in a_ids}
        out_students.append({
            "student_id": sid,
            "username": s["username"],
            "grades": grades,
        })

    return {
        "course": {"id": c.id, "name": c.name, "course_code": c.course_code},
        "assignments": assignments,
        "students": out_students,
    }





