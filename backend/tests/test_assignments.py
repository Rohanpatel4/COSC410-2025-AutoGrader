import pytest
from fastapi.testclient import TestClient
from app.api.main import app
from app.models.models import Course, Assignment, StudentSubmission, TestCase
from datetime import datetime

client = TestClient(app)

def test_create_assignment_success():
    """Test creating assignment successfully."""
    # Create a test course first
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            id=1001,
            course_tag="TEST101",
            name="Test Course",
            description="Course for testing assignments"
        )
        db.add(course)
        db.commit()

        payload = {
            "course_id": 1001,
            "title": "Test Assignment",
            "description": "Test description",
            "sub_limit": 3
        }
        response = client.post("/api/v1/assignments", json=payload)
        assert response.status_code == 201

        data = response.json()
        assert data["title"] == "Test Assignment"
        assert data["description"] == "Test description"
        assert data["course_id"] == 1001
        assert data["sub_limit"] == 3
        assert "id" in data
    finally:
        db.close()

def test_list_assignments():
    """Test listing assignments."""
    response = client.get("/api/v1/assignments")
    assert response.status_code == 200
    # Should return list (may be empty or have assignments from other tests)

def test_list_assignments_by_course():
    """Test listing assignments for a specific course."""
    # Create test data in a separate transaction
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            id=1002,
            course_tag="TEST102",
            name="Test Course 2",
            description="Description for test course 2"
        )
        db.add(course)
        db.commit()

        assignment = Assignment(
            course_id=1002,
            title="Course Assignment",
            description="Assignment for course"
        )
        db.add(assignment)
        db.commit()
        assignment_id = assignment.id

        # Test the endpoint
        response = client.get("/api/v1/assignments/by-course/TEST102")
        assert response.status_code == 200
        assignments = response.json()
        assert len(assignments) >= 1
        assert any(a["title"] == "Course Assignment" for a in assignments)

        # Test by course ID
        response = client.get("/api/v1/assignments/by-course/1002")
        assert response.status_code == 200
        assignments = response.json()
        assert len(assignments) >= 1

    finally:
        db.close()

