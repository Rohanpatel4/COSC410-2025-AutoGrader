# backend/app/api/assignments.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime
from collections import defaultdict
import re

from app.core.db import get_db
from app.models.models import (
    Assignment, Course, StudentSubmission, TestCase,
    User, RoleEnum, user_course_association
)
from app.services.piston import execute_code, get_template_languages, check_piston_available

router = APIRouter()

# ---- Supported Languages Endpoint ------------------------------------------
# Note: Using path /meta/languages to avoid path parameter conflicts

@router.get("/_languages", response_model=list[dict])
def get_supported_languages():
    """
    Get list of supported programming languages based on available templates.
    Returns a list of language objects with id and display name.
    """
    template_languages = get_template_languages()
    
    # Define display names for each language
    display_names = {
        "python": "Python",
        "java": "Java",
        "c++": "C++",
        "cpp": "C++",
        "javascript": "JavaScript",
        "typescript": "TypeScript",
        "c": "C",
        "go": "Go",
        "rust": "Rust",
        "ruby": "Ruby",
    }
    
    # Build unique list of supported languages
    languages = []
    seen = set()
    
    for template_file, piston_lang in template_languages.items():
        # Use lowercase version as the ID
        lang_id = piston_lang.lower().replace("+", "p")  # c++ -> cpp for frontend
        if lang_id == "c++":
            lang_id = "cpp"
        
        if lang_id not in seen:
            seen.add(lang_id)
            display_name = display_names.get(piston_lang.lower(), piston_lang.capitalize())
            languages.append({
                "id": lang_id,
                "name": display_name,
                "piston_name": piston_lang
            })
    
    # Sort by name
    languages.sort(key=lambda x: x["name"])
    
    return languages

# ---- helpers ---------------------------------------------------------------

def _course_by_key(db: Session, key: str) -> Optional[Course]:
    """Fetch a course by numeric id or course_code."""
    if key.isdigit():
        c = db.get(Course, int(key))
        if c:
            return c
    # For course_code lookups, if there are duplicates, return the first one by ID
    courses = db.execute(select(Course).where(Course.course_code == key).order_by(Course.id)).scalars().all()
    return courses[0] if courses else None

def _to_iso_or_raw(v):
    if hasattr(v, "isoformat"):
        try:
            return v.isoformat()
        except Exception:
            return str(v)
    return v

