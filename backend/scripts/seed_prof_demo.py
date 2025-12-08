#!/usr/bin/env python3
"""
Seed comprehensive demo data with simplified users.

Creates:
- prof.x@wofford.edu (faculty) - has all courses
- prof.y@wofford.edu (faculty) - no courses
- alice@wofford.edu (student) - enrolled in prof.x's courses only
- MATH-123 course with prof.x + alice
- COSC-235 course with prof.x + alice
- Calculator assignment in MATH-123 (10 attempts)
- Calculator and Text Analysis assignments in COSC-235 (10 attempts and unlimited)
- No submissions/grades seeded
"""

from __future__ import annotations

import os
import random
import secrets
import string
from datetime import datetime, timezone, timedelta
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


# No additional students needed - only alice@wofford.edu


def _ensure_user(session, username: str, role: RoleEnum, password: str = "secret") -> User:
    """Create or retrieve a user."""
    user = session.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if user:
        return user

    user = User(
        username=username,
        role=role,
        password_hash=pbkdf2_sha256.hash(password),
        created_at=datetime.now(timezone.utc),
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
    session, course: Course, title: str, description: str, language: str, sub_limit: int | None,
    instructions: dict | None = None, start: datetime | None = None, stop: datetime | None = None
) -> Assignment:
    """Create an assignment."""
    assignment = Assignment(
        title=title,
        description=description,
        course_id=course.id,
        language=language,
        sub_limit=sub_limit,
        start=start,
        stop=stop,
        instructions=instructions,
    )
    session.add(assignment)
    session.flush()
    return assignment


def _create_test_case(
    session, assignment: Assignment, test_code: str, point_value: int, visibility: bool, order: int
) -> TestCase:
    """Create a test case with individual point value."""
    test_case = TestCase(
        assignment_id=assignment.id,
        test_code=test_code,
        point_value=point_value,
        visibility=visibility,
        order=order,
        created_at=datetime.now(timezone.utc),
    )
    session.add(test_case)
    session.flush()
    return test_case


