# backend/tests/conftest.py
import os
import sys
import subprocess
import time
from pathlib import Path
import shutil
import tempfile

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Make "import app" work
ROOT = Path(__file__).resolve().parents[1]  # .../backend
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.db import Base
from app.core import db as core_db  # has Base, engine, SessionLocal maybe
from app.api.main import app

# Path to the mock Judge0 server
MOCK_JUDGE0_PATH = ROOT.parent / "mock_judge0_server.py"

@pytest.fixture(scope="session", autouse=True)
def mock_judge0_server():
    """Start mock Judge0 server for tests."""
    print("Starting mock Judge0 server...")
    server_process = subprocess.Popen([
        sys.executable, str(MOCK_JUDGE0_PATH)
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Wait a bit for server to start
    time.sleep(2)

    try:
        yield server_process
    finally:
        print("Stopping mock Judge0 server...")
        server_process.terminate()
        server_process.wait(timeout=5)

@pytest.fixture(scope="session", autouse=True)
def test_isolated_db_and_storage():
    """
    - Create a temp SQLite DB file
    - Rebind SQLAlchemy engine/Session to it
    - Create all tables
    - Use a temp storage dir (if your code writes files to 'storage/')
    """
    tmpdir = tempfile.mkdtemp(prefix="autograder_test_")
    test_db_path = Path(tmpdir) / "app_test.db"
    test_storage_dir = Path(tmpdir) / "storage"
    test_storage_dir.mkdir(parents=True, exist_ok=True)

    # If your code uses a settings var for storage, set it here.
    # Example (adjust to your project):
    os.environ["STORAGE_DIR"] = str(test_storage_dir)

    # Configure Judge0 client to use localhost for tests
    os.environ["JUDGE0_URL"] = "http://localhost:2358"

    # Build an engine for this temp DB
    engine = create_engine(
        f"sqlite:///{test_db_path}",
        connect_args={"check_same_thread": False},
        future=True,
    )

    # Rebind your app's global engine & SessionLocal
    core_db.engine = engine
    if hasattr(core_db, "SessionLocal"):
        core_db.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Re-create schema
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    try:
        yield  # run tests
    finally:
        # Cleanup temp directory
        shutil.rmtree(tmpdir, ignore_errors=True)
