"""
Pydantic schemas for File entity
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class FileCategory(str, Enum):
    """File category enumeration"""
    TEST_CASE = "TEST_CASE"
    SUBMISSION = "SUBMISSION"


class FileBase(BaseModel):
    """Base schema for File"""
    name: str = Field(..., min_length=1, max_length=255)
    category: FileCategory
    size_bytes: int = Field(..., ge=0)
    sha256: str = Field(..., min_length=64, max_length=64)


class FileCreate(FileBase):
    """Schema for creating a File"""
    content: bytes = Field(..., description="File content as bytes")


class FileUpdate(BaseModel):
    """Schema for updating a File"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)


class File(FileBase):
    """Schema for File response"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime

    @property
    def content(self) -> bytes:
        """Content is not included in API responses for performance reasons"""
        raise AttributeError("Content not available in response schema")


class FileList(BaseModel):
    """Schema for paginated file list response"""
    items: list[File]
    total: int
    skip: int = 0
    limit: int = 100
