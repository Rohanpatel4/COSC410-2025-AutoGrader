import os
from unittest.mock import patch, AsyncMock
import pytest
from fastapi.testclient import TestClient
from app.api.main import app

client = TestClient(app)


# Test the bridge submission endpoint
@pytest.mark.asyncio
@patch('app.services.piston.execute_code')
async def test_attempt_submission_test_bridge_success(mock_execute):
    """Test successful bridge submission."""
    mock_execute.return_value = {
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

    # Create a mock file
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n\ndef test_subtract():\n    assert add(5, -2) == 3\n"}

    response = client.post("/api/v1/attempts/bridge", files=files, data=data)

    assert response.status_code == 201
    result = response.json()
    assert result["grading"]["passed_tests"] == 2
    assert result["grading"]["failed_tests"] == 0
    mock_execute.assert_called_once()


@pytest.mark.asyncio
@patch('app.services.piston.execute_code')
async def test_attempt_submission_test_bridge_invalid_file_type(mock_execute):
    """Test bridge submission with invalid file type."""
    # Create a mock file with wrong extension
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.txt", file_content, "text/plain")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}

    response = client.post("/api/v1/attempts/bridge", files=files, data=data)

    assert response.status_code == 415
    assert "Only .py files are accepted" in response.json()["detail"]
    mock_execute.assert_not_called()


@pytest.mark.asyncio
@patch('app.services.piston.execute_code')
async def test_attempt_submission_test_bridge_with_job_name(mock_execute):
    """Test bridge submission with custom job name."""
    mock_execute.return_value = {
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

    file_content = b"def example():\n    return 42\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {
        "test_case": "def test_example():\n    assert example() == 42\n",
        "job_name": "custom_job"
    }

    response = client.post("/api/v1/attempts/bridge", files=files, data=data)

    assert response.status_code == 201
    mock_execute.assert_called_once()


@pytest.mark.asyncio
@patch('app.services.piston.execute_code')
async def test_attempt_submission_test_bridge_bridge_error(mock_execute):
    """Test bridge submission when execution fails."""
    mock_execute.side_effect = Exception("Piston communication error")

    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}

    response = client.post("/api/v1/attempts/bridge", files=files, data=data)

    assert response.status_code == 500


# Test the main submission endpoint
@pytest.mark.asyncio
@patch('app.services.piston.execute_code')
async def test_attempt_submission_test_success(mock_execute):
    """Test main submission endpoint with Piston."""
    mock_execute.return_value = {
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
    
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}

    response = client.post("/api/v1/attempts", files=files, data=data)

    assert response.status_code == 201
    result = response.json()
    assert result["grading"]["all_passed"] is True
    mock_execute.assert_called_once()


def test_test_route_registration():
    """Test the test route endpoint."""
    response = client.get("/api/v1/attempts/test-route")

    assert response.status_code == 200
    assert response.json() == {"message": "Test route works"}
