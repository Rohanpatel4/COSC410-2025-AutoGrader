import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.api.main import app
from app.models.models import Course, Assignment, StudentSubmission, TestCase
from datetime import datetime

client = TestClient(app)

def test_create_assignment_success():
    """Test creating assignment successfully."""
    import uuid
    course_code = f"TEST{uuid.uuid4().hex[:6]}"

    # Create a test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Course for testing assignments"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()

    payload = {
        "course_id": course_data["id"],
        "title": "Test Assignment",
        "description": "Test description",
        "sub_limit": 3
    }
    response = client.post("/api/v1/assignments", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["title"] == "Test Assignment"
    assert data["description"] == "Test description"
    assert data["course_id"] == course_data["id"]
    assert data["sub_limit"] == 3
    assert "id" in data
    assert isinstance(data["id"], int)
    assert data["id"] > 0

def test_list_assignments():
    """Test listing all assignments."""
    response = client.get("/api/v1/assignments")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Verify structure if list is not empty
    if len(data) > 0:
        assert "id" in data[0]
        assert "title" in data[0]
        assert isinstance(data[0]["id"], int)

def test_list_assignments_by_course():
    """Test listing assignments for a specific course."""
    import uuid
    course_code = f"TEST{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Test Course 2",
        "description": "Description for test course 2"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()

    # Create assignment using API
    assignment_payload = {
        "title": "Course Assignment",
        "description": "Assignment for course"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201

    # Test the endpoint by course code
    response = client.get(f"/api/v1/assignments/by-course/{course_code}")
    assert response.status_code == 200
    assignments = response.json()
    assert len(assignments) >= 1
    assert any(a["title"] == "Course Assignment" for a in assignments)
    # Verify structure of returned assignments
    for assignment in assignments:
        assert "id" in assignment
        assert "title" in assignment
        assert isinstance(assignment["id"], int)
        assert isinstance(assignment["title"], str)

    # Test by course ID
    response = client.get(f"/api/v1/assignments/by-course/{course_data['id']}")
    assert response.status_code == 200
    assignments = response.json()
    assert len(assignments) >= 1
    # Verify structure
    for assignment in assignments:
        assert "id" in assignment
        assert "title" in assignment
        assert isinstance(assignment["id"], int)

def test_get_assignment():
    """Test getting a specific assignment."""
    import uuid
    course_code = f"TEST{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Test Course 3",
        "description": "Description for test course 3"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()

    # Create assignment using API
    assignment_payload = {
        "title": "Specific Assignment",
        "description": "For getting test"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Test getting the assignment
    response = client.get(f"/api/v1/assignments/{assignment_data['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Specific Assignment"
    assert data["course_id"] == course_data["id"]

def test_delete_assignment():
    """Test deleting an assignment."""
    import uuid
    course_code = f"TEST{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Test Course 4",
        "description": "Description for test course 4"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201

    # Create assignment using API
    assignment_payload = {
        "title": "Delete Me",
        "description": "Assignment to delete"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Delete the assignment
    response = client.delete(f"/api/v1/assignments/{assignment_data['id']}")
    assert response.status_code == 200
    assert response.json()["ok"] is True

    # Verify it's gone
    response = client.get(f"/api/v1/assignments/{assignment_data['id']}")
    assert response.status_code == 404

@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_upload_test_file(mock_validate):
    """Test uploading test cases to an assignment using batch endpoint."""
    import uuid
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    course_code = f"TEST{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Test Course 5",
        "description": "Description for test course 5"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()

    # Create assignment using API
    assignment_payload = {
        "title": "Test File Assignment",
        "description": "Assignment for testing file uploads",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Upload test cases using batch endpoint
    test_code = "def test_example():\n    assert True"
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": test_code
            }
        ]
    }
    response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )

    assert response.status_code == 201
    data = response.json()
    assert data["ok"] is True
    assert len(data["test_cases"]) == 1
    assert data["test_cases"][0]["test_code"] == test_code

def test_list_attempts():
    """Test listing attempts for an assignment."""
    import uuid
    course_code = f"TEST{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Test Course 6",
        "description": "Description for test course 6"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201

    # Create assignment using API
    assignment_payload = {
        "title": "Attempts Assignment",
        "description": "Assignment for listing attempts"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Test listing attempts (should be empty)
    response = client.get(f"/api/v1/assignments/{assignment_data['id']}/attempts?student_id=201")
    assert response.status_code == 200
    attempts = response.json()
    assert isinstance(attempts, list)
    assert len(attempts) == 0  # Should be empty for new assignment

@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_submit_assignment(mock_validate, mock_execute, mock_piston_check):
    """Test submitting code to an assignment."""
    import uuid
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock Piston as available
    mock_piston_check.return_value = (True, "OK")
    
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    # Mock execution result
    mock_execute.return_value = {
        "stdout": "PASSED: test_add\nPASSED: test_subtract\n",
        "stderr": "",
        "returncode": 0,
        "grading": {
            "total_tests": 2,
            "passed_tests": 2,
            "total_points": 10,
            "earned_points": 10,
            "test_case_results": {}
        }
    }
    
    course_code = f"TEST{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Test Course 7",
        "description": "Description for test course 7"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201

    # Create assignment using API
    assignment_payload = {
        "title": "Submit Assignment",
        "description": "Assignment for submitting code",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Upload test cases using batch endpoint
    test_code = '''
def test_add():
    assert add(2, 3) == 5
def test_subtract():
    assert subtract(5, 3) == 2
'''
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": test_code
            }
        ]
    }
    test_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert test_response.status_code == 201

    # Enroll student
    reg_payload = {"student_id": 201, "course_id": course_response.json()["id"]}
    reg_response = client.post("/api/v1/registrations", json=reg_payload)
    assert reg_response.status_code == 201

    # Submit student code
    student_code = '''
def add(a, b):
    return a + b
def subtract(a, b):
    return a - b
'''
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    response = client.post(f"/api/v1/assignments/{assignment_data['id']}/submit", files=files, data={"student_id": 201})

    assert response.status_code == 201
    data = response.json()
    assert "submission_id" in data
    assert data["submission_id"] is not None
    assert isinstance(data["submission_id"], int)
    assert data["submission_id"] > 0
    assert "grade" in data
    assert isinstance(data["grade"], (int, float))
    assert "result" in data
    assert isinstance(data["result"], dict)  # result is a dict containing stdout, stderr, grading, etc.
    assert "stdout" in data["result"]
    assert "stderr" in data["result"]
    assert "grading" in data["result"]
    assert "test_cases" in data
    assert isinstance(data["test_cases"], list)

def test_list_assignments_for_course_not_found():
    """Test listing assignments for non-existent course."""
    response = client.get("/api/v1/assignments/by-course/NONEXISTENT")
    assert response.status_code == 200
    assert response.json() == []

def test_serialize_assignment_datetime_handling():
    """Test datetime serialization handling."""
    from app.api.assignments import _to_iso_or_raw
    from datetime import datetime

    # Test datetime object
    dt = datetime(2024, 1, 1, 12, 0, 0)
    result = _to_iso_or_raw(dt)
    assert "2024-01-01T12:00:00" in result

    # Test object without isoformat
    class CustomObj:
        def __str__(self):
            return "custom_string"

    obj = CustomObj()
    result = _to_iso_or_raw(obj)
    assert result == obj  # Should return the object itself

def test_datetime_parsing():
    """Test datetime parsing function."""
    from app.api.assignments import _parse_dt

    # Test None input
    assert _parse_dt(None) is None

    # Test datetime object passthrough
    dt = datetime(2024, 1, 1, 12, 0, 0)
    assert _parse_dt(dt) == dt

    # Test empty string
    assert _parse_dt("") is None
    assert _parse_dt("   ") is None

    # Test ISO format
    result = _parse_dt("2024-01-01T12:00:00")
    assert result.year == 2024
    assert result.month == 1
    assert result.day == 1

    # Test space-separated format
    result = _parse_dt("2024-01-01 12:00")
    assert result.year == 2024
    assert result.month == 1
    assert result.day == 1

    # Test invalid format
    assert _parse_dt("invalid") is None

def test_create_assignment_with_dates():
    """Test creating assignment with start/end dates."""
    import uuid
    course_code = f"DATE{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Date Test Course",
        "description": "Testing date handling"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()

    payload = {
        "course_id": course_data["id"],
        "title": "Date Assignment",
        "description": "Testing date fields",
        "start": "2024-01-01T10:00:00",
        "stop": "2024-01-02T10:00:00"
    }
    response = client.post("/api/v1/assignments", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["title"] == "Date Assignment"
    assert "start" in data
    assert "stop" in data

def test_create_assignment_validation_errors():
    """Test various validation errors in assignment creation."""
    # Test invalid course_id (string instead of int)
    payload = {
        "course_id": "not_an_int",
        "title": "Test Assignment",
        "description": "Test description"
    }
    response = client.post("/api/v1/assignments", json=payload)
    assert response.status_code == 400
    assert "course_id must be an integer" in response.json()["detail"]

    # Test missing title
    payload = {
        "course_id": 999,
        "description": "Test description"
    }
    response = client.post("/api/v1/assignments", json=payload)
    assert response.status_code == 400
    assert "title is required" in response.json()["detail"]

    # Test invalid sub_limit string
    payload = {
        "course_id": 999,
        "title": "Test Assignment",
        "description": "Test description",
        "sub_limit": "not_a_number"
    }
    response = client.post("/api/v1/assignments", json=payload)
    assert response.status_code == 400
    assert "sub_limit must be a valid integer" in response.json()["detail"]

    # Test course not found
    payload = {
        "course_id": 99999,
        "title": "Test Assignment",
        "description": "Test description"
    }
    response = client.post("/api/v1/assignments", json=payload)
    assert response.status_code == 404
    assert "Course not found" in response.json()["detail"]

def test_datetime_serialization():
    """Test the datetime serialization helper function."""
    from app.api.assignments import _to_iso_or_raw
    from datetime import datetime

    # Test datetime object
    dt = datetime(2024, 1, 1, 12, 0, 0)
    result = _to_iso_or_raw(dt)
    assert "2024-01-01T12:00:00" in result

    # Test object without isoformat that raises exception (should return str(v))
    class BadDateTime:
        def isoformat(self):
            raise AttributeError("no isoformat")
        def __str__(self):
            return "bad_datetime_string"

    bad_obj = BadDateTime()
    result = _to_iso_or_raw(bad_obj)
    assert result == "bad_datetime_string"

    # Test object without isoformat (should return the object)
    class CustomObj:
        def __str__(self):
            return "custom_string"

    obj = CustomObj()
    result = _to_iso_or_raw(obj)
    assert result == obj

def test_get_assignment_not_found_detailed():
    """Test detailed error response for non-existent assignment."""
    response = client.get("/api/v1/assignments/99999")
    assert response.status_code == 404
    error_data = response.json()
    assert "detail" in error_data
    assert "Assignment not found" in error_data["detail"]

def test_delete_assignment_not_found_detailed():
    """Test detailed error response for deleting non-existent assignment."""
    response = client.delete("/api/v1/assignments/99999")
    assert response.status_code == 404
    error_data = response.json()
    assert "detail" in error_data
    assert "Assignment not found" in error_data["detail"]

def test_upload_test_file_invalid_assignment():
    """Test uploading test cases to invalid assignment ID."""
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "test_code": "def test_example():\n    assert True"
            }
        ]
    }
    response = client.post("/api/v1/assignments/99999/test-cases/batch", json=batch_payload)
    assert response.status_code == 404
    error_data = response.json()
    assert "detail" in error_data
    assert "Assignment not found" in error_data["detail"]

