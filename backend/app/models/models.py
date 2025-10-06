from sqlalchemy import Column, String, Enum, Integer, Boolean, Text, ForeignKey, DateTime, Table
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime, UTC
import enum
from app.core.db import Base

class FileCategory(str, enum.Enum):
    TEST_CASE = "TEST_CASE"
    SUBMISSION = "SUBMISSION"

class RunStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"

class File(Base):
    __tablename__ = "files"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[FileCategory] = mapped_column(Enum(FileCategory), nullable=False)
    path: Mapped[str] = mapped_column(String, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sha256: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

class TestSuite(Base):
    __tablename__ = "test_suites"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    file_ids: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array as text for portability
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

class Submission(Base):
    __tablename__ = "submissions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    file_ids: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

class Runtime(Base):
    __tablename__ = "runtimes"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    language: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[str] = mapped_column(String, nullable=False)
    judge0_id: Mapped[int] = mapped_column(Integer, nullable=False)
    host_path: Mapped[str] = mapped_column(String, nullable=False)
    compile_cmd: Mapped[str | None] = mapped_column(String, nullable=True)
    run_cmd: Mapped[str] = mapped_column(String, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

class Run(Base):
    __tablename__ = "runs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    submission_id: Mapped[str] = mapped_column(String, ForeignKey("submissions.id"), nullable=False)
    testsuite_id: Mapped[str] = mapped_column(String, ForeignKey("test_suites.id"), nullable=False)
    runtime_id: Mapped[str] = mapped_column(String, ForeignKey("runtimes.id"), nullable=False)
    status: Mapped[RunStatus] = mapped_column(Enum(RunStatus), default=RunStatus.QUEUED, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stdout_path: Mapped[str | None] = mapped_column(String, nullable=True)
    stderr_path: Mapped[str | None] = mapped_column(String, nullable=True)

user_course_association = Table(
    "user_course_association",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("course_id", ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
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
        secondary=user_course_association,
        back_populates="professors"
    )


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_tag: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(255))
    

    professors: Mapped[list["User"]] = relationship(
        "User",
        secondary="user_course_association",
        back_populates="courses"
    )

    assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )

class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(255))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False)
    sub_limit: Mapped[int] = mapped_column(Integer)

    course: Mapped["Course"] = relationship(back_populates="assignments")

class TestCase(Base):
    __tablename__ = "test_cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id"), nullable=False)
    var_char: Mapped[str] = mapped_column(String(255))

    assignment: Mapped["Assignment"] = relationship(back_populates="test_cases")

#Second table redundant
user_course_association = Table(
    "user_course_association",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("course_id", ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    extend_existing=True
)



# ORM
# Defines the database schema using SQLAlchemy ORM.
# Each class corresponds to a table in the database.
# if changed upgrade db with `alembic revision --autogenerate -m "msg"` + `alembic upgrade head` or something like that AI did this 