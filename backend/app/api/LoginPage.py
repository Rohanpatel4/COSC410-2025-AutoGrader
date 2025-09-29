from enum import Enum
from typing import Literal, Optional

import sqlite3
from sqlite3 import Connection
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, constr

router = APIRouter(prefix="/login", tags=["login"])

# TODO: set this to your real DB file
DATABASE_PATH = "/absolute/path/to/your/database.db"

# ---------- DB helpers ----------

def get_db_connection() -> Connection:
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row  # dict-like rows
        return conn
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database connection error: {e}")

def fetch_user_by_username(conn: Connection, username: str) -> Optional[sqlite3.Row]:
    cur = conn.execute(
        "SELECT id, username, password, status FROM users WHERE username = ?",
        (username,),
    )
    return cur.fetchone()

# ---------- Models ----------

class Role(str, Enum):
    student = "student"
    faculty = "faculty"
    admin = "admin"  # future use

class LoginRequest(BaseModel):
    username: constr(strip_whitespace=True, min_length=1)
    password: constr(min_length=1)
    role: Role  # send "student" or "faculty" for now

class LoginResponse(BaseModel):
    user_id: int
    status: Role

# ---------- Route ----------

_INVALID = HTTPException(status_code=401, detail="Invalid username or password")

@router.post("", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    """
    Verify username + password + role (status).
    On success, return user_id and status.
    On failure, return generic 401 (no info leak).
    """
    with get_db_connection() as conn:
        row = fetch_user_by_username(conn, payload.username)
        if row is None:
            raise _INVALID

        # NOTE: You asked for plain-text password check.
        # In production, store a hash (e.g., bcrypt) and verify the hash instead.
        if payload.password != row["password"]:
            raise _INVALID

        # Role/status must match exactly
        if payload.role != row["status"]:
            # Per your request, treat mismatch as invalid credentials
            raise _INVALID

        return LoginResponse(user_id=int(row["id"]), status=Role(row["status"]))