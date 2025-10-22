#!/usr/bin/env python3
"""
Quick verification that the course creation fix is working
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import random

def verify_fix():
    print("=" * 70)
    print("COURSE CREATION FIX VERIFICATION")
    print("=" * 70)
    
    from app.api.main import app
    client = TestClient(app)
    
    db_path = "/Users/rohan/Desktop/school/Computer Science/COSC 410/COSC410-2025-AutoGrader/backend/app.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Session = sessionmaker(bind=engine)
    
    # Generate unique course tag
    random_num = random.randint(1000, 9999)
    course_tag = f"VERIFY-{random_num}"
    
    print(f"\n✓ Testing course creation with tag: {course_tag}")
    print(f"✓ Faculty user: 301 (prof.x@wofford.edu)")
    
    # Create course
    response = client.post(
        "/api/v1/courses",
        json={
            "course_tag": course_tag,
            "name": "Verification Test Course",
            "description": "Testing the fix"
        },
        headers={
            "X-User-Id": "301",
            "X-User-Role": "faculty"
        }
    )
    
    print(f"\nAPI Response: {response.status_code}")
    
    if response.status_code != 201:
        print(f"❌ FAILED: Could not create course")
        print(f"Response: {response.text}")
        return False
    
    course = response.json()
    course_id = course['id']
    print(f"✓ Course created: ID {course_id}")
    
    # Check association
    db = Session()
    try:
        assoc = db.execute(
            text("SELECT user_id, course_id FROM user_course_association WHERE course_id = :cid"),
            {"cid": course_id}
        ).first()
        
        if not assoc:
            print(f"\n❌ FAILED: No association created")
            return False
        
        if assoc[0] != 301:
            print(f"\n❌ FAILED: Wrong user associated (expected 301, got {assoc[0]})")
            return False
        
        print(f"✓ Association created: User {assoc[0]} → Course {assoc[1]}")
        
        # Check faculty endpoint
        response = client.get("/api/v1/courses/faculty/301")
        if response.status_code != 200:
            print(f"\n❌ FAILED: Could not fetch faculty courses")
            return False
        
        courses = response.json()
        tags = [c['course_tag'] for c in courses]
        
        if course_tag not in tags:
            print(f"\n❌ FAILED: Course not in faculty list")
            return False
        
        print(f"✓ Course appears in faculty list")
        
        # Show final state
        print(f"\n✓ Database state:")
        total_courses = db.execute(text("SELECT COUNT(*) FROM courses")).scalar()
        total_assocs = db.execute(text("SELECT COUNT(*) FROM user_course_association")).scalar()
        print(f"  Total courses: {total_courses}")
        print(f"  Total associations: {total_assocs}")
        
    finally:
        db.close()
    
    print("\n" + "=" * 70)
    print("✅ SUCCESS: Course creation is working correctly!")
    print("=" * 70)
    print("\nWhat this means:")
    print("  ✓ Faculty can create courses")
    print("  ✓ Associations are automatically created")
    print("  ✓ Courses appear on faculty dashboard")
    print("  ✓ Database integrity is maintained")
    print("\nThe fix is working perfectly!")
    
    return True

if __name__ == "__main__":
    success = verify_fix()
    exit(0 if success else 1)