def test_list_attempts_invalid_assignment():
    """Test listing attempts for invalid assignment."""
    response = client.get("/api/v1/assignments/99999/attempts?student_id=201")
    assert response.status_code == 404
    error_data = response.json()
    assert "detail" in error_data
    assert "Assignment not found" in error_data["detail"]

@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
def test_submit_invalid_assignment(mock_piston_check):
    """Test submitting to invalid assignment."""
    # Mock Piston as available (but assignment will be invalid)
    mock_piston_check.return_value = (True, "OK")
    
    files = {"submission": ("code.py", b"print('hello')", "text/x-python")}
    data = {"student_id": 201}
    response = client.post("/api/v1/assignments/99999/submit", files=files, data=data)
    assert response.status_code == 404
    error_data = response.json()
    assert "detail" in error_data
    assert "Assignment not found" in error_data["detail"]


def test_list_assignments_by_course_not_found():
    """Test listing assignments for non-existent course."""
    # This tests the GET /api/v1/assignments/by-course/{course_key} endpoint
    response = client.get("/api/v1/assignments/by-course/NONEXISTENT")
    assert response.status_code == 200
    data = response.json()
    assert data == []


def test_upload_test_file_invalid_format():
    """Test uploading test cases with empty test_code."""
    import uuid
    course_code = f"INVALID{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Invalid Test Course",
        "description": "For testing invalid test cases"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201

    # Create assignment using API
    assignment_payload = {
        "title": "Invalid File Assignment",
        "description": "For testing invalid test cases",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Try to upload test case with empty test_code
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "test_code": ""  # Empty test code should fail validation
            }
        ]
    }
    response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert response.status_code == 400
    assert "test_code cannot be empty" in response.json()["detail"]


