import enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Integer, Enum, String, Boolean, Text, ForeignKey, DateTime, Column, Table
from backend.db import Base

user_courses = Table(
    "user_courses",
    Base.metadata,
    Column("user_id", ForeignKey("users.id"), primary_key=True),
    Column("course_id", ForeignKey("courses.id"), primary_key=True),
)

# Define allowed roles
class RoleEnum(str, enum.Enum):
    student = "student"
    faculty = "faculty"

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum), nullable=False)
    name: Mapped[str] = mapped_column(String(255), unique=True)

    courses = relationship(
        "Course",
        secondary=user_courses,
        back_populates="professors"
    )


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(255))
    

    professors: Mapped[list["User"]] = relationship(
        "User",
        secondary="user_course_association",
        back_populates="courses"
    )

user_course_association = Table(
    "user_course_association",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("course_id", ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
)
