#!/usr/bin/env python3
"""
Simple script to seed the database with test users.
Run this from the project root.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy.orm import sessionmaker
from passlib.hash import pbkdf2_sha256
from datetime import datetime

from backend.app.core.db import engine, Base
from backend.app.models.models import User, RoleEnum

# Users to seed
USERS = [
    {"id": 201, "username": "alice@wofford.edu", "role": RoleEnum.student, "password": "secret"},
    {"id": 202, "username": "bob@wofford.edu", "role": RoleEnum.student, "password": "secret"},
    {"id": 301, "username": "prof.x@wofford.edu", "role": RoleEnum.faculty, "password": "secret"},
    {"id": 302, "username": "prof.y@wofford.edu", "role": RoleEnum.faculty, "password": "secret"},
]

def main():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)

    print("Seeding users...")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    with SessionLocal() as session:
        # Clear existing users
        session.query(User).delete()
        session.commit()

        now = datetime.utcnow()
        for u in USERS:
            hashed = pbkdf2_sha256.hash(u["password"])
            user = User(
                id=u["id"],
                username=u["username"],
                role=u["role"],
                password_hash=hashed,
                created_at=now,
            )
            session.add(user)
            print(f"Added user: {u['username']}")

        session.commit()
        print("Database seeded successfully!")

if __name__ == "__main__":
    main()