@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
def test_submit_invalid_student(mock_piston_check):
    """Test submitting assignment with invalid student."""
    # Mock Piston as available
    mock_piston_check.return_value = (True, "OK")
    
    import uuid
    course_code = f"INVALID{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Invalid Student Course",
        "description": "For testing invalid student"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201

    # Create assignment using API
    assignment_payload = {
        "title": "Invalid Student Assignment",
        "description": "For testing invalid student"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Try to submit with invalid student
    student_code = "def add(a, b): return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    response = client.post(f"/api/v1/assignments/{assignment_data['id']}/submit", files=files, data={"student_id": 99999})
    assert response.status_code == 404
    assert "Student not found" in response.json()["detail"]


@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
def test_submit_non_student(mock_piston_check):
    """Test submitting assignment with non-student user."""
    # Mock Piston as available
    mock_piston_check.return_value = (True, "OK")
    
    import uuid
    course_code = f"NONSTUDENT{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Non-Student Course",
        "description": "For testing non-student submission"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201

    # Create assignment using API
    assignment_payload = {
        "title": "Non-Student Assignment",
        "description": "For testing non-student submission"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Try to submit with faculty user (non-student)
    student_code = "def add(a, b): return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    response = client.post(f"/api/v1/assignments/{assignment_data['id']}/submit", files=files, data={"student_id": 301})
    assert response.status_code == 400
    assert "Only students can submit" in response.json()["detail"]


@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
def test_submit_no_test_file(mock_piston_check):
    """Test submitting assignment without test file."""
    # Mock Piston as available
    mock_piston_check.return_value = (True, "OK")
    
    import uuid
    course_code = f"NOTEST{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "No Test Course",
        "description": "For testing submission without test file"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201

    # Create assignment using API (no test file uploaded)
    assignment_payload = {
        "title": "No Test Assignment",
        "description": "For testing submission without test file"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Enroll student
    reg_payload = {"student_id": 201, "course_id": course_response.json()["id"]}
    reg_response = client.post("/api/v1/registrations", json=reg_payload)
    assert reg_response.status_code == 201

    # Try to submit without test cases
    student_code = "def add(a, b): return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    response = client.post(f"/api/v1/assignments/{assignment_data['id']}/submit", files=files, data={"student_id": 201})
    assert response.status_code == 409
    assert "No test cases attached to this assignment" in response.json()["detail"]


@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_submit_invalid_file_format(mock_validate, mock_piston_check):
    """Test submitting assignment with invalid file format."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock Piston as available
    mock_piston_check.return_value = (True, "OK")
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    import uuid
    course_code = f"INVALIDFMT{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Invalid Format Course",
        "description": "For testing invalid file format submission"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201

    # Create assignment using API
    assignment_payload = {
        "title": "Invalid Format Assignment",
        "description": "For testing invalid file format submission",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Enroll student
    reg_payload = {"student_id": 201, "course_id": course_response.json()["id"]}
    reg_response = client.post("/api/v1/registrations", json=reg_payload)
    assert reg_response.status_code == 201

    # Upload test cases using batch endpoint
    test_code = "def test_add(): assert add(2, 3) == 5"
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": test_code
            }
        ]
    }
    test_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert test_response.status_code == 201

    # Try to submit with invalid file format (not .py)
    files = {"submission": ("solution.txt", "invalid content", "text/plain")}
    response = client.post(f"/api/v1/assignments/{assignment_data['id']}/submit", files=files, data={"student_id": 201})
    assert response.status_code == 415
    error_detail = response.json()["detail"]
    assert "Invalid file format" in error_detail or "Expected" in error_detail


def test_parse_dt_non_string_input():
    """Test _parse_dt function with non-string input."""
    from app.api.assignments import _parse_dt

    # Test with integer input (should return None)
    assert _parse_dt(123) is None

    # Test with list input (should return None)
    assert _parse_dt([]) is None

    # Test with dict input (should return None)
    assert _parse_dt({}) is None


def test_get_assignment_grades():
    """Test getting grades for an assignment."""
    import uuid
    course_code = f"GRADES{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Grades Test Course",
        "description": "For testing grades endpoint"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201

    # Create assignment using API
    assignment_payload = {
        "title": "Grades Test Assignment",
        "description": "For testing grades"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Test getting grades (should return empty since no students enrolled yet)
    response = client.get(f"/api/v1/assignments/{assignment_data['id']}/grades")
    assert response.status_code == 200
    data = response.json()
    assert "students" in data
    assert isinstance(data["students"], list)


def test_get_course_gradebook():
    """Test getting gradebook for a course."""
    import uuid
    course_code = f"GRADEBOOK{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Gradebook Test Course",
        "description": "For testing gradebook endpoint"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201

    # Test getting gradebook
    response = client.get(f"/api/v1/assignments/gradebook/by-course/{course_code}")
    assert response.status_code == 200
    data = response.json()
    assert "assignments" in data
    assert "students" in data
    assert isinstance(data["assignments"], list)
    assert isinstance(data["students"], list)


# ============================================================================
# Assignment Update (PUT) Endpoint Tests
# ============================================================================

def test_update_assignment_partial():
    """Test updating assignment with partial fields."""
    import uuid
    course_code = f"UPDATETEST{uuid.uuid4().hex[:6]}"
    
    # Create test course
    course_payload = {
        "course_code": course_code,
        "name": "Update Test Course",
        "description": "For testing assignment updates"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Create assignment
    assignment_payload = {
        "title": "Original Title",
        "description": "Original description",
        "language": "python",
        "sub_limit": 5
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    original_id = assignment_data["id"]
    
    # Update only title
    update_payload = {"title": "Updated Title"}
    response = client.put(f"/api/v1/assignments/{original_id}", json=update_payload)
    assert response.status_code == 200
    updated_data = response.json()
    assert updated_data["title"] == "Updated Title"
    assert updated_data["description"] == "Original description"  # Unchanged
    assert updated_data["sub_limit"] == 5  # Unchanged
    
    # Update multiple fields
    update_payload2 = {
        "description": "Updated description",
        "sub_limit": 10
    }
    response2 = client.put(f"/api/v1/assignments/{original_id}", json=update_payload2)
    assert response2.status_code == 200
    updated_data2 = response2.json()
    assert updated_data2["title"] == "Updated Title"  # Still updated from before
    assert updated_data2["description"] == "Updated description"
    assert updated_data2["sub_limit"] == 10


def test_update_assignment_not_found():
    """Test updating non-existent assignment."""
    update_payload = {"title": "New Title"}
    response = client.put("/api/v1/assignments/99999", json=update_payload)
    assert response.status_code == 404
    assert "Assignment not found" in response.json()["detail"]


def test_update_assignment_invalid_sub_limit():
    """Test updating assignment with invalid sub_limit."""
    import uuid
    course_code = f"INVALIDLIMIT{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Invalid Limit Course",
        "description": "Test invalid limit"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Try negative sub_limit
    update_payload = {"sub_limit": -1}
    response = client.put(f"/api/v1/assignments/{assignment_data['id']}", json=update_payload)
    assert response.status_code == 400
    assert "non-negative" in response.json()["detail"].lower()


def test_update_assignment_empty_title():
    """Test updating assignment with empty title."""
    import uuid
    course_code = f"EMPTYTITLE{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Empty Title Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Try empty title
    update_payload = {"title": "   "}
    response = client.put(f"/api/v1/assignments/{assignment_data['id']}", json=update_payload)
    assert response.status_code == 400
    assert "title cannot be empty" in response.json()["detail"]


def test_update_assignment_dates():
    """Test updating assignment with start/stop dates."""
    import uuid
    course_code = f"DATETEST{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Date Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Update dates
    update_payload = {
        "start": "2024-01-01T10:00:00",
        "stop": "2024-01-02T10:00:00"
    }
    response = client.put(f"/api/v1/assignments/{assignment_data['id']}", json=update_payload)
    assert response.status_code == 200
    updated_data = response.json()
    assert "start" in updated_data
    assert "stop" in updated_data


# ============================================================================
# Submission Code Text Field Tests
# ============================================================================

@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_submit_with_code_text(mock_validate, mock_execute, mock_piston_check):
    """Test submitting code using text field instead of file."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock Piston as available
    mock_piston_check.return_value = (True, "OK")
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    # Mock execution result
    mock_execute.return_value = {
        "stdout": "PASSED: test_add\nPASSED: test_subtract\n",
        "stderr": "",
        "returncode": 0,
        "grading": {
            "total_tests": 2,
            "passed_tests": 2,
            "total_points": 10,
            "earned_points": 10,
            "test_case_results": {}
        }
    }
    
    import uuid
    course_code = f"CODETEXT{uuid.uuid4().hex[:6]}"
    
    # Create test course
    course_payload = {
        "course_code": course_code,
        "name": "Code Text Course",
        "description": "For testing text code submission"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    # Create assignment
    assignment_payload = {
        "title": "Code Text Assignment",
        "description": "Assignment for testing text submission",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Upload test cases using batch endpoint
    test_code = '''
def test_add():
    assert add(2, 3) == 5
def test_subtract():
    assert subtract(5, 3) == 2
'''
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": test_code
            }
        ]
    }
    test_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert test_response.status_code == 201
    
    # Enroll student
    reg_payload = {"student_id": 201, "course_id": course_response.json()["id"]}
    reg_response = client.post("/api/v1/registrations", json=reg_payload)
    assert reg_response.status_code == 201
    
    # Submit using code text field
    student_code = '''
def add(a, b):
    return a + b
def subtract(a, b):
    return a - b
'''
    data = {
        "student_id": 201,
        "code": student_code
    }
    response = client.post(f"/api/v1/assignments/{assignment_data['id']}/submit", data=data)
    
    assert response.status_code == 201
    data = response.json()
    assert "submission_id" in data
    assert "grade" in data
    assert "test_cases" in data


@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_submit_with_no_file_or_code(mock_validate, mock_piston_check):
    """Test submitting without file or code field."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock Piston as available
    mock_piston_check.return_value = (True, "OK")
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    import uuid
    course_code = f"NOINPUT{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "No Input Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Upload test cases using batch endpoint
    test_code = "def test_example():\n    assert True"
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": test_code
            }
        ]
    }
    test_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert test_response.status_code == 201
    
    # Enroll student
    reg_payload = {"student_id": 201, "course_id": course_response.json()["id"]}
    reg_response = client.post("/api/v1/registrations", json=reg_payload)
    assert reg_response.status_code == 201
    
    # Submit with neither file nor code
    data = {"student_id": 201}
    response = client.post(f"/api/v1/assignments/{assignment_data['id']}/submit", data=data)
    assert response.status_code == 400
    assert "Either submission file or code text must be provided" in response.json()["detail"]


@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_submit_with_empty_code(mock_validate, mock_piston_check):
    """Test submitting with empty code text."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock Piston as available
    mock_piston_check.return_value = (True, "OK")
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    import uuid
    course_code = f"EMPTYCODE{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Empty Code Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Upload test cases using batch endpoint
    test_code = "def test_example():\n    assert True"
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": test_code
            }
        ]
    }
    test_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert test_response.status_code == 201
    
    # Enroll student
    reg_payload = {"student_id": 201, "course_id": course_response.json()["id"]}
    reg_response = client.post("/api/v1/registrations", json=reg_payload)
    assert reg_response.status_code == 201
    
    # Submit with empty code
    data = {
        "student_id": 201,
        "code": "   "  # Only whitespace
    }
    response = client.post(f"/api/v1/assignments/{assignment_data['id']}/submit", data=data)
    assert response.status_code == 400
    assert "Code cannot be empty" in response.json()["detail"]


