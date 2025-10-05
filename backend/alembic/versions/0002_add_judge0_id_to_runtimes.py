"""add judge0_id to runtimes"""
from alembic import op
import sqlalchemy as sa

revision = '0002_add_judge0_id_to_runtimes'
down_revision = '0001_init'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('runtimes', sa.Column('judge0_id', sa.Integer(), nullable=False, server_default='71'))

def downgrade():
    op.drop_column('runtimes', 'judge0_id')
