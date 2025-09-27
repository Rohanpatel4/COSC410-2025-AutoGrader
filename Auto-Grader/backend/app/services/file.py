"""
File service for file business logic
"""
import hashlib
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..models.file import File, FileCategory
from ..repositories.file import FileRepository
from ..schemas.file import FileCreate, FileUpdate, File as FileSchema
from .base import BaseService


class FileService(BaseService[FileRepository]):
    """Service for file operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(FileRepository(db))

    async def create_file_from_upload(
        self,
        name: str,
        category: FileCategory,
        content: bytes
    ) -> File:
        """Create a file from uploaded content"""
        # Validate file size
        if len(content) > settings.MAX_UPLOAD_SIZE:
            raise ValueError(f"File size exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE} bytes")

        # Calculate SHA256 hash
        sha256 = hashlib.sha256(content).hexdigest()

        # Check if file already exists
        existing_file = await self.repository.get_by_sha256(sha256)
        if existing_file:
            return existing_file

        # Create file object
        file_create = FileCreate(
            name=name,
            category=category,
            content=content,
            size_bytes=len(content),
            sha256=sha256,
        )

        return await self.repository.create_file(obj_in=file_create)

    async def get_file(self, file_id: str) -> Optional[File]:
        """Get file by ID"""
        return await self.repository.get(file_id)

    async def get_files_by_category(
        self,
        category: FileCategory,
        skip: int = 0,
        limit: int = 100
    ) -> List[File]:
        """Get files by category"""
        return await self.repository.get_by_category(category, skip=skip, limit=limit)

    async def update_file(self, file_id: str, update_data: FileUpdate) -> Optional[File]:
        """Update file metadata"""
        return await self.repository.update_file(id=file_id, obj_in=update_data)

    async def delete_file(self, file_id: str) -> Optional[File]:
        """Delete file"""
        return await self.repository.remove(id=file_id)

    async def get_file_content(self, file_id: str) -> Optional[bytes]:
        """Get file content"""
        file_obj = await self.get_file(file_id)
        return file_obj.content if file_obj else None

    async def validate_file_ids_exist(self, file_ids: List[str], category: FileCategory) -> bool:
        """Validate that all file IDs exist and have the correct category"""
        for file_id in file_ids:
            file_obj = await self.get_file(file_id)
            if not file_obj or file_obj.category != category:
                return False
        return True
