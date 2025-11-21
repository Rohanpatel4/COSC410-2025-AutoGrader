#!/usr/bin/env python3
"""
Initialize database: create tables and seed users if needed.
This script is safe to run multiple times.
"""
import sys
import os
from pathlib import Path

# Add backend to path
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.core.db import Base, engine
from app.models import models  # Import all models to register them
from sqlalchemy import inspect
from sqlalchemy.orm import sessionmaker
from app.models.models import User, RoleEnum
from passlib.hash import pbkdf2_sha256
from datetime import datetime

def init_database():
    """Create tables if they don't exist."""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    if "users" not in existing_tables:
        print("[init_db] Creating database tables...", flush=True)
        Base.metadata.create_all(bind=engine)
        print("[init_db] Tables created successfully.", flush=True)
    else:
        print(f"[init_db] Database already has {len(existing_tables)} tables.", flush=True)

def seed_users_if_needed():
    """Seed users if the users table is empty."""
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    try:
        user_count = session.query(User).count()
        if user_count > 0:
            print(f"[init_db] Database already has {user_count} users.", flush=True)
            return
        
        print("[init_db] Seeding users...", flush=True)
        now = datetime.now()
        users_data = [
            {"id": 201, "username": "alice@wofford.edu", "role": RoleEnum.student, "password": "secret"},
            {"id": 202, "username": "bob@wofford.edu", "role": RoleEnum.student, "password": "secret"},
            {"id": 301, "username": "prof.x@wofford.edu", "role": RoleEnum.faculty, "password": "secret"},
            {"id": 302, "username": "prof.y@wofford.edu", "role": RoleEnum.faculty, "password": "secret"},
        ]
        
        for u in users_data:
            user = User(
                id=u["id"],
                username=u["username"],
                role=u["role"],
                password_hash=pbkdf2_sha256.hash(u["password"]),
                created_at=now,
            )
            session.add(user)
        
        session.commit()
        print(f"[init_db] Seeded {len(users_data)} users successfully.", flush=True)
    except Exception as e:
        print(f"[init_db] Error seeding users: {e}", flush=True)
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    try:
        init_database()
        seed_users_if_needed()
        print("[init_db] Database initialization complete.", flush=True)
    except Exception as e:
        print(f"[init_db] Fatal error: {e}", flush=True)
        sys.exit(1)

