"""
TestSuite model for grouping test case files
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, JSON

from ..core.database import Base


class TestSuite(Base):
    """
    TestSuite model for grouping test case files
    """
    __tablename__ = "test_suites"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    file_ids = Column(JSON, nullable=False)  # List of file IDs (all must be TEST_CASE category)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<TestSuite(id='{self.id}', name='{self.name}', file_count={len(self.file_ids)}>"
