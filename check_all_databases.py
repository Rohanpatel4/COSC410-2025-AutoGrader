#!/usr/bin/env python3
"""
Check all database files to see which one has data
"""
import sys
import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def check_database(db_path):
    """Check a specific database file"""
    if not os.path.exists(db_path):
        print(f"  Database does not exist: {db_path}")
        return
    
    print(f"\n{'='*70}")
    print(f"Database: {db_path}")
    print(f"Size: {os.path.getsize(db_path)} bytes")
    print('='*70)
    
    engine = create_engine(f"sqlite:///{db_path}")
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        # Get tables
        tables = db.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).all()
        print(f"\nTables: {[t[0] for t in tables]}")
        
        # Check courses
        try:
            courses = db.execute(text("SELECT id, course_tag, name FROM courses")).all()
            print(f"\nCourses: {len(courses)}")
            for c in courses:
                print(f"  - ID: {c[0]}, Tag: {c[1]}, Name: {c[2]}")
        except Exception as e:
            print(f"\nCourses: Error - {e}")
        
        # Check associations
        try:
            assocs = db.execute(text("SELECT id, user_id, course_id FROM user_course_association")).all()
            print(f"\nAssociations: {len(assocs)}")
            for a in assocs:
                print(f"  - ID: {a[0]}, User {a[1]} → Course {a[2]}")
        except Exception as e:
            print(f"\nAssociations: Error - {e}")
            
    except Exception as e:
        print(f"\nError accessing database: {e}")
    finally:
        db.close()

def main():
    print("=" * 70)
    print("CHECKING ALL DATABASE FILES")
    print("=" * 70)
    
    project_root = Path("/Users/rohan/Desktop/school/Computer Science/COSC 410/COSC410-2025-AutoGrader")
    
    # List of potential database files
    db_files = [
        project_root / "app.db",
        project_root / "backend" / "app.db",
        project_root / "backend" / "backend" / "app.db",
    ]
    
    for db_file in db_files:
        check_database(str(db_file))
    
    print("\n" + "=" * 70)
    print("CHECK COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    main()

