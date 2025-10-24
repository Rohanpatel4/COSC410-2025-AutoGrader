#!/usr/bin/env python3
"""
User seeding functionality for tests.
Extracted from seed_db.py for use in conftest.py
"""

from sqlalchemy.orm import sessionmaker
from passlib.hash import pbkdf2_sha256
from datetime import datetime

from app.models.models import User, RoleEnum

# Users to seed
USERS = [
    {"id": 201, "username": "alice@wofford.edu", "role": RoleEnum.student, "password": "secret"},
    {"id": 202, "username": "bob@wofford.edu", "role": RoleEnum.student, "password": "secret"},
    {"id": 301, "username": "prof.x@wofford.edu", "role": RoleEnum.faculty, "password": "secret"},
    {"id": 302, "username": "prof.y@wofford.edu", "role": RoleEnum.faculty, "password": "secret"},
]

def reseed_users(session, users=USERS, overwrite=True):
    """
    Seed users into the database session.
    If overwrite=True, delete existing users first.
    """
    if overwrite:
        # Clear existing users
        session.query(User).delete()
        session.commit()

    now = datetime.utcnow()
    for u in users:
        hashed = pbkdf2_sha256.hash(u["password"])
        user = User(
            id=u["id"],
            username=u["username"],
            role=u["role"],
            password_hash=hashed,
            created_at=now,
        )
        session.add(user)

    session.commit()