def _sanitize_output_for_students(stdout: str, stderr: str, test_cases: list, visible_test_case_ids: set[int]) -> tuple[str, str]:
    """
    Sanitize stdout/stderr to remove information about hidden test cases.
    
    Args:
        stdout: Raw stdout from Piston
        stderr: Raw stderr from Piston
        test_cases: All test cases (to get IDs and point values)
        visible_test_case_ids: Set of test case IDs that are visible to students
        
    Returns:
        Tuple of (sanitized_stdout, sanitized_stderr)
    """
    hidden_test_case_ids = {tc.id for tc in test_cases if not tc.visibility}
    
    def filter_line(line: str) -> bool:
        """Check if a line should be filtered out (contains hidden test case info)."""
        line_stripped = line.strip()
        # Filter out PASSED/FAILED/ERROR_/OUTPUT_/STDERR_ lines for hidden test cases
        for hidden_id in hidden_test_case_ids:
            if f"test_case_{hidden_id}:" in line_stripped:
                return True
            if line_stripped.startswith(f"ERROR_{hidden_id}:"):
                return True
            if line_stripped.startswith(f"OUTPUT_{hidden_id}:"):
                return True
            if line_stripped.startswith(f"STDERR_{hidden_id}:"):
                return True
        return False
    
    # Filter stdout
    stdout_lines = stdout.split('\n')
    filtered_stdout_lines = [line for line in stdout_lines if not filter_line(line)]
    
    # Recalculate summary if needed (to hide total count that includes hidden tests)
    sanitized_stdout = '\n'.join(filtered_stdout_lines)
    
    # Update summary section to only reflect visible test cases
    if "=== Test Results ===" in sanitized_stdout:
        lines = sanitized_stdout.split('\n')
        in_summary = False
        new_lines = []
        visible_passed = 0
        visible_failed = 0
        visible_earned = 0
        visible_total_points = sum(tc.point_value for tc in test_cases if tc.visibility)
        
        # Count visible test results from filtered lines
        for line in filtered_stdout_lines:
            line_stripped = line.strip()
            if line_stripped.startswith("PASSED:") and "test_case_" in line_stripped:
                # Extract test case ID
                match = re.search(r'test_case_(\d+):', line_stripped)
                if match:
                    test_id = int(match.group(1))
                    if test_id in visible_test_case_ids:
                        visible_passed += 1
                        # Extract points
                        points_match = re.search(r':(\d+)$', line_stripped)
                        if points_match:
                            visible_earned += int(points_match.group(1))
            elif line_stripped.startswith("FAILED:") and "test_case_" in line_stripped:
                match = re.search(r'test_case_(\d+):', line_stripped)
                if match:
                    test_id = int(match.group(1))
                    if test_id in visible_test_case_ids:
                        visible_failed += 1
        
        for line in lines:
            if line.strip() == "=== Test Results ===":
                in_summary = True
                new_lines.append(line)
            elif in_summary and line.startswith("Total:"):
                # Replace with count of only visible test cases
                visible_count = len(visible_test_case_ids)
                new_lines.append(f"Total: {visible_count}")
            elif in_summary and line.startswith("Passed:"):
                # Update to only visible passed tests
                new_lines.append(f"Passed: {visible_passed}")
            elif in_summary and line.startswith("Failed:"):
                # Update to only visible failed tests
                new_lines.append(f"Failed: {visible_failed}")
            elif in_summary and line.startswith("Earned:"):
                # Update to only visible earned points
                new_lines.append(f"Earned: {visible_earned}")
            elif in_summary and line.startswith("TotalPoints:"):
                # Update to only visible test case points
                new_lines.append(f"TotalPoints: {visible_total_points}")
            else:
                new_lines.append(line)
        sanitized_stdout = '\n'.join(new_lines)
    
    # Filter stderr similarly (though stderr usually doesn't contain test case info)
    stderr_lines = stderr.split('\n')
    filtered_stderr_lines = [line for line in stderr_lines if not filter_line(line)]
    sanitized_stderr = '\n'.join(filtered_stderr_lines)
    
    return sanitized_stdout, sanitized_stderr

