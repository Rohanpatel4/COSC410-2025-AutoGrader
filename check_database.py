#!/usr/bin/env python3
"""
Check the actual database state
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import select, create_engine, text
from sqlalchemy.orm import sessionmaker

def check_database():
    # Check the main database
    db_path = "/Users/rohan/Desktop/school/Computer Science/COSC 410/COSC410-2025-AutoGrader/backend/app.db"
    
    if not os.path.exists(db_path):
        print(f"Database not found at: {db_path}")
        return
        
    print("=" * 60)
    print(f"Checking database: {db_path}")
    print("=" * 60)
    
    engine = create_engine(f"sqlite:///{db_path}")
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        # Check courses
        print("\n1. COURSES:")
        courses = db.execute(text("SELECT id, course_tag, name FROM courses")).all()
        for c in courses:
            print(f"   ID: {c[0]}, Tag: {c[1]}, Name: {c[2]}")
        
        # Check users
        print("\n2. FACULTY USERS:")
        faculty = db.execute(text("SELECT id, username, role FROM users WHERE role='faculty'")).all()
        for f in faculty:
            print(f"   ID: {f[0]}, Username: {f[1]}, Role: {f[2]}")
        
        # Check associations
        print("\n3. USER_COURSE_ASSOCIATIONS:")
        assocs = db.execute(text("SELECT id, user_id, course_id FROM user_course_association")).all()
        if assocs:
            for a in assocs:
                print(f"   ID: {a[0]}, User ID: {a[1]}, Course ID: {a[2]}")
        else:
            print("   ⚠️  NO ASSOCIATIONS FOUND - This is the problem!")
        
        # Check if table exists
        print("\n4. DATABASE SCHEMA:")
        tables = db.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).all()
        table_names = [t[0] for t in tables]
        print(f"   Tables: {', '.join(table_names)}")
        
        if 'user_course_association' in table_names:
            print("   ✓ user_course_association table exists")
            
            # Check table structure
            columns = db.execute(text("PRAGMA table_info(user_course_association)")).all()
            print("   Columns:")
            for col in columns:
                print(f"     - {col[1]} ({col[2]})")
        else:
            print("   ✗ user_course_association table MISSING!")
            
    finally:
        db.close()
    
    print("\n" + "=" * 60)
    print("Database Check Complete")
    print("=" * 60)

if __name__ == "__main__":
    check_database()

