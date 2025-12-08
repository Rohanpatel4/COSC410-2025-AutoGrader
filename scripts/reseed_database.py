#!/usr/bin/env python3
"""
Delete database and reseed using both seed_prof_demo.py and seed_demo.py.

Usage (from repo root):
  python scripts/reseed_database.py
"""

import os
import sys
import importlib.util
from pathlib import Path

# ── Ensure backend/ is on import path whether you run from repo root or backend/
HERE = os.path.abspath(os.path.dirname(__file__))
REPO_ROOT = os.path.dirname(HERE)
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# ── Fix database path: respect DATABASE_URL env var if set, otherwise use backend/app.db ──
if "DATABASE_URL" not in os.environ:
    BACKEND_DB_PATH = os.path.join(BACKEND_DIR, "app.db")
    os.environ["DATABASE_URL"] = f"sqlite:///{BACKEND_DB_PATH}"

# Import models to ensure they're registered with Base.metadata
from app.models import models  # noqa: F401

from sqlalchemy.orm import sessionmaker
from sqlalchemy import inspect, select, func
from app.core.db import engine, Base, SessionLocal
from app.models.models import User


def delete_database():
    """Delete the database file if it exists."""
    db_path = str(engine.url).replace("sqlite:///", "")
    db_file = Path(db_path)
    
    if db_file.exists():
        print(f"[delete] Deleting database at {db_path}")
        try:
            db_file.unlink()
            print("[delete] Database deleted successfully.")
        except Exception as e:
            print(f"[delete] ERROR: Failed to delete database: {e}", file=sys.stderr)
            raise
    else:
        print(f"[delete] Database file not found at {db_path}, skipping deletion.")


def reset_schema():
    """
    Drop & recreate ALL tables defined on Base.metadata.
    SQLite-safe (temporarily disables FK checks).
    """
    url = str(engine.url)
    print(f"[reset] Rebuilding schema on {url}")
    try:
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
        print("[reset] Schema rebuilt successfully.")
    except Exception as e:
        print(f"[reset] ERROR: Failed to reset schema: {e}", file=sys.stderr)
        raise


