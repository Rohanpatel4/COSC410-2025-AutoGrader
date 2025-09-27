"""
Submission model for grouping student submission files
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, JSON

from ..core.database import Base


class Submission(Base):
    """
    Submission model for grouping student submission files
    """
    __tablename__ = "submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    file_ids = Column(JSON, nullable=False)  # List of file IDs (all must be SUBMISSION category)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<Submission(id='{self.id}', name='{self.name}', file_count={len(self.file_ids)}>"
