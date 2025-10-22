#!/usr/bin/env python3
"""
Complete end-to-end test of course creation with the actual database
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from fastapi.testclient import TestClient
from sqlalchemy import select, create_engine, text
from sqlalchemy.orm import sessionmaker

def test_complete_flow():
    print("=" * 70)
    print("COMPLETE COURSE CREATION TEST - Using Actual Database")
    print("=" * 70)
    
    # Import app
    from app.api.main import app
    from app.models.models import user_course_association
    
    client = TestClient(app)
    
    # Check current database state
    db_path = "/Users/rohan/Desktop/school/Computer Science/COSC 410/COSC410-2025-AutoGrader/backend/app.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Session = sessionmaker(bind=engine)
    db = Session()
    
    print("\n" + "=" * 70)
    print("STEP 1: Current Database State")
    print("=" * 70)
    try:
        courses = db.execute(text("SELECT id, course_tag, name FROM courses")).all()
        print(f"\nExisting courses: {len(courses)}")
        for c in courses:
            print(f"  - ID: {c[0]}, Tag: {c[1]}, Name: {c[2]}")
        
        assocs = db.execute(text("SELECT user_id, course_id FROM user_course_association")).all()
        print(f"\nExisting associations: {len(assocs)}")
        for a in assocs:
            print(f"  - User ID: {a[0]} → Course ID: {a[1]}")
    finally:
        db.close()
    
    print("\n" + "=" * 70)
    print("STEP 2: Create New Course via API (Faculty User 301)")
    print("=" * 70)
    
    # Test creating a new course with proper headers
    test_tag = f"TEST-{len(courses) + 1}"
    response = client.post(
        "/api/v1/courses",
        json={
            "course_tag": test_tag,
            "name": "Test Course via API",
            "description": "Testing complete flow"
        },
        headers={
            "X-User-Id": "301",
            "X-User-Role": "faculty"
        }
    )
    
    print(f"\nAPI Response Status: {response.status_code}")
    
    if response.status_code == 201:
        course_data = response.json()
        print(f"✓ Course created successfully!")
        print(f"  - ID: {course_data['id']}")
        print(f"  - Tag: {course_data['course_tag']}")
        print(f"  - Name: {course_data['name']}")
        
        new_course_id = course_data['id']
        
        print("\n" + "=" * 70)
        print("STEP 3: Verify Association in Database")
        print("=" * 70)
        
        db = Session()
        try:
            # Check if association was created
            association = db.execute(
                text("SELECT id, user_id, course_id FROM user_course_association WHERE user_id=301 AND course_id=:course_id"),
                {"course_id": new_course_id}
            ).first()
            
            if association:
                print(f"\n✓ Association found in database!")
                print(f"  - Association ID: {association[0]}")
                print(f"  - User ID: {association[1]}")
                print(f"  - Course ID: {association[2]}")
            else:
                print(f"\n✗ NO ASSOCIATION FOUND!")
                print(f"  Expected: user_id=301, course_id={new_course_id}")
                print("\n  This means the backend code is not creating the association.")
        finally:
            db.close()
        
        print("\n" + "=" * 70)
        print("STEP 4: Check Faculty Course List Endpoint")
        print("=" * 70)
        
        response = client.get("/api/v1/courses/faculty/301")
        if response.status_code == 200:
            faculty_courses = response.json()
            course_tags = [c["course_tag"] for c in faculty_courses]
            print(f"\nFaculty 301's courses: {len(faculty_courses)}")
            for c in faculty_courses:
                print(f"  - {c['course_tag']}: {c['name']}")
            
            if test_tag in course_tags:
                print(f"\n✓ New course appears in faculty's course list!")
            else:
                print(f"\n✗ New course NOT in faculty's course list!")
        else:
            print(f"\n✗ Error fetching faculty courses: {response.status_code}")
        
        print("\n" + "=" * 70)
        print("STEP 5: Final Database State")
        print("=" * 70)
        
        db = Session()
        try:
            all_assocs = db.execute(
                text("SELECT user_id, course_id FROM user_course_association ORDER BY course_id")
            ).all()
            print(f"\nAll associations: {len(all_assocs)}")
            for a in all_assocs:
                print(f"  - User {a[0]} → Course {a[1]}")
        finally:
            db.close()
            
    else:
        print(f"✗ Failed to create course")
        print(f"Response: {response.text}")
    
    print("\n" + "=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)
    
    if response.status_code == 201 and association:
        print("\n✅ ALL TESTS PASSED - Course creation is working correctly!")
    else:
        print("\n❌ TESTS FAILED - There is still an issue with course creation")

if __name__ == "__main__":
    test_complete_flow()

