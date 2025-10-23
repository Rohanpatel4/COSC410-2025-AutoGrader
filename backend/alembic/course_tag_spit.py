# AI GENERATED FRAMEWORK FOR MIGRATION FILE FOR THE COURSE TAG SPLIT
# FOR COURSE_CODE AND ENROLLMENT KEY
# UNSURE IF ACTUALLY NEEDED. CAN DELETE IF NOT



# Generate the migration file
#cd backend
#alembic revision -m "course_tag_split"

# Edit the generated file with the code above, then run:
#alembic upgrade head

# If you need to rollback:
#alembic downgrade -1






"""course_tag_split_robust

Revision ID: XXXX
Revises: 317d6b894370
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from typing import Sequence, Union
import secrets
import string
import logging

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = 'XXXX'
down_revision: Union[str, Sequence[str], None] = '317d6b894370'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

logger = logging.getLogger(__name__)

def generate_enrollment_key() -> str:
    """Generate a unique 8-character alphanumeric enrollment key."""
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))


def upgrade() -> None:
    """Upgrade schema: split course_tag into course_code and enrollment_key."""
    
    connection = op.get_bind()
    
    try:
        # Step 1: Add new columns
        logger.info("Adding course_code and enrollment_key columns...")
        op.add_column('courses', sa.Column('course_code', sa.String(length=255), nullable=True))
        op.add_column('courses', sa.Column('enrollment_key', sa.String(length=255), nullable=True))
        
        # Step 2: Migrate existing data
        logger.info("Migrating existing course_tag data to course_code...")
        op.execute(text("UPDATE courses SET course_code = course_tag"))
        
        # Step 3: Generate enrollment_key for existing courses
        logger.info("Generating enrollment keys for existing courses...")
        result = connection.execute(text("SELECT id, course_tag FROM courses"))
        courses = result.fetchall()
                
        enrollment_keys = set()
        for course_id, course_tag in courses:
            # Generate unique enrollment key
            max_attempts = 100
            for attempt in range(max_attempts):
                enrollment_key = generate_enrollment_key()
                if enrollment_key not in enrollment_keys:
                    # Check database for uniqueness
                    existing = connection.execute(
                        text("SELECT id FROM courses WHERE enrollment_key = :key"), 
                        {"key": enrollment_key}
                    ).fetchone()
                    if not existing:
                        enrollment_keys.add(enrollment_key)
                        break
            else:
                raise Exception(f"Could not generate unique enrollment key for course {course_id} after {max_attempts} attempts")
            
            connection.execute(
                text("UPDATE courses SET enrollment_key = :key WHERE id = :id"),
                {"key": enrollment_key, "id": course_id}
            )
            logger.info(f"Generated enrollment key {enrollment_key} for course {course_id} ({course_tag})")
                
        # Step 4: Make new columns NOT NULL
        logger.info("Making new columns NOT NULL...")
        op.alter_column('courses', 'course_code', nullable=False)
        op.alter_column('courses', 'enrollment_key', nullable=False)
        
        # Step 5: Add unique constraint on enrollment_key
        logger.info("Adding unique constraint on enrollment_key...")
        op.create_unique_constraint('uq_courses_enrollment_key', 'courses', ['enrollment_key'])
        
        # Step 6: Drop the old course_tag column
        logger.info("Dropping old course_tag column...")
        op.drop_column('courses', 'course_tag')
        
        logger.info("Migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise

def downgrade() -> None:
    """Downgrade schema: merge course_code and enrollment_key back to course_tag."""
    
    connection = op.get_bind()
    
    try:
        # Step 1: Add back course_tag column
        logger.info("Adding back course_tag column...")
        op.add_column('courses', sa.Column('course_tag', sa.String(length=255), nullable=True))
        
        # Step 2: Copy course_code back to course_tag
        logger.info("Copying course_code back to course_tag...")
        op.execute(text("UPDATE courses SET course_tag = course_code"))
        
        # Step 3: Make course_tag NOT NULL
        logger.info("Making course_tag NOT NULL...")
        op.alter_column('courses', 'course_tag', nullable=False)
        
        # Step 4: Drop unique constraint on enrollment_key
        logger.info("Dropping unique constraint on enrollment_key...")
        op.drop_constraint('uq_courses_enrollment_key', 'courses', type_='unique')
        
        # Step 5: Drop the new columns
        logger.info("Dropping new columns...")
        op.drop_column('courses', 'enrollment_key')
        op.drop_column('courses', 'course_code')
        
        logger.info("Downgrade completed successfully!")
        
    except Exception as e:
        logger.error(f"Downgrade failed: {e}")
        raise