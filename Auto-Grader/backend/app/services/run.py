"""
Run service for run execution business logic
"""
import asyncio
import os
import subprocess
import tempfile
from pathlib import Path
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..models.run import Run, RunStatus
from ..repositories.run import RunRepository
from ..schemas.run import RunCreate, RunUpdate
from .base import BaseService
from .file import FileService
from .runtime import RuntimeService
from .submission import SubmissionService
from .testsuite import TestSuiteService


class RunService(BaseService[RunRepository]):
    """Service for run operations and execution"""

    def __init__(self, db: AsyncSession):
        super().__init__(RunRepository(db))
        self.file_service = FileService(db)
        self.runtime_service = RuntimeService(db)
        self.submission_service = SubmissionService(db)
        self.testsuite_service = TestSuiteService(db)

    async def create_run(self, run_data: RunCreate) -> Run:
        """Create a new run"""
        # Validate that submission exists
        submission = await self.submission_service.get_submission(run_data.submission_id)
        if not submission:
            raise ValueError("Submission not found")

        # Validate that test suite exists
        testsuite = await self.testsuite_service.get_testsuite(run_data.testsuite_id)
        if not testsuite:
            raise ValueError("Test suite not found")

        # Validate that runtime exists and is enabled
        runtime = await self.runtime_service.get_runtime(run_data.runtime_id)
        if not runtime or not runtime.enabled:
            raise ValueError("Runtime not found or not enabled")

        return await self.repository.create_run(obj_in=run_data)

    async def get_run(self, run_id: str) -> Optional[Run]:
        """Get run by ID"""
        return await self.repository.get(run_id)

    async def get_runs(self, skip: int = 0, limit: int = 100) -> List[Run]:
        """Get all runs"""
        return await self.repository.get_multi(skip=skip, limit=limit)

    async def update_run(self, run_id: str, update_data: RunUpdate) -> Optional[Run]:
        """Update run"""
        return await self.repository.update_run(id=run_id, obj_in=update_data)

    async def delete_run(self, run_id: str) -> Optional[Run]:
        """Delete run"""
        run_obj = await self.get_run(run_id)
        if run_obj and run_obj.status in [RunStatus.RUNNING, RunStatus.QUEUED]:
            # Cancel the run if it's running
            await self.cancel_run(run_id)

        return await self.repository.remove(id=run_id)

    async def execute_run(self, run_id: str) -> None:
        """Execute a run asynchronously"""
        run_obj = await self.get_run(run_id)
        if not run_obj or run_obj.status != RunStatus.QUEUED:
            return

        # Mark run as running
        await self.update_run(run_id, RunUpdate(status=RunStatus.RUNNING, started_at=None))

        try:
            # Execute in background
            asyncio.create_task(self._execute_run_async(run_obj))
        except Exception as e:
            # Mark as failed if execution setup fails
            await self.update_run(run_id, RunUpdate(status=RunStatus.FAILED))

    async def _execute_run_async(self, run: Run) -> None:
        """Execute run in background task"""
        try:
            # Get related entities
            submission = await self.submission_service.get_submission(run.submission_id)
            testsuite = await self.testsuite_service.get_testsuite(run.testsuite_id)
            runtime = await self.runtime_service.get_runtime(run.runtime_id)

            if not submission or not testsuite or not runtime:
                raise ValueError("Related entities not found")

            # Create temporary directories
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)

                # Set up submission files (read-only)
                submission_dir = temp_path / "submission"
                submission_dir.mkdir()

                for file_id in submission.file_ids:
                    content = await self.file_service.get_file_content(file_id)
                    if content:
                        file_obj = await self.file_service.get_file(file_id)
                        file_path = submission_dir / file_obj.name
                        file_path.write_bytes(content)
                        file_path.chmod(0o444)  # Read-only

                # Set up test suite files (read-only)
                testsuite_dir = temp_path / "testsuite"
                testsuite_dir.mkdir()

                for file_id in testsuite.file_ids:
                    content = await self.file_service.get_file_content(file_id)
                    if content:
                        file_obj = await self.file_service.get_file(file_id)
                        file_path = testsuite_dir / file_obj.name
                        file_path.write_bytes(content)
                        file_path.chmod(0o444)  # Read-only

                # Set up working directory
                work_dir = temp_path / "work"
                work_dir.mkdir()

                # Set up output files
                stdout_path = settings.RUNS_DIR / f"{run.id}.stdout"
                stderr_path = settings.RUNS_DIR / f"{run.id}.stderr"

                # Ensure runs directory exists
                settings.RUNS_DIR.mkdir(exist_ok=True)

                # Prepare environment
                env = os.environ.copy()
                env.update({
                    "LANG": "C.UTF-8",
                    "LC_ALL": "C.UTF-8",
                    "TZ": "UTC",
                    "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                })

                # Prepare command
                run_cmd = runtime.run_cmd.replace("{entry}", str(submission_dir))

                # Execute command with sandboxing
                process = await asyncio.create_subprocess_shell(
                    run_cmd,
                    cwd=work_dir,
                    env=env,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    preexec_fn=os.setsid,  # Create new process group
                )

                try:
                    # Wait for completion with timeout
                    stdout, stderr = await asyncio.wait_for(
                        process.communicate(),
                        timeout=settings.TIME_LIMIT
                    )

                    # Write outputs to files
                    stdout_path.write_bytes(stdout)
                    stderr_path.write_bytes(stderr)

                    # Update run status
                    exit_code = process.returncode
                    status = RunStatus.SUCCEEDED if exit_code == 0 else RunStatus.FAILED

                    await self.update_run(
                        run.id,
                        RunUpdate(
                            status=status,
                            finished_at=None,
                            exit_code=exit_code,
                            stdout_path=str(stdout_path),
                            stderr_path=str(stderr_path),
                        )
                    )

                except asyncio.TimeoutError:
                    # Timeout - kill process group
                    try:
                        os.killpg(os.getpgid(process.pid), 9)
                    except ProcessLookupError:
                        pass

                    await self.update_run(run.id, RunUpdate(status=RunStatus.FAILED, exit_code=-1))

        except Exception as e:
            # General failure
            await self.update_run(run.id, RunUpdate(status=RunStatus.FAILED))

    async def cancel_run(self, run_id: str) -> bool:
        """Cancel a running or queued run"""
        run_obj = await self.get_run(run_id)
        if not run_obj:
            return False

        if run_obj.status == RunStatus.QUEUED:
            await self.update_run(run_id, RunUpdate(status=RunStatus.FAILED))
            return True
        elif run_obj.status == RunStatus.RUNNING:
            # In a real implementation, we'd need process management
            # For now, just mark as failed
            await self.update_run(run_id, RunUpdate(status=RunStatus.FAILED))
            return True

        return False

    async def get_run_stdout(self, run_id: str) -> Optional[str]:
        """Get run stdout content"""
        run_obj = await self.get_run(run_id)
        if not run_obj or not run_obj.stdout_path:
            return None

        path = Path(run_obj.stdout_path)
        if path.exists():
            return path.read_text()
        return None

    async def get_run_stderr(self, run_id: str) -> Optional[str]:
        """Get run stderr content"""
        run_obj = await self.get_run(run_id)
        if not run_obj or not run_obj.stderr_path:
            return None

        path = Path(run_obj.stderr_path)
        if path.exists():
            return path.read_text()
        return None
