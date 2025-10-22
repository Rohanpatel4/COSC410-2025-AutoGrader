#!/usr/bin/env python3
"""
Recreate the backend database with current schema
"""
import sys
import os
import shutil
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def recreate_database():
    print("=" * 70)
    print("DATABASE RECREATION SCRIPT")
    print("=" * 70)
    
    db_path = "/Users/rohan/Desktop/school/Computer Science/COSC 410/COSC410-2025-AutoGrader/backend/app.db"
    backup_path = f"{db_path}.backup"
    
    # Step 1: Backup
    print("\nStep 1: Backing up current database...")
    if os.path.exists(db_path):
        shutil.copy2(db_path, backup_path)
        print(f"  ✓ Backup created: {backup_path}")
        
        # Read existing data
        print("\nStep 2: Reading existing data...")
        old_engine = create_engine(f"sqlite:///{db_path}")
        old_session = sessionmaker(bind=old_engine)()
        
        users = []
        courses = []
        assocs = []
        
        try:
            users = old_session.execute(text("SELECT id, username, role, password_hash, created_at FROM users")).all()
            print(f"  Users: {len(users)}")
            
            courses = old_session.execute(text("SELECT id, course_tag, name, description FROM courses")).all()
            print(f"  Courses: {len(courses)}")
            
            assocs = old_session.execute(text("SELECT user_id, course_id FROM user_course_association")).all()
            print(f"  Associations: {len(assocs)}")
        except Exception as e:
            print(f"  Error: {e}")
        finally:
            old_session.close()
        
        # Delete old database
        print("\nStep 3: Removing old database...")
        os.remove(db_path)
        print(f"  ✓ Old database removed")
    else:
        print("  No existing database")
        users = []
        courses = []
        assocs = []
    
    # Create new database
    print("\nStep 4: Creating new database with current schema...")
    from app.core.db import Base, engine
    from app.models.models import User, Course, user_course_association
    
    Base.metadata.create_all(bind=engine)
    print(f"  ✓ New database created at: {db_path}")
    
    # Verify schema
    Session = sessionmaker(bind=engine)
    db = Session()
    
    print("\nStep 5: Verifying new schema...")
    try:
        columns = db.execute(text("PRAGMA table_info(courses)")).all()
        print("  Courses table columns:")
        for col in columns:
            nullable = "NULL" if col[3] == 0 else "NOT NULL"
            print(f"    - {col[1]}: {col[2]} {nullable}")
    finally:
        db.close()
    
    # Restore data
    print("\nStep 6: Restoring data...")
    db = Session()
    try:
        # Restore users
        for u in users:
            db.execute(text(
                "INSERT INTO users (id, username, role, password_hash, created_at) VALUES (:id, :username, :role, :password_hash, :created_at)"
            ), {"id": u[0], "username": u[1], "role": u[2], "password_hash": u[3], "created_at": u[4]})
        db.commit()
        print(f"  ✓ Restored {len(users)} users")
        
        # Restore courses
        for c in courses:
            db.execute(text(
                "INSERT INTO courses (id, course_tag, name, description) VALUES (:id, :course_tag, :name, :description)"
            ), {"id": c[0], "course_tag": c[1], "name": c[2], "description": c[3]})
        db.commit()
        print(f"  ✓ Restored {len(courses)} courses")
        
        # Restore associations
        for a in assocs:
            db.execute(text(
                "INSERT INTO user_course_association (user_id, course_id) VALUES (:user_id, :course_id)"
            ), {"user_id": a[0], "course_id": a[1]})
        db.commit()
        print(f"  ✓ Restored {len(assocs)} associations")
        
    except Exception as e:
        print(f"  ✗ Error: {e}")
        db.rollback()
    finally:
        db.close()
    
    # Final verification
    print("\nStep 7: Final verification...")
    db = Session()
    try:
        count_users = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        count_courses = db.execute(text("SELECT COUNT(*) FROM courses")).scalar()
        count_assocs = db.execute(text("SELECT COUNT(*) FROM user_course_association")).scalar()
        
        print(f"  Users: {count_users}")
        print(f"  Courses: {count_courses}")
        print(f"  Associations: {count_assocs}")
        
        print("\n  All courses with their associations:")
        results = db.execute(text("""
            SELECT c.id, c.course_tag, c.name, u.id, u.username
            FROM courses c
            LEFT JOIN user_course_association uca ON uca.course_id = c.id
            LEFT JOIN users u ON u.id = uca.user_id
        """)).all()
        
        for r in results:
            if r[3]:
                print(f"    Course {r[0]} ({r[1]}): Associated with User {r[3]} ({r[4]})")
            else:
                print(f"    Course {r[0]} ({r[1]}): No associations")
        
    finally:
        db.close()
    
    print("\n" + "=" * 70)
    print("DATABASE RECREATION COMPLETE")
    print("=" * 70)
    print(f"\nBackup saved at: {backup_path}")

if __name__ == "__main__":
    recreate_database()

