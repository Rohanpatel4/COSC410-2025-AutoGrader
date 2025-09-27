"""
Runs API endpoints
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...schemas.run import Run, RunCreate, RunList
from ...services.run import RunService
from ..deps import get_db_session

router = APIRouter()


@router.post("/", response_model=Run, status_code=status.HTTP_201_CREATED)
async def create_run(
    run_data: RunCreate,
    db: AsyncSession = Depends(get_db_session),
) -> Run:
    """Create a new run"""
    try:
        run_service = RunService(db)
        db_run = await run_service.create_run(run_data)

        # Start execution asynchronously
        await run_service.execute_run(db_run.id)

        return Run.model_validate(db_run)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{run_id}", response_model=Run)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> Run:
    """Get run by ID"""
    run_service = RunService(db)
    db_run = await run_service.get_run(run_id)
    if not db_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found",
        )

    return Run.model_validate(db_run)


@router.get("/", response_model=RunList)
async def list_runs(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db_session),
) -> RunList:
    """List runs"""
    run_service = RunService(db)
    runs = await run_service.get_runs(skip=skip, limit=limit)
    total = await run_service.repository.count()

    return RunList(
        items=[Run.model_validate(r) for r in runs],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/{run_id}/stdout")
async def get_run_stdout(
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Get run stdout"""
    run_service = RunService(db)
    stdout = await run_service.get_run_stdout(run_id)
    if stdout is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run stdout not found",
        )

    return Response(content=stdout, media_type="text/plain")


@router.get("/{run_id}/stderr")
async def get_run_stderr(
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Get run stderr"""
    run_service = RunService(db)
    stderr = await run_service.get_run_stderr(run_id)
    if stderr is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run stderr not found",
        )

    return Response(content=stderr, media_type="text/plain")


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_run(
    run_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a run (cancel if running)"""
    run_service = RunService(db)
    deleted_run = await run_service.delete_run(run_id)
    if not deleted_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found",
        )
