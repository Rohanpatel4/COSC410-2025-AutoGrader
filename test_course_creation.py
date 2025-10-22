#!/usr/bin/env python3
"""
Test script to verify course creation is working properly
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from fastapi.testclient import TestClient
from sqlalchemy import select

def test_course_creation():
    print("=" * 60)
    print("Testing Course Creation with Auto-Association")
    print("=" * 60)
    
    # Import here to avoid double table definition
    from app.api.main import app
    from app.core.db import SessionLocal
    from app.models.models import user_course_association
    
    client = TestClient(app)
    
    # Test 1: Create a course with faculty headers
    print("\n1. Creating course with faculty user (ID: 301)...")
    response = client.post(
        "/api/v1/courses",
        json={
            "course_tag": "TEST-DEBUG",
            "name": "Debug Test Course",
            "description": "Testing course creation"
        },
        headers={
            "X-User-Id": "301",
            "X-User-Role": "faculty"
        }
    )
    
    print(f"   Status Code: {response.status_code}")
    if response.status_code == 201:
        course_data = response.json()
        print(f"   ✓ Course created: {course_data}")
        course_id = course_data["id"]
        
        # Test 2: Verify association was created
        print("\n2. Checking user_course_association table...")
        db = SessionLocal()
        try:
            association = db.execute(
                select(user_course_association).where(
                    user_course_association.c.user_id == 301,
                    user_course_association.c.course_id == course_id
                )
            ).first()
            
            if association:
                print(f"   ✓ Association found: user_id={association.user_id}, course_id={association.course_id}")
            else:
                print(f"   ✗ NO ASSOCIATION FOUND! This is the problem.")
                print(f"     Expected: user_id=301, course_id={course_id}")
                
            # List all associations
            print("\n3. All associations in database:")
            all_assocs = db.execute(select(user_course_association)).all()
            for a in all_assocs:
                print(f"   - user_id={a.user_id}, course_id={a.course_id}")
                
        finally:
            db.close()
        
        # Test 3: Check if course appears in faculty list
        print("\n4. Checking faculty course list endpoint...")
        response = client.get("/api/v1/courses/faculty/301")
        if response.status_code == 200:
            courses = response.json()
            course_tags = [c["course_tag"] for c in courses]
            if "TEST-DEBUG" in course_tags:
                print(f"   ✓ Course appears in faculty list")
            else:
                print(f"   ✗ Course NOT in faculty list")
                print(f"   Found courses: {course_tags}")
        else:
            print(f"   Error: Status {response.status_code}")
    else:
        print(f"   ✗ Failed to create course")
        print(f"   Response: {response.text}")
    
    print("\n" + "=" * 60)
    print("Test Complete")
    print("=" * 60)

if __name__ == "__main__":
    test_course_creation()

