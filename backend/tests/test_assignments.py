import pytest
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

def test_list_assignments():
    """Test listing assignments."""
    response = client.get("/api/v1/assignments")
    assert response.status_code == 200
    # Should return list (may be empty or have assignments from other tests)

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

    # Test by course ID
    response = client.get(f"/api/v1/assignments/by-course/{course_data['id']}")
    assert response.status_code == 200
    assignments = response.json()
    assert len(assignments) >= 1

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

def test_upload_test_file():
    """Test uploading a test file to an assignment."""
    import uuid
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
        "description": "Assignment for testing file uploads"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Upload test file
    test_code = "def test_example():\n    assert True"
    files = {"file": ("test_example.py", test_code.encode(), "text/x-python")}
    response = client.post(f"/api/v1/assignments/{assignment_data['id']}/test-file", files=files)

    assert response.status_code == 201
    data = response.json()
    assert data["ok"] is True
    assert data["assignment_id"] == assignment_data["id"]
    assert "test_case_id" in data

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

def test_submit_assignment():
    """Test submitting code to an assignment."""
    import uuid
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
        "description": "Assignment for submitting code"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Upload test file
    test_code = '''
def test_add():
    assert add(2, 3) == 5
def test_subtract():
    assert subtract(5, 3) == 2
'''
    test_files = {"file": ("test.py", test_code, "text/x-python")}
    test_response = client.post(f"/api/v1/assignments/{assignment_data['id']}/test-file", files=test_files)
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
    assert "id" in data
    assert data["assignment_id"] == assignment_data["id"]
    assert data["student_id"] == 201
    assert "grade" in data
    assert "grading" in data
    assert "result" in data

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


def test_list_assignments():
    """Test listing all assignments."""
    # This tests the GET /api/v1/assignments endpoint
    response = client.get("/api/v1/assignments")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_list_assignments_by_course_not_found():
    """Test listing assignments for non-existent course."""
    # This tests the GET /api/v1/assignments/by-course/{course_key} endpoint
    response = client.get("/api/v1/assignments/by-course/NONEXISTENT")
    assert response.status_code == 200
    data = response.json()
    assert data == []


def test_upload_test_file_invalid_format():
    """Test uploading test file with invalid format."""
    import uuid
    course_code = f"INVALID{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Invalid Test Course",
        "description": "For testing invalid file uploads"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201

    # Create assignment using API
    assignment_payload = {
        "title": "Invalid File Assignment",
        "description": "For testing invalid file uploads"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Try to upload invalid file (not .py)
    files = {"file": ("test.txt", "invalid content", "text/plain")}
    response = client.post(f"/api/v1/assignments/{assignment_data['id']}/test-file", files=files)
    assert response.status_code == 415
    assert "Only .py files are accepted" in response.json()["detail"]


def test_submit_invalid_student():
    """Test submitting assignment with invalid student."""
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


def test_submit_non_student():
    """Test submitting assignment with non-student user."""
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


def test_submit_no_test_file():
    """Test submitting assignment without test file."""
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

    # Try to submit without test file
    student_code = "def add(a, b): return a + b"
    files = {"submission": ("solution.py", student_code.encode(), "text/x-python")}
    response = client.post(f"/api/v1/assignments/{assignment_data['id']}/submit", files=files, data={"student_id": 201})
    assert response.status_code == 409
    assert "No test file attached to this assignment" in response.json()["detail"]


def test_submit_invalid_file_format():
    """Test submitting assignment with invalid file format."""
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
        "description": "For testing invalid file format submission"
    }
    assignment_response = client.post(f"/api/v1/courses/{course_code}/assignments", json=assignment_payload)
    assert assignment_response.status_code == 201
    assignment_data = assignment_response.json()

    # Enroll student
    reg_payload = {"student_id": 201, "course_id": course_response.json()["id"]}
    reg_response = client.post("/api/v1/registrations", json=reg_payload)
    assert reg_response.status_code == 201

    # Upload test file
    test_code = "def test_add(): assert add(2, 3) == 5"
    test_files = {"file": ("test.py", test_code, "text/x-python")}
    test_response = client.post(f"/api/v1/assignments/{assignment_data['id']}/test-file", files=test_files)
    assert test_response.status_code == 201

    # Try to submit with invalid file format (not .py)
    files = {"submission": ("solution.txt", "invalid content", "text/plain")}
    response = client.post(f"/api/v1/assignments/{assignment_data['id']}/submit", files=files, data={"student_id": 201})
    assert response.status_code == 415
    assert "Only .py files are accepted" in response.json()["detail"]


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
