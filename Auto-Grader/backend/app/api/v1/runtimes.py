"""
Runtimes API endpoints
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...schemas.runtime import Runtime, RuntimeCreate, RuntimeUpdate, RuntimeList
from ...services.runtime import RuntimeService
from ..deps import get_db_session

router = APIRouter()


@router.post("/", response_model=Runtime, status_code=status.HTTP_201_CREATED)
async def create_runtime(
    runtime_data: RuntimeCreate,
    db: AsyncSession = Depends(get_db_session),
) -> Runtime:
    """Create a new runtime"""
    try:
        runtime_service = RuntimeService(db)
        db_runtime = await runtime_service.create_runtime(runtime_data)
        return Runtime.model_validate(db_runtime)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{runtime_id}", response_model=Runtime)
async def get_runtime(
    runtime_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> Runtime:
    """Get runtime by ID"""
    runtime_service = RuntimeService(db)
    db_runtime = await runtime_service.get_runtime(runtime_id)
    if not db_runtime:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Runtime not found",
        )

    return Runtime.model_validate(db_runtime)


@router.get("/", response_model=RuntimeList)
async def list_runtimes(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db_session),
) -> RuntimeList:
    """List all runtimes"""
    runtime_service = RuntimeService(db)
    runtimes = await runtime_service.get_runtimes(skip=skip, limit=limit)
    total = await runtime_service.repository.count()

    return RuntimeList(
        items=[Runtime.model_validate(r) for r in runtimes],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.patch("/{runtime_id}", response_model=Runtime)
async def update_runtime(
    runtime_id: str,
    runtime_data: RuntimeUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> Runtime:
    """Update runtime"""
    try:
        runtime_service = RuntimeService(db)
        db_runtime = await runtime_service.update_runtime(runtime_id, runtime_data)
        if not db_runtime:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Runtime not found",
            )
        return Runtime.model_validate(db_runtime)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{runtime_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_runtime(
    runtime_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a runtime"""
    runtime_service = RuntimeService(db)
    deleted_runtime = await runtime_service.delete_runtime(runtime_id)
    if not deleted_runtime:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Runtime not found",
        )
