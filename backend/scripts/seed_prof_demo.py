#!/usr/bin/env python3
"""
Seed comprehensive demo data for profdemo@wofford.edu.

Creates:
- profdemo@wofford.edu (faculty)
- studemo@wofford.edu (student)
- 14 additional students with common names
- MATH-123 course with all 15 students
- COSC-235 course with professor + 4 selected students (excluding studemo)
- Calculator assignment in MATH-123 (2 attempts)
- Calculator and Text Analysis assignments in COSC-235 (2 and unlimited attempts)
- Randomized submissions for all enrolled students
"""

from __future__ import annotations

import os
import random
import secrets
import string
from datetime import datetime
from pathlib import Path

from sqlalchemy import and_, select

from app.core.db import SessionLocal
from app.models.models import (
    Assignment,
    Course,
    RoleEnum,
    StudentSubmission,
    TestCase,
    User,
    user_course_association,
)
from passlib.hash import pbkdf2_sha256


# Common student names for demo
STUDENT_NAMES = [
    "emma.wilson",
    "liam.johnson",
    "olivia.brown",
    "noah.davis",
    "ava.martinez",
    "ethan.garcia",
    "sophia.rodriguez",
    "mason.wilson",
    "isabella.anderson",
    "william.thomas",
    "mia.jackson",
    "james.white",
    "charlotte.harris",
    "benjamin.martin",
]


def _ensure_user(session, username: str, role: RoleEnum, password: str = "secret") -> User:
    """Create or retrieve a user."""
    user = session.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if user:
        return user

    user = User(
        username=username,
        role=role,
        password_hash=pbkdf2_sha256.hash(password),
        created_at=datetime.utcnow(),
    )
    session.add(user)
    session.flush()
    return user


def _generate_enrollment_key(session, length: int = 12) -> str:
    """Generate a unique enrollment key."""
    alphabet = string.ascii_uppercase + string.digits
    while True:
        key = "".join(secrets.choice(alphabet) for _ in range(length))
        exists = session.execute(select(Course.id).where(Course.enrollment_key == key)).first()
        if not exists:
            return key


def _ensure_course(session, code: str, name: str, description: str, professor: User, recreate: bool = False) -> Course:
    """Create or retrieve a course. If recreate=True, delete existing course first."""
    course = session.execute(
        select(Course).where(Course.course_code == code)
    ).scalar_one_or_none()
    
    if course and recreate:
        print(f"  Deleting existing course: {course.name} ({course.course_code})")
        session.delete(course)
        session.flush()
        course = None
    
    if not course:
        course = Course(
            course_code=code,
            name=name,
            description=description,
            enrollment_key=_generate_enrollment_key(session),
        )
        session.add(course)
        session.flush()

    if professor not in course.professors:
        course.professors.append(professor)
        session.flush()

    return course


def _enroll_student(session, course: Course, student: User) -> None:
    """Enroll a student in a course."""
    exists = session.execute(
        select(user_course_association.c.id).where(
            and_(
                user_course_association.c.user_id == student.id,
                user_course_association.c.course_id == course.id,
            )
        )
    ).first()
    if exists:
        return

    session.execute(
        user_course_association.insert().values(user_id=student.id, course_id=course.id)
    )


def _create_assignment(
    session, course: Course, title: str, description: str, sub_limit: int | None
) -> Assignment:
    """Create an assignment."""
    assignment = Assignment(
        title=title,
        description=description,
        course_id=course.id,
        sub_limit=sub_limit,
        start=None,
        stop=None,
    )
    session.add(assignment)
    session.flush()
    return assignment


def _upload_test_file(session, assignment: Assignment, file_path: Path) -> None:
    """Upload a test file to an assignment."""
    if not file_path.exists():
        print(f"Warning: Test file not found: {file_path}")
        return

    with open(file_path, "r") as f:
        content = f.read()

    test_case = TestCase(
        assignment_id=assignment.id,
        filename=content,
    )
    session.add(test_case)
    session.flush()


def _create_submission(
    session, assignment: Assignment, student: User, grade: int
) -> StudentSubmission:
    """Create a student submission."""
    submission = StudentSubmission(
        student_id=student.id,
        assignment_id=assignment.id,
        grade=grade,
    )
    session.add(submission)
    session.flush()
    return submission


