# backend/app/api/assignments.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import Optional

from app.core.db import get_db
from app.models.models import (
    Assignment, Course, StudentSubmission, TestCase,
    StudentRegistration, User, RoleEnum
)

# (optional) reuse your Judge0 client
from app.judge0_client import get_judge0_client

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

    # Simple rule: keep only the latest test row per assignment (optional)
    # If you want multiple tests, remove this delete section.
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
        # You can relax this during dev if needed
        raise HTTPException(400, "Only students can submit")

    # optional: ensure enrollment
    reg = db.execute(
        select(StudentRegistration).where(
            StudentRegistration.student_id == student_id,
            StudentRegistration.course_id == a.course_id,
        )
    ).scalar_one_or_none()
    # In dev you might allow missing enrollment; here we warn instead of block:
    if not reg:
        # raise HTTPException(403, "Student not registered for this course")
        pass

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

    # run via Judge0
    try:
        client = get_judge0_client()
        token = client.create_submission(
            source_code=student_code,
            language_id=71,   # Python 3.8.1 (align with your attempt_submission_test)
            stdin=tc.var_char,
        )
        result = client.wait_for_completion(token, timeout=30)
    except Exception as e:
        # Preserve friendly debug shape like your other route
        err_payload = e.args[0] if (hasattr(e, "args") and e.args and isinstance(e.args[0], dict)) else {"error": repr(e)}
        raise HTTPException(status_code=500, detail={"message": "Judge0 error", "judge0_debug": err_payload})

    # toy grading rule (replace with your real rubric):
    # if program produced any stdout and status is Accepted → 100 else 0
    status_name = (result.get("status") or {}).get("description") or ""
    stdout = result.get("stdout") or ""
    grade = 100 if ("Accepted" in status_name and stdout.strip()) else 0

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
        "result": {
            "status": result.get("status", {}),
            "stdout": stdout,
            "stderr": result.get("stderr") or "",
            "compile_output": result.get("compile_output") or "",
            "time": result.get("time", ""),
            "memory": result.get("memory", ""),
        },
    }






