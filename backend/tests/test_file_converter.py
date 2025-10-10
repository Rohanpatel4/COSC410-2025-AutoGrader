import pytest
from fastapi import HTTPException, UploadFile
from io import BytesIO
from app.services.FileConverter import file_to_text, text_to_file


class TestFileConverter:
    """Test file conversion utilities."""

    @pytest.mark.asyncio
    async def test_file_to_text_success(self):
        """Test successful file to text conversion."""
        content = "Hello, World!\nThis is a test file."
        file = UploadFile(filename="test.txt", file=BytesIO(content.encode('utf-8')))

        result = await file_to_text(file)
        assert result == content

    @pytest.mark.asyncio
    async def test_file_to_text_empty_file(self):
        """Test empty file handling."""
        file = UploadFile(filename="empty.txt", file=BytesIO(b""))

        with pytest.raises(HTTPException) as exc_info:
            await file_to_text(file)

        assert exc_info.value.status_code == 400
        assert "Empty upload" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_file_to_text_invalid_utf8(self):
        """Test invalid UTF-8 file handling."""
        # Create bytes that are not valid UTF-8
        invalid_bytes = b'\xff\xfe\xfd'
        file = UploadFile(filename="invalid.txt", file=BytesIO(invalid_bytes))

        with pytest.raises(HTTPException) as exc_info:
            await file_to_text(file)

        assert exc_info.value.status_code == 415
        assert "not valid UTF-8" in exc_info.value.detail

    def test_text_to_file_success(self):
        """Test successful text to file conversion."""
        text = "Sample text content for testing."

        result = text_to_file(text)

        assert isinstance(result, dict)
        assert "content_bytes" in result
        assert "encoding" in result
        assert "size_bytes" in result

        assert result["content_bytes"] == text.encode("utf-8")
        assert result["encoding"] == "utf-8"
        assert result["size_bytes"] == len(text.encode("utf-8"))

    def test_text_to_file_none_input(self):
        """Test None input handling."""
        with pytest.raises(ValueError) as exc_info:
            text_to_file(None)

        assert "must not be None" in str(exc_info.value)

    def test_text_to_file_empty_string(self):
        """Test empty string input."""
        result = text_to_file("")

        assert result["content_bytes"] == b""
        assert result["size_bytes"] == 0
        assert result["encoding"] == "utf-8"

    def test_text_to_file_unicode_content(self):
        """Test unicode content handling."""
        unicode_text = "Hello 世界 🌍 Test"

        result = text_to_file(unicode_text)

        assert result["encoding"] == "utf-8"
        assert result["content_bytes"] == unicode_text.encode("utf-8")
        assert result["size_bytes"] == len(unicode_text.encode("utf-8"))

        # Verify round-trip encoding/decoding
        decoded = result["content_bytes"].decode(result["encoding"])
        assert decoded == unicode_text
