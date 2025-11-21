#!/usr/bin/env python3
"""
Seed (and optionally reset) the database.

Usage (from repo root or backend/):
  # only insert users (requires schema to exist)
  python seed_db.py

  # drop & recreate ALL tables from current models, then seed
  python seed_db.py --reset
"""

import os
import sys
import argparse
from datetime import datetime

# ── Ensure backend/ is on import path whether you run from repo root or backend/
HERE = os.path.abspath(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(HERE, "backend")
if os.path.isdir(BACKEND_DIR) and BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# ── Fix database path: always target backend/app.db regardless of working directory ──
# The settings use a relative path "sqlite:///./app.db" which resolves to the current
# working directory. We need to override it to point to backend/app.db.
BACKEND_DB_PATH = os.path.join(BACKEND_DIR, "app.db")
os.environ["DATABASE_URL"] = f"sqlite:///{BACKEND_DB_PATH}"

from sqlalchemy.orm import sessionmaker
from sqlalchemy import inspect

# Project imports (adjust if your paths differ)
from app.core.db import engine, Base
from app.models.models import User, RoleEnum  # importing models registers tables on Base.metadata

try:
    from passlib.hash import pbkdf2_sha256
except Exception as e:
    raise SystemExit(
        "passlib is required (pip install passlib[bcrypt] or passlib). Error: %r" % e
    )

USERS = [
    {"id": 201, "username": "alice@wofford.edu", "role": RoleEnum.student, "password": "secret"},
    {"id": 202, "username": "bob@wofford.edu", "role": RoleEnum.student, "password": "secret"},
    {"id": 301, "username": "prof.x@wofford.edu", "role": RoleEnum.faculty, "password": "secret"},
    {"id": 302, "username": "prof.y@wofford.edu", "role": RoleEnum.faculty, "password": "secret"},
]

def reset_schema():
    """
    Drop & recreate ALL tables defined on Base.metadata.
    SQLite-safe (temporarily disables FK checks).
    """
    url = str(engine.url)
    print(f"[reset] Rebuilding schema on {url}")
    try:
        with engine.begin() as conn:
            # SQLite: allow dropping in any order
            try:
                conn.exec_driver_sql("PRAGMA foreign_keys=OFF;")
            except Exception:
                pass
            Base.metadata.drop_all(bind=conn)
            Base.metadata.create_all(bind=conn)
            try:
                conn.exec_driver_sql("PRAGMA foreign_keys=ON;")
            except Exception:
                pass
        print("[reset] Done.")
    except Exception as e:
        print(f"[reset] ERROR: Failed to reset schema: {e}", file=sys.stderr)
        raise

def ensure_tables_exist():
    """
    Check if tables exist, and create them if they don't.
    Returns True if tables exist or were created, False otherwise.
    """
    try:
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        # Check if users table exists (as a proxy for all tables)
        if "users" not in existing_tables:
            print("[seed] Tables don't exist. Creating tables...")
            Base.metadata.create_all(bind=engine)
            print("[seed] Tables created successfully.")
            return True
        return True
    except Exception as e:
        print(f"[seed] ERROR: Failed to check/create tables: {e}", file=sys.stderr)
        return False

def seed_users():
    """
    Seed users into the database. Ensures tables exist before seeding.
    """
    # Ensure tables exist before seeding
    if not ensure_tables_exist():
        raise SystemExit("Cannot seed users: tables don't exist and couldn't be created.")
    
    url = str(engine.url)
    print(f"[seed] Seeding users into database at {url}")
    
    try:
        SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
        with SessionLocal() as session:
            # Wipe existing users for a clean slate (dev only)
            try:
                session.query(User).delete()
                session.commit()
            except Exception as e:
                print(f"[seed] WARNING: Could not delete existing users: {e}")
                session.rollback()
                # Continue anyway - might be first run

            now = datetime.now()  # models use timezone=False, so UTC naive is fine (datetime.now() returns naive datetime)
            for u in USERS:
                try:
                    user = User(
                        id=u["id"],
                        username=u["username"],
                        role=u["role"],
                        password_hash=pbkdf2_sha256.hash(u["password"]),
                        created_at=now,
                    )
                    session.add(user)
                    print(f"[seed] Added user: {u['username']} (role: {u['role'].value})")
                except Exception as e:
                    print(f"[seed] ERROR: Failed to add user {u['username']}: {e}", file=sys.stderr)
                    session.rollback()
                    raise
            
            session.commit()
        print("[seed] Database seeded successfully!")
    except Exception as e:
        print(f"[seed] ERROR: Failed to seed users: {e}", file=sys.stderr)
        raise

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="Drop & recreate tables from current models before seeding")
    args = ap.parse_args()

    try:
        # Verify database path
        db_path = str(engine.url).replace("sqlite:///", "")
        print(f"[info] Database path: {db_path}")
        
        if args.reset:
            reset_schema()
        else:
            # Check if tables exist and warn if they don't
            inspector = inspect(engine)
            existing_tables = inspector.get_table_names()
            if not existing_tables:
                print("[info] No tables found. Use --reset to create tables, or tables will be auto-created.")

        seed_users()
    except Exception as e:
        print(f"[error] Fatal error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
