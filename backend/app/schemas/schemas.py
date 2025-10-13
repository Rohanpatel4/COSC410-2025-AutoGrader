from pydantic import BaseModel, Field, ConfigDict, field_serializer
from typing import List, Optional
from datetime import datetime
from enum import Enum
import json

class FileCategory(str, Enum):
    TEST_CASE = "TEST_CASE"
    SUBMISSION = "SUBMISSION"

class RunStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"

class RoleEnum(str, Enum):
    student = "student"
    faculty = "faculty"
    admin = "admin"

class UserCreate(BaseModel):
    username: str
    name: str
    role: RoleEnum
    password_hash: str
    created_at: datetime

class UserRead(BaseModel):
    id: int
    username: str
    name: str
    role: RoleEnum
    password_hash: str
    created_at: datetime


    class Config:
        from_attributes = True

class CourseCreate(BaseModel):
    course_tag: str
    name: str
    description: Optional[str] 
    

class CourseRead(BaseModel):
    id: int
    course_tag: str
    name: str
    description: Optional[str] 
    
    class Config:
        from_attributes = True

class AssignmentCreate(BaseModel):
    course_id: int
    title: str
    description: Optional[str] 
    sub_limit: Optional[int] = None
    start: datetime
    stop: datetime

class AssignmentRead(BaseModel):
    id: int
    course_id: int
    title: str
    description: Optional[str] 
    sub_limit: Optional[int] = None
    start: datetime
    stop: datetime

    class Config:
        from_attributes = True

