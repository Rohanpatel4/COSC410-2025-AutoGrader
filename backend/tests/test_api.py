import os, io, json
from unittest.mock import patch, AsyncMock
import pytest
from fastapi.testclient import TestClient
from app.api.main import app
from app.core.db import Base, engine

client = TestClient(app)

# REMOVED: File upload functionality removed with judge0 integration
# def test_upload_and_list_files():
#     data = {"category": "TEST_CASE"}
#     file_content = b"print('hello')"
#     r = client.post("/api/v1/files", files={"f": ("t.py", file_content, "text/x-python")}, data=data)
#     assert r.status_code == 201
#     fid = r.json()["id"]
#     r2 = client.get("/api/v1/files?category=TEST_CASE")
#     assert r2.status_code == 200
#     assert any(x["id"] == fid for x in r2.json())

# Test the bridge submission endpoint
@pytest.mark.asyncio
@patch('app.api.attempt_submission_test._submit_to_bridge')
async def test_attempt_submission_test_bridge_success(mock_submit):
    """Test successful bridge submission."""
    mock_submit.return_value = {
        "job": "submission",
        "total_units": 2,
        "passed": 2,
        "failed": 0,
        "score_pct": 100.0,
        "by_kind": {"PASSED": 2},
        "units": [
            {"name": "test_add", "kind": "PASSED", "stdout": "", "stderr": ""},
            {"name": "test_subtract", "kind": "PASSED", "stdout": "", "stderr": ""}
        ],
        "stdout": "PASSED: test_add\nPASSED: test_subtract\n=== Test Results ===\nPassed: 2\nFailed: 0\nTotal: 2",
        "stderr": "",
        "compile_output": "",
        "returncode": 0,
        "status": {"id": 3, "description": "Accepted"},
        "time": 0.123,
        "memory": 1024,
        "language_id_used": 71,
        "grading": {
            "total_tests": 2,
            "passed_tests": 2,
            "failed_tests": 0
        }
    }

    # Create a mock file
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n\ndef test_subtract():\n    assert add(5, -2) == 3\n"}

    # We need to use the actual app client but mock the environment
    with patch.dict(os.environ, {"BRIDGE_URL": "http://localhost:5001"}):
        response = client.post("/api/v1/attempts/bridge", files=files, data=data)

    assert response.status_code == 201
    result = response.json()
    assert result["grading"]["passed_tests"] == 2
    assert result["grading"]["failed_tests"] == 0
    mock_submit.assert_called_once()


@pytest.mark.asyncio
@patch('app.api.attempt_submission_test._submit_to_bridge')
async def test_attempt_submission_test_bridge_invalid_file_type(mock_submit):
    """Test bridge submission with invalid file type."""
    # Create a mock file with wrong extension
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.txt", file_content, "text/plain")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}

    response = client.post("/api/v1/attempts/bridge", files=files, data=data)

    assert response.status_code == 415
    assert "Only .py files are accepted" in response.json()["detail"]
    mock_submit.assert_not_called()


@pytest.mark.asyncio
@patch('app.api.attempt_submission_test._submit_to_bridge')
async def test_attempt_submission_test_bridge_with_job_name(mock_submit):
    """Test bridge submission with custom job name."""
    mock_submit.return_value = {
        "job": "custom_job",
        "total_units": 1,
        "passed": 1,
        "failed": 0,
        "score_pct": 100.0,
        "by_kind": {"PASSED": 1},
        "units": [{"name": "test_example", "kind": "PASSED", "stdout": "", "stderr": ""}],
        "stdout": "PASSED: test_example\n",
        "stderr": "",
        "compile_output": "",
        "returncode": 0,
        "status": {"id": 3},
        "time": 0.1,
        "memory": 512,
        "language_id_used": 71,
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "failed_tests": 0
        }
    }

    file_content = b"def example():\n    return 42\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {
        "test_case": "def test_example():\n    assert example() == 42\n",
        "job_name": "custom_job"
    }

    with patch.dict(os.environ, {"BRIDGE_URL": "http://localhost:5001"}):
        response = client.post("/api/v1/attempts/bridge", files=files, data=data)

    assert response.status_code == 201
    mock_submit.assert_called_once()
    # Check that job_name was passed to the bridge
    call_args = mock_submit.call_args[1]
    assert call_args["job_name"] == "custom_job"