def _serialize_assignment(db: Session, a: Assignment) -> dict:
    attempts = db.execute(
        select(func.count())
        .select_from(StudentSubmission)
        .where(StudentSubmission.assignment_id == a.id)
    ).scalar_one() or 0

    start = getattr(a, "start", None)
    stop = getattr(a, "stop", None)
    language = getattr(a, "language", "python")  # Default to python for backward compatibility
    instructions = getattr(a, "instructions", None)

    return {
        "id": a.id,
        "course_id": a.course_id,
        "title": a.title,
        "description": a.description,
        "language": language,
        "sub_limit": getattr(a, "sub_limit", None),
        "start": _to_iso_or_raw(start),
        "stop": _to_iso_or_raw(stop),
        "num_attempts": int(attempts),
        "instructions": instructions,
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
    Expected payload: { course_id, title, description?, language?, sub_limit?, start?, stop? }
    """
    course_id = payload.get("course_id")
    title = (payload.get("title") or "").strip()
    description = (payload.get("description") or "").strip()  # Use empty string, not None - DB requires non-null
    language = (payload.get("language") or "python").strip().lower()
    
    instructions = payload.get("instructions", [])
    # instructions is now Tiptap JSON (dict) or legacy list
    # We can do minimal validation if needed, or just trust it's valid JSON
    if instructions is not None and not isinstance(instructions, (dict, list)):
        raise HTTPException(400, "instructions must be a JSON object or list")

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
    if not language:
        raise HTTPException(400, "language is required")

    c = db.get(Course, course_id)
    if not c:
        raise HTTPException(404, "Course not found")

    a = Assignment(
        course_id=course_id,
        title=title,
        description=description,
        language=language,
        sub_limit=sub_limit,
        instructions=instructions,
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


@router.put("/{assignment_id}", response_model=dict)
def update_assignment(assignment_id: int, payload: dict, db: Session = Depends(get_db)):
    """
    Update an assignment with partial fields.
    Only provided fields will be updated; others remain unchanged.
    Expected payload: { title?, description?, language?, sub_limit?, start?, stop? }
    """
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    
    # Update title if provided
    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if not title:
            raise HTTPException(400, "title cannot be empty")
        a.title = title
    
    # Update description if provided
    if "description" in payload:
        description = (payload.get("description") or "").strip()  # Use empty string, not None - DB requires non-null
        if description is not None and not isinstance(description, str):
            raise HTTPException(400, "description must be a string")
        a.description = description
    
    # Update language if provided
    if "language" in payload:
        language = (payload.get("language") or "python").strip().lower()
        if not language:
            raise HTTPException(400, "language cannot be empty")
        a.language = language
    
    # Update instructions if provided
    if "instructions" in payload:
        instructions = payload.get("instructions")
        if instructions is not None:
            if not isinstance(instructions, (dict, list)):
                raise HTTPException(400, "instructions must be a JSON object or list")
            a.instructions = instructions
        else:
            a.instructions = None
    
    # Update sub_limit if provided
    if "sub_limit" in payload:
        sub_limit_raw = payload.get("sub_limit", None)
        if sub_limit_raw == "" or sub_limit_raw is None:
            a.sub_limit = None
        elif isinstance(sub_limit_raw, int):
            if sub_limit_raw < 0:
                raise HTTPException(400, "sub_limit must be a non-negative integer")
            a.sub_limit = sub_limit_raw
        elif isinstance(sub_limit_raw, str):
            try:
                sub_limit = int(sub_limit_raw) if sub_limit_raw.strip() else None
                if sub_limit is not None and sub_limit < 0:
                    raise HTTPException(400, "sub_limit must be a non-negative integer")
                a.sub_limit = sub_limit
            except ValueError:
                raise HTTPException(400, "sub_limit must be a valid integer or empty for unlimited")
        else:
            a.sub_limit = None
    
    # Update start date if provided
    if "start" in payload:
        start = _parse_dt(payload.get("start", None))
        if hasattr(a, "start"):
            a.start = start
    
    # Update stop date if provided
    if "stop" in payload:
        stop = _parse_dt(payload.get("stop", None))
        if hasattr(a, "stop"):
            a.stop = stop
    
    db.commit()
    db.refresh(a)
    return _serialize_assignment(db, a)

# ============================================================================
# Test Case Management Endpoints
# ============================================================================

@router.post("/{assignment_id}/test-cases/batch", status_code=201)
async def create_test_cases_batch(
    assignment_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    """
    Create multiple test cases for an assignment at once.
    Request body: { test_cases: [{ point_value, visibility, test_code, order? }, ...] }
    """
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    
    # Validate assignment has language set
    language = getattr(a, "language", None)
    if not language:
        raise HTTPException(400, "Assignment language must be set before creating test cases")
    
    test_cases_data = payload.get("test_cases", [])
    if not test_cases_data:
        raise HTTPException(400, "test_cases array is required")
    
    # Validate and set defaults for test cases
    for i, test_case in enumerate(test_cases_data):
        if "test_code" not in test_case:
            raise HTTPException(400, f"Test case {i}: test_code is required")
        if not test_case["test_code"].strip():
            raise HTTPException(400, f"Test case {i}: test_code cannot be empty")

        # Set default point_value if not provided
        if "point_value" not in test_case:
            test_case["point_value"] = 10
        elif not isinstance(test_case["point_value"], int) or test_case["point_value"] < 0:
            raise HTTPException(400, f"Test case {i}: point_value must be a non-negative integer")

        # Set default visibility if not provided
        if "visibility" not in test_case:
            test_case["visibility"] = True
    
    # Delete existing test cases for this assignment (replace all)
    existing_test_cases = db.execute(
        select(TestCase).where(TestCase.assignment_id == assignment_id)
    ).scalars().all()
    for tc in existing_test_cases:
        db.delete(tc)
    db.flush()  # Flush deletes before creating new ones
    
    # Create all test cases in batch
    created_test_cases = []
    for test_case_data in test_cases_data:
        tc = TestCase(
            assignment_id=assignment_id,
            point_value=test_case_data["point_value"],
            visibility=test_case_data.get("visibility", True),
            test_code=test_case_data["test_code"],
            order=test_case_data.get("order")
        )
        db.add(tc)
        created_test_cases.append(tc)
    
    db.commit()
    
    # Refresh all test cases to get IDs
    for tc in created_test_cases:
        db.refresh(tc)
    
    # Serialize test cases
    serialized_test_cases = [
        {
            "id": tc.id,
            "assignment_id": tc.assignment_id,
            "point_value": tc.point_value,
            "visibility": tc.visibility,
            "test_code": tc.test_code,
            "order": tc.order,
            "created_at": tc.created_at.isoformat() if tc.created_at else None
        }
        for tc in created_test_cases
    ]
    
    return {
        "ok": True,
        "test_cases": serialized_test_cases
    }


@router.get("/{assignment_id}/test-cases", response_model=list[dict])
def list_test_cases(
    assignment_id: int,
    student_id: Optional[int] = None,
    include_hidden: bool = False,
    user_id: Optional[int] = Query(None, description="User ID for authentication"),
    db: Session = Depends(get_db),
):
    """
    List all test cases for an assignment.
    - If student_id is provided and user is a student, only visible test cases are returned
    - If include_hidden is True and user is faculty, all test cases are returned
    """
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")

    # Determine user role for authentication
    user_role = None
    if user_id:
        user = db.get(User, user_id)
        if user:
            user_role = user.role

    # Determine if user is a student
    is_student = False
    if student_id:
        user = db.get(User, student_id)
        if user and user.role == RoleEnum.student:
            is_student = True

    # Fetch test cases
    query = select(TestCase).where(TestCase.assignment_id == assignment_id)

    # If student and not including hidden, filter by visibility
    # If include_hidden is True, only allow if user is faculty
    if is_student and not include_hidden:
        query = query.where(TestCase.visibility == True)
    elif include_hidden and user_role != RoleEnum.faculty:
        # Only faculty can see hidden test cases
        raise HTTPException(403, "Only faculty members can view hidden test cases")
    
    test_cases = db.execute(
        query.order_by(TestCase.order.asc().nulls_last(), TestCase.id.asc())
    ).scalars().all()
    
    # Serialize test cases
    return [
        {
            "id": tc.id,
            "assignment_id": tc.assignment_id,
            "point_value": tc.point_value,
            "visibility": tc.visibility,
            "test_code": tc.test_code,
            "order": tc.order,
            "created_at": tc.created_at.isoformat() if tc.created_at else None
        }
        for tc in test_cases
    ]


@router.get("/{assignment_id}/test-cases/{test_case_id}", response_model=dict)
def get_test_case(
    assignment_id: int,
    test_case_id: int,
    db: Session = Depends(get_db),
):
    """Get a single test case."""
    tc = db.get(TestCase, test_case_id)
    if not tc:
        raise HTTPException(404, "Test case not found")
    if tc.assignment_id != assignment_id:
        raise HTTPException(404, "Test case not found for this assignment")
    
    return {
        "id": tc.id,
        "assignment_id": tc.assignment_id,
        "point_value": tc.point_value,
        "visibility": tc.visibility,
        "test_code": tc.test_code,
        "order": tc.order,
        "created_at": tc.created_at.isoformat() if tc.created_at else None
    }


@router.put("/{assignment_id}/test-cases/{test_case_id}", response_model=dict)
def update_test_case(
    assignment_id: int,
    test_case_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    """Update a test case."""
    tc = db.get(TestCase, test_case_id)
    if not tc:
        raise HTTPException(404, "Test case not found")
    if tc.assignment_id != assignment_id:
        raise HTTPException(404, "Test case not found for this assignment")
    
    # Update fields if provided
    if "point_value" in payload:
        if not isinstance(payload["point_value"], int) or payload["point_value"] < 0:
            raise HTTPException(400, "point_value must be a non-negative integer")
        tc.point_value = payload["point_value"]
    
    if "visibility" in payload:
        tc.visibility = bool(payload["visibility"])
    
    if "test_code" in payload:
        if not payload["test_code"].strip():
            raise HTTPException(400, "test_code cannot be empty")
        tc.test_code = payload["test_code"]
    
    if "order" in payload:
        tc.order = payload["order"] if payload["order"] is not None else None
    
    db.commit()
    db.refresh(tc)
    
    return {
        "id": tc.id,
        "assignment_id": tc.assignment_id,
        "point_value": tc.point_value,
        "visibility": tc.visibility,
        "test_code": tc.test_code,
        "order": tc.order,
        "created_at": tc.created_at.isoformat() if tc.created_at else None
    }


@router.delete("/{assignment_id}/test-cases/{test_case_id}", response_model=dict)
def delete_test_case(
    assignment_id: int,
    test_case_id: int,
    db: Session = Depends(get_db),
):
    """Delete a test case."""
    tc = db.get(TestCase, test_case_id)
    if not tc:
        raise HTTPException(404, "Test case not found")
    if tc.assignment_id != assignment_id:
        raise HTTPException(404, "Test case not found for this assignment")
    
    db.delete(tc)
    db.commit()
    
    return {
        "ok": True,
        "id": test_case_id
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

    return [{"id": s.id, "grade": s.earned_points} for s in rows]

@router.post("/{assignment_id}/submit", status_code=201)
async def submit_to_assignment(
    assignment_id: int,
    submission: Optional[UploadFile] = File(None, description="Student code submission file"),
    code: Optional[str] = Form(None, description="Student code as text"),
    student_id: int = Form(...),
    db: Session = Depends(get_db),
):
    """
    Create a StudentSubmission for this assignment and run it against the
    assignment's test cases.
    Accepts either a file upload (submission) or text input (code), but at least one must be provided.
    """
    # Check if Piston (grading service) is available FIRST
    # This prevents wasting a student's attempt if the grader is down
    piston_available, piston_message = await check_piston_available()
    if not piston_available:
        raise HTTPException(
            status_code=503,
            detail=f"Grading service is currently unavailable. Your submission was NOT counted. Please try again later. ({piston_message})"
        )
    
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")

    # Get assignment language
    language = getattr(a, "language", "python")
    if not language:
        raise HTTPException(400, "Assignment language not set")

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

    # Fetch all test cases for this assignment (ordered by order or id)
    test_cases = db.execute(
        select(TestCase)
        .where(TestCase.assignment_id == assignment_id)
        .order_by(TestCase.order.asc().nulls_last(), TestCase.id.asc())
    ).scalars().all()
    
    if not test_cases:
        raise HTTPException(409, "No test cases attached to this assignment")

    # Read student code from either file or text input
    student_code = None
    if submission:
        # Validate file extension based on assignment language
        if submission.filename:
            file_ext = submission.filename.split('.')[-1].lower() if '.' in submission.filename else ''
            language_ext_map = {
                "python": ["py"],
                "java": ["java"],
                "cpp": ["cpp", "cc", "cxx"],
                "c++": ["cpp", "cc", "cxx"],
                "gcc": ["cpp", "cc", "cxx", "c"],
                "c": ["c"],
                "rust": ["rs"],
                "rs": ["rs"],
            }
            valid_extensions = language_ext_map.get(language.lower(), ["py"])  # Default to py
            if file_ext not in valid_extensions:
                raise HTTPException(
                    status_code=415,
                    detail=f"Invalid file format. Expected: {', '.join(valid_extensions)}, got: {file_ext}"
                )
        
        # Read from file upload
        try:
            sub_bytes = await submission.read()
            student_code = sub_bytes.decode("utf-8")
        except Exception as e:
            raise HTTPException(400, f"Failed to read submission file: {e}")
    elif code is not None:
        # Use text input directly
        student_code = code
    else:
        raise HTTPException(400, "Either submission file or code text must be provided")
    
    if not student_code or not student_code.strip():
        raise HTTPException(400, "Code cannot be empty")

    # Prepare test cases for execution (all test cases, including hidden ones)
    test_cases_for_execution = [
        {
            "id": tc.id,
            "point_value": tc.point_value,
            "test_code": tc.test_code
        }
        for tc in test_cases
    ]

    # Execute with Piston using new template system
    result = await execute_code(language, student_code, test_cases_for_execution)
    
    # Ensure grading structure exists
    if "grading" not in result:
        result["grading"] = {}
    
    # Check for execution errors (Piston connection issues, timeouts, etc.)
    # If there's an error in stderr and no tests were run, it's likely a grading service error
    stderr = result.get("stderr", "")
    has_tests = result["grading"].get("has_tests", False)
    status_id = result.get("status", {}).get("id", 0)
    
    # Status 13 = Internal Error, Status 5 = Time Limit Exceeded
    if status_id == 13 and not has_tests:
        # This is a grading service error, not a student code error
        error_msg = stderr if stderr else "Unknown grading service error"
        raise HTTPException(
            status_code=503,
            detail=f"Grading service error. Your submission was NOT counted. Please try again later. Error: {error_msg}"
        )
    
    # Check for invalid test configuration
    if result["grading"].get("error"):
        raise HTTPException(400, f"Invalid test configuration: {result['grading']['error']}")
    
    # Check if code execution actually happened (has_tests should be True if tests ran)
    if not has_tests and result["grading"].get("total_tests", 0) == 0:
        # If there's a compilation error, show it to the student
        if "Compilation error" in stderr:
            # This is a student error - let it save with 0 points but include the error message
            pass
        elif stderr and ("Cannot connect" in stderr or "timed out" in stderr or "temporarily unavailable" in stderr):
            # This is a service error
            raise HTTPException(
                status_code=503,
                detail=f"Grading service error. Your submission was NOT counted. Please try again later. Error: {stderr}"
            )
    
    # Calculate grade from all test cases (visible + hidden)
    total_points = result["grading"].get("total_points", 0)
    earned_points = result["grading"].get("earned_points", 0)
    
    # Handle division by zero
    if total_points > 0:
        grade = (earned_points / total_points) * 100
    else:
        grade = 0
    
    # Get test case results mapping
    test_case_results = result["grading"].get("test_case_results", {})
    
    # Create submission record
    submission_record = StudentSubmission(
        student_id=student_id,
        assignment_id=assignment_id,
        earned_points=earned_points,
        code=student_code,
        created_at=datetime.now()
    )
    db.add(submission_record)
    db.commit()
    db.refresh(submission_record)
    
    # Filter visible test cases for student response and include pass/fail status
    visible_test_cases = []
    for tc in test_cases:
        # Include all test cases in the result, but handle visibility
        # Note: test_case_results keys are integers (from piston.py parse_test_output)
        test_result = test_case_results.get(tc.id, {})
        
        tc_data = {
            "id": tc.id,
            "point_value": tc.point_value,
            "visibility": tc.visibility,
            "order": tc.order,
            "passed": test_result.get("passed", False),
            "points_earned": test_result.get("points", 0) if test_result.get("passed", False) else 0
        }
        
        if tc.visibility:
            # Visible test cases include code and per-test output/errors
            tc_data["test_code"] = tc.test_code
            # Include per-test-case output and error messages for visible tests
            if not test_result.get("passed", False):
                tc_data["error_message"] = test_result.get("error_message")
                tc_data["actual_output"] = test_result.get("actual_output")
                tc_data["stderr"] = test_result.get("stderr")
        else:
            # Hidden test cases do not include code or detailed output
            tc_data["test_code"] = None
            
        visible_test_cases.append(tc_data)
    
    # Sanitize stdout/stderr to hide information about hidden test cases
    visible_test_case_ids = {tc.id for tc in test_cases if tc.visibility}
    sanitized_stdout, sanitized_stderr = _sanitize_output_for_students(
        result.get("stdout", ""),
        result.get("stderr", ""),
        test_cases,
        visible_test_case_ids
    )
    
    # Create sanitized result for students
    sanitized_result = result.copy()
    sanitized_result["stdout"] = sanitized_stdout
    sanitized_result["stderr"] = sanitized_stderr
    
    # Extract console output (dry run output) from grading results
    console_output = result.get("grading", {}).get("console_output", "")
    
    # Return complete result with filtered test cases for students
    return {
        "ok": True,
        "submission_id": submission_record.id,
        "grade": grade,
        "result": sanitized_result,  # Use sanitized result instead of raw result
        "test_cases": visible_test_cases,  # Includes all test cases with pass/fail status (code hidden for invisible ones)
        "console_output": console_output  # Dry run output from student code
    }

@router.get("/{assignment_id}/submissions/{submission_id}/code")
def get_submission_code(
    assignment_id: int,
    submission_id: int,
    user_id: int = Query(..., description="User ID of faculty member"),
    db: Session = Depends(get_db),
):
    """
    Faculty endpoint to download student submission code as a .txt file.
    Only faculty members can access this endpoint.
    Returns a downloadable text file with the student's code.
    """
    # Verify user is faculty
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.role != RoleEnum.faculty:
        raise HTTPException(403, "Only faculty members can access submission code")
    
    # Verify assignment exists
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    
    # Get submission
    submission = db.get(StudentSubmission, submission_id)
    if not submission:
        raise HTTPException(404, "Submission not found")
    
    # Verify submission belongs to the assignment
    if submission.assignment_id != assignment_id:
        raise HTTPException(404, "Submission not found for this assignment")
    
    # Get code content (empty string if None)
    code_content = submission.code or ""
    
    # Return as downloadable text file
    return Response(
        content=code_content,
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="submission_{submission_id}.txt"'
        }
    )

@router.get("/{assignment_id}/submission-detail/{submission_id}", response_model=dict)
def get_submission_detail(
    assignment_id: int,
    submission_id: int,
    user_id: int = Query(..., description="User ID for authentication"),
    db: Session = Depends(get_db),
):
    """
    Get detailed information about a specific submission.
    Returns the submission code, student info, assignment info, and attempt number.
    Only faculty members can access this endpoint.
    """
    # Verify user is faculty
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.role != RoleEnum.faculty:
        raise HTTPException(403, "Only faculty members can access submission details")
    
    # Verify assignment exists
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    
    # Get submission
    submission = db.get(StudentSubmission, submission_id)
    if not submission:
        raise HTTPException(404, "Submission not found")
    
    # Verify submission belongs to the assignment
    if submission.assignment_id != assignment_id:
        raise HTTPException(404, "Submission not found for this assignment")
    
    # Get student info
    student = db.get(User, submission.student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    
    # Get course info
    course = db.get(Course, a.course_id)
    
    # Calculate attempt number for this submission
    all_attempts = db.execute(
        select(StudentSubmission)
        .where(
            StudentSubmission.assignment_id == assignment_id,
            StudentSubmission.student_id == submission.student_id,
        )
        .order_by(StudentSubmission.id.asc())
    ).scalars().all()
    
    attempt_number = 1
    for i, att in enumerate(all_attempts):
        if att.id == submission_id:
            attempt_number = i + 1
            break
    
    # Get all students with attempts for this assignment (for navigation)
    students_with_attempts = db.execute(
        select(User.id, User.username)
        .join(StudentSubmission, StudentSubmission.student_id == User.id)
        .where(StudentSubmission.assignment_id == assignment_id)
        .distinct()
        .order_by(User.username.asc())
    ).all()
    
    # Get total points for this assignment
    total_points = db.execute(
        select(func.sum(TestCase.point_value))
        .where(TestCase.assignment_id == assignment_id)
    ).scalar() or 0
    
    # Get all assignments for this course (for navigation dropdown)
    course_assignments = db.execute(
        select(Assignment.id, Assignment.title)
        .where(Assignment.course_id == a.course_id)
        .order_by(Assignment.id.asc())
    ).all()
    
    return {
        "submission": {
            "id": submission.id,
            "earned_points": submission.earned_points,
            "code": submission.code or "",
            "created_at": submission.created_at.isoformat() if submission.created_at else None,
        },
        "student": {
            "id": student.id,
            "username": student.username,
        },
        "assignment": {
            "id": a.id,
            "title": a.title,
            "language": getattr(a, "language", "python"),
            "total_points": total_points,
        },
        "course": {
            "id": course.id if course else None,
            "name": course.name if course else None,
            "course_code": course.course_code if course else None,
        },
        "course_assignments": [
            {"id": aid, "title": atitle}
            for (aid, atitle) in course_assignments
        ],
        "attempt_number": attempt_number,
        "total_attempts": len(all_attempts),
        "all_attempts": [
            {"id": att.id, "earned_points": att.earned_points}
            for att in all_attempts
        ],
        "students_with_attempts": [
            {"id": sid, "username": uname}
            for (sid, uname) in students_with_attempts
        ],
    }


@router.get("/{assignment_id}/students/{student_id}/attempts", response_model=list[dict])
def get_student_attempts(
    assignment_id: int,
    student_id: int,
    user_id: int = Query(..., description="User ID for authentication"),
    db: Session = Depends(get_db),
):
    """
    Get all attempts by a specific student for an assignment.
    Returns list of attempt IDs and grades for navigation.
    """
    # Verify user is faculty
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.role != RoleEnum.faculty:
        raise HTTPException(403, "Only faculty members can access student attempts")
    
    # Verify assignment exists
    a = db.get(Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    
    # Get all attempts for this student
    attempts = db.execute(
        select(StudentSubmission)
        .where(
            StudentSubmission.assignment_id == assignment_id,
            StudentSubmission.student_id == student_id,
        )
        .order_by(StudentSubmission.id.asc())
    ).scalars().all()
    
    return [
        {
            "id": att.id,
            "earned_points": att.earned_points,
            "created_at": att.created_at.isoformat() if att.created_at else None,
        }
        for att in attempts
    ]


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
            StudentSubmission.earned_points
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

    for sid, sub_id, earned_points in att_rows:
        attempts_by_student[sid].append({"id": sub_id, "earned_points": earned_points})
        if earned_points is not None:
            if sid not in best_by_student:
                best_by_student[sid] = earned_points
            else:
                best_by_student[sid] = max(best_by_student[sid], earned_points)

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

    # columns - include total points for each assignment
    assigns = db.execute(
        select(Assignment.id, Assignment.title)
        .where(Assignment.course_id == c.id)
        .order_by(Assignment.id.asc())
    ).all()

    assignments = []
    for aid, title in assigns:
        # Calculate total points for this assignment (sum of all test case point values)
        total_points = db.execute(
            select(func.sum(TestCase.point_value))
            .where(TestCase.assignment_id == aid)
        ).scalar() or 0

        assignments.append({
            "id": aid,
            "title": title,
            "total_points": total_points
        })
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
            func.max(StudentSubmission.earned_points)
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





