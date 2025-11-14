from sqlalchemy import Column, String, Enum, Integer, Boolean, Text, ForeignKey, DateTime, Table, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime, UTC
import enum
from app.core.db import Base

user_course_association = Table(
    "user_course_association",
    Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("course_id", ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
    UniqueConstraint("user_id", "course_id", name="uq_user_course"),
)

class RoleEnum(str, enum.Enum):
    student = "student"
    faculty = "faculty"
    admin = "admin"

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum), nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False))

    courses = relationship(
        "Course",
        secondary=user_course_association,
        back_populates="professors"
    )

class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    course_code: Mapped[str] = mapped_column(String, nullable=False, index=True)
    enrollment_key: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    professors: Mapped[list["User"]] = relationship(
        "User", secondary="user_course_association", back_populates="courses"
    )
    assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )

class Assignment(Base):
    __tablename__ = "assignments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False)
    sub_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    stop:  Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    languages: Mapped[str | None] = mapped_column(String, nullable=True)

    course: Mapped["Course"] = relationship(back_populates="assignments")
    test_files: Mapped[list["TestCase"]] = relationship(
        back_populates="assignment", cascade="all, delete-orphan"
    )

class TestCase(Base):
    __tablename__ = "test_files"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id"), nullable=False)
    point_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    visibility: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    test_case: Mapped[str | None] = mapped_column(Text, nullable=True)
    order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    assignment: Mapped["Assignment"] = relationship(back_populates="test_files")

class StudentSubmission(Base):
    __tablename__ = "student_submissions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id"), nullable=False)
    attempt: Mapped[int | None] = mapped_column(Integer, nullable=True)
    earned_point: Mapped[int | None] = mapped_column(Integer, nullable=True)
    code: Mapped[str | None] = mapped_column(Text, nullable=True)
    time_submitted: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    student: Mapped["User"] = relationship()
    assignment: Mapped["Assignment"] = relationship()
