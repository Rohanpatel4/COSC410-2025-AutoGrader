"""
Pydantic schemas for Run entity
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class RunStatus(str, Enum):
    """Run status enumeration"""
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class RunBase(BaseModel):
    """Base schema for Run"""
    submission_id: str
    testsuite_id: str
    runtime_id: str


class RunCreate(RunBase):
    """Schema for creating a Run"""
    pass


class RunUpdate(BaseModel):
    """Schema for updating a Run"""
    status: Optional[RunStatus] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    exit_code: Optional[int] = None
    stdout_path: Optional[str] = None
    stderr_path: Optional[str] = None


class Run(RunBase):
    """Schema for Run response"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: RunStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    exit_code: Optional[int] = None
    stdout_path: Optional[str] = None
    stderr_path: Optional[str] = None


class RunList(BaseModel):
    """Schema for paginated run list response"""
    items: list[Run]
    total: int
    skip: int = 0
    limit: int = 100
