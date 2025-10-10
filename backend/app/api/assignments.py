# backend/app/api/assignments.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime

from app.core.db import get_db
from app.models.models import (
    Assignment, Course, StudentSubmission, TestCase,
    StudentRegistration, User, RoleEnum
)

# REMOVED: Judge0 client - using secure subprocess execution instead

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
    For now we store the test code in test_files.var_char (string column).
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

    tc = TestCase(assignment_id=assignment_id, var_char=content)
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
    """
    Create a StudentSubmission for this assignment and run it against the
    assignment's stored test file (latest TestCase row). Uses Judge0.
    """
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")

    # lightweight enrollment/role check (dev-friendly)
    stu = db.get(User, student_id)
    if not stu:
        raise HTTPException(404, "Student not found")
    if stu.role not in (RoleEnum.student,):
        raise HTTPException(400, "Only students can submit")

    # optional: ensure enrollment (relaxed in dev)
    reg = db.execute(
        select(StudentRegistration).where(
            StudentRegistration.student_id == student_id,
            StudentRegistration.course_id == a.course_id,
        )
    ).scalar_one_or_none()
    # If not reg: allow for now.

    # fetch latest test code for this assignment
    tc = db.execute(
        select(TestCase)
        .where(TestCase.assignment_id == assignment_id)
        .order_by(TestCase.id.desc())
        .limit(1)
    ).scalar_one_or_none()
    if not tc or not (tc.var_char or "").strip():
        raise HTTPException(409, "No test file attached to this assignment")

    if not submission.filename or not submission.filename.lower().endswith(".py"):
        raise HTTPException(415, "Only .py files are accepted")

    # read student code
    try:
        sub_bytes = await submission.read()
        student_code = sub_bytes.decode("utf-8")
    except Exception as e:
        raise HTTPException(400, f"Failed to read submission: {e}")

    # Import grading functions from the attempts module
    from app.api.attempt_submission_test import _run_with_subprocess, _parse_pytest_output

    # Run with the same grading logic as the sandbox
    try:
        result = _run_with_subprocess(student_code, tc.var_char)
        grading = result.get("grading", {})
    except Exception as e:
        err_payload = e.args[0] if (hasattr(e, "args") and e.args and isinstance(e.args[0], dict)) else {"error": repr(e)}
        raise HTTPException(status_code=500, detail={"message": "Execution error", "error": err_payload})

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
        "result": {
            "status": result.get("status", {}),
            "stdout": result.get("stdout", ""),
            "stderr": result.get("stderr") or "",
            "compile_output": result.get("compile_output") or "",
            "time": result.get("time", ""),
            "memory": result.get("memory", ""),
        },
    }






