#!/usr/bin/env python3
"""
Quick SQLite inspector for this project.

Usage:
  python tools/inspect_db.py                # looks for ./app.db
  python tools/inspect_db.py path\to\db.db  # custom path

It prints tables, a few sample rows, and some helpful focused queries.
"""
from __future__ import annotations
import os, sys, sqlite3
from typing import Iterable, Tuple

def connect(db_path: str) -> sqlite3.Connection:
    if not os.path.isabs(db_path):
        db_path = os.path.abspath(db_path)
    if not os.path.exists(db_path):
        print(f"❌ DB not found at: {db_path}")
        sys.exit(2)
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    return con

def list_tables(cur: sqlite3.Cursor) -> list[str]:
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    return [r["name"] for r in cur.fetchall()]

def print_rows(cur: sqlite3.Cursor, title: str, rows: Iterable[sqlite3.Row], limit: int = 5):
    print(f"\nTable: {title}")
    count = 0
    for row in rows:
        print(" ", dict(row))
        count += 1
        if count >= limit:
            break
    if count == 0:
        print("  (empty)")
    elif count >= limit:
        print(f"  … (showing {limit} rows)")

def dump_sample(con: sqlite3.Connection, tables: Iterable[str], limit: int = 5):
    cur = con.cursor()
    for t in tables:
        try:
            cur.execute(f"SELECT * FROM {t} LIMIT {limit};")
            print_rows(cur, t, cur.fetchall(), limit=limit)
        except sqlite3.Error as e:
            print(f"\nTable: {t}")
            print(f"  ⚠️ error: {e}")

def focused_queries(con: sqlite3.Connection):
    cur = con.cursor()

    print("\n=== Users (id, username, role) ===")
    try:
        cur.execute("SELECT id, username, role FROM users ORDER BY id;")
        print_rows(cur, "users (focused)", cur.fetchall(), limit=50)
    except sqlite3.Error:
        # legacy schema fallback (name instead of username)
        try:
            cur.execute("SELECT id, name AS username, role FROM users ORDER BY id;")
            print_rows(cur, "users (legacy name)", cur.fetchall(), limit=50)
        except sqlite3.Error as e:
            print("  ⚠️", e)

    print("\n=== Courses ===")
    try:
        cur.execute("SELECT id, course_tag, name, description FROM courses ORDER BY id;")
        print_rows(cur, "courses (focused)", cur.fetchall(), limit=50)
    except sqlite3.Error as e:
        print("  ⚠️", e)

    print("\n=== Faculty ↔ Courses (user_course_association) ===")
    try:
        cur.execute("""
            SELECT u.id AS user_id, u.username, u.role, c.id AS course_id, c.course_tag, c.name
            FROM user_course_association a
            JOIN users u ON u.id = a.user_id
            JOIN courses c ON c.id = a.course_id
            ORDER BY c.id, u.id;
        """)
        print_rows(cur, "user_course_association (joined)", cur.fetchall(), limit=200)
    except sqlite3.Error as e:
        print("  ⚠️", e)

    print("\n=== Student Registrations ===")
    try:
        cur.execute("""
            SELECT r.id, u.id AS student_id, u.username AS student_username, c.id AS course_id, c.course_tag
            FROM student_registrations r
            JOIN users u ON u.id = r.student_id
            JOIN courses c ON c.id = r.course_id
            ORDER BY r.id;
        """)
        print_rows(cur, "student_registrations (joined)", cur.fetchall(), limit=200)
    except sqlite3.Error as e:
        print("  ⚠️", e)

    print("\n=== Assignments ===")
    try:
        # show helpful assignment fields if present
        cur.execute("""
            SELECT id, course_id, title, description, sub_limit,
                   COALESCE(start, NULL) AS start,
                   COALESCE(stop, NULL)  AS stop
            FROM assignments
            ORDER BY id;
        """)
        print_rows(cur, "assignments (focused)", cur.fetchall(), limit=200)
    except sqlite3.Error as e:
        print("  ⚠️", e)

    print("\n=== Test Files (per assignment) ===")
    try:
        cur.execute("""
            SELECT tf.id, tf.assignment_id, tf.var_char
            FROM test_files tf
            ORDER BY tf.id;
        """)
        print_rows(cur, "test_files", cur.fetchall(), limit=200)
    except sqlite3.Error as e:
        print("  ⚠️", e)

    print("\n=== Student Submissions (attempts) ===")
    try:
        cur.execute("""
            SELECT id, student_id, assignment_id, grade
            FROM student_submissions
            ORDER BY id;
        """)
        print_rows(cur, "student_submissions", cur.fetchall(), limit=200)
    except sqlite3.Error as e:
        print("  ⚠️", e)

def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else "app.db"
    con = connect(db_path)
    print(f"🔍 Inspecting database at: {os.path.abspath(db_path)}")

    cur = con.cursor()
    tables = list_tables(cur)
    print("\n=== Tables ===")
    for t in tables:
        print(" -", t if isinstance(t, str) else t["name"])

    print("\n=== Sample Data ===")
    dump_sample(con, tables, limit=5)

    focused_queries(con)
    con.close()
    print("\n✅ Done.")

if __name__ == "__main__":
    main()
