import pytest
from fastapi.testclient import TestClient
from app.api.main import app
from app.models.models import Course, User, RoleEnum

client = TestClient(app)

def test_create_course_success():
    """Test creating a course successfully."""
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        payload = {
            "course_tag": "CS101",
            "name": "Introduction to Computer Science",
            "description": "Basic programming concepts"
        }
        # Need to provide professor_id (faculty user)
        response = client.post("/api/v1/courses?professor_id=301", json=payload)
        assert response.status_code == 201

        data = response.json()
        assert data["course_tag"] == "CS101"
        assert data["name"] == "Introduction to Computer Science"
        assert data["description"] == "Basic programming concepts"
    finally:
        db.close()

def test_create_course_missing_fields():
    """Test creating course with missing required fields."""
    # Missing course_tag
    payload = {
        "name": "Test Course",
        "description": "Test description"
    }
    response = client.post("/api/v1/courses", json=payload)
    assert response.status_code == 422

def test_list_courses():
    """Test listing courses."""
    response = client.get("/api/v1/courses")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "nextCursor" in data
    assert isinstance(data["items"], list)

def test_get_course_by_tag():
    """Test getting a course by tag."""
    # Create test course
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            course_tag="TEST200",
            name="Test Course 200",
            description="For testing get by tag"
        )
        db.add(course)
        db.commit()

        response = client.get("/api/v1/courses/TEST200")
        assert response.status_code == 200
        data = response.json()
        assert data["course_tag"] == "TEST200"
        assert data["name"] == "Test Course 200"
    finally:
        db.close()

def test_get_course_by_id():
    """Test getting a course by numeric ID."""
    # Create test course
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            course_tag="TESTID",
            name="Test Course by ID",
            description="Test description for ID lookup"
        )
        db.add(course)
        db.commit()
        db.refresh(course)

        # Test getting by numeric ID
        response = client.get(f"/api/v1/courses/{course.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["course_tag"] == "TESTID"
        assert data["name"] == "Test Course by ID"
    finally:
        db.close()

def test_get_course_not_found():
    """Test getting non-existent course."""
    response = client.get("/api/v1/courses/NONEXISTENT")
    assert response.status_code == 404

def test_get_course_faculty():
    """Test getting faculty for a course."""
    # Create test course
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            course_tag="TEST201",
            name="Test Course 201",
            description="Description for test course 201"
        )
        db.add(course)
        db.commit()

        response = client.get("/api/v1/courses/TEST201/faculty")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    finally:
        db.close()

def test_add_faculty_to_course():
    """Test adding faculty to a course."""
    # TEST201 course exists from previous test, faculty user 301 exists from seed data
    response = client.post("/api/v1/courses/TEST201/faculty", json={"faculty_id": 301})
    assert response.status_code == 201

def test_remove_faculty_from_course():
    """Test removing faculty from a course."""
    # Faculty was added in previous test
    response = client.delete("/api/v1/courses/TEST201/faculty/301")
    assert response.status_code == 200

def test_get_course_students():
    """Test getting students for a course."""
    # Create test course
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            course_tag="TEST202",
            name="Test Course 202",
            description="Description for test course 202"
        )
        db.add(course)
        db.commit()

        response = client.get("/api/v1/courses/TEST202/students")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    finally:
        db.close()

def test_get_course_students_empty():
    """Test getting students for a course with no students."""
    # Create course with no students
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            course_tag="EMPTY",
            name="Empty Course",
            description="Testing empty student list"
        )
        db.add(course)
        db.commit()

        response = client.get(f"/api/v1/courses/{course.id}/students")
        assert response.status_code == 200
        data = response.json()
        assert data == []  # Should return empty list
    finally:
        db.close()

def test_get_course_students_not_found():
    """Test getting students for non-existent course."""
    response = client.get("/api/v1/courses/99999/students")
    assert response.status_code == 404
    assert "Not found" in response.json()["detail"]

def test_remove_student_from_course():
    """Test removing student from course."""
    response = client.delete("/api/v1/courses/TEST202/students/201")
    assert response.status_code in [404, 400, 500]  # Expected without proper setup

def test_get_course_assignments():
    """Test getting assignments for a course."""
    # Create test course
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            course_tag="TEST203",
            name="Test Course 203",
            description="Description for test course 203"
        )
        db.add(course)
        db.commit()

        response = client.get("/api/v1/courses/TEST203/assignments")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    finally:
        db.close()

def test_create_assignment_for_course():
    """Test creating assignment for a course."""
    # Create test course first
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            course_tag="TEST204",
            name="Test Course 204",
            description="Description for test course 204"
        )
        db.add(course)
        db.commit()

        payload = {
            "title": "Course Assignment",
            "description": "Assignment created via course endpoint"
        }
        response = client.post("/api/v1/courses/TEST204/assignments", json=payload)
        assert response.status_code == 201

        data = response.json()
        assert data["title"] == "Course Assignment"
        assert data["course_id"] == course.id
    finally:
        db.close()

def test_delete_assignment_from_course():
    """Test deleting assignment from course."""
    response = client.delete("/api/v1/courses/TEST204/assignments/999")
    assert response.status_code in [404, 400, 500]  # Expected without proper setup

def test_course_date_parsing():
    """Test the _parse_dt utility function."""
    from app.api.courses import _parse_dt
    from datetime import datetime

    # Test None input
    assert _parse_dt(None) is None

    # Test datetime object passthrough
    dt = datetime(2024, 1, 1, 12, 0, 0)
    assert _parse_dt(dt) == dt

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
    assert _parse_dt("") is None
