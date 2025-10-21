import pytest
from fastapi.testclient import TestClient
from app.api.main import app
from app.models.models import Course, user_course_association
# StudentRegistration DEPRECATED - now using user_course_association

client = TestClient(app)

def test_create_registration_success():
    """Test creating a student registration successfully."""
    # Create test course first
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            course_tag="REG101",
            name="Registration Test Course",
            description="Course for registration testing"
        )
        db.add(course)
        db.commit()

        # Create registration
        payload = {
            "student_id": 201,  # alice from seed data
            "course_id": course.id
        }
        response = client.post("/api/v1/registrations", json=payload)
        assert response.status_code == 201

        data = response.json()
        assert "id" in data
        assert data["student_id"] == 201
        assert data["course_id"] == course.id

    finally:
        db.close()

def test_create_registration_invalid_student():
    """Test creating registration with invalid student ID."""
    payload = {
        "student_id": 99999,  # Non-existent student
        "course_id": 1
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 404

def test_create_registration_invalid_course():
    """Test creating registration with invalid course ID."""
    payload = {
        "student_id": 201,
        "course_id": 99999  # Non-existent course
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 404

def test_create_registration_duplicate():
    """Test creating duplicate registration (should fail)."""
    # Create test course first
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            course_tag="REG102",
            name="Duplicate Registration Test",
            description="Testing duplicate registration prevention"
        )
        db.add(course)
        db.commit()

        # Create first registration
        payload = {
            "student_id": 201,
            "course_id": course.id
        }
        response1 = client.post("/api/v1/registrations", json=payload)
        assert response1.status_code == 201

        # Try to create duplicate
        response2 = client.post("/api/v1/registrations", json=payload)
        assert response2.status_code == 409  # Conflict

    finally:
        db.close()

def test_get_student_courses():
    """Test getting courses for a student."""
    # Create test course and registration
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            course_tag="REG103",
            name="Student Courses Test",
            description="Testing student course retrieval"
        )
        db.add(course)
        db.commit()

        # Create enrollment via user_course_association
        db.execute(
            user_course_association.insert().values(
                user_id=202,  # bob from seed data
                course_id=course.id
            )
        )
        db.commit()

        # Get student courses
        response = client.get("/api/v1/students/202/courses")
        assert response.status_code == 200

        courses = response.json()
        assert isinstance(courses, list)
        assert len(courses) >= 1

        # Check that our course is in the list
        course_tags = [c["course_tag"] for c in courses]
        assert "REG103" in course_tags

    finally:
        db.close()

def test_get_student_courses_empty():
    """Test getting courses for a student with no registrations."""
    # Use a student ID that doesn't exist in registrations
    response = client.get("/api/v1/students/999/courses")
    assert response.status_code == 200
    assert response.json() == []

def test_create_registration_faculty_allowed():
    """Test that faculty users can also register for courses."""
    # Create test course first
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            course_tag="REG104",
            name="Role Test Course",
            description="Testing that faculty can register"
        )
        db.add(course)
        db.commit()

        # Register faculty user (API allows any valid user to register)
        payload = {
            "student_id": 301,  # prof.x from seed data (faculty)
            "course_id": course.id
        }
        response = client.post("/api/v1/registrations", json=payload)
        assert response.status_code == 201

        data = response.json()
        assert data["student_id"] == 301
        assert data["course_id"] == course.id

    finally:
        db.close()

def test_create_registration_by_course_tag():
    """Test creating registration using course_tag instead of course_id."""
    # Create test course first
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        course = Course(
            course_tag="REGTAG",
            name="Registration by Tag Course",
            description="Testing registration by course tag"
        )
        db.add(course)
        db.commit()

        # Create registration using course_tag
        payload = {
            "student_id": 201,  # alice from seed data
            "course_tag": "REGTAG"
        }
        response = client.post("/api/v1/registrations", json=payload)
        assert response.status_code == 201

        data = response.json()
        assert data["student_id"] == 201
        assert data["course_id"] == course.id

    finally:
        db.close()
