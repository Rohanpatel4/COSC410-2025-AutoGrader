# backend/tests/test_languages.py
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.api.main import app

client = TestClient(app)


def test_get_supported_languages_success():
    """Test getting supported languages successfully."""
    # Mock get_template_languages to return known languages
    mock_templates = {
        "template_python.py": "python",
        "template_java.java": "java",
        "template_cpp.cpp": "c++",
        "template_rust.rs": "rust",
    }
    
    with patch("app.api.languages.get_template_languages", return_value=mock_templates):
        response = client.get("/api/v1/languages")
        assert response.status_code == 200
        
        languages = response.json()
        assert isinstance(languages, list)
        assert len(languages) > 0
        
        # Check that languages have required fields
        for lang in languages:
            assert "id" in lang
            assert "name" in lang
            assert "piston_name" in lang
            assert isinstance(lang["id"], str)
            assert isinstance(lang["name"], str)
            assert isinstance(lang["piston_name"], str)


def test_get_supported_languages_cpp_normalization():
    """Test that C++ is normalized to 'cpp' as ID."""
    mock_templates = {
        "template_cpp.cpp": "c++",
    }
    
    with patch("app.api.languages.get_template_languages", return_value=mock_templates):
        response = client.get("/api/v1/languages")
        assert response.status_code == 200
        
        languages = response.json()
        cpp_lang = next((l for l in languages if l["piston_name"].lower() == "c++"), None)
        assert cpp_lang is not None
        assert cpp_lang["id"] == "cpp"
        assert cpp_lang["name"] == "C++"


def test_get_supported_languages_deduplication():
    """Test that duplicate languages are deduplicated."""
    # Multiple templates for same language should result in one entry
    mock_templates = {
        "template_python.py": "python",
        "template_python2.py": "python",
        "template_python3.py": "python",
    }
    
    with patch("app.api.languages.get_template_languages", return_value=mock_templates):
        response = client.get("/api/v1/languages")
        assert response.status_code == 200
        
        languages = response.json()
        python_langs = [l for l in languages if l["piston_name"].lower() == "python"]
        assert len(python_langs) == 1


def test_get_supported_languages_sorted():
    """Test that languages are sorted by name."""
    mock_templates = {
        "template_zebra.py": "zebra",
        "template_apple.py": "apple",
        "template_banana.py": "banana",
    }
    
    with patch("app.api.languages.get_template_languages", return_value=mock_templates):
        response = client.get("/api/v1/languages")
        assert response.status_code == 200
        
        languages = response.json()
        names = [l["name"] for l in languages]
        assert names == sorted(names)


def test_get_supported_languages_display_names():
    """Test that display names are correctly mapped."""
    mock_templates = {
        "template_python.py": "python",
        "template_java.java": "java",
        "template_rust.rs": "rust",
    }
    
    with patch("app.api.languages.get_template_languages", return_value=mock_templates):
        response = client.get("/api/v1/languages")
        assert response.status_code == 200
        
        languages = response.json()
        lang_dict = {l["piston_name"].lower(): l["name"] for l in languages}
        
        assert lang_dict.get("python") == "Python"
        assert lang_dict.get("java") == "Java"
        assert lang_dict.get("rust") == "Rust"


def test_get_supported_languages_unknown_language():
    """Test that unknown languages get capitalized as fallback."""
    mock_templates = {
        "template_unknown.xyz": "unknownlang",
    }
    
    with patch("app.api.languages.get_template_languages", return_value=mock_templates):
        response = client.get("/api/v1/languages")
        assert response.status_code == 200
        
        languages = response.json()
        unknown_lang = next((l for l in languages if l["piston_name"] == "unknownlang"), None)
        assert unknown_lang is not None
        # Should capitalize the language name as fallback
        assert unknown_lang["name"] == "Unknownlang"


def test_get_supported_languages_empty():
    """Test handling when no templates are available."""
    with patch("app.api.languages.get_template_languages", return_value={}):
        response = client.get("/api/v1/languages")
        assert response.status_code == 200
        
        languages = response.json()
        assert isinstance(languages, list)
        assert len(languages) == 0


def test_get_supported_languages_case_insensitive():
    """Test that language names are handled case-insensitively."""
    mock_templates = {
        "template_python.py": "PYTHON",
        "template_java.java": "Java",
        "template_rust.rs": "rust",
    }
    
    with patch("app.api.languages.get_template_languages", return_value=mock_templates):
        response = client.get("/api/v1/languages")
        assert response.status_code == 200
        
        languages = response.json()
        # Should deduplicate Python regardless of case
        python_langs = [l for l in languages if l["piston_name"].lower() == "python"]
        assert len(python_langs) == 1
        assert python_langs[0]["name"] == "Python"

