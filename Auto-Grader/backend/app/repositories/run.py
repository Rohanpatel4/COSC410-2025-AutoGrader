"""
Run repository for run operations
"""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.run import Run, RunStatus
from ..schemas.run import RunCreate, RunUpdate
from .base import BaseRepository


class RunRepository(BaseRepository[Run]):
    """Repository for Run entity operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(Run, db)

    async def create_run(self, *, obj_in: RunCreate) -> Run:
        """Create a new run"""
        db_obj = Run(
            submission_id=obj_in.submission_id,
            testsuite_id=obj_in.testsuite_id,
            runtime_id=obj_in.runtime_id,
            status=RunStatus.QUEUED,
        )
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def update_run(self, *, id: str, obj_in: RunUpdate) -> Optional[Run]:
        """Update run"""
        db_obj = await self.get(id)
        if not db_obj:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def get_queued_runs(self) -> List[Run]:
        """Get all queued runs"""
        result = await self.db.execute(
            select(Run).where(Run.status == RunStatus.QUEUED).order_by(Run.created_at)
        )
        return result.scalars().all()

    async def get_running_runs(self) -> List[Run]:
        """Get all running runs"""
        result = await self.db.execute(
            select(Run).where(Run.status == RunStatus.RUNNING)
        )
        return result.scalars().all()

    async def get_runs_by_submission(self, submission_id: str) -> List[Run]:
        """Get runs by submission ID"""
        result = await self.db.execute(
            select(Run).where(Run.submission_id == submission_id).order_by(Run.created_at.desc())
        )
        return result.scalars().all()

    async def get_runs_by_testsuite(self, testsuite_id: str) -> List[Run]:
        """Get runs by test suite ID"""
        result = await self.db.execute(
            select(Run).where(Run.testsuite_id == testsuite_id).order_by(Run.created_at.desc())
        )
        return result.scalars().all()
