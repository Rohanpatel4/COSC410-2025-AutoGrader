from sqlalchemy import Column, String, Enum, Integer, Boolean, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class TestSuite(Base):
    __tablename__ = "test_suites"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    file_ids: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array as text for portability
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Submission(Base):
    __tablename__ = "submissions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    file_ids: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Runtime(Base):
    __tablename__ = "runtimes"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    language: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[str] = mapped_column(String, nullable=False)
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stdout_path: Mapped[str | None] = mapped_column(String, nullable=True)
    stderr_path: Mapped[str | None] = mapped_column(String, nullable=True)
