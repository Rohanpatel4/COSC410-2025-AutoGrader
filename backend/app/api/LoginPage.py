# backend/app/api/LoginPage.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.hash import pbkdf2_sha256
import logging

from app.core.db import get_db
from app.models.models import User, RoleEnum
from app.schemas.schemas import LoginRequest, LoginResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Login endpoint for user authentication.
    """
    try:
        # Access payload.username, payload.password, payload.role directly
        username = payload.username.strip() if payload.username else ""
        password = payload.password or ""
        role_in = payload.role.value if payload.role else ""  # Already validated as RoleEnum

        if not username or not password or not role_in:
            raise HTTPException(status_code=400, detail="username, password, and role are required")

        # Validate role -> Enum
        try:
            role = RoleEnum(role_in)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid role")

        # Look up by username (which you store as email in the seeder)
        user = db.query(User).filter(User.username == username).first()
        if not user:
            logger.warning(f"Login attempt with non-existent username: {username}")
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        if user.role != role:
            logger.warning(f"Login attempt with wrong role for user {username}: expected {user.role.value}, got {role.value}")
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Check password hash
        try:
            if not pbkdf2_sha256.verify(password, user.password_hash):
                logger.warning(f"Login attempt with wrong password for user: {username}")
                raise HTTPException(status_code=401, detail="Invalid username or password")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error verifying password for user {username}: {e}")
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Shape matches your frontend expectations
        response_data = {
            "user_id": user.id,
            "userId": user.id,
            "role": user.role.value,
            "status": user.role.value,
            "token": None,
            "username": user.username,
            "email": user.username,
        }
        
        logger.info(f"Successful login for user: {username} (role: {user.role.value})")
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log unexpected errors
        logger.error(f"Unexpected error in login endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

