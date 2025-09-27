"""
API dependencies
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get database session dependency"""
    async for session in get_db():
        yield session
