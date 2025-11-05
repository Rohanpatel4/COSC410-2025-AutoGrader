# backend/app/api/LoginPage.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.hash import pbkdf2_sha256

from app.core.db import get_db
from app.models.models import User, RoleEnum

router = APIRouter()

@router.post("/login")
def login(payload: dict, db: Session = Depends(get_db)):
    # Frontend sends username (email), password, role
    username = (payload.get("username") or payload.get("email") or "").strip()
    password = payload.get("password") or ""
    role_in  = (payload.get("role") or "").strip()

    if not username or not password or not role_in:
        raise HTTPException(400, "username, password, and role are required")

    # Validate role -> Enum
    try:
        role = RoleEnum(role_in)
    except ValueError:
        raise HTTPException(400, "Invalid role")

    # Look up by username (which you store as email in the seeder)
    user = db.query(User).filter(User.username == username).first()
    if not user or user.role != role:
        raise HTTPException(401, "Invalid username or password")

    # Check password hash
    try:
        if not pbkdf2_sha256.verify(password, user.password_hash):
            raise HTTPException(401, "Invalid username or password")
    except Exception:
        raise HTTPException(401, "Invalid username or password")

    # Shape matches your frontend expectations
    return {
        "user_id": user.id,
        "userId": user.id,
        "role": user.role.value,
        "status": user.role.value,
        "token": None,
    }