def _create_submission(
    session, assignment: Assignment, student: User, grade: int
) -> StudentSubmission:
    """Create a student submission."""
    submission = StudentSubmission(
        student_id=student.id,
        assignment_id=assignment.id,
        earned_points=grade,
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
        prof_x = _ensure_user(session, "prof.x@wofford.edu", RoleEnum.faculty)
        prof_y = _ensure_user(session, "prof.y@wofford.edu", RoleEnum.faculty)
        alice = _ensure_user(session, "alice@wofford.edu", RoleEnum.student)
        
        # Create MATH-123 course with prof.x and alice (prof.y has no courses)
        print("Creating MATH-123 course...")
        math_course = _ensure_course(
            session,
            "MATH-123",
            "MATH-123",
            "Demo course with prof.x and alice",
            prof_x,  # Only prof.x has courses
        )
        
        # Enroll alice
        _enroll_student(session, math_course, alice)
        
        # Create COSC-235 course with prof.x and alice (prof.y has no courses)
        print("Creating COSC-235 course...")
        cosc_course = _ensure_course(
            session,
            "COSC-235",
            "COSC-235 Demo Grading",
            "Demo course for grading showcase",
            prof_x,  # Only prof.x has courses
            recreate=True,  # Delete old course if it exists
        )
        
        # Enroll alice
        _enroll_student(session, cosc_course, alice)
        
        session.commit()
        
        # Create assignments
        print("Creating assignments...")
        
        # Set up dates
        now = datetime.now(timezone.utc)
        yesterday = now - timedelta(days=1)  # Past due assignment
        tomorrow = now + timedelta(days=1)
        two_days_from_now = now + timedelta(days=2)  # Number Operations due date
        one_week_from_now = now + timedelta(days=7)  # Upcoming assignment due date
        
        # MATH-123: Simple Calculator assignment (Python, 10 attempts)
        calc_instructions = {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "Implement basic calculator functions in Python. This assignment focuses on fundamental arithmetic operations.", "marks": [{"type": "bold"}]}
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "You need to implement the following functions:"}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "add(a, b)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Returns the sum of two numbers"}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "subtract(a, b)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Returns the difference of two numbers"}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "multiply(a, b)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Returns the product of two numbers"}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "divide(a, b)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Returns the quotient of two numbers (as a float)"}
                    ]}]},
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "This assignment is part of a series. After completing this, you'll work on string operations and number operations in other assignments.", "marks": [{"type": "italic"}]}
                ]}
            ]
        }
        
        math_calc_assignment = _create_assignment(
            session,
            math_course,
            "Calculator Basics",
            "Implement simple calculator functions in Python. This assignment introduces basic arithmetic operations and prepares you for more complex string and number manipulation tasks in subsequent assignments.",
            "python",
            10,  # 10 attempts
            instructions=calc_instructions,
        )
        
        # Create individual test cases with database points (simple assertions)
        _create_test_case(
            session, math_calc_assignment,
            "assert add(2, 3) == 5\nassert add(10, 5) == 15",
            25, True, 1
        )
        _create_test_case(
            session, math_calc_assignment,
            "assert subtract(10, 4) == 6\nassert subtract(20, 8) == 12",
            25, True, 2
        )
        _create_test_case(
            session, math_calc_assignment,
            "assert multiply(3, 4) == 12\nassert multiply(5, 6) == 30",
            25, True, 3
        )
        _create_test_case(
            session, math_calc_assignment,
            "assert divide(8, 2) == 4.0\nassert divide(15, 3) == 5.0",
            25, False, 4  # Hidden test case
        )
        
        # COSC-235: Simple String Operations assignment (Python, 10 attempts)
        string_instructions = {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "Implement string manipulation functions in Python. This assignment builds on the calculator basics you learned earlier, now applying similar logic to text processing.", "marks": [{"type": "bold"}]}
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "You need to implement the following functions:"}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "reverse_string(s)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Takes a string and returns it reversed. For example, reverse_string('hello') should return 'olleh'."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "count_vowels(s)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Counts and returns the number of vowels (a, e, i, o, u) in a string, case-insensitive. For example, count_vowels('hello') returns 2."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "is_palindrome(s)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Returns True if the string reads the same forwards and backwards (ignoring case), False otherwise. For example, is_palindrome('racecar') returns True."}
                    ]}]},
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "This assignment complements the Calculator Basics assignment. After this, you'll work on Number Operations in Rust to practice with a different programming language.", "marks": [{"type": "italic"}]}
                ]}
            ]
        }
        
        cosc_string_assignment = _create_assignment(
            session,
            cosc_course,
            "String Operations",
            "Implement simple string manipulation functions in Python. This assignment builds on calculator basics and prepares you for number operations in Rust. Learn to work with strings, character counting, and pattern recognition.",
            "python",
            10,  # 10 attempts
            instructions=string_instructions,
            start=now - timedelta(days=2),  # Started 2 days ago, active
            stop=None,  # Active, no due date
        )
        
        # Create individual test cases with database points (simple assertions)
        _create_test_case(
            session, cosc_string_assignment,
            "assert reverse_string('hello') == 'olleh'\nassert reverse_string('world') == 'dlrow'",
            30, True, 1
        )
        _create_test_case(
            session, cosc_string_assignment,
            "assert count_vowels('hello') == 2\nassert count_vowels('aeiou') == 5",
            30, True, 2
        )
        _create_test_case(
            session, cosc_string_assignment,
            "assert is_palindrome('racecar') == True\nassert is_palindrome('hello') == False",
            20, True, 3  # Now visible
        )
        _create_test_case(
            session, cosc_string_assignment,
            "assert is_palindrome('A man a plan a canal Panama') == False\nassert is_palindrome('level') == True",
            20, False, 4  # Hidden test case
        )
        
        # COSC-235: Simple Number Operations assignment (Rust, unlimited attempts, due in 2 days)
        rust_instructions = {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "Implement number operations in Rust. This assignment continues the progression from Calculator Basics (Python) and String Operations (Python), now introducing you to Rust's type system and syntax.", "marks": [{"type": "bold"}]}
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "You need to implement the following functions:"}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "fn add(a: i32, b: i32) -> i32", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Returns the sum of two integers. Similar to the add function from Calculator Basics, but using Rust syntax."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "fn multiply(a: i32, b: i32) -> i32", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Returns the product of two integers. Builds on the multiply function from Calculator Basics."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "fn is_even(n: i32) -> bool", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Returns true if the number is even, false otherwise. This introduces boolean logic similar to is_palindrome from String Operations."}
                    ]}]},
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "This assignment completes the series: Calculator Basics → String Operations → Number Operations. You'll practice the same concepts across different languages and paradigms.", "marks": [{"type": "italic"}]}
                ]}
            ]
        }
        
        cosc_rust_assignment = _create_assignment(
            session,
            cosc_course,
            "Number Operations",
            "Implement simple number operations in Rust. This assignment completes the series started with Calculator Basics and String Operations, introducing Rust's type system while reinforcing concepts from previous assignments.",
            "rust",
            None,  # unlimited attempts
            instructions=rust_instructions,
            start=now - timedelta(days=1),  # Started yesterday, already active
            stop=two_days_from_now,  # Due in 2 days
        )
        
        # Create individual test cases with database points for Rust (simple assertions)
        _create_test_case(
            session, cosc_rust_assignment,
            "assert_eq!(add(5, 3), 8);\nassert_eq!(add(10, 20), 30);",
            30, True, 1
        )
        _create_test_case(
            session, cosc_rust_assignment,
            "assert_eq!(multiply(4, 7), 28);\nassert_eq!(multiply(3, 5), 15);",
            30, True, 2
        )
        _create_test_case(
            session, cosc_rust_assignment,
            "assert_eq!(is_even(4), true);\nassert_eq!(is_even(5), false);\nassert_eq!(is_even(0), true);",
            40, False, 3  # Hidden test case
        )
        
        # COSC-235: Third assignment starting tomorrow
        third_instructions = {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "This is the third assignment in the series. Complete Calculator Basics and String Operations first, then tackle this challenge.", "marks": [{"type": "bold"}]}
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "This assignment will be available starting tomorrow. Make sure you've completed the previous assignments to prepare for this one."}
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "The concepts from Calculator Basics and String Operations will be essential for success here.", "marks": [{"type": "italic"}]}
                ]}
            ]
        }
        
        third_assignment = _create_assignment(
            session,
            cosc_course,
            "Advanced Operations",
            "This assignment builds on Calculator Basics and String Operations. It will be available starting tomorrow and will combine concepts from both previous assignments.",
            "python",
            10,  # 10 attempts
            instructions=third_instructions,
            start=tomorrow,  # Starts tomorrow
            stop=None,  # No due date set yet
        )
        
        # Create placeholder test cases for third assignment
        _create_test_case(
            session, third_assignment,
            "# Placeholder test case\n# This assignment starts tomorrow",
            0, True, 1
        )
        
        # COSC-235: Upcoming assignment (due in 1 week)
        upcoming_instructions = {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "This assignment is upcoming and will be due in one week. Complete the current assignments (String Operations and Number Operations) to prepare.", "marks": [{"type": "bold"}]}
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "You will need to implement the following function:"}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "calculate_average(numbers)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Takes a list of numbers and returns their average. For example, calculate_average([1, 2, 3, 4, 5]) should return 3.0."}
                    ]}]},
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "This assignment combines concepts from Calculator Basics (arithmetic) and String Operations (working with collections). Make sure you've completed those first!", "marks": [{"type": "italic"}]}
                ]}
            ]
        }
        
        upcoming_assignment = _create_assignment(
            session,
            cosc_course,
            "Calculate Average",
            "Calculate the average of a list of numbers. This upcoming assignment combines arithmetic from Calculator Basics with list processing concepts. Due in one week.",
            "python",
            10,  # 10 attempts
            instructions=upcoming_instructions,
            start=now,  # Available now
            stop=one_week_from_now,  # Due in 1 week
        )
        
        # Create test cases for upcoming assignment
        _create_test_case(
            session, upcoming_assignment,
            "assert calculate_average([1, 2, 3, 4, 5]) == 3.0\nassert calculate_average([10, 20, 30]) == 20.0",
            50, True, 1
        )
        _create_test_case(
            session, upcoming_assignment,
            "assert calculate_average([5]) == 5.0\nassert calculate_average([1, 1, 1, 1]) == 1.0",
            50, False, 2  # Hidden test case
        )
        
        # COSC-235: Past due assignment
        past_due_instructions = {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "This assignment was due yesterday. It serves as a review of basic Python concepts.", "marks": [{"type": "bold"}]}
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "You need to implement the following function:"}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "max_of_three(a, b, c)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Returns the maximum of three numbers. For example, max_of_three(1, 5, 3) should return 5."}
                    ]}]},
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "Note: This assignment is past due. Late submissions may not be accepted.", "marks": [{"type": "italic"}]}
                ]}
            ]
        }
        
        past_due_assignment = _create_assignment(
            session,
            cosc_course,
            "Max of Three",
            "Find the maximum of three numbers. This was a simple introductory assignment that was due yesterday.",
            "python",
            5,  # 5 attempts
            instructions=past_due_instructions,
            start=now - timedelta(days=7),  # Started a week ago
            stop=yesterday,  # Due yesterday (past due)
        )
        
        # Create test cases for past due assignment
        _create_test_case(
            session, past_due_assignment,
            "assert max_of_three(1, 5, 3) == 5\nassert max_of_three(10, 2, 8) == 10",
            50, True, 1
        )
        _create_test_case(
            session, past_due_assignment,
            "assert max_of_three(-5, -1, -10) == -1\nassert max_of_three(0, 0, 0) == 0",
            50, False, 2  # Hidden test case
        )
        
        session.commit()
        
        # No submissions created - assignments are ready but no grades seeded
        
        print("\n" + "=" * 60)
        print("Demo seeding completed successfully!")
        print("=" * 60)
        print(f"\nProfessors:")
        print(f"  - prof.x@wofford.edu (password: secret) - has all courses")
        print(f"  - prof.y@wofford.edu (password: secret) - no courses")
        print(f"\nStudent (enrolled in prof.x's courses):")
        print(f"  - alice@wofford.edu (password: secret)")
        print(f"\nMATH-123 ({math_course.course_code}):")
        print(f"  - Professor: prof.x@wofford.edu")
        print(f"  - Enrolled: alice@wofford.edu")
        print(f"  - Assignments: 1 (Calculator Basics, Python, 10 attempts)")
        print(f"    - 4 test cases with database points: 25+25+25+25 = 100 total points")
        print(f"  - Enrollment Key: {math_course.enrollment_key}")
        print(f"\nCOSC-235 ({cosc_course.course_code}):")
        print(f"  - Professor: prof.x@wofford.edu")
        print(f"  - Enrolled: alice@wofford.edu")
        print(f"  - Assignments:")
        print(f"    1. Max of Three (Python, 5 attempts) - PAST DUE")
        print(f"       - 2 test cases: 50+50 = 100 points (1 visible, 1 hidden)")
        print(f"       - Due: {yesterday.strftime('%Y-%m-%d %H:%M')} (yesterday - past due)")
        print(f"    2. String Operations (Python, 10 attempts) - ACTIVE")
        print(f"       - 4 test cases: 30+30+20+20 = 100 points (3 visible, 1 hidden)")
        print(f"       - is_palindrome is now visible")
        print(f"    3. Number Operations (Rust, unlimited attempts) - ACTIVE")
        print(f"       - 3 test cases: 30+30+40 = 100 points (2 visible, 1 hidden)")
        print(f"       - Due: {two_days_from_now.strftime('%Y-%m-%d %H:%M')} (2 days from now)")
        print(f"    4. Calculate Average (Python, 10 attempts) - UPCOMING")
        print(f"       - 2 test cases: 50+50 = 100 points (1 visible, 1 hidden)")
        print(f"       - Due: {one_week_from_now.strftime('%Y-%m-%d %H:%M')} (1 week from now)")
        print(f"    5. Advanced Operations (Python, 10 attempts) - FUTURE")
        print(f"       - Starts: {tomorrow.strftime('%Y-%m-%d %H:%M')} (tomorrow)")
        print(f"  - Enrollment Key: {cosc_course.enrollment_key}")
        print("\nAssignments have linked descriptions and instructions.")
        print("Test cases use database points (individual point values per test case).")
        print("No submissions/grades seeded - assignments are ready for students to submit.")
        print("=" * 60)
        
    except Exception as e:
        session.rollback()
        print(f"Error during seeding: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()

