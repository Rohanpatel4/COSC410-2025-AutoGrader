from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime
from enum import Enum

class FileCategory(str, Enum):
    TEST_CASE = "TEST_CASE"
    SUBMISSION = "SUBMISSION"

class RunStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"

class FileCreate(BaseModel):
    name: str
    category: FileCategory
    size_bytes: int
    sha256: str
    path: str

class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    category: FileCategory
    size_bytes: int
    sha256: str
    created_at: datetime

class TestSuiteCreate(BaseModel):
    name: str
    file_ids: List[str]

class TestSuiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    file_ids: List[str]
    created_at: datetime

'''class SubmissionCreate(BaseModel):
    name: str
    file_ids: List[str]

class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    file_ids: List[str]
    created_at: datetime'''

class RuntimeCreate(BaseModel):
    language: str
    version: str
    judge0_id: int
    host_path: str
    compile_cmd: Optional[str] = None
    run_cmd: str
    enabled: bool = True

class RuntimeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    language: str
    version: str
    judge0_id: int
    host_path: str
    compile_cmd: Optional[str] = None
    run_cmd: str
    enabled: bool

class RunCreate(BaseModel):
    submission_id: str
    testsuite_id: str
    runtime_id: str

class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    submission_id: str
    testsuite_id: str
    runtime_id: str
    status: RunStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    exit_code: Optional[int] = None
    stdout_path: Optional[str] = None
    stderr_path: Optional[str] = None

'''class CourseIn(BaseModel):
    course_id: int
    name: str
    description: Optional[str] = None
    professor_id: int

class CourseOut(CourseIn):
    id: int
    professor_name: Optional[str] = None

class ListCoursesOut(BaseModel):
    items: list[CourseOut]
    nextCursor: Optional[str] = None

class RegistrationIn(BaseModel):
    student_id: int
    course_id: int

class RegistrationOut(RegistrationIn):
    id: int'''

class RoleEnum(str, Enum):
    student = "student"
    faculty = "faculty"

class UserCreate(BaseModel):
    role: RoleEnum
    name: str

class UserRead(BaseModel):
    id: int
    role: RoleEnum
    name: str
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
    title: str
    description: Optional[str]
    course_id: int


class AssignmentRead(BaseModel):
    id: int
    title: str
    course_id: int
    description: Optional[str]

    class Config:
        from_attributes = True
    




    
