"""Initial migration

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create files table
    op.create_table(
        "files",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.Enum("TEST_CASE", "SUBMISSION", name="filecategory"), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sha256"),
    )

    # Create test_suites table
    op.create_table(
        "test_suites",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("file_ids", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create submissions table
    op.create_table(
        "submissions",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("file_ids", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create runtimes table
    op.create_table(
        "runtimes",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("language", sa.String(50), nullable=False),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("host_path", sa.String(500), nullable=False),
        sa.Column("compile_cmd", sa.String(500), nullable=True),
        sa.Column("run_cmd", sa.String(500), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create runs table
    op.create_table(
        "runs",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("submission_id", sa.String(36), nullable=False),
        sa.Column("testsuite_id", sa.String(36), nullable=False),
        sa.Column("runtime_id", sa.String(36), nullable=False),
        sa.Column("status", sa.Enum("QUEUED", "RUNNING", "SUCCEEDED", "FAILED", name="runstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("exit_code", sa.Integer(), nullable=True),
        sa.Column("stdout_path", sa.String(500), nullable=True),
        sa.Column("stderr_path", sa.String(500), nullable=True),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ),
        sa.ForeignKeyConstraint(["testsuite_id"], ["test_suites.id"], ),
        sa.ForeignKeyConstraint(["runtime_id"], ["runtimes.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("runs")
    op.drop_table("runtimes")
    op.drop_table("submissions")
    op.drop_table("test_suites")
    op.drop_table("files")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS runstatus")
    op.execute("DROP TYPE IF EXISTS filecategory")
