#!/usr/bin/env python3
"""
Quick setup and test runner for the sandbox.
This script will set up the mock environment and run comprehensive tests.
"""

import subprocess
import sys
import os

def run_command(cmd, description, check=True):
    """Run a command."""
    print(f"\n[SETUP] {description}")
    print(f"Running: {cmd}")
    try:
        result = subprocess.run(cmd, shell=True, check=check, text=True)
        print(f"[OK] {description}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[FAIL] {description}: {e}")
        return False

def main():
    """Set up and run sandbox tests."""
    print("🚀 Sandbox Testing Setup")
    print("=" * 50)

    # Check if required packages are installed
    print("\n[SETUP] Checking dependencies...")
    try:
        import requests
        import flask
        print("[OK] Required packages are available")
    except ImportError:
        print("[INFO] Installing required packages...")
        if not run_command(f"{sys.executable} -m pip install -r requirements-test.txt", "Install test dependencies"):
            print("[ERROR] Failed to install dependencies. Please run: pip install -r requirements-test.txt")
            return

    # Check if backend is available
    print("\n[SETUP] Checking backend availability...")
    try:
        import requests
        response = requests.get("http://localhost:8000/docs", timeout=5)
        if response.status_code == 200:
            print("[OK] Backend is running")
            backend_running = True
        else:
            print("[WARN] Backend responded but not healthy")
            backend_running = False
    except:
        print("[WARN] Backend not running - will start it")
        backend_running = False

    if not backend_running:
        print("\n[SETUP] Starting backend server...")
        print("[INFO] Backend will start in the background")
        print("[INFO] Check backend logs in another terminal if needed")

        # Start backend in background
        backend_process = subprocess.Popen([
            sys.executable, "-m", "uvicorn", "backend/app/main:app",
            "--host", "0.0.0.0", "--port", "8000", "--reload"
        ], env={**os.environ, "JUDGE0_URL": "http://localhost:2358"})

        print("[INFO] Waiting for backend to start...")
        import time
        for i in range(15):
            time.sleep(1)
            try:
                response = requests.get("http://localhost:8000/docs", timeout=2)
                if response.status_code == 200:
                    print("[OK] Backend started successfully")
                    break
            except:
                continue
        else:
            print("[ERROR] Backend failed to start within 15 seconds")
            return

    # Run the comprehensive test
    print("\n" + "=" * 50)
    print("🏃 Running Comprehensive Sandbox Tests")
    print("=" * 50)

    try:
        # Run the test script
        result = subprocess.run([sys.executable, "test_sandbox_complete.py"],
                              check=True, text=True)
        print("\n" + "=" * 50)
        print("✅ Sandbox testing completed successfully!")
        print("=" * 50)

    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] Sandbox testing failed: {e}")
        print("=" * 50)
        print("❌ Sandbox testing failed!")
        print("=" * 50)
        return

    except KeyboardInterrupt:
        print("\n[INFO] Testing interrupted by user")
        return

    # Print next steps
    print("\n" + "=" * 50)
    print("🎯 NEXT STEPS:")
    print("=" * 50)
    print("1. Your sandbox is working! The backend API is running at:")
    print("   - API: http://localhost:8000")
    print("   - Docs: http://localhost:8000/docs")
    print("   - Judge0 Mock: http://localhost:2358")
    print()
    print("2. To test manually:")
    print("   - Use the API endpoints documented at /docs")
    print("   - Upload files via POST /api/v1/files")
    print("   - Create test suites and submissions")
    print("   - Execute runs and check results")
    print()
    print("3. To stop the servers:")
    print("   - Press Ctrl+C in the backend terminal")
    print("   - Mock Judge0 will stop automatically")
    print()
    print("4. For production deployment:")
    print("   - Replace mock Judge0 with real Judge0 Docker container")
    print("   - Configure proper database (SQLite is fine for development)")
    print("   - Add authentication and security measures")

if __name__ == "__main__":
    main()

