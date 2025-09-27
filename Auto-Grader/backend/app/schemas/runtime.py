"""
Pydantic schemas for Runtime entity
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class RuntimeBase(BaseModel):
    """Base schema for Runtime"""
    language: str = Field(..., min_length=1, max_length=50)
    version: str = Field(..., min_length=1, max_length=50)
    host_path: str = Field(..., min_length=1, max_length=500, description="Absolute path to interpreter/compiler")
    compile_cmd: Optional[str] = Field(None, max_length=500)
    run_cmd: str = Field(..., min_length=1, max_length=500, description="Run command with placeholders")
    enabled: bool = True


class RuntimeCreate(RuntimeBase):
    """Schema for creating a Runtime"""
    pass


class RuntimeUpdate(BaseModel):
    """Schema for updating a Runtime"""
    language: Optional[str] = Field(None, min_length=1, max_length=50)
    version: Optional[str] = Field(None, min_length=1, max_length=50)
    host_path: Optional[str] = Field(None, min_length=1, max_length=500)
    compile_cmd: Optional[str] = Field(None, max_length=500)
    run_cmd: Optional[str] = Field(None, min_length=1, max_length=500)
    enabled: Optional[bool] = None


class Runtime(RuntimeBase):
    """Schema for Runtime response"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class RuntimeList(BaseModel):
    """Schema for paginated runtime list response"""
    items: list[Runtime]
    total: int
    skip: int = 0
    limit: int = 100
