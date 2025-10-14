#!/usr/bin/env python3
"""
Inspect your SQLite (or other SQLAlchemy URL) database.

Examples:
  # default DB path (sqlite:///backend/app.db), 5 sample rows each
  python inspect_db.py

  # explicit URL + show 10 rows
  python inspect_db.py --url sqlite:///backend/app.db --limit 10

  # only show specific tables
  python inspect_db.py --tables users,courses,assignments

  # include CREATE TABLE DDL (SQLite) for certain tables
  python inspect_db.py --ddl users,assignments
"""
from __future__ import annotations
import argparse, json, sys
from typing import Iterable, List, Optional
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

def csv_list(s: Optional[str]) -> List[str]:
    if not s: return []
    return [p.strip() for p in s.split(",") if p.strip()]

def print_header(title: str) -> None:
    bar = "─" * max(8, len(title) + 2)
    print(f"\n{bar}\n{title}\n{bar}")

def show_tables(engine: Engine, tables: List[str], limit: int, ddl_for: List[str]) -> None:
    insp = inspect(engine)
    with engine.connect() as conn:
        # Discover tables if not specified
        all_tables = insp.get_table_names()
        if not tables:
            tables = all_tables

        print_header(f"DB URL: {engine.url}")
        print("Tables:", ", ".join(all_tables) if all_tables else "<none>")

        for t in tables:
            if t not in all_tables:
                print(f"\n[skip] {t} (not found)")
                continue

            print_header(f"TABLE: {t}")
            cols = insp.get_columns(t)
            print("Columns:")
            for c in cols:
                name = c.get("name")
                typ  = str(c.get("type"))
                nul  = c.get("nullable")
                dflt = c.get("default")
                print(f"  - {name:<22} {typ:<18} nullable={nul!s:<5} default={dflt}")

            # Row count
            try:
                n = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar_one()
            except Exception as e:
                print(f"Count error: {e}")
                n = None
            print(f"Rows: {n}")

            # Sample rows
            if n and n > 0 and limit > 0:
                try:
                    rows = conn.execute(text(f"SELECT * FROM {t} LIMIT :lim"), {"lim": limit}).fetchall()
                    print(f"Sample (up to {limit}):")
                    for r in rows:
                        print("  ", json.dumps(dict(r._mapping), default=str))
                except Exception as e:
                    print(f"Sample error: {e}")

            # DDL (SQLite only)
            if t in ddl_for and engine.url.get_backend_name() == "sqlite":
                try:
                    sql = conn.execute(
                        text("SELECT sql FROM sqlite_master WHERE type='table' AND name=:name"),
                        {"name": t},
                    ).scalar()
                    if sql:
                        print("\nDDL:")
                        print(sql)
                except Exception as e:
                    print(f"DDL error: {e}")

        # Alembic revision (if present)
        if "alembic_version" in all_tables:
            rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
            print_header(f"Alembic revision: {rev}")

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="sqlite:///backend/app.db",
                    help="SQLAlchemy DB URL (default: sqlite:///backend/app.db)")
    ap.add_argument("--limit", type=int, default=5, help="Sample rows per table")
    ap.add_argument("--tables", help="Comma-separated list to restrict tables")
    ap.add_argument("--ddl", help="Comma-separated list of tables to print DDL (SQLite)")
    args = ap.parse_args()

    engine = create_engine(args.url)
    tables = csv_list(args.tables)
    ddl_for = csv_list(args.ddl)
    try:
        show_tables(engine, tables, args.limit, ddl_for)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
