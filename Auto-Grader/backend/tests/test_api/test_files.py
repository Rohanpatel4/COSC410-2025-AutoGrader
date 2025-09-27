"""
Tests for files API endpoints
"""
import pytest
from httpx import AsyncClient

from app.models.file import FileCategory


class TestFilesAPI:
    """Test files API endpoints"""

    @pytest.mark.asyncio
    async def test_upload_file(self, client: AsyncClient):
        """Test file upload"""
        files = {"file": ("test.txt", b"test content", "text/plain")}
        data = {"category": FileCategory.TEST_CASE.value}

        response = await client.post("/api/v1/files/", files=files, data=data)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "test.txt"
        assert data["category"] == FileCategory.TEST_CASE.value
        assert data["size_bytes"] == len(b"test content")
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_upload_file_missing_category(self, client: AsyncClient):
        """Test file upload without category"""
        files = {"file": ("test.txt", b"test content", "text/plain")}

        response = await client.post("/api/v1/files/", files=files)

        assert response.status_code == 400
        assert "Category is required" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_get_file(self, client: AsyncClient):
        """Test getting a file"""
        # First upload a file
        files = {"file": ("test.txt", b"test content", "text/plain")}
        data = {"category": FileCategory.TEST_CASE.value}

        upload_response = await client.post("/api/v1/files/", files=files, data=data)
        file_id = upload_response.json()["id"]

        # Then get it
        response = await client.get(f"/api/v1/files/{file_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == file_id
        assert data["name"] == "test.txt"

    @pytest.mark.asyncio
    async def test_get_nonexistent_file(self, client: AsyncClient):
        """Test getting a nonexistent file"""
        response = await client.get("/api/v1/files/nonexistent-id")

        assert response.status_code == 404
        assert "File not found" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_list_files(self, client: AsyncClient):
        """Test listing files"""
        response = await client.get("/api/v1/files/")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_list_files_by_category(self, client: AsyncClient):
        """Test listing files by category"""
        # Upload files of different categories
        files_test = {"file": ("test.txt", b"test content", "text/plain")}
        data_test = {"category": FileCategory.TEST_CASE.value}

        files_sub = {"file": ("sub.txt", b"sub content", "text/plain")}
        data_sub = {"category": FileCategory.SUBMISSION.value}

        await client.post("/api/v1/files/", files=files_test, data=data_test)
        await client.post("/api/v1/files/", files=files_sub, data=data_sub)

        # List test case files
        response = await client.get(f"/api/v1/files/?category={FileCategory.TEST_CASE.value}")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        for item in data["items"]:
            assert item["category"] == FileCategory.TEST_CASE.value

    @pytest.mark.asyncio
    async def test_delete_file(self, client: AsyncClient):
        """Test deleting a file"""
        # First upload a file
        files = {"file": ("test.txt", b"test content", "text/plain")}
        data = {"category": FileCategory.TEST_CASE.value}

        upload_response = await client.post("/api/v1/files/", files=files, data=data)
        file_id = upload_response.json()["id"]

        # Then delete it
        response = await client.delete(f"/api/v1/files/{file_id}")

        assert response.status_code == 204

        # Verify it's gone
        get_response = await client.get(f"/api/v1/files/{file_id}")
        assert get_response.status_code == 404
