"""
Run model for execution runs
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, String, DateTime, Integer, Enum as SQLEnum, ForeignKey

from ..core.database import Base


class RunStatus(str, Enum):
    """Run status enumeration"""
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class Run(Base):
    """
    Run model for execution runs
    """
    __tablename__ = "runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String(36), ForeignKey("submissions.id"), nullable=False)
    testsuite_id = Column(String(36), ForeignKey("test_suites.id"), nullable=False)
    runtime_id = Column(String(36), ForeignKey("runtimes.id"), nullable=False)
    status = Column(SQLEnum(RunStatus), nullable=False, default=RunStatus.QUEUED)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    exit_code = Column(Integer, nullable=True)
    stdout_path = Column(String(500), nullable=True)
    stderr_path = Column(String(500), nullable=True)

    def __repr__(self):
        return f"<Run(id='{self.id}', status='{self.status}', exit_code={self.exit_code})>"
