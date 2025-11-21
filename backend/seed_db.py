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

from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

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

def seed_users():
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    with SessionLocal() as session:
        # Wipe existing users for a clean slate (dev only)
        session.query(User).delete()
        session.commit()

        now = datetime.utcnow()  # models use timezone=False, so UTC naive is fine
        for u in USERS:
            user = User(
                id=u["id"],
                username=u["username"],
                role=u["role"],
                password_hash=pbkdf2_sha256.hash(u["password"]),
                created_at=now,
            )
            session.add(user)
            print(f"[seed] Added user: {u['username']}")
        session.commit()
    print("[seed] Database seeded successfully!")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="Drop & recreate tables from current models before seeding")
    args = ap.parse_args()

    if args.reset:
        reset_schema()

    seed_users()

if __name__ == "__main__":
    main()
