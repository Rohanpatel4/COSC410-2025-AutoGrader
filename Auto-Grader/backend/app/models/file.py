"""
File model for storing uploaded files
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, String, Integer, DateTime, LargeBinary, Enum as SQLEnum

from ..core.database import Base


class FileCategory(str, Enum):
    """File category enumeration"""
    TEST_CASE = "TEST_CASE"
    SUBMISSION = "SUBMISSION"


class File(Base):
    """
    File model for storing uploaded files
    """
    __tablename__ = "files"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    category = Column(SQLEnum(FileCategory), nullable=False)
    content = Column(LargeBinary, nullable=False)  # Store file content as blob
    size_bytes = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False, unique=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<File(id='{self.id}', name='{self.name}', category='{self.category}')>"
