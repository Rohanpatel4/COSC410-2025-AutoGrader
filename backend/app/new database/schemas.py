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
    course_id: str
    name: str
    description: Optional[str] 
    

class CourseRead(BaseModel):
    id: int
    course_id: str
    name: str
    description: Optional[str] 
    
    class Config:
        from_attributes = True





    
