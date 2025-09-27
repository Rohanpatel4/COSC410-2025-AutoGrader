"""
Runtime service for runtime business logic
"""
import os
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.runtime import Runtime
from ..repositories.runtime import RuntimeRepository
from ..schemas.runtime import RuntimeCreate, RuntimeUpdate
from .base import BaseService


class RuntimeService(BaseService[RuntimeRepository]):
    """Service for runtime operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(RuntimeRepository(db))

    async def create_runtime(self, runtime_data: RuntimeCreate) -> Runtime:
        """Create a new runtime"""
        # Validate that host_path exists and is executable
        if not os.path.exists(runtime_data.host_path):
            raise ValueError(f"Host path does not exist: {runtime_data.host_path}")

        if not os.access(runtime_data.host_path, os.X_OK):
            raise ValueError(f"Host path is not executable: {runtime_data.host_path}")

        return await self.repository.create_runtime(obj_in=runtime_data)

    async def get_runtime(self, runtime_id: str) -> Optional[Runtime]:
        """Get runtime by ID"""
        return await self.repository.get(runtime_id)

    async def get_runtimes(self, skip: int = 0, limit: int = 100) -> List[Runtime]:
        """Get all runtimes"""
        return await self.repository.get_multi(skip=skip, limit=limit)

    async def get_enabled_runtimes(self) -> List[Runtime]:
        """Get all enabled runtimes"""
        return await self.repository.get_enabled_runtimes()

    async def update_runtime(self, runtime_id: str, update_data: RuntimeUpdate) -> Optional[Runtime]:
        """Update runtime"""
        # If host_path is being updated, validate it exists and is executable
        if update_data.host_path is not None:
            if not os.path.exists(update_data.host_path):
                raise ValueError(f"Host path does not exist: {update_data.host_path}")
            if not os.access(update_data.host_path, os.X_OK):
                raise ValueError(f"Host path is not executable: {update_data.host_path}")

        return await self.repository.update_runtime(id=runtime_id, obj_in=update_data)

    async def delete_runtime(self, runtime_id: str) -> Optional[Runtime]:
        """Delete runtime"""
        return await self.repository.remove(id=runtime_id)

    async def get_runtime_by_language_version(
        self, language: str, version: str
    ) -> Optional[Runtime]:
        """Get runtime by language and version"""
        return await self.repository.get_by_language_version(language, version)
