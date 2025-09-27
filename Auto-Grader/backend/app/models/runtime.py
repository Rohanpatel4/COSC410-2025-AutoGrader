"""
Runtime model for pluggable language runtimes
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, String, DateTime, Boolean

from ..core.database import Base


class Runtime(Base):
    """
    Runtime model for pluggable language runtimes
    """
    __tablename__ = "runtimes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    language = Column(String(50), nullable=False)
    version = Column(String(50), nullable=False)
    host_path = Column(String(500), nullable=False)  # Absolute path to interpreter/compiler on host
    compile_cmd = Column(String(500), nullable=True)  # Optional compile command
    run_cmd = Column(String(500), nullable=False)  # Run command with placeholders like {entry}
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Runtime(id='{self.id}', language='{self.language}', version='{self.version}', enabled={self.enabled})>"
