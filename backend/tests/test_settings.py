import pytest
from app.core.settings import Settings


class TestSettings:
    """Test settings configuration and validation."""

    def test_default_settings(self):
        """Test default settings values."""
        settings = Settings()
        assert settings.DATABASE_URL == "sqlite:///./app.db"
        assert settings.DEBUG is True
        assert isinstance(settings.CORS_ORIGINS, list)
        assert "http://localhost:5173" in settings.CORS_ORIGINS
        assert "http://127.0.0.1:5173" in settings.CORS_ORIGINS

    def test_cors_origins_string_parsing(self):
        """Test CORS origins parsing from string."""
        # Test comma-separated string
        settings = Settings(CORS_ORIGINS="http://test.com,https://example.com")
        assert settings.CORS_ORIGINS == ["http://test.com", "https://example.com"]

        # Test single URL string
        settings = Settings(CORS_ORIGINS="http://single.com")
        assert settings.CORS_ORIGINS == ["http://single.com"]

        # Test string with spaces
        settings = Settings(CORS_ORIGINS="http://a.com, http://b.com ")
        assert settings.CORS_ORIGINS == ["http://a.com", "http://b.com"]

    def test_cors_origins_json_string_parsing(self):
        """Test CORS origins parsing from JSON string."""
        settings = Settings(CORS_ORIGINS='["http://json1.com", "http://json2.com"]')
        assert settings.CORS_ORIGINS == ["http://json1.com", "http://json2.com"]

    def test_cors_origins_list_passthrough(self):
        """Test CORS origins with list input."""
        origins = ["http://list1.com", "http://list2.com"]
        settings = Settings(CORS_ORIGINS=origins)
        assert settings.CORS_ORIGINS == origins

    def test_cors_origins_tuple_conversion(self):
        """Test CORS origins conversion from tuple."""
        origins = ("http://tuple1.com", "http://tuple2.com")
        settings = Settings(CORS_ORIGINS=origins)
        assert settings.CORS_ORIGINS == list(origins)

    def test_cors_origins_none_handling(self):
        """Test CORS origins handling of None."""
        settings = Settings(CORS_ORIGINS=None)
        assert settings.CORS_ORIGINS == []

    def test_cors_origins_invalid_json_fallback(self):
        """Test CORS origins fallback when JSON parsing fails."""
        # Invalid JSON string should fall back to comma splitting
        settings = Settings(CORS_ORIGINS='[not valid json, syntax')
        assert settings.CORS_ORIGINS == ["[not valid json", "syntax"]

    def test_cors_origins_non_string_fallback(self):
        """Test CORS origins fallback for non-string inputs."""
        # Non-string input should be converted to string list
        settings = Settings(CORS_ORIGINS=123)
        assert settings.CORS_ORIGINS == ["123"]

    def test_cors_origins_empty_string(self):
        """Test CORS origins with empty string."""
        settings = Settings(CORS_ORIGINS="")
        assert settings.CORS_ORIGINS == []

    def test_cors_origins_whitespace_only(self):
        """Test CORS origins with whitespace only."""
        settings = Settings(CORS_ORIGINS="   ,  ,   ")
        assert settings.CORS_ORIGINS == []

    def test_database_url_override(self):
        """Test database URL override."""
        settings = Settings(DATABASE_URL="postgresql://user:pass@localhost/db")
        assert settings.DATABASE_URL == "postgresql://user:pass@localhost/db"

    def test_debug_override(self):
        """Test debug flag override."""
        settings = Settings(DEBUG=False)
        assert settings.DEBUG is False
