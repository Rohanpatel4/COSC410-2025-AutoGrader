# backend/app/seed_appdb.py
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.models import (
    User, RoleEnum, Course, Assignment,
    user_course_association, StudentRegistration
)

def get_or_create_user(db: Session, username: str, role: RoleEnum) -> User:
    u = db.query(User).filter(User.username == username).first()
    if u:
        return u
    u = User(
        username=username,
        role=role,
        password_hash="seeded",           # placeholder; not used by your UI
        created_at=datetime.utcnow(),     # column exists in your model
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

def get_or_create_course(db: Session, course_tag: str, name: str, description: str) -> Course:
    c = db.query(Course).filter(Course.course_tag == course_tag).first()
    if c:
        return c
    c = Course(course_tag=course_tag, name=name, description=description)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

def ensure_prof_teaches_course(db: Session, prof: User, course: Course) -> None:
    # use association table directly to avoid duplicates
    exists = db.execute(
        user_course_association.select().where(
            user_course_association.c.user_id == prof.id,
            user_course_association.c.course_id == course.id,
        )
    ).first()
    if not exists:
        db.execute(user_course_association.insert().values(
            user_id=prof.id, course_id=course.id
        ))
        db.commit()

def get_or_create_registration(db: Session, student: User, course: Course) -> None:
    reg = db.query(StudentRegistration).filter(
        StudentRegistration.student_id == student.id,
        StudentRegistration.course_id == course.id,
    ).first()
    if not reg:
        db.add(StudentRegistration(student_id=student.id, course_id=course.id))
        db.commit()

def get_or_create_assignment(db: Session, course: Course, title: str) -> Assignment:
    a = db.query(Assignment).filter(
        Assignment.course_id == course.id,
        Assignment.title == title
    ).first()
    if a:
        return a
    a = Assignment(
        course_id=course.id,
        title=title,
        description="Intro warm-up",
        sub_limit=3,
        # if your 0004 migration added start/stop and your model now has them, you can set:
        # start=datetime(2025, 10, 1, 9, 0),
        # stop=datetime(2025, 10, 31, 23, 59),
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a

def main():
    db = SessionLocal()
    try:
        # 2 faculty + 2 students
        f1 = get_or_create_user(db, "prof_alice", RoleEnum.faculty)
        f2 = get_or_create_user(db, "prof_bob", RoleEnum.faculty)
        s1 = get_or_create_user(db, "stud_cara", RoleEnum.student)
        s2 = get_or_create_user(db, "stud_dan", RoleEnum.student)

        # a course and link a professor
        course = get_or_create_course(db, "COSC-410", "Software Engineering", "Senior project course")
        ensure_prof_teaches_course(db, f1, course)

        # register one student to demonstrate the list on CoursePage
        get_or_create_registration(db, s1, course)

        # make one assignment for the course
        get_or_create_assignment(db, course, "A1: Warm-up")

        print("✅ Seed complete.")
        print(f"   Faculty IDs: {f1.id} (prof_alice), {f2.id} (prof_bob)")
        print(f"   Student IDs: {s1.id} (stud_cara), {s2.id} (stud_dan)")
        print(f"   Course: {course.id} {course.course_tag}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