def main() -> None:
    """Main seeding function."""
    session = SessionLocal()
    try:
        # Get project root and manual test files directory
        project_root = Path(__file__).parent.parent.parent
        manual_test_dir = project_root / "manual_test_files"
        
        # Create users
        print("Creating users...")
        professor = _ensure_user(session, "profdemo@wofford.edu", RoleEnum.faculty)
        studemo = _ensure_user(session, "studemo@wofford.edu", RoleEnum.student)
        
        other_students = [
            _ensure_user(session, f"{name}@wofford.edu", RoleEnum.student)
            for name in STUDENT_NAMES
        ]
        all_students = [studemo] + other_students
        
        # Create MATH-123 course with all 15 students
        print("Creating MATH-123 course...")
        math_course = _ensure_course(
            session,
            "MATH-123",
            "MATH-123",
            "show 15 students",
            professor,
        )
        
        for student in all_students:
            _enroll_student(session, math_course, student)
        
        # Create COSC-235 course with professor + 4 selected students (excluding studemo)
        print("Creating COSC-235 course...")
        cosc_course = _ensure_course(
            session,
            "COSC-235",
            "COSC-235 Demo Grading",
            "Demo course for grading showcase",
            professor,
            recreate=True,  # Delete old course if it exists
        )
        
        # Select 4 random students from other_students (excluding studemo)
        selected_students = random.sample(other_students, 4)
        for student in selected_students:
            _enroll_student(session, cosc_course, student)
        
        session.commit()
        
        # Create assignments
        print("Creating assignments...")
        
        # MATH-123: Calculator assignment (2 attempts)
        math_calc_assignment = _create_assignment(
            session,
            math_course,
            "Calculator Basics",
            "Implement basic calculator functions",
            2,  # 2 attempts
        )
        
        calc_test_file = manual_test_dir / "calculator_demo" / "tests" / "calculator_basic.py"
        _upload_test_file(session, math_calc_assignment, calc_test_file)
        
        # COSC-235: Calculator assignment (2 attempts)
        cosc_calc_assignment = _create_assignment(
            session,
            cosc_course,
            "Calculator Basics",
            "Implement basic calculator functions",
            2,  # 2 attempts
        )
        _upload_test_file(session, cosc_calc_assignment, calc_test_file)
        
        # COSC-235: Text Analysis assignment (unlimited attempts, but we'll do up to 5)
        cosc_text_assignment = _create_assignment(
            session,
            cosc_course,
            "Text Analysis Suite",
            "Implement text processing functions",
            None,  # unlimited
        )
        
        text_test_file = manual_test_dir / "string_analysis_demo" / "tests" / "text_analysis_suite.py"
        _upload_test_file(session, cosc_text_assignment, text_test_file)
        
        session.commit()
        
        # Create submissions
        print("Creating submissions...")
        
        # Calculator submission grades
        calc_grades = [100, 80, 60, 40, 20, 0]
        
        # MATH-123 Calculator: All 15 students, up to 2 attempts each
        calc_submission_dir = manual_test_dir / "calculator_demo" / "submissions"
        for student in all_students:
            num_attempts = random.randint(1, 2)
            for _ in range(num_attempts):
                grade = random.choice(calc_grades)
                _create_submission(session, math_calc_assignment, student, grade)
        
        # COSC-235 Calculator: 4 selected students, up to 2 attempts each
        for student in selected_students:
            num_attempts = random.randint(1, 2)
            for _ in range(num_attempts):
                grade = random.choice(calc_grades)
                _create_submission(session, cosc_calc_assignment, student, grade)
        
        # COSC-235 Text Analysis: 4 selected students, 1-5 attempts each
        text_grades = [100, 68, 59, 23, 8, 0]
        for student in selected_students:
            num_attempts = random.randint(1, 5)
            for _ in range(num_attempts):
                grade = random.choice(text_grades)
                _create_submission(session, cosc_text_assignment, student, grade)
        
        session.commit()
        
        print("\n" + "=" * 60)
        print("Demo seeding completed successfully!")
        print("=" * 60)
        print(f"\nProfessor: profdemo@wofford.edu (password: secret)")
        print(f"Student (not in COSC-235): studemo@wofford.edu (password: secret)")
        print(f"\nMATH-123 ({math_course.course_code}):")
        print(f"  - Enrolled: 15 students (including studemo)")
        print(f"  - Assignments: 1 (Calculator, 2 attempts)")
        print(f"  - Enrollment Key: {math_course.enrollment_key}")
        print(f"\nCOSC-235 ({cosc_course.course_code}):")
        print(f"  - Enrolled: 4 students (excluding studemo)")
        print(f"  - Students: {', '.join(s.username for s in selected_students)}")
        print(f"  - Assignments: 2 (Calculator 2 attempts, Text Analysis unlimited)")
        print(f"  - Enrollment Key: {cosc_course.enrollment_key}")
        print("\nAll students have randomized submission attempts and grades.")
        print("=" * 60)
        
    except Exception as e:
        session.rollback()
        print(f"Error during seeding: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()

