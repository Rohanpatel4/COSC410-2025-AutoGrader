"""
Test Suites API endpoints
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...schemas.testsuite import TestSuite, TestSuiteCreate, TestSuiteList
from ...services.testsuite import TestSuiteService
from ..deps import get_db_session

router = APIRouter()


@router.post("/", response_model=TestSuite, status_code=status.HTTP_201_CREATED)
async def create_testsuite(
    testsuite_data: TestSuiteCreate,
    db: AsyncSession = Depends(get_db_session),
) -> TestSuite:
    """Create a new test suite"""
    try:
        testsuite_service = TestSuiteService(db)
        db_testsuite = await testsuite_service.create_testsuite(testsuite_data)
        return TestSuite.model_validate(db_testsuite)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{testsuite_id}", response_model=TestSuite)
async def get_testsuite(
    testsuite_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> TestSuite:
    """Get test suite by ID"""
    testsuite_service = TestSuiteService(db)
    db_testsuite = await testsuite_service.get_testsuite(testsuite_id)
    if not db_testsuite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test suite not found",
        )

    return TestSuite.model_validate(db_testsuite)


@router.get("/", response_model=TestSuiteList)
async def list_testsuites(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db_session),
) -> TestSuiteList:
    """List test suites"""
    testsuite_service = TestSuiteService(db)
    testsuites = await testsuite_service.get_testsuites(skip=skip, limit=limit)
    total = await testsuite_service.repository.count()

    return TestSuiteList(
        items=[TestSuite.model_validate(ts) for ts in testsuites],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.delete("/{testsuite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_testsuite(
    testsuite_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a test suite"""
    testsuite_service = TestSuiteService(db)
    deleted_testsuite = await testsuite_service.delete_testsuite(testsuite_id)
    if not deleted_testsuite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test suite not found",
        )
