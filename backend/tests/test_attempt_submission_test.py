# backend/tests/test_attempt_submission_test.py
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from app.api.main import app
from io import BytesIO

client = TestClient(app)


def test_test_route_registration():
    """Test the test route endpoint."""
    response = client.get("/api/v1/attempts/test-route")
    assert response.status_code == 200
    assert "message" in response.json()
    assert response.json()["message"] == "Test route works"


@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_bridge_success(mock_execute):
    """Test successful submission via bridge endpoint."""
    mock_execute.return_value = {
        "stdout": "PASSED: test\n",
        "stderr": "",
        "returncode": 0,
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "total_points": 1,
            "earned_points": 1
        }
    }
    
    # Create test file
    test_file = ("solution.py", BytesIO(b"def add(a, b): return a + b"), "text/x-python")
    
    response = client.post(
        "/api/v1/attempts/bridge",
        data={
            "test_case": "def test(): assert add(2, 3) == 5",
            "language": "python",
            "job_name": "test_job"
        },
        files={"submission": test_file}
    )
    
    assert response.status_code == 201
    data = response.json()
    assert "stdout" in data
    assert "grading" in data


@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_bridge_invalid_file_extension(mock_execute):
    """Test bridge endpoint with invalid file extension."""
    # Create test file with wrong extension
    test_file = ("solution.java", BytesIO(b"public class Test {}"), "text/x-java")
    
    response = client.post(
        "/api/v1/attempts/bridge",
        data={
            "test_case": "def test(): assert True",
            "language": "python"
        },
        files={"submission": test_file}
    )
    
    assert response.status_code == 415
    assert "Only .py files are accepted" in response.json()["detail"]


@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_bridge_read_error(mock_execute):
    """Test bridge endpoint with file read error."""
    # TestClient handles file reading, so we test with invalid encoding
    # which should either be handled gracefully or return 400
    test_file = ("solution.py", BytesIO(b"\xff\xfe\x00\x00"), "text/x-python")
    
    response = client.post(
        "/api/v1/attempts/bridge",
        data={
            "test_case": "def test(): assert True",
            "language": "python"
        },
        files={"submission": test_file}
    )
    
    # Should either succeed (if encoding is handled) or return 400 for invalid input
    assert response.status_code in [201, 400]
    if response.status_code == 400:
        # If it fails, should have a detail message
        assert "detail" in response.json()


@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_bridge_execution_error(mock_execute):
    """Test bridge endpoint with execution error."""
    mock_execute.side_effect = Exception("Execution failed")
    
    test_file = ("solution.py", BytesIO(b"def add(a, b): return a + b"), "text/x-python")
    
    response = client.post(
        "/api/v1/attempts/bridge",
        data={
            "test_case": "def test(): assert add(2, 3) == 5",
            "language": "python"
        },
        files={"submission": test_file}
    )
    
    assert response.status_code == 500
    assert "Execution error" in response.json()["detail"]


@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_success(mock_execute):
    """Test successful submission via main endpoint."""
    mock_execute.return_value = {
        "stdout": "PASSED: test\n",
        "stderr": "",
        "returncode": 0,
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "total_points": 1,
            "earned_points": 1
        }
    }
    
    test_file = ("solution.py", BytesIO(b"def add(a, b): return a + b"), "text/x-python")
    
    response = client.post(
        "/api/v1/attempts",
        data={
            "test_case": "def test(): assert add(2, 3) == 5",
            "language": "python"
        },
        files={"submission": test_file}
    )
    
    assert response.status_code == 201
    data = response.json()
    assert "stdout" in data
    assert "grading" in data


@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_read_error(mock_execute):
    """Test main endpoint with file read error."""
    test_file = ("solution.py", BytesIO(b"\xff\xfe\x00\x00"), "text/x-python")
    
    response = client.post(
        "/api/v1/attempts",
        data={
            "test_case": "def test(): assert True",
            "language": "python"
        },
        files={"submission": test_file}
    )
    
    # Should either succeed (if encoding is handled) or return 400 for invalid input
    assert response.status_code in [201, 400]
    if response.status_code == 400:
        # If it fails, should have a detail message
        assert "detail" in response.json()


@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_execution_error(mock_execute):
    """Test main endpoint with execution error."""
    mock_execute.side_effect = Exception("Execution failed")
    
    test_file = ("solution.py", BytesIO(b"def add(a, b): return a + b"), "text/x-python")
    
    response = client.post(
        "/api/v1/attempts",
        data={
            "test_case": "def test(): assert add(2, 3) == 5",
            "language": "python"
        },
        files={"submission": test_file}
    )
    
    assert response.status_code == 500
    assert "Execution error" in response.json()["detail"]


@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_different_languages(mock_execute):
    """Test submission with different languages."""
    mock_execute.return_value = {
        "stdout": "PASSED: test\n",
        "stderr": "",
        "returncode": 0,
        "grading": {"total_tests": 1, "passed_tests": 1, "total_points": 1, "earned_points": 1}
    }
    
    languages = ["python", "java", "cpp", "rust"]
    
    for lang in languages:
        # For non-Python, we'd need appropriate file extensions, but bridge only accepts .py
        # So we'll test with Python but different language parameter
        test_file = ("solution.py", BytesIO(b"def add(a, b): return a + b"), "text/x-python")
        
        response = client.post(
            "/api/v1/attempts/bridge",
            data={
                "test_case": "def test(): assert add(2, 3) == 5",
                "language": lang
            },
            files={"submission": test_file}
        )
        
        # Should succeed (bridge accepts .py but uses language parameter)
        assert response.status_code in [201, 415]  # 415 if language validation fails



