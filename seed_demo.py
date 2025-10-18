#!/usr/bin/env python3
"""
Seed demo data for the gradebook & assignment views without touching base users.

Usage:
  python -m scripts.seed_demo create           # create demo course + data
  python -m scripts.seed_demo clear            # delete ONLY demo data
  python -m scripts.seed_demo create --with-extra-students  # also add seed-only users

Works with the existing DB and models.
"""

import sys, os, argparse
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))  # project root in sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))  # backend imports

from datetime import datetime, timedelta
from passlib.hash import pbkdf2_sha256
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete

from backend.app.core.db import engine, Base
from backend.app.models.models import (
    User, RoleEnum, Course, Assignment, TestCase,
    StudentRegistration, StudentSubmission
)

SEED_COURSE_TAG = "SEED-COSC410"
SEED_COURSE_NAME = "Seeded Demo Course"
SEED_ONLY_USERNAMES = [
    "charlie.seed@wofford.edu",
    "dana.seed@wofford.edu",
]

# Existing user IDs from your seed_db.py
ALICE_ID = 201
BOB_ID   = 202
PROF_X   = 301

def _ensure_course(session):
    course = session.execute(
        select(Course).where(Course.course_tag == SEED_COURSE_TAG)
    ).scalar_one_or_none()
    if course:
        return course
    course = Course(course_tag=SEED_COURSE_TAG, name=SEED_COURSE_NAME, description="Demo data for gradebook")
    session.add(course)
    session.flush()
    return course

def _ensure_seed_only_users(session):
    created = []
    for uname in SEED_ONLY_USERNAMES:
        u = session.execute(select(User).where(User.username == uname)).scalar_one_or_none()
        if not u:
            u = User(
                username=uname,
                role=RoleEnum.student,
                password_hash=pbkdf2_sha256.hash("secret"),
                created_at=datetime.utcnow(),
            )
            session.add(u)
            session.flush()
            created.append(u)
    return created

def _enroll_students(session, course_id, extra_students=False):
    # pick base students (201, 202) if present
    sids = []
    for sid in (ALICE_ID, BOB_ID):
        u = session.get(User, sid)
        if u and u.role == RoleEnum.student:
            sids.append(u.id)

    # optionally add seed-only students
    if extra_students:
        for uname in SEED_ONLY_USERNAMES:
            u = session.execute(select(User).where(User.username == uname)).scalar_one()
            sids.append(u.id)

    # enroll
    for sid in sids:
        exists = session.execute(
            select(StudentRegistration).where(
                StudentRegistration.student_id == sid,
                StudentRegistration.course_id == course_id
            )
        ).scalar_one_or_none()
        if not exists:
            session.add(StudentRegistration(student_id=sid, course_id=course_id))

    # also ensure at least one faculty is associated (optional for your UI)
    # (Your faculty association is modeled via user_course_association for professors.
    # If you need that link, you can add it separately; not required for gradebook queries.)

    return sids

def _create_assignments(session, course_id):
    now = datetime.utcnow()
    assigns = [
        ("Warmup: Functions", "Basic Python functions", now - timedelta(days=5), now + timedelta(days=10)),
        ("Lists & Loops", "Practice with lists",       now - timedelta(days=4), now + timedelta(days=9)),
        ("Recursion",       "Recursive thinking",      now - timedelta(days=2), now + timedelta(days=7)),
    ]
    out = []
    for title, desc, start, stop in assigns:
        a = Assignment(course_id=course_id, title=title, description=desc, sub_limit=None, start=start, stop=stop)
        session.add(a)
        session.flush()
        # minimal test file so /submit wouldn't 409 if you try it
        tc = TestCase(assignment_id=a.id, var_char="def test_stub():\n    assert True")
        session.add(tc)
        out.append(a)
    return out

def _create_fake_attempts(session, assignment_ids, student_ids):
    """
    Insert a few attempts with grades:
      - varied per assignment and per student
      - multiple attempts for at least one student/assignment
    """
    # Simple matrix of grades for determinism
    demo = [
        # (student_id, assignment_id, [grades... as attempts])
        (student_ids[0], assignment_ids[0], [100, 100]),
        (student_ids[0], assignment_ids[1], [70, 85, 90]),
        (student_ids[0], assignment_ids[2], [0, 50, 100]),

        (student_ids[1], assignment_ids[0], [60, 80]),
        (student_ids[1], assignment_ids[1], [95]),
        (student_ids[1], assignment_ids[2], [88, 92]),
    ]

    # If we have more than 2 students, give them some grades too
    for sid in student_ids[2:]:
        for aid in assignment_ids:
            # two attempts per assignment
            demo.append((sid, aid, [65, 85]))

    for sid, aid, grades in demo:
        for g in grades:
            session.add(StudentSubmission(student_id=sid, assignment_id=aid, grade=g))

def create_demo(session, with_extra_students=False):
    course = _ensure_course(session)
    assigns = session.execute(select(Assignment).where(Assignment.course_id == course.id)).scalars().all()
    if assigns:
        print(f"[skip] Demo course {SEED_COURSE_TAG} already has assignments; clear first if you want a fresh state.")
        return

    if with_extra_students:
        _ensure_seed_only_users(session)

    student_ids = _enroll_students(session, course.id, extra_students=with_extra_students)
    assignments = _create_assignments(session, course.id)
    _create_fake_attempts(session, [a.id for a in assignments], student_ids)
    print(f"[ok] Created demo course={SEED_COURSE_TAG}, assignments={len(assignments)}, students={len(student_ids)}")

def clear_demo(session):
    course = session.execute(
        select(Course).where(Course.course_tag == SEED_COURSE_TAG)
    ).scalar_one_or_none()
    if not course:
        print("[ok] No demo course found; nothing to clear.")
        return

    # Collect IDs
    a_ids = [a.id for a in session.execute(select(Assignment).where(Assignment.course_id == course.id)).scalars().all()]

    # Delete children in the right order
    if a_ids:
        session.execute(delete(StudentSubmission).where(StudentSubmission.assignment_id.in_(a_ids)))
        session.execute(delete(TestCase).where(TestCase.assignment_id.in_(a_ids)))
        session.execute(delete(Assignment).where(Assignment.id.in_(a_ids)))

    session.execute(delete(StudentRegistration).where(StudentRegistration.course_id == course.id))
    session.delete(course)
    print(f"[ok] Cleared demo course {SEED_COURSE_TAG} and related data.")

    # Remove seed-only users (do NOT touch your base users)
    for uname in SEED_ONLY_USERNAMES:
        u = session.execute(select(User).where(User.username == uname)).scalar_one_or_none()
        if u:
            session.delete(u)
            print(f"[ok] Deleted seed-only user {uname}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["create", "clear"])
    parser.add_argument("--with-extra-students", action="store_true", help="also create seed-only students")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    with SessionLocal() as session:
        if args.action == "create":
            create_demo(session, with_extra_students=args.with_extra_students)
        elif args.action == "clear":
            clear_demo(session)
        session.commit()

if __name__ == "__main__":
    main()