def test_get_assignment():
    """Test getting a specific assignment."""
    # Create test data
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(id=1003, course_tag="TEST103", name="Test Course 3", description="Description for test course 3")
        db.add(course)
        db.commit()

        assignment = Assignment(
            course_id=1003,
            title="Specific Assignment",
            description="For getting test"
        )
        db.add(assignment)
        db.commit()

        # Test getting the assignment
        response = client.get(f"/api/v1/assignments/{assignment.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Specific Assignment"
        assert data["course_id"] == 1003

    finally:
        db.close()

def test_delete_assignment():
    """Test deleting an assignment."""
    # Create test data
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(id=1004, course_tag="TEST104", name="Test Course 4", description="Description for test course 4")
        db.add(course)
        db.commit()

        assignment = Assignment(
            course_id=1004,
            title="Delete Me",
            description="Assignment to delete"
        )
        db.add(assignment)
        db.commit()

        assignment_id = assignment.id

        # Delete the assignment
        response = client.delete(f"/api/v1/assignments/{assignment_id}")
        assert response.status_code == 200
        assert response.json()["ok"] is True

        # Verify it's gone
        response = client.get(f"/api/v1/assignments/{assignment_id}")
        assert response.status_code == 404

    finally:
        db.close()

def test_upload_test_file():
    """Test uploading a test file to an assignment."""
    # Create test data
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(id=1005, course_tag="TEST105", name="Test Course 5", description="Description for test course 5")
        db.add(course)
        db.commit()

        assignment = Assignment(
            course_id=1005,
            title="Test File Assignment",
            description="Assignment for testing file uploads"
        )
        db.add(assignment)
        db.commit()

        # Upload test file
        test_code = "def test_example():\n    assert True"
        files = {"file": ("test_example.py", test_code.encode(), "text/x-python")}
        response = client.post(f"/api/v1/assignments/{assignment.id}/test-file", files=files)

        assert response.status_code == 201
        data = response.json()
        assert data["ok"] is True
        assert data["assignment_id"] == assignment.id
        assert "test_case_id" in data

    finally:
        db.close()

def test_list_attempts():
    """Test listing attempts for an assignment."""
    # Create test data
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(id=1006, course_tag="TEST106", name="Test Course 6", description="Description for test course 6")
        db.add(course)
        db.commit()

        assignment = Assignment(course_id=1006, title="Attempts Assignment", description="Assignment for listing attempts")
        db.add(assignment)
        db.commit()

        # Test listing attempts (should be empty)
        response = client.get(f"/api/v1/assignments/{assignment.id}/attempts?student_id=201")
        assert response.status_code == 200
        attempts = response.json()
        assert isinstance(attempts, list)

    finally:
        db.close()

def test_submit_assignment():
    """Test submitting code to an assignment."""
    # Create test data
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(id=1007, course_tag="TEST107", name="Test Course 7", description="Description for test course 7")
        db.add(course)
        db.commit()

        assignment = Assignment(course_id=1007, title="Submit Assignment", description="Assignment for submitting code")
        db.add(assignment)
        db.commit()

        # Add test case with proper pytest functions
        test_code = '''
def test_add():
    """Test the add function with various inputs."""
    assert add(2, 3) == 5
    assert add(-1, 1) == 0
    assert add(0, 0) == 0

def test_subtract():
    """Test the subtract function with various inputs."""
    assert subtract(5, 3) == 2
    assert subtract(-1, 1) == -2

def test_multiply():
    """Test the multiply function with various inputs."""
    assert multiply(2, 3) == 6
    assert multiply(-2, 3) == -6

def test_divide():
    """Test the divide function with various inputs."""
    assert divide(6, 2) == 3
    assert divide(-6, 2) == -3

def test_divide_by_zero():
    """Test that divide raises ZeroDivisionError when dividing by zero."""
    try:
        divide(5, 0)
        raise AssertionError("Expected ZeroDivisionError")
    except ZeroDivisionError:
        pass  # This is expected
'''
        test_case = TestCase(assignment_id=assignment.id, var_char=test_code)
        db.add(test_case)
        db.commit()

        # Submit student code
        student_code = "def add(a, b):\n    return a + b\n\ndef subtract(a, b):\n    return a - b\n\ndef multiply(a, b):\n    return a * b\n\ndef divide(a, b):\n    if b == 0:\n        raise ZeroDivisionError('Cannot divide by zero')\n    return a / b"
        files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
        data = {"student_id": "201"}

        response = client.post(f"/api/v1/assignments/{assignment.id}/submit", files=files, data=data)
        if response.status_code != 201:
            print(f"Error response: {response.text}")
        assert response.status_code == 201

        data = response.json()
        assert "id" in data
        assert data["assignment_id"] == assignment.id
        assert data["student_id"] == 201
        assert "grade" in data
        assert "grading" in data
        assert "result" in data

    finally:
        db.close()

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
    # Create test course first
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            course_tag="DATE101",
            name="Date Test Course",
            description="Testing date handling"
        )
        db.add(course)
        db.commit()

        payload = {
            "course_id": course.id,
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

    finally:
        db.close()

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
    """Test uploading test file to invalid assignment ID."""
    files = {"file": ("test.py", b"print('test')", "text/x-python")}
    response = client.post("/api/v1/assignments/99999/test-file", files=files)
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

def test_submit_invalid_assignment():
    """Test submitting to invalid assignment."""
    files = {"submission": ("code.py", b"print('hello')", "text/x-python")}
    data = {"student_id": "201"}
    response = client.post("/api/v1/assignments/99999/submit", files=files, data=data)
    assert response.status_code == 404
    error_data = response.json()
    assert "detail" in error_data
    assert "Assignment not found" in error_data["detail"]
