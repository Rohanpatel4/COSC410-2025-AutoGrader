"""
Tests for FileService
"""
import pytest

from app.models.file import FileCategory
from app.services.file import FileService


class TestFileService:
    """Test FileService functionality"""

    @pytest.mark.asyncio
    async def test_create_file_from_upload(self, test_db):
        """Test creating a file from upload"""
        service = FileService(test_db)

        content = b"test file content"
        file_obj = await service.create_file_from_upload(
            name="test.txt",
            category=FileCategory.TEST_CASE,
            content=content,
        )

        assert file_obj.name == "test.txt"
        assert file_obj.category == FileCategory.TEST_CASE
        assert file_obj.content == content
        assert file_obj.size_bytes == len(content)
        assert len(file_obj.sha256) == 64  # SHA256 hex length

    @pytest.mark.asyncio
    async def test_create_duplicate_file(self, test_db):
        """Test creating a file with duplicate content returns existing file"""
        service = FileService(test_db)

        content = b"duplicate content"
        file1 = await service.create_file_from_upload(
            name="test1.txt",
            category=FileCategory.TEST_CASE,
            content=content,
        )

        file2 = await service.create_file_from_upload(
            name="test2.txt",
            category=FileCategory.SUBMISSION,
            content=content,
        )

        # Should return the same file since content is identical
        assert file1.id == file2.id
        assert file1.sha256 == file2.sha256

    @pytest.mark.asyncio
    async def test_create_file_too_large(self, test_db):
        """Test creating a file that's too large"""
        service = FileService(test_db)

        # Create content larger than max size
        content = b"x" * (25 * 1024 * 1024 + 1)  # 25MB + 1 byte

        with pytest.raises(ValueError, match="File size exceeds maximum allowed size"):
            await service.create_file_from_upload(
                name="large.txt",
                category=FileCategory.TEST_CASE,
                content=content,
            )

    @pytest.mark.asyncio
    async def test_get_file(self, test_db):
        """Test getting a file by ID"""
        service = FileService(test_db)

        # Create a file first
        content = b"test content"
        created_file = await service.create_file_from_upload(
            name="test.txt",
            category=FileCategory.TEST_CASE,
            content=content,
        )

        # Retrieve it
        retrieved_file = await service.get_file(created_file.id)

        assert retrieved_file is not None
        assert retrieved_file.id == created_file.id
        assert retrieved_file.name == "test.txt"

    @pytest.mark.asyncio
    async def test_get_nonexistent_file(self, test_db):
        """Test getting a nonexistent file"""
        service = FileService(test_db)

        result = await service.get_file("nonexistent-id")
        assert result is None

    @pytest.mark.asyncio
    async def test_validate_file_ids_exist(self, test_db):
        """Test validating file IDs exist and have correct category"""
        service = FileService(test_db)

        # Create test files
        file1 = await service.create_file_from_upload(
            name="test1.txt",
            category=FileCategory.TEST_CASE,
            content=b"content1",
        )
        file2 = await service.create_file_from_upload(
            name="test2.txt",
            category=FileCategory.TEST_CASE,
            content=b"content2",
        )

        # Test valid file IDs
        assert await service.validate_file_ids_exist([file1.id, file2.id], FileCategory.TEST_CASE)

        # Test invalid category
        assert not await service.validate_file_ids_exist([file1.id], FileCategory.SUBMISSION)

        # Test nonexistent file ID
        assert not await service.validate_file_ids_exist(["nonexistent"], FileCategory.TEST_CASE)
