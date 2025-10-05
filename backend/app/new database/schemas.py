from pydantic import BaseModel
from enum import Enum
from typing import Optional

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
    




    
