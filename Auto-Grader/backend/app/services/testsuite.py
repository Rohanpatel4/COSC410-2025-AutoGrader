"""
TestSuite service for test suite business logic
"""
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.file import FileCategory
from ..models.testsuite import TestSuite
from ..repositories.testsuite import TestSuiteRepository
from ..schemas.testsuite import TestSuiteCreate, TestSuiteUpdate
from .base import BaseService
from .file import FileService


class TestSuiteService(BaseService[TestSuiteRepository]):
    """Service for test suite operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(TestSuiteRepository(db))
        self.file_service = FileService(db)

    async def create_testsuite(self, testsuite_data: TestSuiteCreate) -> TestSuite:
        """Create a new test suite"""
        # Validate that all file IDs exist and are TEST_CASE files
        if not await self.file_service.validate_file_ids_exist(
            testsuite_data.file_ids, FileCategory.TEST_CASE
        ):
            raise ValueError("All files must exist and be of TEST_CASE category")

        return await self.repository.create_testsuite(obj_in=testsuite_data)

    async def get_testsuite(self, testsuite_id: str) -> Optional[TestSuite]:
        """Get test suite by ID"""
        return await self.repository.get(testsuite_id)

    async def get_testsuites(self, skip: int = 0, limit: int = 100) -> List[TestSuite]:
        """Get all test suites"""
        return await self.repository.get_multi(skip=skip, limit=limit)

    async def update_testsuite(self, testsuite_id: str, update_data: TestSuiteUpdate) -> Optional[TestSuite]:
        """Update test suite"""
        return await self.repository.update_testsuite(id=testsuite_id, obj_in=update_data)

    async def delete_testsuite(self, testsuite_id: str) -> Optional[TestSuite]:
        """Delete test suite"""
        return await self.repository.remove(id=testsuite_id)

    async def get_testsuite_files(self, testsuite_id: str) -> List[dict]:
        """Get files associated with a test suite"""
        testsuite = await self.get_testsuite(testsuite_id)
        if not testsuite:
            return []

        files = []
        for file_id in testsuite.file_ids:
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
