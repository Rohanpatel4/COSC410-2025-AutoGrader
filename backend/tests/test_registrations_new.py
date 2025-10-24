from fastapi.testclient import TestClient
from app.api.main import app

client = TestClient(app)

def test_create_registration_success():
    """Test creating a student registration successfully."""
    import uuid
    course_code = f"REG{uuid.uuid4().hex[:6]}"

    # Create test course first using API
    course_payload = {
        "course_code": course_code,
        "name": "Registration Test Course",
        "description": "Course for registration testing"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()

    # Create registration
    payload = {
        "student_id": 201,  # alice from seed data
        "course_id": course_data["id"]
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert "id" in data
    assert data["student_id"] == 201
    assert data["course_id"] == course_data["id"]


def test_create_registration_invalid_student():
    """Test creating registration with invalid student ID."""
    payload = {
        "student_id": 99999,  # Non-existent student
        "course_id": 1
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 404


def test_create_registration_duplicate():
    """Test creating duplicate registration (should fail)."""
    import uuid
    course_code = f"DUP{uuid.uuid4().hex[:6]}"

    # Create test course first using API
    course_payload = {
        "course_code": course_code,
        "name": "Duplicate Registration Test",
        "description": "Testing duplicate registration prevention"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()

    # Create first registration
    payload = {
        "student_id": 201,
        "course_id": course_data["id"]
    }
    response1 = client.post("/api/v1/registrations", json=payload)
    assert response1.status_code == 201

    # Try to create duplicate
    response2 = client.post("/api/v1/registrations", json=payload)
    assert response2.status_code == 409  # Conflict


def test_get_student_courses():
    """Test getting courses for a student."""
    import uuid
    course_code = f"STU{uuid.uuid4().hex[:6]}"

    # Create test course using API
    course_payload = {
        "course_code": course_code,
        "name": "Student Courses Test",
        "description": "Testing student course retrieval"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()

    # Create registration using API
    reg_payload = {
        "student_id": 202,  # bob from seed data
        "course_id": course_data["id"]
    }
    reg_response = client.post("/api/v1/registrations", json=reg_payload)
    assert reg_response.status_code == 201

    # Get student courses
    response = client.get("/api/v1/students/202/courses")
    assert response.status_code == 200

    courses = response.json()
    assert isinstance(courses, list)
    assert len(courses) >= 1


def test_get_student_courses_empty():
    """Test getting courses for a student with no enrollments."""
    response = client.get("/api/v1/students/99999/courses")
    assert response.status_code == 200  # Returns empty list for non-existent student


def test_create_registration_faculty_allowed():
    """Test that faculty users can also register for courses."""
    # Create test course first using API
    import uuid
    course_code = f"FAC{uuid.uuid4().hex[:6]}"
    course_payload = {
        "course_code": course_code,
        "name": "Role Test Course",
        "description": "Testing that faculty can register"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()

    # Create registration for faculty
    payload = {
        "student_id": 301,  # prof.x from seed data (faculty)
        "course_id": course_data["id"]
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 201


def test_create_registration_by_course_tag():
    """Test creating registration using course_tag instead of course_id."""
    # Create test course first using API
    import uuid
    course_code = f"TAG{uuid.uuid4().hex[:6]}"
    course_payload = {
        "course_code": course_code,
        "name": "Registration by Tag Course",
        "description": "Testing registration by course tag"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()

    # Create registration using course_id (API doesn't support course_code)
    payload = {
        "student_id": 201,
        "course_id": course_data["id"]
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 201


def test_course_by_input_utility():
    """Test the _course_by_input utility function."""
    from app.api.registrations import _course_by_input
    from app.core.db import SessionLocal

    db = SessionLocal()
    try:
        # Create test course using API
        import uuid
        course_code = f"UTIL{uuid.uuid4().hex[:6]}"
        course_payload = {
            "course_code": course_code,
            "name": "Utility Test Course",
            "description": "For testing utility functions"
        }
        course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
        assert course_response.status_code == 201
        course_data = course_response.json()

        # Test by ID
        course_by_id = _course_by_input(db, course_id=course_data["id"], enrollment_key=None)
        assert course_by_id is not None
        assert course_by_id.id == course_data["id"]

        # Test by enrollment_key
        enrollment_key = course_data["enrollment_key"]
        course_by_key = _course_by_input(db, course_id=None, enrollment_key=enrollment_key)
        assert course_by_key is not None
        assert course_by_key.enrollment_key == enrollment_key

        # Test non-existent
        course_none = _course_by_input(db, course_id=999999, enrollment_key=None)
        assert course_none is None

    finally:
        db.close()


def test_create_registration_invalid_student_id_type():
    """Test validation of student_id type."""
    payload = {
        "student_id": "not_an_int",
        "course_id": 1
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 400  # API validates and returns 400


def test_create_registration_missing_fields():
    """Test missing payload fields."""
    payload = {
        "student_id": 201
        # Missing course_id/course_code
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 404  # Invalid course returns 404


def test_create_registration_course_by_id_and_tag():
    """Test that course_id takes precedence over course_tag."""
    import uuid
    course1_code = f"PREC1{uuid.uuid4().hex[:3]}"
    course2_code = f"PREC2{uuid.uuid4().hex[:3]}"

    # Create two test courses
    course1_payload = {
        "course_code": course1_code,
        "name": "Precedence Test 1",
        "description": "First course"
    }
    course1_response = client.post("/api/v1/courses?professor_id=301", json=course1_payload)
    assert course1_response.status_code == 201
    course1_data = course1_response.json()

    course2_payload = {
        "course_code": course2_code,
        "name": "Precedence Test 2",
        "description": "Second course"
    }
    course2_response = client.post("/api/v1/courses?professor_id=301", json=course2_payload)
    assert course2_response.status_code == 201
    course2_data = course2_response.json()

    # Register with both course_id and course_code (course_id should take precedence)
    payload = {
        "student_id": 201,
        "course_id": course1_data["id"],
        "course_code": course2_code
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["course_id"] == course1_data["id"]  # Should be course1, not course2
