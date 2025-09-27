"""
Base repository class with common CRUD operations
"""
from typing import Generic, List, Optional, Type, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """Base repository with common CRUD operations"""

    def __init__(self, model: Type[ModelType], db: AsyncSession):
        self.model = model
        self.db = db

    async def get(self, id: str) -> Optional[ModelType]:
        """Get entity by ID"""
        result = await self.db.execute(select(self.model).where(self.model.id == id))
        return result.scalars().first()

    async def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """Get multiple entities with pagination"""
        result = await self.db.execute(
            select(self.model).offset(skip).limit(limit)
        )
        return result.scalars().all()

    async def create(self, *, obj_in) -> ModelType:
        """Create new entity"""
        db_obj = self.model(**obj_in.model_dump())
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def update(self, *, db_obj: ModelType, obj_in) -> ModelType:
        """Update existing entity"""
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def remove(self, *, id: str) -> Optional[ModelType]:
        """Remove entity by ID"""
        result = await self.db.execute(select(self.model).where(self.model.id == id))
        db_obj = result.scalars().first()
        if db_obj:
            await self.db.delete(db_obj)
            await self.db.flush()
        return db_obj

    async def count(self) -> int:
        """Count total entities"""
        result = await self.db.execute(
            select(self.model).with_only_columns([self.model.id])
        )
        return len(result.all())
