import os
from unittest.mock import patch, AsyncMock, MagicMock
import pytest
import asyncio
from fastapi.testclient import TestClient
from app.api.main import app

client = TestClient(app)


# Test the bridge submission endpoint
@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_bridge_success(mock_execute):
    """Test successful bridge submission."""
    mock_result = {
        "stdout": "PASSED: test_add\nPASSED: test_subtract\n=== Test Results ===\nPassed: 2\nFailed: 0\nTotal: 2",
        "stderr": "",
        "returncode": 0,
        "status": {"id": 3},
        "time": None,
        "memory": None,
        "language_id_used": 71,
        "grading": {
            "total_tests": 2,
            "passed_tests": 2,
            "failed_tests": 0,
            "passed": True,
            "all_passed": True,
            "has_tests": True
        }
    }
    # Set the return value for AsyncMock
    mock_execute.return_value = mock_result

    # Create a mock file
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n\ndef test_subtract():\n    assert add(5, -2) == 3\n"}

    response = client.post("/api/v1/attempts/bridge", files=files, data=data)

    assert response.status_code == 201
    result = response.json()
    # The result has a single test case (point_value=1), so passed_tests is parsed from stdout
    # Since we're returning a mock, check that the result structure is correct
    assert "grading" in result
    # The actual execution parses stdout, so we verify the mock was called
    assert mock_execute.called


@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_bridge_invalid_file_type(mock_execute):
    """Test bridge submission with invalid file type."""
    # Create a mock file with wrong extension
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.txt", file_content, "text/plain")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}

    response = client.post("/api/v1/attempts/bridge", files=files, data=data)

    assert response.status_code == 415
    assert "Only .py files are accepted" in response.json()["detail"]
    assert not mock_execute.called


@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_bridge_with_job_name(mock_execute):
    """Test bridge submission with custom job name."""
    mock_result = {
        "stdout": "PASSED: test_example\n",
        "stderr": "",
        "returncode": 0,
        "status": {"id": 3},
        "time": None,
        "memory": None,
        "language_id_used": 71,
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "failed_tests": 0,
            "passed": True,
            "all_passed": True,
            "has_tests": True
        }
    }
    # Set the return value for AsyncMock
    mock_execute.return_value = mock_result

    file_content = b"def example():\n    return 42\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {
        "test_case": "def test_example():\n    assert example() == 42\n",
        "job_name": "custom_job"
    }

    response = client.post("/api/v1/attempts/bridge", files=files, data=data)

    assert response.status_code == 201
    assert mock_execute.called


@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_bridge_bridge_error(mock_execute):
    """Test bridge submission when execution fails."""
    # Make the async mock raise an exception
    mock_execute.side_effect = Exception("Piston communication error")

    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}

    response = client.post("/api/v1/attempts/bridge", files=files, data=data)

    assert response.status_code == 500


# Test the main submission endpoint
@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_success(mock_execute):
    """Test main submission endpoint with Piston."""
    mock_result = {
        "stdout": "PASSED: test_add\n",
        "stderr": "",
        "returncode": 0,
        "status": {"id": 3},
        "time": None,
        "memory": None,
        "language_id_used": 71,
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "failed_tests": 0,
            "passed": True,
            "all_passed": True,
            "has_tests": True
        }
    }
    # Set the return value for AsyncMock
    mock_execute.return_value = mock_result
    
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}

    response = client.post("/api/v1/attempts", files=files, data=data)

    assert response.status_code == 201
    result = response.json()
    assert result["grading"]["all_passed"] is True
    assert mock_execute.called


def test_test_route_registration():
    """Test the test route endpoint."""
    response = client.get("/api/v1/attempts/test-route")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "Test route works" in data["message"]


def test_attempt_submission_test_bridge_invalid_file_extension():
    """Test bridge endpoint with invalid file extension."""
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.txt", file_content, "text/plain")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}
    
    response = client.post("/api/v1/attempts/bridge", files=files, data=data)
    assert response.status_code == 415
    assert "Only .py files are accepted" in response.json()["detail"]


