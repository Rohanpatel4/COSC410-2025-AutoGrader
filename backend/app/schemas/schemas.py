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
    id: int
    course_code: str
    enrollment_key: str
    name: str
    description: str
    model_config = ConfigDict(from_attributes=True)

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
    start: Optional[datetime] = None
    stop: Optional[datetime] = None

class AssignmentRead(BaseModel):
    id: int
    course_id: int
    title: str
    description: str
    sub_limit: Optional[int] = None
    start: Optional[datetime] = None
    stop: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# ---------- TEST CASES ----------
class TestCaseCreate(BaseModel):
    assignment_id: int
    var_char: str

class TestCaseRead(BaseModel):
    id: int
    assignment_id: int
    var_char: str
    model_config = ConfigDict(from_attributes=True)

# ---------- STUDENT SUBMISSIONS ----------
class StudentSubmissionCreate(BaseModel):
    student_id: int
    assignment_id: int

class StudentSubmissionRead(BaseModel):
    id: int
    student_id: int
    assignment_id: int
    grade: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

# ---------- STUDENT REGISTRATIONS ----------
# DEPRECATED: StudentRegistration has been consolidated into user_course_association
# All enrollment (both faculty and students) now use user_course_association
# Use users.role to distinguish between faculty and students
# class StudentRegistrationCreate(BaseModel):
#     student_id: int
#     course_id: int

# class StudentRegistrationRead(BaseModel):
#     id: int
#     student_id: int
#     course_id: int
#     model_config = ConfigDict(from_attributes=True)


