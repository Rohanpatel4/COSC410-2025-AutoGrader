"""init tables"""
from alembic import op
import sqlalchemy as sa

revision = '0001_init'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('files',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('category', sa.Enum('TEST_CASE','SUBMISSION', name='filecategory'), nullable=False),
        sa.Column('path', sa.String(), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('sha256', sa.String(), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(), nullable=False)
    )
    op.create_table('test_suites',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('file_ids', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False)
    )
    op.create_table('submissions',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('file_ids', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False)
    )
    op.create_table('runtimes',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('language', sa.String(), nullable=False),
        sa.Column('version', sa.String(), nullable=False),
        sa.Column('host_path', sa.String(), nullable=False),
        sa.Column('compile_cmd', sa.String(), nullable=True),
        sa.Column('run_cmd', sa.String(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('1'))
    )
    op.create_table('runs',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('submission_id', sa.String(), sa.ForeignKey('submissions.id'), nullable=False),
        sa.Column('testsuite_id', sa.String(), sa.ForeignKey('test_suites.id'), nullable=False),
        sa.Column('runtime_id', sa.String(), sa.ForeignKey('runtimes.id'), nullable=False),
        sa.Column('status', sa.Enum('QUEUED','RUNNING','SUCCEEDED','FAILED', name='runstatus'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('exit_code', sa.Integer(), nullable=True),
        sa.Column('stdout_path', sa.String(), nullable=True),
        sa.Column('stderr_path', sa.String(), nullable=True)
    )

def downgrade():
    op.drop_table('runs')
    op.drop_table('runtimes')
    op.drop_table('submissions')
    op.drop_table('test_suites')
    op.drop_table('files')
