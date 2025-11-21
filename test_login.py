#!/usr/bin/env python3
"""
Test script to verify login functionality works correctly.
Run this to test the login endpoint before trying from the frontend.
"""
import sys
import os

# Add backend to path
HERE = os.path.abspath(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(HERE, "backend")
if os.path.isdir(BACKEND_DIR) and BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from app.api.main import app

def test_login():
    """Test the login endpoint with alice's credentials."""
    client = TestClient(app)
    
    print("=" * 60)
    print("Testing Login Endpoint")
    print("=" * 60)
    
    # Test login with alice credentials
    response = client.post(
        '/api/v1/login',
        json={
            'username': 'alice@wofford.edu',
            'password': 'secret',
            'role': 'student'
        },
        headers={'Origin': 'http://localhost:5173'}
    )
    
    print(f"\nStatus Code: {response.status_code}")
    print(f"\nCORS Headers:")
    cors_headers = {k: v for k, v in response.headers.items() if 'access-control' in k.lower()}
    if cors_headers:
        for header, value in cors_headers.items():
            print(f"  {header}: {value}")
    else:
        print("  (No CORS headers found)")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ Login Successful!")
        print(f"\nResponse Data:")
        print(f"  User ID: {data.get('user_id')}")
        print(f"  Username: {data.get('username')}")
        print(f"  Role: {data.get('role')}")
        return True
    else:
        print(f"\n❌ Login Failed!")
        print(f"Error: {response.text}")
        return False

if __name__ == "__main__":
    success = test_login()
    sys.exit(0 if success else 1)

