#!/usr/bin/env python3
"""
Test that course creation now works correctly with the fix
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def test_fixed_creation():
    print("=" * 70)
    print("TESTING FIXED COURSE CREATION")
    print("=" * 70)
    
    # Import app with the fixed code
    from app.api.main import app
    
    client = TestClient(app)
    
    db_path = "/Users/rohan/Desktop/school/Computer Science/COSC 410/COSC410-2025-AutoGrader/backend/app.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Session = sessionmaker(bind=engine)
    
    # Get current state
    db = Session()
    try:
        courses_before = db.execute(text("SELECT COUNT(*) FROM courses")).scalar()
        assocs_before = db.execute(text("SELECT COUNT(*) FROM user_course_association")).scalar()
    finally:
        db.close()
    
    print(f"\nBefore test:")
    print(f"  Courses: {courses_before}")
    print(f"  Associations: {assocs_before}")
    
    # Test creating a course
    print(f"\nCreating course with faculty user 302 (prof.y)...")
    
    response = client.post(
        "/api/v1/courses",
        json={
            "course_tag": f"FIXED-TEST-{courses_before + 1}",
            "name": "Fixed Course Creation Test",
            "description": "Testing the fix"
        },
        headers={
            "X-User-Id": "302",  # Using prof.y this time
            "X-User-Role": "faculty"
        }
    )
    
    print(f"Response status: {response.status_code}")
    
    if response.status_code == 201:
        course_data = response.json()
        print(f"\n✓ Course created!")
        print(f"  ID: {course_data['id']}")
        print(f"  Tag: {course_data['course_tag']}")
        print(f"  Name: {course_data['name']}")
        
        course_id = course_data['id']
        
        # Check database
        db = Session()
        try:
            # Check if association was created
            assoc = db.execute(
                text("SELECT id, user_id, course_id FROM user_course_association WHERE course_id = :cid"),
                {"cid": course_id}
            ).first()
            
            if assoc:
                print(f"\n✓ Association created!")
                print(f"  Association ID: {assoc[0]}")
                print(f"  User ID: {assoc[1]} (should be 302)")
                print(f"  Course ID: {assoc[2]}")
                
                if assoc[1] == 302:
                    print(f"\n✅ PERFECT! Faculty member 302 is correctly linked to the course!")
                else:
                    print(f"\n⚠️  Wrong user linked! Expected 302, got {assoc[1]}")
            else:
                print(f"\n✗ NO ASSOCIATION CREATED!")
                print(f"  This means the fix didn't work.")
            
            # Check faculty endpoint
            response = client.get("/api/v1/courses/faculty/302")
            if response.status_code == 200:
                courses = response.json()
                tags = [c['course_tag'] for c in courses]
                if course_data['course_tag'] in tags:
                    print(f"\n✓ Course appears in prof.y's course list!")
                else:
                    print(f"\n✗ Course doesn't appear in prof.y's list")
                    print(f"  Found: {tags}")
            
            # Final counts
            courses_after = db.execute(text("SELECT COUNT(*) FROM courses")).scalar()
            assocs_after = db.execute(text("SELECT COUNT(*) FROM user_course_association")).scalar()
            
            print(f"\nAfter test:")
            print(f"  Courses: {courses_after} (was {courses_before})")
            print(f"  Associations: {assocs_after} (was {assocs_before})")
            
        finally:
            db.close()
    else:
        print(f"\n✗ Failed to create course")
        print(f"Response: {response.text}")
    
    print("\n" + "=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    test_fixed_creation()

