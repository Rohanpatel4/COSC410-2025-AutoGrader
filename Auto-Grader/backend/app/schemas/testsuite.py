"""
Pydantic schemas for TestSuite entity
"""
from datetime import datetime
from typing import List

from pydantic import BaseModel, Field, ConfigDict


class TestSuiteBase(BaseModel):
    """Base schema for TestSuite"""
    name: str = Field(..., min_length=1, max_length=255)
    file_ids: List[str] = Field(..., min_items=1, description="List of TEST_CASE file IDs")


class TestSuiteCreate(TestSuiteBase):
    """Schema for creating a TestSuite"""
    pass


class TestSuiteUpdate(BaseModel):
    """Schema for updating a TestSuite"""
    name: str = Field(..., min_length=1, max_length=255)


class TestSuite(TestSuiteBase):
    """Schema for TestSuite response"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime


class TestSuiteList(BaseModel):
    """Schema for paginated test suite list response"""
    items: List[TestSuite]
    total: int
    skip: int = 0
    limit: int = 100
