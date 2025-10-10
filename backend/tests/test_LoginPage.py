# backend/tests/test_LoginPage.py
import sqlite3
from pathlib import Path
import importlib
import json

import pytest
from fastapi.testclient import TestClient

# --- Helpers -----------------------------------------------------------------

CREATE_USERS_SQL = """
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email    TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role     TEXT NOT NULL CHECK(role IN ('student','faculty','admin'))
);
"""

SEED_USERS = [
    ("student@wofford.edu", "12345", "student"),
    ("faculty@wofford.edu", "67890", "faculty"),
    ("admin@wofford.edu",   "admin", "admin"),
    ("alice@wofford.edu",   "password123", "student"),
    ("garrettal@wofford.edu","securepass", "faculty"),
]

def init_test_db(db_path: Path):
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute(CREATE_USERS_SQL)
        conn.executemany(
            "INSERT INTO users (email, password, role) VALUES (?, ?, ?)",
            SEED_USERS,
        )
        conn.commit()
    finally:
        conn.close()

# --- Fixtures ----------------------------------------------------------------

@pytest.fixture(scope="session")
def test_db_path(tmp_path_factory):
    db_file = tmp_path_factory.mktemp("db") / "autograder_test.db"
    init_test_db(db_file)
    return db_file

@pytest.fixture(scope="session")
def test_app(test_db_path):
    """
    Build a TestClient using the unified app, with LoginPage.DATABASE_PATH
    pointed to our temporary DB.
    """
    # 1) Import LoginPage first and monkeypatch its DB path
    from app.api import LoginPage
    LoginPage.DATABASE_PATH = str(test_db_path)

    # 2) Import (or reload) the unified app AFTER patching DB path
    #    The router reads DATABASE_PATH at request-time, so this is enough.
    from app.api.main import app
    # If your test runner imported app earlier, you can force a reload:
    # import app.api.main as main_mod
    # importlib.reload(main_mod)
    # app = main_mod.app

    client = TestClient(app)
    return client

# --- Tests: “renders properly” (OpenAPI) -------------------------------------

def test_openapi_contains_login_path(test_app):
    r = test_app.get("/openapi.json")
    assert r.status_code == 200
    doc = r.json()
    # Your design yields final path /api/v1/login (POST)
    paths = doc.get("paths", {})
    assert "/api/v1/login" in paths, f"Login path not found. Paths were: {list(paths.keys())}"
    assert "post" in paths["/api/v1/login"], "POST /api/v1/login missing in OpenAPI."

# --- Tests: Success cases -----------------------------------------------------

@pytest.mark.parametrize(
    "email,password,role",
    [
        ("alice@wofford.edu", "secret", "student"),
        ("prof.x@wofford.edu", "secret", "faculty"),
    ],
)
def test_login_success_variants(test_app, email, password, role):
    payload = {"username": email, "password": password, "role": role}
    r = test_app.post("/api/v1/login", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "user_id" in data
    assert data["status"] == role

# --- Tests: Failure cases -----------------------------------------------------

def test_login_wrong_password(test_app):
    payload = {"username": "alice@wofford.edu", "password": "WRONG", "role": "student"}
    r = test_app.post("/api/v1/login", json=payload)
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid username or password"

def test_login_wrong_role(test_app):
    # correct creds but mismatched role
    payload = {"username": "alice@wofford.edu", "password": "secret", "role": "faculty"}
    r = test_app.post("/api/v1/login", json=payload)
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid username or password"

def test_login_unknown_user(test_app):
    payload = {"username": "nobody@wofford.edu", "password": "whatever", "role": "student"}
    r = test_app.post("/api/v1/login", json=payload)
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid username or password"

def test_login_missing_username(test_app):
    payload = {"password": "secret", "role": "student"}
    r = test_app.post("/api/v1/login", json=payload)
    assert r.status_code == 400
    assert "username, password, and role are required" in r.json()["detail"]

def test_login_missing_password(test_app):
    payload = {"username": "alice@wofford.edu", "role": "student"}
    r = test_app.post("/api/v1/login", json=payload)
    assert r.status_code == 400
    assert "username, password, and role are required" in r.json()["detail"]

def test_login_missing_role(test_app):
    payload = {"username": "alice@wofford.edu", "password": "secret"}
    r = test_app.post("/api/v1/login", json=payload)
    assert r.status_code == 400
    assert "username, password, and role are required" in r.json()["detail"]

def test_login_invalid_role(test_app):
    payload = {"username": "alice@wofford.edu", "password": "secret", "role": "invalid"}
    r = test_app.post("/api/v1/login", json=payload)
    assert r.status_code == 400
    assert "Invalid role" in r.json()["detail"]
