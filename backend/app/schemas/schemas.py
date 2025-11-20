# backend/app/api/schemas.py
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from enum import Enum

# Keep these if you actually use them elsewhere; harmless to leave.
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

# ---------- USERS ----------
class UserCreate(BaseModel):
    username: str
    role: RoleEnum
    # Your model stores a hash; keep API as-is for now (or switch to plain password if you add server-side hashing)
    password_hash: str
    created_at: datetime

class UserRead(BaseModel):
    id: int
    username: str
    role: RoleEnum
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)  # Pydantic v2 style

# ---------- COURSES ----------
# models.py: description is NOT nullable -> required in schemas
class CourseCreate(BaseModel):
    course_code: str
    name: str
    description: str

class CourseRead(BaseModel):
    id: int
    course_code: str
    enrollment_key: str
    name: str
    description: str
    model_config = ConfigDict(from_attributes=True)

# ---------- ASSIGNMENTS ----------
# models.py: description NOT nullable; start/stop are nullable
class AssignmentCreate(BaseModel):
    course_id: int
    title: str
    description: str
    sub_limit: Optional[int] = None
    start: Optional[datatime] = None 
    stop: Optional[datatime] = None 

class AssignmentRead(BaseModel):
    id: int
    course_id: int
    title: str
    description: str
    sub_limit: Optional[int] = None
    start: Optional[str] = None             #changed from Optional[datetime] = None
    stop: Optional[str] = None              #changed from Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# ---------- TEST CASES ----------
class TestCaseCreate(BaseModel):
    assignment_id: int
    point_value: int  
    visibility: bool = True  
    test_code: str  
    order: Optional[int] = None  

class TestCaseRead(BaseModel):
    id: int
    assignment_id: int
    point_value: int
    visibility: bool
    test_code: str
    order: Optional[int] = None
    created_at: Optional[str] = None  
    model_config = ConfigDict(from_attributes=True)

# Batch create for test cases (matches API endpoint)
class TestCaseBatchCreate(BaseModel):
    test_cases: list[TestCaseCreate]

# ---------- STUDENT SUBMISSIONS ----------
class StudentSubmissionCreate(BaseModel):
    student_id: int
    assignment_id: int

class StudentSubmissionRead(BaseModel):
    id: int
    student_id: int
    assignment_id: int
    earned_points: Optional[int] = None  
    code: Optional[str] = None  
    created_at: Optional[str] = None  
    model_config = ConfigDict(from_attributes=True)

class StudentSubmissionAttempt(BaseModel):
    id: int
    earned_points: Optional[int] = None


# ---------- REGISTRATIONS ----------
class RegistrationCreate(BaseModel):
    student_id: int
    course_id: Optional[int] = None
    enrollment_key: Optional[str] = None
    # Note: Either course_id OR enrollment_key should be provided

class RegistrationRead(BaseModel):
    id: int
    student_id: int
    course_id: int


# ---------- LOGIN ----------
class LoginRequest(BaseModel):
    username: str  # Email address
    password: str
    role: RoleEnum

class LoginResponse(BaseModel):
    user_id: int
    userId: int  # Duplicate for frontend compatibility
    role: str
    status: str  # Duplicate for frontend compatibility
    token: Optional[str] = None
    username: Optional[str] = None  # Email/username
    email: Optional[str] = None  # Email/username (same as username)