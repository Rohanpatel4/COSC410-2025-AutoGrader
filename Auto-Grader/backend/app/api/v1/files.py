"""
Files API endpoints
"""
import hashlib
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...models.file import FileCategory
from ...schemas.file import File as FileSchema, FileList
from ...services.file import FileService
from ..deps import get_db_session

router = APIRouter()


@router.post("/", response_model=FileSchema, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    category: FileCategory = None,
    db: AsyncSession = Depends(get_db_session),
) -> FileSchema:
    """Upload a file with category"""
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category is required",
        )

    # Validate MIME type
    if file.content_type not in settings.ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}",
        )

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE} bytes",
        )

    # Create file through service
    file_service = FileService(db)
    db_file = await file_service.create_file_from_upload(
        name=file.filename,
        category=category,
        content=content,
    )

    return FileSchema.model_validate(db_file)


@router.get("/{file_id}", response_model=FileSchema)
async def get_file(
    file_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> FileSchema:
    """Get file metadata by ID"""
    file_service = FileService(db)
    db_file = await file_service.get_file(file_id)
    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    return FileSchema.model_validate(db_file)


@router.get("/", response_model=FileList)
async def list_files(
    category: FileCategory = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db_session),
) -> FileList:
    """List files, optionally filtered by category"""
    file_service = FileService(db)

    if category:
        files = await file_service.get_files_by_category(category, skip=skip, limit=limit)
        total = await file_service.repository.count_by_category(category)
    else:
        files = await file_service.repository.get_multi(skip=skip, limit=limit)
        total = await file_service.repository.count()

    return FileList(
        items=[FileSchema.model_validate(f) for f in files],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a file"""
    file_service = FileService(db)
    deleted_file = await file_service.delete_file(file_id)
    if not deleted_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )
