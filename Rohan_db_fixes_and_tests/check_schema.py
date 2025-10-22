#!/usr/bin/env python3
"""
Check the schema of the backend database
"""
import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def check_schema():
    db_path = "/Users/rohan/Desktop/school/Computer Science/COSC 410/COSC410-2025-AutoGrader/backend/app.db"
    
    print("=" * 70)
    print(f"Checking schema of: {db_path}")
    print("=" * 70)
    
    engine = create_engine(f"sqlite:///{db_path}")
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        # Get courses table schema
        print("\nCOURSES table schema:")
        columns = db.execute(text("PRAGMA table_info(courses)")).all()
        for col in columns:
            nullable = "NULL" if col[3] == 0 else "NOT NULL"
            default = f", default={col[4]}" if col[4] else ""
            print(f"  {col[1]}: {col[2]} {nullable}{default}")
        
        # Get user_course_association table schema
        print("\nUSER_COURSE_ASSOCIATION table schema:")
        columns = db.execute(text("PRAGMA table_info(user_course_association)")).all()
        for col in columns:
            nullable = "NULL" if col[3] == 0 else "NOT NULL"
            default = f", default={col[4]}" if col[4] else ""
            print(f"  {col[1]}: {col[2]} {nullable}{default}")
            
        # Check alembic version
        print("\nALEMBIC version:")
        try:
            version = db.execute(text("SELECT version_num FROM alembic_version")).first()
            if version:
                print(f"  Current migration: {version[0]}")
            else:
                print("  No migration applied")
        except Exception as e:
            print(f"  Error: {e}")
            
    finally:
        db.close()
    
    print("\n" + "=" * 70)
    print("Schema check complete")
    print("=" * 70)

if __name__ == "__main__":
    check_schema()