def verify_database():
    """Verify the database was created correctly."""
    print("\n" + "=" * 60)
    print("Verifying database...")
    print("=" * 60)
    
    session = SessionLocal()
    try:
        user_count = session.scalar(select(func.count(User.id)))
        print(f"✅ Found {user_count} users in database")
        
        if user_count == 0:
            print("⚠️  WARNING: No users found in database!")
            return False
        
        # Check for key users
        key_users = [
            "prof.x@wofford.edu",
            "prof.y@wofford.edu",
            "alice@wofford.edu"
        ]
        
        found_users = []
        for username in key_users:
            user = session.scalar(select(User).where(User.username == username))
            if user:
                found_users.append(username)
                print(f"  ✅ {username} ({user.role.value})")
            else:
                print(f"  ⚠️  {username} not found")
        
        print(f"\n✅ Database verification complete: {len(found_users)}/{len(key_users)} key users found")
        return True
    except Exception as e:
        print(f"❌ Error verifying database: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        session.close()


def trigger_backend_reload():
    """Trigger backend server reload by touching watched files."""
    print("\n" + "=" * 60)
    print("Triggering backend refresh...")
    print("=" * 60)
    
    # Touch multiple files to ensure reload triggers
    files_to_touch = [
        os.path.join(BACKEND_DIR, "app", "api", "main.py"),
        os.path.join(BACKEND_DIR, "app", "core", "db.py"),
        os.path.join(BACKEND_DIR, "app", "api", "LoginPage.py"),
    ]
    
    touched_count = 0
    for file_path in files_to_touch:
        if os.path.exists(file_path):
            try:
                # Touch the file (update modification time)
                Path(file_path).touch()
                touched_count += 1
                print(f"  ✅ Touched {os.path.basename(file_path)}")
            except Exception as e:
                print(f"  ⚠️  Could not touch {os.path.basename(file_path)}: {e}")
        else:
            print(f"  ⚠️  {os.path.basename(file_path)} not found")
    
    if touched_count > 0:
        print(f"\n✅ Touched {touched_count} file(s) to trigger reload")
        print("   (If backend is running with --reload, it should refresh automatically)")
        print("   Waiting 2 seconds for reload to process...")
        import time
        time.sleep(2)
        
        # Verify database is accessible after reload
        print("   Verifying database is accessible...")
        try:
            test_session = SessionLocal()
            test_count = test_session.scalar(select(func.count(User.id)))
            test_session.close()
            print(f"   ✅ Database accessible: {test_count} users found")
        except Exception as e:
            print(f"   ⚠️  Database verification failed: {e}")
            print("   You may need to manually restart the backend server")
        
        return True
    else:
        print("⚠️  No files were touched")
        print("   You may need to manually restart the backend server")
        return False


def run_seed_script(script_path: str, script_name: str):
    """Import and run a seed script's main function directly."""
    print(f"\n{'=' * 60}")
    print(f"Running {script_name}...")
    print(f"{'=' * 60}")
    
    try:
        # Load the module from the script file
        spec = importlib.util.spec_from_file_location("seed_module", script_path)
        if spec is None or spec.loader is None:
            print(f"ERROR: Could not load {script_name}", file=sys.stderr)
            return False
        
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Call the main function
        if hasattr(module, "main"):
            module.main()
            print(f"\n{script_name} completed successfully.")
            return True
        else:
            print(f"ERROR: {script_name} does not have a main() function", file=sys.stderr)
            return False
    except Exception as e:
        print(f"\n{script_name} failed with error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main function to delete and reseed database."""
    print("=" * 60)
    print("Database Reset and Reseed Script")
    print("=" * 60)
    
    try:
        # Step 1: Delete database
        print("\n[Step 1] Deleting existing database...")
        delete_database()
        
        # Step 2: Reset schema
        print("\n[Step 2] Creating fresh database schema...")
        reset_schema()
        
        # Step 3: Run seed_prof_demo.py
        seed_prof_demo_path = os.path.join(BACKEND_DIR, "scripts", "seed_prof_demo.py")
        if not os.path.exists(seed_prof_demo_path):
            print(f"ERROR: {seed_prof_demo_path} not found!", file=sys.stderr)
            sys.exit(1)
        
        if not run_seed_script(seed_prof_demo_path, "seed_prof_demo.py"):
            print("ERROR: seed_prof_demo.py failed!", file=sys.stderr)
            sys.exit(1)
        
        # Step 4: Run seed_demo.py
        seed_demo_path = os.path.join(BACKEND_DIR, "scripts", "seed_demo.py")
        if not os.path.exists(seed_demo_path):
            print(f"ERROR: {seed_demo_path} not found!", file=sys.stderr)
            sys.exit(1)
        
        if not run_seed_script(seed_demo_path, "seed_demo.py"):
            print("ERROR: seed_demo.py failed!", file=sys.stderr)
            sys.exit(1)
        
        # Step 5: Verify database
        if not verify_database():
            print("WARNING: Database verification failed, but continuing...", file=sys.stderr)
        
        # Step 6: Dispose database connections to force fresh connection
        print("\n[Step 6] Disposing database connections...")
        try:
            # Close all sessions first
            engine.dispose(close=True)
            print("  ✅ Database connections disposed")
            # Small delay to ensure connections are fully closed
            import time
            time.sleep(0.5)
        except Exception as e:
            print(f"  ⚠️  Could not dispose connections: {e}")
        
        # Step 7: Trigger backend reload
        trigger_backend_reload()
        
        # Step 8: Final verification - test database access
        print("\n[Step 8] Final database access test...")
        try:
            # Create a fresh session to test
            test_session = SessionLocal()
            test_users = test_session.scalar(select(func.count(User.id)))
            test_session.close()
            print(f"  ✅ Database is accessible: {test_users} users found")
        except Exception as e:
            print(f"  ⚠️  Database access test failed: {e}")
            print("  This might indicate the backend needs a manual restart")
        
        print("\n" + "=" * 60)
        print("Database reset and reseed completed successfully!")
        print("=" * 60)
        print("\nSummary:")
        print("  - Database deleted and recreated")
        print("  - seed_prof_demo.py executed")
        print("  - seed_demo.py executed")
        print("  - Database verified")
        print("  - Database connections disposed")
        print("  - Backend refresh triggered")
        print("\nUsers created:")
        print("  - prof.x@wofford.edu (faculty, has all courses)")
        print("  - prof.y@wofford.edu (faculty, no courses)")
        print("  - alice@wofford.edu (student, enrolled in prof.x's courses only)")
        print("  - Plus courses from seed_demo.py (prof.x already exists)")
        print("\nNote: Submission limits set to 10, no grades/submissions seeded")
        print("\n⚠️  IMPORTANT: The backend server MUST be restarted to pick up the new database!")
        print("   - If running with 'uvicorn --reload', it should auto-reload")
        print("   - Otherwise, manually restart the backend server")
        print("   - The database connections have been disposed to force reconnection")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n[error] Fatal error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
