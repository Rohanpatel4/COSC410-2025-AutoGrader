"""
Submission repository for submission operations
"""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.submission import Submission
from ..schemas.submission import SubmissionCreate, SubmissionUpdate
from .base import BaseRepository


class SubmissionRepository(BaseRepository[Submission]):
    """Repository for Submission entity operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(Submission, db)

    async def create_submission(self, *, obj_in: SubmissionCreate) -> Submission:
        """Create a new submission"""
        db_obj = Submission(
            name=obj_in.name,
            file_ids=obj_in.file_ids,
        )
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def update_submission(self, *, id: str, obj_in: SubmissionUpdate) -> Optional[Submission]:
        """Update submission"""
        db_obj = await self.get(id)
        if not db_obj:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def get_submissions_with_file_count(self) -> List[dict]:
        """Get submissions with file count information"""
        submissions = await self.get_multi()
        result = []
        for sub in submissions:
            result.append({
                "id": sub.id,
                "name": sub.name,
                "file_count": len(sub.file_ids),
                "created_at": sub.created_at,
            })
        return result
