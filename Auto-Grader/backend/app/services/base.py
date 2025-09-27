"""
Base service class with common functionality
"""
from typing import Generic, List, Optional, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories.base import BaseRepository

RepositoryType = TypeVar("RepositoryType", bound=BaseRepository)


class BaseService(Generic[RepositoryType]):
    """Base service with common functionality"""

    def __init__(self, repository: RepositoryType):
        self.repository = repository
