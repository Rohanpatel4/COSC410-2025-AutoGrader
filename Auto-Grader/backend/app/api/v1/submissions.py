"""
Submissions API endpoints
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...schemas.submission import Submission, SubmissionCreate, SubmissionList
from ...services.submission import SubmissionService
from ..deps import get_db_session

router = APIRouter()


@router.post("/", response_model=Submission, status_code=status.HTTP_201_CREATED)
async def create_submission(
    submission_data: SubmissionCreate,
    db: AsyncSession = Depends(get_db_session),
) -> Submission:
    """Create a new submission"""
    try:
        submission_service = SubmissionService(db)
        db_submission = await submission_service.create_submission(submission_data)
        return Submission.model_validate(db_submission)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{submission_id}", response_model=Submission)
async def get_submission(
    submission_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> Submission:
    """Get submission by ID"""
    submission_service = SubmissionService(db)
    db_submission = await submission_service.get_submission(submission_id)
    if not db_submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )

    return Submission.model_validate(db_submission)


@router.get("/", response_model=SubmissionList)
async def list_submissions(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db_session),
) -> SubmissionList:
    """List submissions"""
    submission_service = SubmissionService(db)
    submissions = await submission_service.get_submissions(skip=skip, limit=limit)
    total = await submission_service.repository.count()

    return SubmissionList(
        items=[Submission.model_validate(s) for s in submissions],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.delete("/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_submission(
    submission_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a submission"""
    submission_service = SubmissionService(db)
    deleted_submission = await submission_service.delete_submission(submission_id)
    if not deleted_submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )
