#!/usr/bin/env python3
"""
Demo seed for presentation/showcase.

Creates:
- 3 courses assigned to prof.x@wofford.edu (profx)
- 4 assignments (Python, Java, C++, Rust) spread across courses
- Various due dates (no due date, due soon, due later)
- 5 test cases per assignment (3 visible, 2 hidden)
- Point values: 5, 10, 15, 20
- Different functions tested per assignment
- Instructions as bullet points
"""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone, timedelta

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models.models import (
    Assignment,
    Course,
    RoleEnum,
    TestCase,
    User,
    user_course_association,
)


def _generate_enrollment_key(session, length: int = 12) -> str:
    """Generate a unique enrollment key."""
    alphabet = string.ascii_uppercase + string.digits
    while True:
        key = "".join(secrets.choice(alphabet) for _ in range(length))
        exists = session.execute(select(Course.id).where(Course.enrollment_key == key)).first()
        if not exists:
            return key


def _get_or_create_profx(session) -> User:
    """Get or create prof.x@wofford.edu (profx)."""
    profx = session.execute(
        select(User).where(User.username == "prof.x@wofford.edu")
    ).scalar_one_or_none()
    
    if not profx:
        from passlib.hash import pbkdf2_sha256
        profx = User(
            id=301,
            username="prof.x@wofford.edu",
            role=RoleEnum.faculty,
            password_hash=pbkdf2_sha256.hash("secret"),
            created_at=datetime.now(timezone.utc),
        )
        session.add(profx)
        session.flush()
    
    return profx


def _create_course(session, code: str, name: str, description: str, professor: User) -> Course:
    """Create a course or get existing one."""
    course = session.execute(
        select(Course).where(Course.course_code == code)
    ).scalar_one_or_none()
    
    if course:
        print(f"  Course {code} already exists, deleting and recreating...")
        session.delete(course)
        session.flush()
    
    course = Course(
        course_code=code,
        name=name,
        description=description,
        enrollment_key=_generate_enrollment_key(session),
    )
    session.add(course)
    session.flush()
    
    course.professors.append(professor)
    session.flush()
    
    return course


def _create_assignment(
    session,
    course: Course,
    title: str,
    description: str,
    language: str,
    instructions: dict,
    sub_limit: int | None,
    start: datetime | None,
    stop: datetime | None,
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
    session,
    assignment: Assignment,
    test_code: str,
    point_value: int,
    visibility: bool,
    order: int,
) -> TestCase:
    """Create a test case."""
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