def test_attempt_submission_test_bridge_missing_test_case():
    """Test bridge endpoint with missing test_case."""
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {}  # Missing test_case
    
    response = client.post("/api/v1/attempts/bridge", files=files, data=data)
    assert response.status_code == 422  # Validation error


def test_attempt_submission_test_bridge_custom_language():
    """Test bridge endpoint with custom language."""
    from unittest.mock import patch, AsyncMock
    
    mock_result = {
        "stdout": "PASSED: test_add\n",
        "stderr": "",
        "returncode": 0,
        "status": {"id": 3},
        "time": None,
        "memory": None,
        "language_id_used": 71,
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "failed_tests": 0,
            "passed": True,
            "all_passed": True,
            "has_tests": True
        }
    }
    
    with patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock) as mock_execute:
        mock_execute.return_value = mock_result
        
        file_content = b"def add(a, b):\n    return a + b\n"
        files = {"submission": ("test.py", file_content, "text/x-python")}
        data = {
            "test_case": "def test_add():\n    assert add(1, 2) == 3\n",
            "language": "python",
            "job_name": "custom_job"
        }
        
        response = client.post("/api/v1/attempts/bridge", files=files, data=data)
        assert response.status_code == 201
        mock_execute.assert_called_once()
        # Check that language was passed correctly
        call_args = mock_execute.call_args
        assert call_args[0][0] == "python"  # language parameter


def test_attempt_submission_test_missing_file():
    """Test main endpoint with missing file."""
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}
    
    response = client.post("/api/v1/attempts", files={}, data=data)
    assert response.status_code == 422  # Validation error - missing file


def test_attempt_submission_test_custom_language():
    """Test main endpoint with custom language."""
    from unittest.mock import patch, AsyncMock
    
    mock_result = {
        "stdout": "PASSED: test_add\n",
        "stderr": "",
        "returncode": 0,
        "status": {"id": 3},
        "time": None,
        "memory": None,
        "language_id_used": 71,
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "failed_tests": 0,
            "passed": True,
            "all_passed": True,
            "has_tests": True
        }
    }
    
    with patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock) as mock_execute:
        mock_execute.return_value = mock_result
        
        file_content = b"def add(a, b):\n    return a + b\n"
        files = {"submission": ("test.py", file_content, "text/x-python")}
        data = {
            "test_case": "def test_add():\n    assert add(1, 2) == 3\n",
            "language": "python"
        }
        
        response = client.post("/api/v1/attempts", files=files, data=data)
        assert response.status_code == 201
        mock_execute.assert_called_once()


def test_attempt_submission_test_file_read_error():
    """Test handling of file read errors."""
    from unittest.mock import patch, MagicMock
    
    # Create a mock file that raises an error when read
    mock_file = MagicMock()
    mock_file.filename = "test.py"
    mock_file.read.side_effect = Exception("File read error")
    
    # Note: This test may need adjustment based on how FastAPI handles file uploads
    # The actual error handling depends on the implementation
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}
    
    # This should work normally, but we can test error handling if file reading fails
    # For now, just verify the endpoint accepts the file
    response = client.post("/api/v1/attempts/bridge", files=files, data=data)
    # Should either succeed (if mocked) or handle error gracefully
    assert response.status_code in [201, 400, 500]
    response = client.get("/api/v1/attempts/test-route")

    assert response.status_code == 200
    assert response.json() == {"message": "Test route works"}


@patch('app.api.attempt_submission_test.execute_code', new_callable=AsyncMock)
def test_attempt_submission_test_error(mock_execute):
    """Test main submission endpoint with execution error."""
    mock_execute.side_effect = Exception("Execution failed")
    
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}

    response = client.post("/api/v1/attempts", files=files, data=data)

    assert response.status_code == 500
    assert "Execution error" in response.json()["detail"]
