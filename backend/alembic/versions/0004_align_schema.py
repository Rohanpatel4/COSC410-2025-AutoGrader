"""align live DB with app models: users username/pwd, assignments sub_limit/start/stop, +aux tables"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, UniqueConstraint

# Revision identifiers, used by Alembic.
revision = "0004_align_schema"
down_revision = "0003_add_user_course_assignment_tables"
branch_labels = None
depends_on = None


def _colnames(inspector, table):
    try:
        return {c["name"] for c in inspector.get_columns(table)}
    except Exception:
        return set()


def _has_table(inspector, name):
    try:
        return name in inspector.get_table_names()
    except Exception:
        return False


def upgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)

    # --- users: add username/password_hash/created_at if absent; keep legacy 'name' if it exists ---
    if _has_table(inspector, "users"):
        cols = _colnames(inspector, "users")
        # add username if missing
        if "username" not in cols:
            with op.batch_alter_table("users") as batch:
                batch.add_column(sa.Column("username", sa.String(255), nullable=True))
                # Add unique constraint separately
                batch.create_unique_constraint("uq_users_username", ["username"])
            # copy from legacy 'name' if present
            if "name" in cols:
                op.execute("UPDATE users SET username = name WHERE username IS NULL")
            # make it NOT NULL after backfill
            with op.batch_alter_table("users") as batch:
                batch.alter_column("username", existing_type=sa.String(255), nullable=False)
                # Drop the old name column since we've migrated to username
                if "name" in cols:
                    batch.drop_column("name")

        # add password_hash
        if "password_hash" not in cols:
            with op.batch_alter_table("users") as batch:
                batch.add_column(sa.Column("password_hash", sa.String(255), nullable=True))
            # put a dummy default
            op.execute("UPDATE users SET password_hash = COALESCE(password_hash, '$2b$12$PLACEHOLDER') ")
            with op.batch_alter_table("users") as batch:
                batch.alter_column("password_hash", existing_type=sa.String(255), nullable=False)

        # add created_at (naive ts)
        if "created_at" not in cols:
            with op.batch_alter_table("users") as batch:
                batch.add_column(sa.Column("created_at", sa.DateTime(), nullable=True))
            op.execute("UPDATE users SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)")
            with op.batch_alter_table("users") as batch:
                batch.alter_column("created_at", existing_type=sa.DateTime(), nullable=False)

    # --- assignments: add sub_limit, start, stop if missing ---
    if _has_table(inspector, "assignments"):
        a_cols = _colnames(inspector, "assignments")
        with op.batch_alter_table("assignments") as batch:
            if "sub_limit" not in a_cols:
                batch.add_column(sa.Column("sub_limit", sa.Integer(), nullable=True))
            if "start" not in a_cols:
                batch.add_column(sa.Column("start", sa.DateTime(), nullable=True))
            if "stop" not in a_cols:
                batch.add_column(sa.Column("stop", sa.DateTime(), nullable=True))

    # --- student_registrations ---
    if not _has_table(inspector, "student_registrations"):
        op.create_table(
            "student_registrations",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
            sa.UniqueConstraint("student_id", "course_id", name="uq_student_course"),
        )

    # --- test_files ---
    if not _has_table(inspector, "test_files"):
        op.create_table(
            "test_files",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("assignments.id"), nullable=False),
            sa.Column("var_char", sa.String(255), nullable=False),
        )

    # --- student_submissions ---
    if not _has_table(inspector, "student_submissions"):
        op.create_table(
            "student_submissions",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("assignments.id"), nullable=False),
            sa.Column("grade", sa.Integer(), nullable=True),
        )


def downgrade():
    # Be conservative on downgrade; only drop columns we added that are safe.
    # (Dropping tables/columns on SQLite is messy; this is minimal and safe.)

    # assignments: drop start/stop/sub_limit if present
    with op.batch_alter_table("assignments") as batch:
        try:
            batch.drop_column("stop")
        except Exception:
            pass
        try:
            batch.drop_column("start")
        except Exception:
            pass
        try:
            batch.drop_column("sub_limit")
        except Exception:
            pass

    # Keep student_registrations/test_files/student_submissions and users changes to avoid data loss.
    # If you really need full down migrations later, craft them carefully for your environment.
