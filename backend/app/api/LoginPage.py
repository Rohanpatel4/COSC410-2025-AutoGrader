from enum import Enum
from typing import Optional

import sqlite3
from sqlite3 import Connection
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, constr
from pathlib import Path

router = APIRouter(prefix="/login", tags=["login"])

# Point to backend/autograder.db regardless of where uvicorn is launched
DATABASE_PATH = str(Path(__file__).resolve().parents[1] / "autograder.db")

# ---------- DB helpers ----------

def get_db_connection() -> Connection:
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row  # dict-like rows
        return conn
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database connection error: {e}")

def fetch_user_by_email(conn: Connection, email: str) -> Optional[sqlite3.Row]:
    cur = conn.execute(
        "SELECT user_id, email, password, role FROM users WHERE email = ?",
        (email,),
    )
    return cur.fetchone()

# ---------- Models ----------

class Role(str, Enum):
    student = "student"
    faculty = "faculty"
    admin = "admin"

class LoginRequest(BaseModel):
    # Keep 'username' for compatibility, but it's actually the email in your DB
    username: constr(strip_whitespace=True, min_length=1)
    password: constr(min_length=1)
    role: Role  # must match users.role

class LoginResponse(BaseModel):
    user_id: int
    status: Role

# ---------- Route ----------

_INVALID = HTTPException(status_code=401, detail="Invalid username or password")

@router.post("", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    """
    Verify email (sent as username) + password + role.
    On success, return user_id and status.
    On failure, return generic 401 (no info leak).
    """
    with get_db_connection() as conn:
        row = fetch_user_by_email(conn, payload.username)  # username is email in DB
        if row is None:
            raise _INVALID

        # Plaintext check (dev only). In prod, use bcrypt/argon2.
        if payload.password != row["password"]:
            raise _INVALID

        # Role must match exactly
        if payload.role != row["role"]:
            raise _INVALID

        return LoginResponse(user_id=int(row["user_id"]), status=Role(row["role"]))
    
    



