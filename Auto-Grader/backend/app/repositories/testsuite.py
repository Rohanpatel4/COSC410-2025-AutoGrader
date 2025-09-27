"""
TestSuite repository for test suite operations
"""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.testsuite import TestSuite
from ..schemas.testsuite import TestSuiteCreate, TestSuiteUpdate
from .base import BaseRepository


class TestSuiteRepository(BaseRepository[TestSuite]):
    """Repository for TestSuite entity operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(TestSuite, db)

    async def create_testsuite(self, *, obj_in: TestSuiteCreate) -> TestSuite:
        """Create a new test suite"""
        db_obj = TestSuite(
            name=obj_in.name,
            file_ids=obj_in.file_ids,
        )
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def update_testsuite(self, *, id: str, obj_in: TestSuiteUpdate) -> Optional[TestSuite]:
        """Update test suite"""
        db_obj = await self.get(id)
        if not db_obj:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def get_testsuites_with_file_count(self) -> List[dict]:
        """Get test suites with file count information"""
        testsuites = await self.get_multi()
        result = []
        for ts in testsuites:
            result.append({
                "id": ts.id,
                "name": ts.name,
                "file_count": len(ts.file_ids),
                "created_at": ts.created_at,
            })
        return result
