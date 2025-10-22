#!/usr/bin/env python3
"""
Final verification test - creates a course and verifies it appears correctly
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def final_test():
    print("=" * 70)
    print("FINAL VERIFICATION TEST")
    print("=" * 70)
    
    # Import app (this will use the updated settings)
    from app.api.main import app
    from app.core import settings as settings_module
    
    print(f"\nDatabase URL: {settings_module.settings.DATABASE_URL}")
    
    client = TestClient(app)
    
    # Get the database path from settings
    db_url = settings_module.settings.DATABASE_URL
    if db_url.startswith("sqlite:///"):
        db_path = db_url[10:]  # Remove "sqlite:///"
    else:
        print("Unexpected database URL format")
        return
    
    print(f"Database file: {db_path}")
    print(f"File exists: {os.path.exists(db_path)}")
    print(f"File size: {os.path.getsize(db_path) if os.path.exists(db_path) else 0} bytes")
    
    # Check current state
    print("\n" + "=" * 70)
    print("CURRENT DATABASE STATE")
    print("=" * 70)
    
    engine = create_engine(f"sqlite:///{db_path}")
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        courses = db.execute(text("SELECT id, course_tag, name FROM courses")).all()
        print(f"\nCourses: {len(courses)}")
        for c in courses:
            print(f"  - ID: {c[0]}, Tag: {c[1]}, Name: {c[2]}")
        
        assocs_before = db.execute(text("SELECT id, user_id, course_id FROM user_course_association")).all()
        print(f"\nAssociations: {len(assocs_before)}")
        for a in assocs_before:
            print(f"  - ID: {a[0]}, User {a[1]} → Course {a[2]}")
    finally:
        db.close()
    
    # Create a new course
    print("\n" + "=" * 70)
    print("CREATING NEW COURSE")
    print("=" * 70)
    
    new_tag = f"FINAL-TEST-{len(courses) + 1}"
    print(f"\nCreating course with tag: {new_tag}")
    print("Faculty: prof.x@wofford.edu (ID: 301)")
    
    response = client.post(
        "/api/v1/courses",
        json={
            "course_tag": new_tag,
            "name": "Final Verification Course",
            "description": "Testing final implementation"
        },
        headers={
            "X-User-Id": "301",
            "X-User-Role": "faculty"
        }
    )
    
    print(f"\nAPI Response: {response.status_code}")
    
    if response.status_code != 201:
        print(f"✗ Failed to create course")
        print(f"Response: {response.text}")
        return
    
    course_data = response.json()
    print(f"✓ Course created!")
    print(f"  - ID: {course_data['id']}")
    print(f"  - Tag: {course_data['course_tag']}")
    print(f"  - Name: {course_data['name']}")
    
    new_course_id = course_data['id']
    
    # Verify in database
    print("\n" + "=" * 70)
    print("VERIFICATION")
    print("=" * 70)
    
    db = Session()
    try:
        # Check association
        association = db.execute(
            text("SELECT id, user_id, course_id FROM user_course_association WHERE course_id=:cid"),
            {"cid": new_course_id}
        ).first()
        
        if association:
            print(f"\n✓ Association created in database!")
            print(f"  - Association ID: {association[0]}")
            print(f"  - User ID: {association[1]}")
            print(f"  - Course ID: {association[2]}")
            success_assoc = True
        else:
            print(f"\n✗ NO ASSOCIATION FOUND in database!")
            success_assoc = False
        
        # Check faculty endpoint
        response = client.get("/api/v1/courses/faculty/301")
        if response.status_code == 200:
            faculty_courses = response.json()
            tags = [c["course_tag"] for c in faculty_courses]
            if new_tag in tags:
                print(f"\n✓ Course appears in faculty endpoint!")
                success_endpoint = True
            else:
                print(f"\n✗ Course NOT in faculty endpoint!")
                print(f"  Found tags: {tags}")
                success_endpoint = False
        else:
            print(f"\n✗ Faculty endpoint error: {response.status_code}")
            success_endpoint = False
        
        # Final state
        print("\n" + "=" * 70)
        print("FINAL DATABASE STATE")
        print("=" * 70)
        
        all_courses = db.execute(text("SELECT id, course_tag, name FROM courses")).all()
        print(f"\nTotal courses: {len(all_courses)}")
        
        all_assocs = db.execute(text("SELECT id, user_id, course_id FROM user_course_association ORDER BY id")).all()
        print(f"Total associations: {len(all_assocs)}")
        for a in all_assocs:
            print(f"  - ID: {a[0]}, User {a[1]} → Course {a[2]}")
        
    finally:
        db.close()
    
    print("\n" + "=" * 70)
    print("FINAL RESULT")
    print("=" * 70)
    
    if success_assoc and success_endpoint:
        print("\n✅ ALL TESTS PASSED!")
        print("Course creation is working correctly:")
        print("  ✓ Course inserted into database")
        print("  ✓ Association created in user_course_association")
        print("  ✓ Course appears in faculty endpoint")
        print("\nThe system is ready for production use!")
    else:
        print("\n❌ TESTS FAILED!")
        if not success_assoc:
            print("  ✗ Association not created")
        if not success_endpoint:
            print("  ✗ Course not appearing in faculty list")
        print("\nThere is still an issue that needs to be fixed.")

if __name__ == "__main__":
    final_test()

