import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException
from app.services.FileConverter import file_to_text, text_to_file

class TestFileConverter:
    """Test cases for FileConverter service."""

    @pytest.mark.asyncio
    async def test_file_to_text_success(self):
        """Test successful file to text conversion."""
        mock_file = AsyncMock()
        mock_file.read.return_value = b"Hello, World!"

        result = await file_to_text(mock_file)

        assert result == "Hello, World!"
        mock_file.read.assert_called_once()

    @pytest.mark.asyncio
    async def test_file_to_text_empty_file(self):
        """Test file to text conversion with empty file."""
        mock_file = AsyncMock()
        mock_file.read.return_value = b""

        with pytest.raises(HTTPException) as exc_info:
            await file_to_text(mock_file)

        assert exc_info.value.status_code == 400
        assert "Empty upload" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_file_to_text_invalid_utf8(self):
        """Test file to text conversion with invalid UTF-8."""
        mock_file = AsyncMock()
        # Invalid UTF-8 bytes
        mock_file.read.return_value = b"\xff\xfe\xfd"

        with pytest.raises(HTTPException) as exc_info:
            await file_to_text(mock_file)

        assert exc_info.value.status_code == 415
        assert "not valid UTF-8 text" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_file_to_text_unicode_content(self):
        """Test file to text conversion with Unicode content."""
        mock_file = AsyncMock()
        unicode_content = "Hello, 世界! 🌍"
        mock_file.read.return_value = unicode_content.encode("utf-8")

        result = await file_to_text(mock_file)

        assert result == unicode_content

    def test_text_to_file_success(self):
        """Test successful text to file conversion."""
        text = "Hello, World!"

        result = text_to_file(text)

        assert result["encoding"] == "utf-8"
        assert result["content_bytes"] == b"Hello, World!"
        assert result["size_bytes"] == len(b"Hello, World!")

    def test_text_to_file_empty_string(self):
        """Test text to file conversion with empty string."""
        text = ""

        result = text_to_file(text)

        assert result["encoding"] == "utf-8"
        assert result["content_bytes"] == b""
        assert result["size_bytes"] == 0

    def test_text_to_file_unicode_text(self):
        """Test text to file conversion with Unicode text."""
        text = "Hello, 世界! 🌍"

        result = text_to_file(text)

        expected_bytes = text.encode("utf-8")
        assert result["encoding"] == "utf-8"
        assert result["content_bytes"] == expected_bytes
        assert result["size_bytes"] == len(expected_bytes)

    def test_text_to_file_none_input(self):
        """Test text to file conversion with None input."""
        with pytest.raises(ValueError) as exc_info:
            text_to_file(None)

        assert "must not be None" in str(exc_info.value)

    def test_text_to_file_special_characters(self):
        """Test text to file conversion with special characters."""
        text = "Line 1\nLine 2\tTab\r\nWindows line"

        result = text_to_file(text)

        expected_bytes = text.encode("utf-8")
        assert result["content_bytes"] == expected_bytes
        assert result["size_bytes"] == len(expected_bytes)
        assert result["encoding"] == "utf-8"

    @pytest.mark.asyncio
    async def test_file_to_text_read_exception(self):
        """Test file to text conversion when read fails."""
        mock_file = AsyncMock()
        mock_file.read.side_effect = Exception("Read failed")

        with pytest.raises(Exception):  # Should propagate the original exception
            await file_to_text(mock_file)