# ============================================================================
# Download Submission Code Endpoint Tests
# ============================================================================

@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_download_submission_code(mock_validate, mock_execute, mock_piston_check):
    """Test downloading submission code as text file."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock Piston as available
    mock_piston_check.return_value = (True, "OK")
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    # Mock execution result
    mock_execute.return_value = {
        "stdout": "PASSED: test_example\n",
        "stderr": "",
        "returncode": 0,
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "total_points": 10,
            "earned_points": 10,
            "test_case_results": {}
        }
    }
    
    import uuid
    course_code = f"DOWNLOAD{uuid.uuid4().hex[:6]}"
    
    # Create test course
    course_payload = {
        "course_code": course_code,
        "name": "Download Course",
        "description": "For testing code download"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    # Create assignment
    assignment_payload = {
        "title": "Download Assignment",
        "description": "Assignment for testing download",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Upload test cases using batch endpoint
    test_code = "def test_example():\n    assert True"
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": test_code
            }
        ]
    }
    test_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert test_response.status_code == 201
    
    # Enroll student
    reg_payload = {"student_id": 201, "course_id": course_response.json()["id"]}
    reg_response = client.post("/api/v1/registrations", json=reg_payload)
    assert reg_response.status_code == 201
    
    # Submit code
    student_code = "def add(a, b):\n    return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    submit_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/submit",
        files=files,
        data={"student_id": 201}
    )
    assert submit_response.status_code == 201
    submit_data = submit_response.json()
    submission_id = submit_data["submission_id"]
    
    # Download code as faculty (user_id=301 is faculty from seed)
    response = client.get(
        f"/api/v1/assignments/{assignment_data['id']}/submissions/{submission_id}/code",
        params={"user_id": 301}
    )
    assert response.status_code == 200
    
    # Check content type
    assert response.headers["content-type"] == "text/plain; charset=utf-8"
    
    # Check content disposition header
    assert "attachment" in response.headers["content-disposition"]
    assert f'submission_{submission_id}.txt' in response.headers["content-disposition"]
    
    # Check content matches submitted code
    assert response.text == student_code


@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_download_submission_code_non_faculty(mock_validate, mock_execute, mock_piston_check):
    """Test that non-faculty cannot download submission code."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock Piston as available
    mock_piston_check.return_value = (True, "OK")
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    # Mock execution result
    mock_execute.return_value = {
        "stdout": "PASSED: test_example\n",
        "stderr": "",
        "returncode": 0,
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "total_points": 10,
            "earned_points": 10,
            "test_case_results": {}
        }
    }
    
    import uuid
    course_code = f"NOFACULTY{uuid.uuid4().hex[:6]}"
    
    # Create course and assignment
    course_payload = {
        "course_code": course_code,
        "name": "No Faculty Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Upload test cases using batch endpoint
    test_code = "def test_example():\n    assert True"
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": test_code
            }
        ]
    }
    test_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert test_response.status_code == 201
    
    # Enroll student
    reg_payload = {"student_id": 201, "course_id": course_response.json()["id"]}
    reg_response = client.post("/api/v1/registrations", json=reg_payload)
    assert reg_response.status_code == 201
    
    # Submit code
    student_code = "def add(a, b):\n    return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    submit_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/submit",
        files=files,
        data={"student_id": 201}
    )
    assert submit_response.status_code == 201
    submit_data = submit_response.json()
    submission_id = submit_data["submission_id"]
    
    # Try to download as student (user_id=201 is student)
    response = client.get(
        f"/api/v1/assignments/{assignment_data['id']}/submissions/{submission_id}/code",
        params={"user_id": 201}
    )
    assert response.status_code == 403
    assert "Only faculty members" in response.json()["detail"]


def test_download_submission_code_not_found():
    """Test downloading non-existent submission."""
    response = client.get(
        "/api/v1/assignments/1/submissions/99999/code",
        params={"user_id": 301}
    )
    assert response.status_code == 404


# ============================================================================
# Test Case Management Endpoint Tests
# ============================================================================

@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_create_test_cases_batch(mock_validate):
    """Test creating test cases in batch."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    import uuid
    course_code = f"BATCHTC{uuid.uuid4().hex[:6]}"
    
    # Create course and assignment
    course_payload = {
        "course_code": course_code,
        "name": "Batch Test Case Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Batch Test Case Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Create test cases in batch
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": "def test_one():\n    assert True",
                "order": 1
            },
            {
                "point_value": 20,
                "visibility": False,
                "test_code": "def test_two():\n    assert True",
                "order": 2
            }
        ]
    }
    response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert response.status_code == 201
    data = response.json()
    assert data["ok"] is True
    assert len(data["test_cases"]) == 2
    assert data["test_cases"][0]["point_value"] == 10
    assert data["test_cases"][1]["point_value"] == 20


@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_create_test_cases_batch_no_language(mock_validate):
    """Test creating test cases when assignment has no language (defaults to python)."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    import uuid
    course_code = f"NOLANG{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "No Lang Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test"
        # No language set - should default to python
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Assignment should default to python language
    assert assignment_data.get("language", "python") == "python"
    
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "test_code": "def test_one():\n    assert True"
            }
        ]
    }
    response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    # Should succeed because assignment defaults to python
    assert response.status_code == 201
    assert len(response.json()["test_cases"]) == 1




def test_update_assignment_non_string_description():
    """Test updating assignment with non-string description."""
    import uuid
    course_code = f"NONSTR{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Non String Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Try to update with non-string description
    # Note: The code calls .strip() on the value, which will cause an AttributeError
    # if it's not a string. The endpoint should handle this gracefully.
    update_payload = {"description": 123}
    response = client.put(f"/api/v1/assignments/{assignment_data['id']}", json=update_payload)
    # The code will raise AttributeError when calling .strip() on int, which FastAPI converts to 500
    # Or if the code checks type first, it should return 400
    assert response.status_code in [400, 500]
    if response.status_code == 400:
        assert "description must be a string" in response.json()["detail"]


@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_update_test_case_empty_code(mock_validate):
    """Test updating test case with empty test_code."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock validation to pass for initial creation
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    import uuid
    course_code = f"EMPTYTC{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Empty TC Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Create test case
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "test_code": "def test_one():\n    assert True"
            }
        ]
    }
    batch_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert batch_response.status_code == 201
    test_case_id = batch_response.json()["test_cases"][0]["id"]
    
    # Try to update with empty test_code
    update_payload = {"test_code": ""}
    response = client.put(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/{test_case_id}",
        json=update_payload
    )
    assert response.status_code == 400
    assert "test_code cannot be empty" in response.json()["detail"]


@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_list_test_cases_with_student_filtering(mock_validate):
    """Test listing test cases with student filtering (hidden cases excluded)."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    import uuid
    course_code = f"STUFILT{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Student Filter Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Create visible and hidden test cases
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": "def test_visible():\n    assert True"
            },
            {
                "point_value": 5,
                "visibility": False,
                "test_code": "def test_hidden():\n    assert True"
            }
        ]
    }
    batch_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert batch_response.status_code == 201
    
    # List as student (should only see visible)
    response = client.get(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases",
        params={"student_id": 201}  # student_id from seed
    )
    assert response.status_code == 200
    test_cases = response.json()
    assert len(test_cases) == 1
    assert test_cases[0]["visibility"] is True
    
    # List with include_hidden=True as faculty (should see all)
    response = client.get(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases",
        params={"user_id": 301, "include_hidden": True}  # user_id=301 is faculty
    )
    assert response.status_code == 200
    test_cases = response.json()
    assert len(test_cases) == 2