def main() -> None:
    """Main seeding function."""
    session = SessionLocal()
    
    try:
        print("=" * 60)
        print("Demo Seed - Creating courses and assignments for profx")
        print("=" * 60)
        
        # Get or create profx
        print("\n[1] Getting/creating prof.x@wofford.edu...")
        profx = _get_or_create_profx(session)
        print(f"    Professor ID: {profx.id}")
        
        # Define dates
        now = datetime.now(timezone.utc)
        due_soon = now + timedelta(days=2)  # Due in 2 days
        due_later = now + timedelta(days=14)  # Due in 2 weeks
        start_past = now - timedelta(days=7)  # Started a week ago
        start_now = now
        
        # ========================================================================
        # COURSE 1: COSC-101 - Introduction to Programming (Python)
        # ========================================================================
        print("\n[2] Creating COSC-101: Introduction to Programming...")
        cosc101 = _create_course(
            session,
            "COSC-101",
            "Introduction to Programming",
            "An introductory course covering fundamental programming concepts using Python. Students will learn variables, control structures, functions, and basic data structures.",
            profx,
        )
        
        # Assignment 1: Python - Math Functions (Due Soon)
        print("    Creating Python assignment: Math Functions...")
        python_instructions = {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "Implement the following mathematical functions in Python:", "marks": [{"type": "bold"}]}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "factorial(n)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Calculate the factorial of a non-negative integer n. The factorial of n (written as n!) is the product of all positive integers less than or equal to n. For example, factorial(5) = 5 × 4 × 3 × 2 × 1 = 120. By definition, factorial(0) = 1."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "is_prime(n)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Determine whether a positive integer n is a prime number. A prime number is a natural number greater than 1 that has no positive divisors other than 1 and itself. Return True if n is prime, False otherwise. Note: 1 is NOT considered prime."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "fibonacci(n)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Return the nth number in the Fibonacci sequence (0-indexed). The Fibonacci sequence starts with 0, 1, and each subsequent number is the sum of the two preceding ones: 0, 1, 1, 2, 3, 5, 8, 13, 21... So fibonacci(0) = 0, fibonacci(1) = 1, fibonacci(6) = 8."}
                    ]}]},
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "Requirements:", "marks": [{"type": "bold"}]}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "All functions should handle edge cases appropriately"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "You may use iteration or recursion for your implementations"}]}]},
                ]}
            ]
        }
        
        python_assignment = _create_assignment(
            session,
            cosc101,
            "Math Functions",
            "Implement fundamental mathematical functions including factorial, prime checking, and Fibonacci sequence generation. This assignment tests your understanding of loops, recursion, and mathematical algorithms.",
            "python",
            python_instructions,
            3,  # 3 attempts
            start_past,
            due_soon,  # Due soon!
        )
        
        # Python Test Cases
        python_test_cases = [
            # Visible test cases (3)
            ("assert factorial(0) == 1\nassert factorial(1) == 1", 10, True, 1),
            ("assert factorial(5) == 120\nassert factorial(10) == 3628800", 15, True, 2),
            ("assert is_prime(2) == True\nassert is_prime(17) == True\nassert is_prime(4) == False", 20, True, 3),
            # Hidden test cases (2)
            ("assert fibonacci(0) == 0\nassert fibonacci(1) == 1\nassert fibonacci(10) == 55", 20, False, 4),
            ("assert is_prime(1) == False\nassert is_prime(97) == True\nassert factorial(7) == 5040", 15, False, 5),
        ]
        
        for test_code, points, visible, order in python_test_cases:
            _create_test_case(session, python_assignment, test_code, points, visible, order)
        
        # ========================================================================
        # COURSE 2: COSC-201 - Data Structures (Java + C++)
        # ========================================================================
        print("\n[3] Creating COSC-201: Data Structures...")
        cosc201 = _create_course(
            session,
            "COSC-201",
            "Data Structures",
            "A comprehensive study of data structures and algorithms. Topics include arrays, linked lists, trees, graphs, sorting, and searching algorithms.",
            profx,
        )
        
        # Assignment 2: Java - String Operations (Due Later)
        print("    Creating Java assignment: String Operations...")
        java_instructions = {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "Create a class called Solution with the following static methods for string manipulation:", "marks": [{"type": "bold"}]}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "reverseString(String s)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Takes a string as input and returns a new string with all characters in reverse order. For example, reverseString(\"hello\") should return \"olleh\". An empty string should return an empty string."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "countVowels(String s)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Count and return the total number of vowels (a, e, i, o, u) in the given string. The counting should be case-insensitive, so both 'A' and 'a' count as vowels. For example, countVowels(\"Hello World\") returns 3."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "isPalindrome(String s)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Determine if the given string reads the same forwards and backwards, ignoring case. Return true if it's a palindrome, false otherwise. For example, isPalindrome(\"RaceCar\") returns true, while isPalindrome(\"Hello\") returns false. An empty string is considered a palindrome."}
                    ]}]},
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "Requirements:", "marks": [{"type": "bold"}]}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "All methods must be public and static"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Handle empty strings gracefully (do not throw exceptions)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "You may use any String methods available in Java"}]}]},
                ]}
            ]
        }
        
        java_assignment = _create_assignment(
            session,
            cosc201,
            "String Operations",
            "Implement a suite of string manipulation methods in Java. You will practice working with String methods, loops, and character comparison while building utility functions commonly used in text processing.",
            "java",
            java_instructions,
            5,  # 5 attempts
            start_now,
            due_later,  # Due in 2 weeks
        )
        
        # Java Test Cases
        java_test_cases = [
            # Visible test cases (3)
            ("assert Solution.reverseString(\"hello\").equals(\"olleh\");\nassert Solution.reverseString(\"Java\").equals(\"avaJ\");", 10, True, 1),
            ("assert Solution.countVowels(\"Hello World\") == 3;\nassert Solution.countVowels(\"AEIOU\") == 5;", 15, True, 2),
            ("assert Solution.isPalindrome(\"racecar\") == true;\nassert Solution.isPalindrome(\"hello\") == false;", 20, True, 3),
            # Hidden test cases (2)
            ("assert Solution.reverseString(\"\").equals(\"\");\nassert Solution.countVowels(\"\") == 0;\nassert Solution.isPalindrome(\"\") == true;", 15, False, 4),
            ("assert Solution.isPalindrome(\"RaceCar\") == true;\nassert Solution.countVowels(\"xyz\") == 0;\nassert Solution.reverseString(\"A\").equals(\"A\");", 20, False, 5),
        ]
        
        for test_code, points, visible, order in java_test_cases:
            _create_test_case(session, java_assignment, test_code, points, visible, order)
        
        # Assignment 3: C++ - Array Operations (No Due Date)
        print("    Creating C++ assignment: Array Operations...")
        cpp_instructions = {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "Implement the following functions to perform common operations on integer arrays:", "marks": [{"type": "bold"}]}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "int findMax(int arr[], int size)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Search through the array and return the largest integer value. The function should work correctly with both positive and negative numbers. For example, findMax({1, 5, 3, 9, 2}, 5) returns 9."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "int findMin(int arr[], int size)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Search through the array and return the smallest integer value. Should handle negative numbers correctly. For example, findMin({-5, -1, -10}, 3) returns -10."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "int sum(int arr[], int size)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Calculate and return the sum of all elements in the array. For example, sum({10, 20, 30}, 3) returns 60."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "double average(int arr[], int size)", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Calculate and return the arithmetic mean (average) of all elements. Return type is double for precision. For example, average({4, 8, 12}, 3) returns 8.0."}
                    ]}]},
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "Requirements:", "marks": [{"type": "bold"}]}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Arrays are guaranteed to have at least one element (size >= 1)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Do not use any standard library functions like std::max or std::min"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Ensure average() returns a double, not an integer"}]}]},
                ]}
            ]
        }
        
        cpp_assignment = _create_assignment(
            session,
            cosc201,
            "Array Operations",
            "Master array manipulation in C++ by implementing common utility functions. This assignment focuses on pointer arithmetic, array traversal, and mathematical operations on collections of data.",
            "c++",
            cpp_instructions,
            None,  # Unlimited attempts
            start_past,
            None,  # No due date
        )
        
        # C++ Test Cases
        cpp_test_cases = [
            # Visible test cases (3)
            ("int arr1[] = {1, 5, 3, 9, 2};\nassert(findMax(arr1, 5) == 9);\nassert(findMin(arr1, 5) == 1);", 15, True, 1),
            ("int arr2[] = {10, 20, 30};\nassert(sum(arr2, 3) == 60);", 10, True, 2),
            ("int arr3[] = {4, 8, 12};\nassert(average(arr3, 3) == 8.0);", 15, True, 3),
            # Hidden test cases (2)
            ("int arr4[] = {-5, -1, -10};\nassert(findMax(arr4, 3) == -1);\nassert(findMin(arr4, 3) == -10);", 20, False, 4),
            ("int arr5[] = {100};\nassert(findMax(arr5, 1) == 100);\nassert(sum(arr5, 1) == 100);\nassert(average(arr5, 1) == 100.0);", 20, False, 5),
        ]
        
        for test_code, points, visible, order in cpp_test_cases:
            _create_test_case(session, cpp_assignment, test_code, points, visible, order)
        
        # ========================================================================
        # COURSE 3: COSC-301 - Systems Programming (Rust)
        # ========================================================================
        print("\n[4] Creating COSC-301: Systems Programming...")
        cosc301 = _create_course(
            session,
            "COSC-301",
            "Systems Programming",
            "Advanced systems programming concepts with emphasis on memory safety, concurrency, and performance. Features modern languages like Rust for building reliable software.",
            profx,
        )
        
        # Assignment 4: Rust - Number Theory (Due Soon)
        print("    Creating Rust assignment: Number Theory...")
        rust_instructions = {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "Implement the following number theory functions in Rust:", "marks": [{"type": "bold"}]}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "fn gcd(a: u32, b: u32) -> u32", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Calculate the Greatest Common Divisor of two non-negative integers. The GCD is the largest positive integer that divides both numbers without a remainder. For example, gcd(12, 8) returns 4 because 4 is the largest number that divides both 12 and 8 evenly. Use the Euclidean algorithm for efficiency."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "fn lcm(a: u32, b: u32) -> u32", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Calculate the Least Common Multiple of two positive integers. The LCM is the smallest positive integer that is divisible by both numbers. For example, lcm(4, 6) returns 12. Hint: LCM can be calculated using the formula: lcm(a, b) = (a * b) / gcd(a, b)."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "fn is_even(n: i32) -> bool", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Determine whether an integer is even. Return true if the number is divisible by 2 with no remainder, false otherwise. This should work for positive numbers, negative numbers, and zero. Remember: 0 is considered even, and negative even numbers (like -2, -4) are also even."}
                    ]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "fn abs_value(n: i32) -> i32", "marks": [{"type": "bold"}]},
                        {"type": "text", "text": " - Return the absolute value of an integer. The absolute value is the non-negative value of a number without regard to its sign. For example, abs_value(-10) returns 10, abs_value(5) returns 5, and abs_value(0) returns 0."}
                    ]}]},
                ]},
                {"type": "paragraph", "content": [
                    {"type": "text", "text": "Requirements:", "marks": [{"type": "bold"}]}
                ]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Use idiomatic Rust patterns (no unsafe code needed)"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Consider using pattern matching where appropriate"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Functions should not panic on valid inputs"}]}]},
                ]}
            ]
        }
        
        rust_assignment = _create_assignment(
            session,
            cosc301,
            "Number Theory Basics",
            "Explore number theory algorithms in Rust. Implement fundamental mathematical functions while learning Rust's type system, pattern matching, and memory-safe programming practices.",
            "rust",
            rust_instructions,
            3,  # 3 attempts
            start_past,
            due_soon,  # Due soon!
        )
        
        # Rust Test Cases
        rust_test_cases = [
            # Visible test cases (3)
            ("assert_eq!(gcd(12, 8), 4);\nassert_eq!(gcd(17, 13), 1);", 15, True, 1),
            ("assert_eq!(lcm(4, 6), 12);\nassert_eq!(lcm(3, 5), 15);", 15, True, 2),
            ("assert_eq!(is_even(4), true);\nassert_eq!(is_even(7), false);\nassert_eq!(is_even(0), true);", 10, True, 3),
            # Hidden test cases (2)
            ("assert_eq!(abs_value(-10), 10);\nassert_eq!(abs_value(5), 5);\nassert_eq!(abs_value(0), 0);", 20, False, 4),
            ("assert_eq!(gcd(100, 25), 25);\nassert_eq!(lcm(7, 11), 77);\nassert_eq!(is_even(-2), true);", 20, False, 5),
        ]
        
        for test_code, points, visible, order in rust_test_cases:
            _create_test_case(session, rust_assignment, test_code, points, visible, order)
        
        # Commit all changes
        session.commit()
        
        # Print summary
        print("\n" + "=" * 60)
        print("Demo Seeding Complete!")
        print("=" * 60)
        
        print(f"\nProfessor: prof.x@wofford.edu (password: secret)")
        
        print(f"\n--- COSC-101: Introduction to Programming ---")
        print(f"    Enrollment Key: {cosc101.enrollment_key}")
        print(f"    Assignment: Math Functions (Python)")
        print(f"       - Due: {due_soon.strftime('%Y-%m-%d %H:%M')} (DUE SOON!)")
        print(f"       - Attempts: 3")
        print(f"       - Test Cases: 5 (3 visible, 2 hidden)")
        print(f"       - Total Points: 80")
        
        print(f"\n--- COSC-201: Data Structures ---")
        print(f"    Enrollment Key: {cosc201.enrollment_key}")
        print(f"    Assignment 1: String Operations (Java)")
        print(f"       - Due: {due_later.strftime('%Y-%m-%d %H:%M')} (2 weeks out)")
        print(f"       - Attempts: 5")
        print(f"       - Test Cases: 5 (3 visible, 2 hidden)")
        print(f"       - Total Points: 80")
        print(f"    Assignment 2: Array Operations (C++)")
        print(f"       - Due: No due date")
        print(f"       - Attempts: Unlimited")
        print(f"       - Test Cases: 5 (3 visible, 2 hidden)")
        print(f"       - Total Points: 80")
        
        print(f"\n--- COSC-301: Systems Programming ---")
        print(f"    Enrollment Key: {cosc301.enrollment_key}")
        print(f"    Assignment: Number Theory Basics (Rust)")
        print(f"       - Due: {due_soon.strftime('%Y-%m-%d %H:%M')} (DUE SOON!)")
        print(f"       - Attempts: 3")
        print(f"       - Test Cases: 5 (3 visible, 2 hidden)")
        print(f"       - Total Points: 80")
        
        print("\n" + "=" * 60)
        print("All assignments are visible on the calendar!")
        print("=" * 60)
        
    except Exception as e:
        session.rollback()
        print(f"\nError during seeding: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()

