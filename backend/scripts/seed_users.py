# backend/scripts/seed_users.py
from __future__ import annotations
import argparse
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from passlib.hash import pbkdf2_sha256

from app.core.db import engine, Base
from app.models.models import User, RoleEnum

# Canonical users you’ll keep in the DB after a wipe
USERS = [
    # students
    {"id": 201, "username": "alice@wofford.edu", "name": "alice@wofford.edu", "role": RoleEnum.student, "password": "secret"},
    {"id": 202, "username": "bob@wofford.edu",   "name": "bob@wofford.edu", "role": RoleEnum.student, "password": "secret"},
    # faculty
    {"id": 301, "username": "prof.x@wofford.edu", "name": "prof.x@wofford.edu", "role": RoleEnum.faculty, "password": "secret"},
    {"id": 302, "username": "prof.y@wofford.edu", "name": "prof.y@wofford.edu", "role": RoleEnum.faculty, "password": "secret"},
    # optional admin (uncomment if you want one)
    # {"id": 101, "username": "admin@wofford.edu", "name": "admin@wofford.edu", "role": RoleEnum.admin, "password": "secret"},
]

NON_USER_TABLES = [
    # “new” flow tables
    "student_submissions",
    "test_files",
    "student_registrations",
    "user_course_association",
    "assignments",
    "courses",
    # legacy pipeline tables (kept but wiped)
    "runs",
    "runtimes",
    "submissions",
    "test_suites",
    "files",
]

def hard_reset_schema():
    """
    DANGER: Drops ALL tables and recreates from SQLAlchemy models.
    Only use if you’re okay losing the exact Alembic-managed schema (alembic_version will be dropped).
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

def soft_wipe_non_user_tables(sess):
    """DELETE FROM all non-user tables (preserves schema + alembic_version + users)."""
    for table in NON_USER_TABLES:
        try:
            sess.execute(text(f"DELETE FROM {table}"))
        except Exception:
            # Table might not exist in some dev DBs; ignore
            pass
    sess.commit()

def reseed_users(sess, users: list[dict], overwrite: bool = True):
    """
    Seed canonical users. If overwrite=True, DELETE FROM users first.
    """
    if overwrite:
        try:
            sess.execute(text("DELETE FROM users"))
            sess.commit()
        except Exception:
            # users table might not exist if schema is ancient
            pass

    now = datetime.utcnow()
    for u in users:
        # hash password with pbkdf2_sha256
        hashed = pbkdf2_sha256.hash(u["password"])
        row = User(
            id=u["id"],
            username=u["username"],
            name=u.get("name", u["username"]),  # Use name if provided, otherwise username
            role=u["role"],
            password_hash=hashed,
            created_at=now,
        )
        sess.add(row)
    sess.commit()

def main():
    ap = argparse.ArgumentParser(description="Reset DB state and seed canonical users.")
    ap.add_argument("--hard-reset", action="store_true",
                    help="Drop ALL tables and recreate schema before seeding. (Danger: drops alembic_version)")
    ap.add_argument("--keep-users", action="store_true",
                    help="Wipe non-user tables only and keep whatever users already exist.")
    args = ap.parse_args()

    if args.hard_reset:
        hard_reset_schema()

    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with SessionLocal() as sess:
        if args.keep_users:
            # Keep existing users, just clear everything else
            soft_wipe_non_user_tables(sess)
        elif args.hard_reset:
            # Fresh schema → seed users
            reseed_users(sess, USERS, overwrite=True)
        else:
            # Default: wipe non-user tables and replace users with our canonical four
            soft_wipe_non_user_tables(sess)
            reseed_users(sess, USERS, overwrite=True)

    print("✅ Done seeding.")

if __name__ == "__main__":
    main()
