"""
Pydantic schemas for Submission entity
"""
from datetime import datetime
from typing import List

from pydantic import BaseModel, Field, ConfigDict


class SubmissionBase(BaseModel):
    """Base schema for Submission"""
    name: str = Field(..., min_length=1, max_length=255)
    file_ids: List[str] = Field(..., min_items=1, description="List of SUBMISSION file IDs")


class SubmissionCreate(SubmissionBase):
    """Schema for creating a Submission"""
    pass


class SubmissionUpdate(BaseModel):
    """Schema for updating a Submission"""
    name: str = Field(..., min_length=1, max_length=255)


class Submission(SubmissionBase):
    """Schema for Submission response"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime


class SubmissionList(BaseModel):
    """Schema for paginated submission list response"""
    items: List[Submission]
    total: int
    skip: int = 0
    limit: int = 100
