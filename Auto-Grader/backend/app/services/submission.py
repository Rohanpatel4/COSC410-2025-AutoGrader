"""
Submission service for submission business logic
"""
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.file import FileCategory
from ..models.submission import Submission
from ..repositories.submission import SubmissionRepository
from ..schemas.submission import SubmissionCreate, SubmissionUpdate
from .base import BaseService
from .file import FileService


class SubmissionService(BaseService[SubmissionRepository]):
    """Service for submission operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(SubmissionRepository(db))
        self.file_service = FileService(db)

    async def create_submission(self, submission_data: SubmissionCreate) -> Submission:
        """Create a new submission"""
        # Validate that all file IDs exist and are SUBMISSION files
        if not await self.file_service.validate_file_ids_exist(
            submission_data.file_ids, FileCategory.SUBMISSION
        ):
            raise ValueError("All files must exist and be of SUBMISSION category")

        return await self.repository.create_submission(obj_in=submission_data)

    async def get_submission(self, submission_id: str) -> Optional[Submission]:
        """Get submission by ID"""
        return await self.repository.get(submission_id)

    async def get_submissions(self, skip: int = 0, limit: int = 100) -> List[Submission]:
        """Get all submissions"""
        return await self.repository.get_multi(skip=skip, limit=limit)

    async def update_submission(self, submission_id: str, update_data: SubmissionUpdate) -> Optional[Submission]:
        """Update submission"""
        return await self.repository.update_submission(id=submission_id, obj_in=update_data)

    async def delete_submission(self, submission_id: str) -> Optional[Submission]:
        """Delete submission"""
        return await self.repository.remove(id=submission_id)

    async def get_submission_files(self, submission_id: str) -> List[dict]:
        """Get files associated with a submission"""
        submission = await self.get_submission(submission_id)
        if not submission:
            return []

        files = []
        for file_id in submission.file_ids:
            file_obj = await self.file_service.get_file(file_id)
            if file_obj:
                files.append({
                    "id": file_obj.id,
                    "name": file_obj.name,
                    "size_bytes": file_obj.size_bytes,
                    "sha256": file_obj.sha256,
                    "created_at": file_obj.created_at,
                })

        return files