@pytest.mark.asyncio
@patch('app.api.attempt_submission_test._submit_to_bridge')
async def test_attempt_submission_test_bridge_bridge_error(mock_submit):
    """Test bridge submission when bridge fails."""
    mock_submit.side_effect = Exception("Bridge communication error")

    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}

    with patch.dict(os.environ, {"BRIDGE_URL": "http://localhost:5001"}):
        response = client.post("/api/v1/attempts/bridge", files=files, data=data)

    assert response.status_code == 500
    assert "Bridge error" in response.json()["detail"]


# REMOVED: Test suite functionality replaced with secure subprocess execution
# def test_testsuite_and_submission_and_run():
#     # upload files
#     fc = b"input1"
#     sc = "print('solution')".encode()
#     f1 = client.post("/api/v1/files", files={"f": ("in.txt", fc, "text/plain")}, data={"category":"TEST_CASE"}).json()
#     f2 = client.post("/api/v1/files", files={"f": ("sol.py", sc, "text/x-python")}, data={"category":"SUBMISSION"}).json()
#     # create test suite and submission
#     ts = client.post("/api/v1/test-suites", json={"name":"ts1","file_ids":[f1["id"]]}).json()
#     sub = client.post("/api/v1/submissions", json={"name":"s1","file_ids":[f2["id"]]}).json()
#     # runtime
#     rt = client.post("/api/v1/runtimes", json={"language":"python","version":"3.11","judge0_id":71,"host_path":"/usr/bin/python3","run_cmd":"{entry}"}).json()
#     # run
#     run = client.post("/api/v1/runs", json={"submission_id": sub["id"], "testsuite_id": ts["id"], "runtime_id": rt["id"]}).json()
#     got = client.post(f"/api/v1/runs/{run['id']}/execute").json()
#     assert got["status"] in ("RUNNING","SUCCEEDED")


# Test the main submission endpoint (now returns 501 since Judge0 removed)
@pytest.mark.asyncio
async def test_attempt_submission_test_not_implemented():
    """Test main submission endpoint returns 501 (Judge0 removed)."""
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}

    response = client.post("/api/v1/attempts", files=files, data=data)

    assert response.status_code == 501
    result = response.json()
    assert "Judge0 integration has been removed" in result["detail"]


@pytest.mark.asyncio
async def test_attempt_submission_test_bridge_not_implemented():
    """Test bridge submission endpoint returns 501 (Judge0 removed)."""
    file_content = b"def add(a, b):\n    return a + b\n"
    files = {"submission": ("test.py", file_content, "text/x-python")}
    data = {"test_case": "def test_add():\n    assert add(1, 2) == 3\n"}

    response = client.post("/api/v1/attempts/bridge", files=files, data=data)

    assert response.status_code == 501
    result = response.json()
    assert "Judge0 Integration Bridge has been removed" in result["detail"]


def test_test_route_registration():
    """Test the test route endpoint."""
    response = client.get("/api/v1/attempts/test-route")

    assert response.status_code == 200
    assert response.json() == {"message": "Test route works"}


def test_execute_endpoint():
    """Test the execute endpoint."""
    from unittest.mock import patch

    payload = {
        "files": {
            "student.py": "def add(a, b): return a + b",
            "tests/test_basic.py": "def test_add(): assert add(2, 3) == 5"
        },
        "timeout_sec": 10
    }

    # Mock the run_pytest_job function
    with patch('app.api.execute.run_pytest_job') as mock_run:
        mock_run.return_value = {
            "exit_code": 0,
            "passed": 1,
            "failed": 0,
            "log": "1 passed"
        }

        response = client.post("/api/v1/execute", json=payload)
        assert response.status_code == 200

        result = response.json()
        assert result["exit_code"] == 0
        assert result["passed"] == 1
        assert result["failed"] == 0

        # Verify the function was called with correct arguments
        mock_run.assert_called_once_with(payload["files"], timeout_sec=10)