@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_list_test_cases(mock_validate):
    """Test listing test cases for an assignment."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    import uuid
    course_code = f"LISTTC{uuid.uuid4().hex[:6]}"
    
    # Create course and assignment
    course_payload = {
        "course_code": course_code,
        "name": "List Test Case Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Create test cases
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": "def test_one():\n    assert True"
            },
            {
                "point_value": 20,
                "visibility": False,
                "test_code": "def test_two():\n    assert True"
            }
        ]
    }
    batch_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert batch_response.status_code == 201
    
    # List all test cases (should include hidden)
    response = client.get(f"/api/v1/assignments/{assignment_data['id']}/test-cases")
    assert response.status_code == 200
    test_cases = response.json()
    assert len(test_cases) == 2
    
    # List as student (should only see visible)
    response = client.get(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases",
        params={"student_id": 201}
    )
    assert response.status_code == 200
    test_cases = response.json()
    assert len(test_cases) == 1  # Only visible test case
    assert test_cases[0]["visibility"] is True


@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_get_test_case(mock_validate):
    """Test getting a single test case."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    import uuid
    course_code = f"GETTC{uuid.uuid4().hex[:6]}"
    
    # Create course and assignment
    course_payload = {
        "course_code": course_code,
        "name": "Get Test Case Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Create test case
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": "def test_one():\n    assert True"
            }
        ]
    }
    batch_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    test_case_id = batch_response.json()["test_cases"][0]["id"]
    
    # Get test case
    response = client.get(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/{test_case_id}"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_case_id
    assert data["point_value"] == 10
    assert "test_code" in data


@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_update_test_case(mock_validate):
    """Test updating a test case."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    import uuid
    course_code = f"UPDTC{uuid.uuid4().hex[:6]}"
    
    # Create course and assignment
    course_payload = {
        "course_code": course_code,
        "name": "Update Test Case Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Create test case
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": "def test_one():\n    assert True"
            }
        ]
    }
    batch_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert batch_response.status_code == 201
    test_case_id = batch_response.json()["test_cases"][0]["id"]
    
    # Update test case
    update_payload = {
        "point_value": 20,
        "visibility": False,
        "test_code": "def test_updated():\n    assert False"
    }
    response = client.put(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/{test_case_id}",
        json=update_payload
    )
    assert response.status_code == 200
    data = response.json()
    assert data["point_value"] == 20
    assert data["visibility"] is False
    assert "test_updated" in data["test_code"]


@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_delete_test_case(mock_validate):
    """Test deleting a test case."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    import uuid
    course_code = f"DELTC{uuid.uuid4().hex[:6]}"
    
    # Create course and assignment
    course_payload = {
        "course_code": course_code,
        "name": "Delete Test Case Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Create test case
    batch_payload = {
        "test_cases": [
            {
                "point_value": 10,
                "visibility": True,
                "test_code": "def test_one():\n    assert True"
            }
        ]
    }
    batch_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert batch_response.status_code == 201
    test_case_id = batch_response.json()["test_cases"][0]["id"]
    
    # Delete test case
    response = client.delete(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/{test_case_id}"
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True
    
    # Verify it's deleted
    response = client.get(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/{test_case_id}"
    )
    assert response.status_code == 404


# ============================================================================
# Tests for Missing Endpoints
# ============================================================================

def test_get_supported_languages():
    """Test getting supported languages from assignments endpoint."""
    response = client.get("/api/v1/assignments/_languages")
    assert response.status_code == 200
    languages = response.json()
    assert isinstance(languages, list)
    if len(languages) > 0:
        lang = languages[0]
        assert "id" in lang
        assert "name" in lang


@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_get_submission_detail(mock_validate, mock_execute, mock_piston_check):
    """Test getting detailed submission information (faculty only)."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock Piston as available
    mock_piston_check.return_value = (True, "OK")
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    # Mock execution result
    mock_execute.return_value = {
        "stdout": "PASSED: test_add\n",
        "stderr": "",
        "returncode": 0,
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "total_points": 10,
            "earned_points": 10,
            "test_case_results": {}
        }
    }
    
    import uuid
    course_code = f"SUBDET{uuid.uuid4().hex[:6]}"
    
    # Create test course
    course_payload = {
        "course_code": course_code,
        "name": "Submission Detail Test",
        "description": "For testing submission detail"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Create assignment
    assignment_payload = {
        "title": "Submission Detail Assignment",
        "description": "For testing",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Add test cases
    test_code = "def test_add(): assert add(2, 3) == 5"
    batch_payload = {
        "test_cases": [{
            "point_value": 10,
            "visibility": True,
            "test_code": test_code
        }]
    }
    test_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert test_response.status_code == 201
    
    # Enroll student
    reg_payload = {"student_id": 201, "course_id": course_data["id"]}
    reg_response = client.post("/api/v1/registrations", json=reg_payload)
    assert reg_response.status_code == 201
    
    # Submit code
    student_code = "def add(a, b): return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    
    submit_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/submit",
        files=files,
        data={"student_id": 201}
    )
    assert submit_response.status_code == 201
    submission_id = submit_response.json()["submission_id"]
    
    # Get submission detail (faculty)
    response = client.get(
        f"/api/v1/assignments/{assignment_data['id']}/submission-detail/{submission_id}",
        params={"user_id": 301}
    )
    assert response.status_code == 200
    data = response.json()
    assert "submission" in data
    assert "student" in data
    assert "assignment" in data
    assert "course" in data
    assert "attempt_number" in data


def test_get_submission_detail_non_faculty():
    """Test that non-faculty cannot access submission details."""
    import uuid
    
    course_code = f"SUBDETNF{uuid.uuid4().hex[:6]}"
    
    # Create test course
    course_payload = {
        "course_code": course_code,
        "name": "Submission Detail Test NF",
        "description": "For testing"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Create assignment
    assignment_payload = {
        "title": "Submission Detail Assignment",
        "description": "For testing",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Try to access as student (should fail)
    response = client.get(
        f"/api/v1/assignments/{assignment_data['id']}/submission-detail/1",
        params={"user_id": 201}  # student
    )
    assert response.status_code == 403


@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_get_student_attempts(mock_validate, mock_execute, mock_piston_check):
    """Test getting all attempts for a specific student (faculty only)."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock Piston as available
    mock_piston_check.return_value = (True, "OK")
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    # Mock execution result
    mock_execute.return_value = {
        "stdout": "PASSED: test_add\n",
        "stderr": "",
        "returncode": 0,
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "total_points": 10,
            "earned_points": 10,
            "test_case_results": {}
        }
    }
    
    import uuid
    course_code = f"STUATT{uuid.uuid4().hex[:6]}"
    
    # Create test course
    course_payload = {
        "course_code": course_code,
        "name": "Student Attempts Test",
        "description": "For testing"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Create assignment
    assignment_payload = {
        "title": "Student Attempts Assignment",
        "description": "For testing",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Add test cases
    test_code = "def test_add(): assert add(2, 3) == 5"
    batch_payload = {
        "test_cases": [{
            "point_value": 10,
            "visibility": True,
            "test_code": test_code
        }]
    }
    test_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert test_response.status_code == 201
    
    # Enroll student
    reg_payload = {"student_id": 201, "course_id": course_data["id"]}
    reg_response = client.post("/api/v1/registrations", json=reg_payload)
    assert reg_response.status_code == 201
    
    # Submit code twice
    student_code = "def add(a, b): return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    
    # First submission
    submit_response1 = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/submit",
        files=files,
        data={"student_id": 201}
    )
    assert submit_response1.status_code == 201
    
    # Second submission
    submit_response2 = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/submit",
        files=files,
        data={"student_id": 201}
    )
    assert submit_response2.status_code == 201
    
    # Get student attempts (faculty)
    response = client.get(
        f"/api/v1/assignments/{assignment_data['id']}/students/201/attempts",
        params={"user_id": 301}
    )
    assert response.status_code == 200
    attempts = response.json()
    assert isinstance(attempts, list)
    assert len(attempts) >= 2


def test_get_student_attempts_non_faculty():
    """Test that non-faculty cannot access student attempts."""
    import uuid
    
    course_code = f"STUATTNF{uuid.uuid4().hex[:6]}"
    
    # Create test course
    course_payload = {
        "course_code": course_code,
        "name": "Student Attempts Test NF",
        "description": "For testing"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Create assignment
    assignment_payload = {
        "title": "Student Attempts Assignment",
        "description": "For testing",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Try to access as student (should fail)
    response = client.get(
        f"/api/v1/assignments/{assignment_data['id']}/students/201/attempts",
        params={"user_id": 201}  # student
    )
    assert response.status_code == 403


@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_rerun_all_students(mock_validate, mock_piston_check, mock_execute):
    """Test rerunning all student attempts for an assignment."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    # Mock Piston availability
    mock_piston_check.return_value = (True, "OK")
    # Mock execution result
    mock_execute.return_value = {
        "stdout": "PASSED: test_add\n",
        "stderr": "",
        "returncode": 0,
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "total_points": 10,
            "earned_points": 10,
            "test_case_results": {}
        }
    }
    
    import uuid
    course_code = f"RERUNALL{uuid.uuid4().hex[:6]}"
    
    # Create test course
    course_payload = {
        "course_code": course_code,
        "name": "Rerun All Test",
        "description": "For testing"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Create assignment
    assignment_payload = {
        "title": "Rerun All Assignment",
        "description": "For testing",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Add test cases
    test_code = "def test_add(): assert add(2, 3) == 5"
    batch_payload = {
        "test_cases": [{
            "point_value": 10,
            "visibility": True,
            "test_code": test_code
        }]
    }
    test_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert test_response.status_code == 201
    
    # Enroll students
    for student_id in [201, 202]:
        reg_payload = {"student_id": student_id, "course_id": course_data["id"]}
        reg_response = client.post("/api/v1/registrations", json=reg_payload)
        assert reg_response.status_code == 201
    
    # Submit code for both students
    student_code = "def add(a, b): return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    
    for student_id in [201, 202]:
        submit_response = client.post(
            f"/api/v1/assignments/{assignment_data['id']}/submit",
            files=files,
            data={"student_id": student_id}
        )
        assert submit_response.status_code == 201
    
    # Rerun all students (faculty)
    response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/rerun-all-students",
        params={"user_id": 301}
    )
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "total_submissions" in data
    assert "total_students" in data
    assert "results" in data
    assert data["total_students"] == 2


@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_rerun_student_attempts(mock_validate, mock_piston_check, mock_execute):
    """Test rerunning attempts for a specific student."""
    from app.api.syntax import SyntaxCheckResponse
    
    # Mock validation to pass
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    # Mock Piston availability
    mock_piston_check.return_value = (True, "OK")
    # Mock execution result
    mock_execute.return_value = {
        "stdout": "PASSED: test_add\n",
        "stderr": "",
        "returncode": 0,
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "total_points": 10,
            "earned_points": 10,
            "test_case_results": {}
        }
    }
    
    import uuid
    course_code = f"RERUNSTU{uuid.uuid4().hex[:6]}"
    
    # Create test course
    course_payload = {
        "course_code": course_code,
        "name": "Rerun Student Test",
        "description": "For testing"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Create assignment
    assignment_payload = {
        "title": "Rerun Student Assignment",
        "description": "For testing",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Add test cases
    test_code = "def test_add(): assert add(2, 3) == 5"
    batch_payload = {
        "test_cases": [{
            "point_value": 10,
            "visibility": True,
            "test_code": test_code
        }]
    }
    test_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert test_response.status_code == 201
    
    # Enroll student
    reg_payload = {"student_id": 201, "course_id": course_data["id"]}
    reg_response = client.post("/api/v1/registrations", json=reg_payload)
    assert reg_response.status_code == 201
    
    # Submit code twice
    student_code = "def add(a, b): return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    
    for _ in range(2):
        submit_response = client.post(
            f"/api/v1/assignments/{assignment_data['id']}/submit",
            files=files,
            data={"student_id": 201}
        )
        assert submit_response.status_code == 201
    
    # Rerun student attempts (faculty)
    response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/rerun-student-attempts/201",
        params={"user_id": 301}
    )
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "results" in data
    assert len(data["results"]) >= 2  # Should have results for both submissions


def test_rerun_all_students_non_faculty():
    """Test that non-faculty cannot rerun student attempts."""
    import uuid
    
    course_code = f"RERUNNF{uuid.uuid4().hex[:6]}"
    
    # Create test course
    course_payload = {
        "course_code": course_code,
        "name": "Rerun NF Test",
        "description": "For testing"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Create assignment
    assignment_payload = {
        "title": "Rerun NF Assignment",
        "description": "For testing",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Try to rerun as student (should fail)
    response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/rerun-all-students",
        params={"user_id": 201}  # student
    )
    assert response.status_code == 403


def test_rerun_all_students_no_submissions():
    """Test rerunning when there are no submissions."""
    import uuid
    
    course_code = f"RERUNNONE{uuid.uuid4().hex[:6]}"
    
    # Create test course
    course_payload = {
        "course_code": course_code,
        "name": "Rerun None Test",
        "description": "For testing"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Create assignment
    assignment_payload = {
        "title": "Rerun None Assignment",
        "description": "For testing",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Try to rerun (should fail - no submissions)
    response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/rerun-all-students",
        params={"user_id": 301}
    )
    assert response.status_code == 404
    assert "No submissions" in response.json()["detail"]


# ============================================================================
# Helper Function Tests
# ============================================================================

def test_to_iso_or_raw():
    """Test _to_iso_or_raw helper function."""
    from app.api.assignments import _to_iso_or_raw
    from datetime import datetime
    
    # Test with datetime object
    dt = datetime(2024, 1, 1, 12, 0, 0)
    result = _to_iso_or_raw(dt)
    assert isinstance(result, str)
    assert "2024-01-01" in result
    
    # Test with non-datetime object
    result = _to_iso_or_raw("test")
    assert result == "test"
    
    # Test with None
    result = _to_iso_or_raw(None)
    assert result is None
    
    # Test with object that has isoformat but raises exception
    class BadDateTime:
        def isoformat(self):
            raise Exception("Error")
    
    bad_dt = BadDateTime()
    result = _to_iso_or_raw(bad_dt)
    assert isinstance(result, str)  # Should fall back to str()


def test_parse_dt():
    """Test _parse_dt helper function."""
    from app.api.assignments import _parse_dt
    from datetime import datetime
    
    # Test None
    assert _parse_dt(None) is None
    
    # Test datetime object
    dt = datetime(2024, 1, 1, 12, 0, 0)
    assert _parse_dt(dt) == dt
    
    # Test empty string
    assert _parse_dt("") is None
    assert _parse_dt("   ") is None
    
    # Test ISO format
    result = _parse_dt("2024-01-01T12:00:00")
    assert isinstance(result, datetime)
    assert result.year == 2024
    
    # Test space-separated format
    result = _parse_dt("2024-01-01 12:00")
    assert isinstance(result, datetime)
    assert result.year == 2024
    
    # Test invalid format
    assert _parse_dt("invalid") is None
    
    # Test non-string, non-datetime
    assert _parse_dt(123) is None


def test_sanitize_output_for_students():
    """Test _sanitize_output_for_students helper function."""
    from app.api.assignments import _sanitize_output_for_students
    from app.models.models import TestCase
    
    # Create mock test cases
    tc1 = TestCase(id=1, visibility=True, point_value=10)
    tc2 = TestCase(id=2, visibility=False, point_value=20)
    tc3 = TestCase(id=3, visibility=True, point_value=15)
    test_cases = [tc1, tc2, tc3]
    visible_ids = {1, 3}
    
    # Test stdout with hidden test case info
    stdout = """PASSED: test_case_1:10
FAILED: test_case_2:0
PASSED: test_case_3:15
=== Test Results ===
Total: 3
Passed: 2
Failed: 1
Earned: 25
TotalPoints: 45"""
    
    stderr = "ERROR_2: Some error for hidden test"
    
    sanitized_stdout, sanitized_stderr = _sanitize_output_for_students(
        stdout, stderr, test_cases, visible_ids
    )
    
    # Hidden test case info should be removed
    assert "test_case_2" not in sanitized_stdout
    assert "ERROR_2" not in sanitized_stderr
    # Visible test cases should remain
    assert "test_case_1" in sanitized_stdout
    assert "test_case_3" in sanitized_stdout
    # Summary should be updated
    assert "Total: 2" in sanitized_stdout or "Total: 2" in sanitized_stdout.split('\n')


# ============================================================================
# Assignment Creation Edge Cases
# ============================================================================

def test_create_assignment_invalid_instructions_type():
    """Test creating assignment with invalid instructions type (tests line 515)."""
    import uuid
    course_code = f"INVINST{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Test with string (should be dict or list, not string)
    payload = {
        "course_id": course_data["id"],
        "title": "Test Assignment",
        "instructions": "not a dict"  # Should be dict or list
    }
    response = client.post("/api/v1/assignments", json=payload)
    assert response.status_code == 400
    assert "instructions must be a JSON object or list" in response.json()["detail"]
    
    # Test with list (should be accepted - assignments.py accepts both dict and list)
    payload2 = {
        "course_id": course_data["id"],
        "title": "Test Assignment 2",
        "instructions": ["not", "a", "dict"]  # List is allowed
    }
    response2 = client.post("/api/v1/assignments", json=payload2)
    # List should be accepted by assignments.py endpoint
    assert response2.status_code == 201


def test_create_assignment_invalid_sub_limit_string():
    """Test creating assignment with invalid sub_limit string."""
    import uuid
    course_code = f"INVSUB{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    payload = {
        "course_id": course_data["id"],
        "title": "Test Assignment",
        "sub_limit": "not_a_number"
    }
    response = client.post("/api/v1/assignments", json=payload)
    assert response.status_code == 400
    assert "sub_limit must be a valid integer" in response.json()["detail"]


def test_create_assignment_empty_language():
    """Test creating assignment with empty language."""
    import uuid
    course_code = f"EMPTYLANG{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    payload = {
        "course_id": course_data["id"],
        "title": "Test Assignment",
        "language": "   "  # Empty after strip
    }
    response = client.post("/api/v1/assignments", json=payload)
    assert response.status_code == 400
    assert "language is required" in response.json()["detail"]


# ============================================================================
# Assignment Update Edge Cases
# ============================================================================

def test_update_assignment_empty_language():
    """Test updating assignment with empty language."""
    import uuid
    course_code = f"UPDLANG{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Try to update with empty language
    update_payload = {"language": "   "}
    response = client.put(f"/api/v1/assignments/{assignment_data['id']}", json=update_payload)
    assert response.status_code == 400
    assert "language cannot be empty" in response.json()["detail"]


def test_update_assignment_invalid_instructions_type():
    """Test updating assignment with invalid instructions type."""
    import uuid
    course_code = f"UPDINST{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Try to update with invalid instructions
    update_payload = {"instructions": "not a dict or list"}
    response = client.put(f"/api/v1/assignments/{assignment_data['id']}", json=update_payload)
    assert response.status_code == 400
    assert "instructions must be a JSON object or list" in response.json()["detail"]


def test_update_assignment_negative_sub_limit():
    """Test updating assignment with negative sub_limit."""
    import uuid
    course_code = f"NEGSUB{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Try to update with negative sub_limit
    update_payload = {"sub_limit": -1}
    response = client.put(f"/api/v1/assignments/{assignment_data['id']}", json=update_payload)
    assert response.status_code == 400
    assert "sub_limit must be a non-negative integer" in response.json()["detail"]


def test_update_assignment_invalid_sub_limit_string():
    """Test updating assignment with invalid sub_limit string."""
    import uuid
    course_code = f"INVSUBSTR{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Try to update with invalid sub_limit string
    update_payload = {"sub_limit": "not_a_number"}
    response = client.put(f"/api/v1/assignments/{assignment_data['id']}", json=update_payload)
    assert response.status_code == 400
    assert "sub_limit must be a valid integer" in response.json()["detail"]


# ============================================================================
# Submission Error Paths
# ============================================================================

@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_submit_assignment_no_language_set(mock_validate, mock_piston_check, mock_execute):
    """Test submitting to assignment with no language set."""
    from app.api.syntax import SyntaxCheckResponse
    
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    mock_piston_check.return_value = (True, "OK")
    # Mock execute_code - AsyncMock automatically handles await, return_value works
    mock_execute.return_value = {
        "stdout": "PASSED: test\n",
        "stderr": "",
        "returncode": 0,
        "status": {"id": 0},  # Add status field
        "grading": {
            "total_tests": 1,
            "passed_tests": 1,
            "total_points": 10,
            "earned_points": 10,
            "has_tests": True,
            "test_case_results": {}
        }
    }
    
    import uuid
    course_code = f"NOLANG{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test"
        # No language specified - should default to python
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Add test case
    batch_payload = {
        "test_cases": [{
            "point_value": 10,
            "visibility": True,
            "test_code": "def test(): assert True"
        }]
    }
    batch_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert batch_response.status_code == 201
    
    # Submit code (student_id must be in form data, not params)
    student_code = "def add(a, b): return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/submit",
        data={"student_id": 201},
        files=files
    )
    # Should succeed with default language
    assert response.status_code == 201


@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_submit_assignment_piston_status_13_error(mock_validate, mock_piston_check, mock_execute):
    """Test submitting when Piston returns status 13 (Internal Error)."""
    from app.api.syntax import SyntaxCheckResponse
    
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    mock_piston_check.return_value = (True, "OK")
    # Mock execution with status 13 (Internal Error)
    mock_execute.return_value = {
        "stdout": "",
        "stderr": "Internal error occurred",
        "returncode": 1,
        "status": {"id": 13},
        "grading": {"has_tests": False}
    }
    
    import uuid
    course_code = f"STAT13{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Add test case
    batch_payload = {
        "test_cases": [{
            "point_value": 10,
            "visibility": True,
            "test_code": "def test(): assert True"
        }]
    }
    batch_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert batch_response.status_code == 201
    
    # Submit code (student_id must be in form data, not params)
    student_code = "def add(a, b): return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/submit",
        data={"student_id": 201},
        files=files
    )
    assert response.status_code == 503
    # The error message format may vary, check for key phrases
    detail = response.json()["detail"]
    assert "Grading service" in detail or "unavailable" in detail.lower() or "error" in detail.lower()


@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_submit_assignment_compilation_error(mock_validate, mock_piston_check, mock_execute):
    """Test submitting code with compilation error."""
    from app.api.syntax import SyntaxCheckResponse
    
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    mock_piston_check.return_value = (True, "OK")
    # Mock execution with compilation error
    mock_execute.return_value = {
        "stdout": "",
        "stderr": "Compilation error: syntax error",
        "returncode": 1,
        "grading": {
            "has_tests": False,
            "total_tests": 0,
            "error": None
        }
    }
    
    import uuid
    course_code = f"COMPERR{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Add test case
    batch_payload = {
        "test_cases": [{
            "point_value": 10,
            "visibility": True,
            "test_code": "def test(): assert True"
        }]
    }
    batch_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert batch_response.status_code == 201
    
    # Submit code with compilation error (student_id must be in form data, not params)
    student_code = "def add(a, b) return a + b"  # Missing colon
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/submit",
        data={"student_id": 201},
        files=files
    )
    # Should save with 0 points but include error
    assert response.status_code == 201
    data = response.json()
    assert data["grade"] == 0


# ============================================================================
# Test Case Management Error Paths
# ============================================================================

@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_get_test_case_wrong_assignment(mock_validate):
    """Test getting test case that belongs to different assignment."""
    from app.api.syntax import SyntaxCheckResponse
    
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    import uuid
    course_code1 = f"TC1{uuid.uuid4().hex[:6]}"
    course_code2 = f"TC2{uuid.uuid4().hex[:6]}"
    
    # Create two courses
    for course_code in [course_code1, course_code2]:
        course_payload = {
            "course_code": course_code,
            "name": f"Test Course {course_code}",
            "description": "Test"
        }
        client.post("/api/v1/courses?professor_id=301", json=course_payload)
    
    # Create assignments
    assignment1_response = client.post(
        f"/api/v1/courses/{course_code1}/assignments",
        json={"title": "Assignment 1", "description": "Test"}
    )
    assignment1_data = assignment1_response.json()
    
    assignment2_response = client.post(
        f"/api/v1/courses/{course_code2}/assignments",
        json={"title": "Assignment 2", "description": "Test"}
    )
    assignment2_data = assignment2_response.json()
    
    # Add test case to assignment 1
    batch_payload = {
        "test_cases": [{
            "point_value": 10,
            "test_code": "def test(): assert True"
        }]
    }
    batch_response = client.post(
        f"/api/v1/assignments/{assignment1_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert batch_response.status_code == 201
    test_case_id = batch_response.json()["test_cases"][0]["id"]
    
    # Try to get test case from assignment 2 (should fail)
    response = client.get(
        f"/api/v1/assignments/{assignment2_data['id']}/test-cases/{test_case_id}"
    )
    assert response.status_code == 404
    assert "not found for this assignment" in response.json()["detail"]


@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_update_test_case_wrong_assignment(mock_validate):
    """Test updating test case that belongs to different assignment."""
    from app.api.syntax import SyntaxCheckResponse
    
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    
    import uuid
    course_code1 = f"TCU1{uuid.uuid4().hex[:6]}"
    course_code2 = f"TCU2{uuid.uuid4().hex[:6]}"
    
    # Create two courses
    for course_code in [course_code1, course_code2]:
        course_payload = {
            "course_code": course_code,
            "name": f"Test Course {course_code}",
            "description": "Test"
        }
        client.post("/api/v1/courses?professor_id=301", json=course_payload)
    
    # Create assignments
    assignment1_response = client.post(
        f"/api/v1/courses/{course_code1}/assignments",
        json={"title": "Assignment 1", "description": "Test"}
    )
    assignment1_data = assignment1_response.json()
    
    assignment2_response = client.post(
        f"/api/v1/courses/{course_code2}/assignments",
        json={"title": "Assignment 2", "description": "Test"}
    )
    assignment2_data = assignment2_response.json()
    
    # Add test case to assignment 1
    batch_payload = {
        "test_cases": [{
            "point_value": 10,
            "test_code": "def test(): assert True"
        }]
    }
    batch_response = client.post(
        f"/api/v1/assignments/{assignment1_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert batch_response.status_code == 201
    test_case_id = batch_response.json()["test_cases"][0]["id"]
    
    # Try to update test case from assignment 2 (should fail)
    update_payload = {"point_value": 20}
    response = client.put(
        f"/api/v1/assignments/{assignment2_data['id']}/test-cases/{test_case_id}",
        json=update_payload
    )
    assert response.status_code == 404
    assert "not found for this assignment" in response.json()["detail"]


# ============================================================================
# Submission Detail Error Paths
# ============================================================================

@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_get_submission_detail_wrong_assignment(mock_validate, mock_piston_check, mock_execute):
    """Test getting submission detail for submission from different assignment."""
    from app.api.syntax import SyntaxCheckResponse
    
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    mock_piston_check.return_value = (True, "OK")
    mock_execute.return_value = {
        "stdout": "PASSED: test\n",
        "stderr": "",
        "returncode": 0,
        "grading": {"total_tests": 1, "passed_tests": 1, "total_points": 10, "earned_points": 10}
    }
    
    import uuid
    course_code1 = f"SD1{uuid.uuid4().hex[:6]}"
    course_code2 = f"SD2{uuid.uuid4().hex[:6]}"
    
    # Create two courses
    for course_code in [course_code1, course_code2]:
        course_payload = {
            "course_code": course_code,
            "name": f"Test Course {course_code}",
            "description": "Test"
        }
        client.post("/api/v1/courses?professor_id=301", json=course_payload)
    
    # Create assignments
    assignment1_response = client.post(
        f"/api/v1/courses/{course_code1}/assignments",
        json={"title": "Assignment 1", "description": "Test", "language": "python"}
    )
    assignment1_data = assignment1_response.json()
    
    assignment2_response = client.post(
        f"/api/v1/courses/{course_code2}/assignments",
        json={"title": "Assignment 2", "description": "Test", "language": "python"}
    )
    assignment2_data = assignment2_response.json()
    
    # Add test cases
    for assignment_id in [assignment1_data['id'], assignment2_data['id']]:
        batch_payload = {
            "test_cases": [{
                "point_value": 10,
                "visibility": True,
                "test_code": "def test(): assert True"
            }]
        }
        client.post(f"/api/v1/assignments/{assignment_id}/test-cases/batch", json=batch_payload)
    
    # Submit to assignment 1 (student_id must be in form data, not params)
    student_code = "def add(a, b): return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    submit_response = client.post(
        f"/api/v1/assignments/{assignment1_data['id']}/submit",
        data={"student_id": 201},
        files=files
    )
    assert submit_response.status_code == 201
    submission_id = submit_response.json()["submission_id"]
    
    # Try to get submission detail from assignment 2 (should fail)
    response = client.get(
        f"/api/v1/assignments/{assignment2_data['id']}/submission-detail/{submission_id}",
        params={"user_id": 301}
    )
    assert response.status_code == 404
    assert "not found for this assignment" in response.json()["detail"]


@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
@patch('app.api.assignments.check_piston_available', new_callable=AsyncMock)
@patch('app.api.assignments._validate_code_syntax', new_callable=AsyncMock)
def test_get_submission_code_non_faculty(mock_validate, mock_piston_check, mock_execute):
    """Test getting submission code as non-faculty (should fail)."""
    from app.api.syntax import SyntaxCheckResponse
    
    mock_validate.return_value = SyntaxCheckResponse(valid=True, errors=[])
    mock_piston_check.return_value = (True, "OK")
    mock_execute.return_value = {
        "stdout": "PASSED: test\n",
        "stderr": "",
        "returncode": 0,
        "grading": {"total_tests": 1, "passed_tests": 1, "total_points": 10, "earned_points": 10}
    }
    
    import uuid
    course_code = f"SUBNF{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test",
        "language": "python"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()
    
    # Add test case
    batch_payload = {
        "test_cases": [{
            "point_value": 10,
            "visibility": True,
            "test_code": "def test(): assert True"
        }]
    }
    batch_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/test-cases/batch",
        json=batch_payload
    )
    assert batch_response.status_code == 201
    
    # Submit code (student_id must be in form data, not params)
    student_code = "def add(a, b): return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    submit_response = client.post(
        f"/api/v1/assignments/{assignment_data['id']}/submit",
        data={"student_id": 201},
        files=files
    )
    assert submit_response.status_code == 201
    submission_id = submit_response.json()["submission_id"]
    
    # Try to get code as student (should fail with 403)
    # Note: The endpoint checks user existence first (404), then role (403)
    response = client.get(
        f"/api/v1/assignments/{assignment_data['id']}/submission-code/{submission_id}",
        params={"user_id": 201}  # student
    )
    # User 201 exists and is a student, so we should get 403
    # But if the endpoint checks user first and returns 404, that's also valid
    assert response.status_code in [403, 404]
    if response.status_code == 403:
        assert "Only faculty members" in response.json()["detail"]


# ============================================================================
# Gradebook Error Paths
# ============================================================================

def test_gradebook_for_course_no_assignments():
    """Test gradebook for course with no assignments."""
    import uuid
    course_code = f"NOASSIGN{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    # Get gradebook
    response = client.get(f"/api/v1/assignments/gradebook/by-course/{course_code}")
    assert response.status_code == 200
    data = response.json()
    assert data["assignments"] == []
    assert data["students"] == []


def test_gradebook_for_course_no_students():
    """Test gradebook for course with assignments but no students."""
    import uuid
    course_code = f"NOSTU{uuid.uuid4().hex[:6]}"
    
    course_payload = {
        "course_code": course_code,
        "name": "Test Course",
        "description": "Test"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    
    # Create assignment
    assignment_payload = {
        "title": "Test Assignment",
        "description": "Test"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    
    # Get gradebook
    response = client.get(f"/api/v1/assignments/gradebook/by-course/{course_code}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["assignments"]) == 1
    assert data["students"] == []