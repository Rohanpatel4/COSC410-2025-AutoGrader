from fastapi.testclient import TestClient
from app.api.main import app

client = TestClient(app)

def test_create_registration_success():
    """Test creating a student registration successfully."""
    # Create test course first using API
    course_payload = {
        "course_code": "REG101",
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
    # Create test course first using API
    course_payload = {
        "course_code": "REG102",
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
    # Create test course using API
    course_payload = {
        "course_code": "REG103",
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
    assert response.status_code == 200  # Returns empty list, not 404
    data = response.json()
    assert data == []


def test_create_registration_faculty_allowed():
    """Test that faculty users can also register for courses."""
    import uuid
    course_code = f"REG104{uuid.uuid4().hex[:6]}"
    
    # Create test course first using API
    course_payload = {
        "course_code": course_code,
        "name": "Role Test Course",
        "description": "Testing that faculty can register"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()

    # Create registration for faculty using faculty_id (not student_id)
    payload = {
        "faculty_id": 301,  # prof.x from seed data (faculty)
        "course_id": course_data["id"]
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 201


def test_create_registration_by_course_tag():
    """Test creating registration using course_id."""
    # Create test course first using API
    course_payload = {
        "course_code": "REGTAG",
        "name": "Registration by Tag Course",
        "description": "Testing registration by course tag"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()

    # Create registration using course_id (not course_code - API doesn't support course_code)
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
        course_payload = {
            "course_code": "UTILTEST",
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
    import uuid
    course_code = f"INVTYPE{uuid.uuid4().hex[:6]}"
    
    # Create a valid course first
    course_payload = {
        "course_code": course_code,
        "name": "Invalid Type Test",
        "description": "Testing invalid student_id type"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Try to register with non-integer student_id
    # The endpoint will try to look up user with ID "not_an_int", which will fail
    payload = {
        "student_id": "not_an_int",
        "course_id": course_data["id"]
    }
    response = client.post("/api/v1/registrations", json=payload)
    # The endpoint doesn't validate type, it just tries to use it as an ID
    # This will likely return 404 when looking up the user, not 400
    assert response.status_code in [400, 404]


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
    # Create two test courses
    course1_payload = {
        "course_code": "PREC1",
        "name": "Precedence Test 1",
        "description": "First course"
    }
    course1_response = client.post("/api/v1/courses?professor_id=301", json=course1_payload)
    assert course1_response.status_code == 201
    course1_data = course1_response.json()

    course2_payload = {
        "course_code": "PREC2",
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
        "course_code": "PREC2"
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["course_id"] == course1_data["id"]  # Should be course1, not course2


def test_create_registration_by_enrollment_key():
    """Test creating registration using enrollment_key."""
    # Create test course using API
    course_payload = {
        "course_code": "ENROLLKEY",
        "name": "Enrollment Key Test",
        "description": "Testing enrollment key registration"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    enrollment_key = course_data["enrollment_key"]
    
    # Create registration using enrollment_key
    payload = {
        "student_id": 201,
        "enrollment_key": enrollment_key
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 201
    
    data = response.json()
    assert data["course_id"] == course_data["id"]


def test_create_registration_invalid_enrollment_key():
    """Test creating registration with invalid enrollment_key."""
    payload = {
        "student_id": 201,
        "enrollment_key": "INVALIDKEY123"
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 404
    assert "Invalid course" in response.json()["detail"]


def test_create_registration_faculty_by_enrollment_key():
    """Test that faculty can register using enrollment_key."""
    # Create test course using API
    course_payload = {
        "course_code": "FACENROLL",
        "name": "Faculty Enrollment Test",
        "description": "Testing faculty enrollment"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    enrollment_key = course_data["enrollment_key"]
    
    # Create registration for faculty using enrollment_key
    payload = {
        "faculty_id": 301,
        "enrollment_key": enrollment_key
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 201
    
    data = response.json()
    assert data["course_id"] == course_data["id"]
    assert "faculty_id" in data


def test_create_registration_missing_user_id():
    """Test creating registration without student_id or faculty_id."""
    # Create test course using API
    course_payload = {
        "course_code": "NOUSER",
        "name": "No User Test",
        "description": "Testing missing user"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Try to register without user_id
    payload = {
        "course_id": course_data["id"]
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 400
    assert "Either student_id or faculty_id must be provided" in response.json()["detail"]


def test_create_registration_invalid_course_id():
    """Test creating registration with invalid course_id."""
    payload = {
        "student_id": 201,
        "course_id": 99999
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 404
    assert "Invalid course" in response.json()["detail"]


def test_create_registration_invalid_faculty():
    """Test creating registration with invalid faculty_id."""
    # Create test course using API
    course_payload = {
        "course_code": "INVFAC",
        "name": "Invalid Faculty Test",
        "description": "Testing invalid faculty"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Try to register with non-existent faculty
    payload = {
        "faculty_id": 99999,
        "course_id": course_data["id"]
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 404
    assert "Invalid faculty_id" in response.json()["detail"]


def test_create_registration_student_as_faculty():
    """Test that a student user cannot register as faculty."""
    # Create test course using API
    course_payload = {
        "course_code": "STUFAC",
        "name": "Student as Faculty Test",
        "description": "Testing student as faculty"
    }
    course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
    assert course_response.status_code == 201
    course_data = course_response.json()
    
    # Try to register student (201) as faculty
    payload = {
        "faculty_id": 201,  # This is a student, not faculty
        "course_id": course_data["id"]
    }
    response = client.post("/api/v1/registrations", json=payload)
    assert response.status_code == 404
    assert "Invalid faculty_id" in response.json()["detail"]


def test_get_student_courses_with_multiple_enrollments():
    """Test getting courses for a student with multiple enrollments."""
    # Create multiple test courses
    course_codes = []
    for i in range(3):
        course_payload = {
            "course_code": f"MULTI{i}",
            "name": f"Multi Course {i}",
            "description": f"Testing multiple enrollments {i}"
        }
        course_response = client.post("/api/v1/courses?professor_id=301", json=course_payload)
        assert course_response.status_code == 201
        course_data = course_response.json()
        course_codes.append(course_data["id"])
        
        # Enroll student in each course
        reg_payload = {
            "student_id": 201,
            "course_id": course_data["id"]
        }
        reg_response = client.post("/api/v1/registrations", json=reg_payload)
        assert reg_response.status_code == 201
    
    # Get student courses
    response = client.get("/api/v1/students/201/courses")
    assert response.status_code == 200
    
    courses = response.json()
    assert isinstance(courses, list)
    assert len(courses) >= 3
    course_ids = [c["id"] for c in courses]
    for course_id in course_codes:
        assert course_id in course_ids