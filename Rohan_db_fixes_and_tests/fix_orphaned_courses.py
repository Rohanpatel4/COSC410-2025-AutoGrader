#!/usr/bin/env python3
"""
Fix orphaned courses by associating them with a faculty user
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import select, create_engine, text
from sqlalchemy.orm import sessionmaker

def fix_orphaned_courses():
    db_path = "/Users/rohan/Desktop/school/Computer Science/COSC 410/COSC410-2025-AutoGrader/backend/app.db"
    
    if not os.path.exists(db_path):
        print(f"Database not found at: {db_path}")
        return
        
    print("=" * 60)
    print("Fixing Orphaned Courses")
    print("=" * 60)
    
    engine = create_engine(f"sqlite:///{db_path}")
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        # Get all courses
        courses = db.execute(text("SELECT id, course_tag, name FROM courses")).all()
        print(f"\nFound {len(courses)} course(s) in database:")
        for c in courses:
            print(f"  - ID: {c[0]}, Tag: {c[1]}, Name: {c[2]}")
        
        # Get existing associations
        existing_assocs = db.execute(
            text("SELECT course_id FROM user_course_association")
        ).all()
        associated_course_ids = {a[0] for a in existing_assocs}
        
        print(f"\nCourses with associations: {associated_course_ids if associated_course_ids else 'None'}")
        
        # Find orphaned courses
        orphaned = [c for c in courses if c[0] not in associated_course_ids]
        
        if not orphaned:
            print("\n✓ No orphaned courses found. All courses have faculty associations.")
            return
        
        print(f"\n⚠️  Found {len(orphaned)} orphaned course(s):")
        for c in orphaned:
            print(f"  - ID: {c[0]}, Tag: {c[1]}, Name: {c[2]}")
        
        # Get first faculty user
        faculty = db.execute(
            text("SELECT id, username FROM users WHERE role='faculty' LIMIT 1")
        ).first()
        
        if not faculty:
            print("\n✗ No faculty users found in database!")
            return
        
        faculty_id = faculty[0]
        faculty_username = faculty[1]
        print(f"\nWill associate orphaned courses with faculty: {faculty_username} (ID: {faculty_id})")
        
        # Fix each orphaned course
        print("\nFixing associations...")
        for c in orphaned:
            course_id = c[0]
            db.execute(
                text("INSERT INTO user_course_association (user_id, course_id) VALUES (:user_id, :course_id)"),
                {"user_id": faculty_id, "course_id": course_id}
            )
            print(f"  ✓ Associated course {course_id} with faculty {faculty_id}")
        
        db.commit()
        
        # Verify
        print("\nVerifying fix...")
        all_assocs = db.execute(
            text("SELECT id, user_id, course_id FROM user_course_association")
        ).all()
        print(f"\nTotal associations in database: {len(all_assocs)}")
        for a in all_assocs:
            print(f"  - Association ID: {a[0]}, User ID: {a[1]}, Course ID: {a[2]}")
        
        print("\n✓ All orphaned courses have been fixed!")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        db.rollback()
    finally:
        db.close()
    
    print("\n" + "=" * 60)
    print("Fix Complete")
    print("=" * 60)

if __name__ == "__main__":
    fix_orphaned_courses()

