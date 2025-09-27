"""
File repository for file operations
"""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.file import File, FileCategory
from ..schemas.file import FileCreate, FileUpdate
from .base import BaseRepository


class FileRepository(BaseRepository[File]):
    """Repository for File entity operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(File, db)

    async def get_by_sha256(self, sha256: str) -> Optional[File]:
        """Get file by SHA256 hash"""
        result = await self.db.execute(select(File).where(File.sha256 == sha256))
        return result.scalars().first()

    async def get_by_category(
        self,
        category: FileCategory,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[File]:
        """Get files by category with pagination"""
        result = await self.db.execute(
            select(File)
            .where(File.category == category)
            .offset(skip)
            .limit(limit)
            .order_by(File.created_at.desc())
        )
        return result.scalars().all()

    async def count_by_category(self, category: FileCategory) -> int:
        """Count files by category"""
        result = await self.db.execute(
            select(File.id).where(File.category == category)
        )
        return len(result.all())

    async def create_file(self, *, obj_in: FileCreate) -> File:
        """Create a new file with content"""
        # Check if file with same SHA256 already exists
        existing = await self.get_by_sha256(obj_in.sha256)
        if existing:
            return existing

        # Create new file
        db_obj = File(
            name=obj_in.name,
            category=obj_in.category,
            content=obj_in.content,
            size_bytes=obj_in.size_bytes,
            sha256=obj_in.sha256,
        )
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def update_file(self, *, id: str, obj_in: FileUpdate) -> Optional[File]:
        """Update file metadata (not content)"""
        db_obj = await self.get(id)
        if not db_obj:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj
