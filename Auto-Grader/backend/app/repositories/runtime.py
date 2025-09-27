"""
Runtime repository for runtime operations
"""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.runtime import Runtime
from ..schemas.runtime import RuntimeCreate, RuntimeUpdate
from .base import BaseRepository


class RuntimeRepository(BaseRepository[Runtime]):
    """Repository for Runtime entity operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(Runtime, db)

    async def get_enabled_runtimes(self) -> List[Runtime]:
        """Get all enabled runtimes"""
        result = await self.db.execute(
            select(Runtime).where(Runtime.enabled == True)
        )
        return result.scalars().all()

    async def get_by_language_version(
        self, language: str, version: str
    ) -> Optional[Runtime]:
        """Get runtime by language and version"""
        result = await self.db.execute(
            select(Runtime).where(
                Runtime.language == language,
                Runtime.version == version
            )
        )
        return result.scalars().first()

    async def create_runtime(self, *, obj_in: RuntimeCreate) -> Runtime:
        """Create a new runtime"""
        db_obj = Runtime(
            language=obj_in.language,
            version=obj_in.version,
            host_path=obj_in.host_path,
            compile_cmd=obj_in.compile_cmd,
            run_cmd=obj_in.run_cmd,
            enabled=obj_in.enabled,
        )
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def update_runtime(self, *, id: str, obj_in: RuntimeUpdate) -> Optional[Runtime]:
        """Update runtime"""
        db_obj = await self.get(id)
        if not db_obj:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj
