#!/usr/bin/env python3
"""
Migrate the backend database to the current schema
"""
import sys
import os
import shutil
from pathlib import Path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def migrate_database():
    print("=" * 70)
    print("DATABASE MIGRATION SCRIPT")
    print("=" * 70)
    
    db_path = "/Users/rohan/Desktop/school/Computer Science/COSC 410/COSC410-2025-AutoGrader/backend/app.db"
    backup_path = f"{db_path}.backup"
    
    # Step 1: Backup existing database
    print("\nStep 1: Backing up current database...")
    if os.path.exists(db_path):
        shutil.copy2(db_path, backup_path)
        print(f"  ✓ Backup created: {backup_path}")
    else:
        print(f"  No existing database to backup")
    
    # Step 2: Read existing data
    print("\nStep 2: Reading existing data...")
    old_engine = create_engine(f"sqlite:///{db_path}")
    old_session = sessionmaker(bind=old_engine)()
    
    users = []
    courses = []
    assocs = []
    assignments = []
    
    try:
        users = old_session.execute(text("SELECT id, username, role, password_hash, created_at FROM users")).all()
        print(f"  Users: {len(users)}")
        
        courses = old_session.execute(text("SELECT id, course_tag, name, description FROM courses")).all()
        print(f"  Courses: {len(courses)}")
        
        assocs = old_session.execute(text("SELECT user_id, course_id FROM user_course_association")).all()
        print(f"  Associations: {len(assocs)}")
        
        try:
            assignments = old_session.execute(text("SELECT id, course_id, title, description, sub_limit, start, stop FROM assignments")).all()
            print(f"  Assignments: {len(assignments)}")
        except:
            print(f"  Assignments: 0 (table may not exist)")
            
    except Exception as e:
        print(f"  Error reading data: {e}")
    finally:
        old_session.close()
    
    # Step 3: Delete old database
    print("\nStep 3: Removing old database...")
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"  ✓ Old database removed")
    
    # Step 4: Create new database with current schema
    print("\nStep 4: Creating new database with current schema...")
    from app.core.db import Base, engine
    Base.metadata.create_all(bind=engine)
    print(f"  ✓ New database created")
    
    # Step 5: Restore data
    print("\nStep 5: Restoring data to new database...")
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        # Insert users
        for u in users:
            db.execute(text(
                "INSERT INTO users (id, username, role, password_hash, created_at) VALUES (:id, :username, :role, :password_hash, :created_at)"
            ), {"id": u[0], "username": u[1], "role": u[2], "password_hash": u[3], "created_at": u[4]})
        print(f"  ✓ Restored {len(users)} users")
        
        # Insert courses
        for c in courses:
            db.execute(text(
                "INSERT INTO courses (id, course_tag, name, description) VALUES (:id, :course_tag, :name, :description)"
            ), {"id": c[0], "course_tag": c[1], "name": c[2], "description": c[3]})
        print(f"  ✓ Restored {len(courses)} courses")
        
        # Insert associations
        for a in assocs:
            db.execute(text(
                "INSERT INTO user_course_association (user_id, course_id) VALUES (:user_id, :course_id)"
            ), {"user_id": a[0], "course_id": a[1]})
        print(f"  ✓ Restored {len(assocs)} associations")
        
        # Insert assignments
        for a in assignments:
            db.execute(text(
                "INSERT INTO assignments (id, course_id, title, description, sub_limit, start, stop) VALUES (:id, :course_id, :title, :description, :sub_limit, :start, :stop)"
            ), {"id": a[0], "course_id": a[1], "title": a[2], "description": a[3], "sub_limit": a[4], "start": a[5], "stop": a[6]})
        print(f"  ✓ Restored {len(assignments)} assignments")
        
        db.commit()
        
    except Exception as e:
        print(f"  ✗ Error restoring data: {e}")
        db.rollback()
    finally:
        db.close()
    
    # Step 6: Verify
    print("\nStep 6: Verifying new database...")
    verify_session = Session()
    try:
        print("\nNew database schema:")
        columns = verify_session.execute(text("PRAGMA table_info(courses)")).all()
        for col in columns:
            print(f"  {col[1]}: {col[2]}")
        
        count_courses = verify_session.execute(text("SELECT COUNT(*) FROM courses")).scalar()
        count_assocs = verify_session.execute(text("SELECT COUNT(*) FROM user_course_association")).scalar()
        
        print(f"\nData counts:")
        print(f"  Courses: {count_courses}")
        print(f"  Associations: {count_assocs}")
        
    finally:
        verify_session.close()
    
    print("\n" + "=" * 70)
    print("MIGRATION COMPLETE")
    print("=" * 70)
    print(f"\nBackup saved at: {backup_path}")
    print("If everything looks good, you can delete the backup file.")

if __name__ == "__main__":
    migrate_database()

