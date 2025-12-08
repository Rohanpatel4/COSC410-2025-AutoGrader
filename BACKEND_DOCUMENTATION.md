# AutoGrader Backend Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Database Models](#database-models)
3. [API Routes & Endpoints](#api-routes--endpoints)
4. [Authentication & Authorization](#authentication--authorization)
5. [Code Execution System](#code-execution-system)
6. [Services & Utilities](#services--utilities)
7. [Request/Response Flow](#requestresponse-flow)
8. [Configuration](#configuration)

---

## Architecture Overview

The AutoGrader backend is built using **FastAPI**, a modern Python web framework. The architecture follows a layered approach:

```
┌─────────────────────────────────────────┐
│         FastAPI Application             │
│         (app/api/main.py)               │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────────┐    ┌───────▼────────┐
│ API Routes │    │  Middleware    │
│ (Routers)  │    │  (CORS, etc.)  │
└───┬────────┘    └────────────────┘
    │
┌───▼─────────────────────────────────────┐
│         Business Logic Layer            │
│  - Route Handlers                       │
│  - Validation                           │
│  - Authorization Checks                 │
└───┬─────────────────────────────────────┘
    │
┌───▼─────────────────────────────────────┐
│         Service Layer                   │
│  - Piston Integration (Code Execution)  │
│  - File Conversion                      │
└───┬─────────────────────────────────────┘
    │
┌───▼─────────────────────────────────────┐
│         Data Access Layer               │
│  - SQLAlchemy ORM                       │
│  - Database Models                      │
│  - Session Management                   │
└───┬─────────────────────────────────────┘
    │
┌───▼────────┐
│  Database  │
│  (SQLite)  │
└────────────┘
```

### Key Components

- **FastAPI Application**: Entry point defined in `app/api/main.py`
- **API Routers**: Modular route handlers in `app/api/`
- **Database Models**: SQLAlchemy ORM models in `app/models/models.py`
- **Services**: External integrations (Piston) in `app/services/`
- **Schemas**: Pydantic models for request/response validation in `app/schemas/`

---

## Database Models

### Entity Relationship Diagram

```
┌─────────────┐         ┌──────────────────────────┐         ┌──────────────┐
│    User     │────────▶│ user_course_association  │◀────────│   Course     │
│             │         │  (Many-to-Many)          │         │              │
└─────────────┘         └──────────────────────────┘         └──────┬───────┘
     │                                                                 │
     │                                                                 │
     │                                                                 │
     │                                                        ┌────────▼────────┐
     │                                                        │   Assignment    │
     │                                                        └────────┬────────┘
     │                                                                 │
     │                                                        ┌────────▼────────┐
     │                                                        │   TestCase      │
     │                                                        └─────────────────┘
     │
     │
┌────▼──────────────────┐
│  StudentSubmission    │
│  (Attempts)           │
└───────────────────────┘
```

### Model Details

#### 1. User Model
**Location**: `app/models/models.py:21-33`

```python
class User(Base):
    id: int                    # Primary key
    username: str              # Unique username (email)
    role: RoleEnum             # student, faculty, or admin
    password_hash: str         # Hashed password (pbkdf2_sha256)
    created_at: datetime       # Account creation timestamp
    courses: relationship      # Many-to-many with Course
```

**Relationships**:
- Many-to-many with `Course` via `user_course_association` table
- One-to-many with `StudentSubmission` (student submissions)

**Role Enum**:
- `student`: Can enroll in courses, submit assignments
- `faculty`: Can create courses, manage assignments, view submissions
- `admin`: (Reserved for future use)

#### 2. Course Model
**Location**: `app/models/models.py:35-50`

```python
class Course(Base):
    id: int                    # Primary key
    course_code: str           # e.g., "COSC410"
    enrollment_key: str        # Unique enrollment code (12-char A-Z0-9)
    name: str                  # Course name
    description: str           # Course description (Text field)
    professors: relationship   # Many-to-many with User (faculty)
    assignments: relationship  # One-to-many with Assignment
```

**Key Features**:
- Auto-generates unique `enrollment_key` on creation
- Cascading delete: Deleting a course deletes all assignments

#### 3. Assignment Model
**Location**: `app/models/models.py:52-67`

```python
class Assignment(Base):
    id: int                    # Primary key
    title: str                 # Assignment title
    description: str           # Assignment description
    course_id: int             # Foreign key to Course
    language: str              # Programming language (default: "python")
    sub_limit: int | None      # Submission limit (None = unlimited)
    start: datetime | None     # Assignment start time
    stop: datetime | None      # Assignment end time
    instructions: dict | list  # JSON field for rich text instructions
    course: relationship       # Many-to-one with Course
    test_cases: relationship   # One-to-many with TestCase
```

**Key Features**:
- Supports multiple programming languages
- Optional time windows (start/stop dates)
- Optional submission limits
- Rich text instructions stored as JSON (Tiptap format)

#### 4. TestCase Model
**Location**: `app/models/models.py:69-78`

```python
class TestCase(Base):
    id: int                    # Primary key
    assignment_id: int         # Foreign key to Assignment
    point_value: int           # Points awarded for passing
    visibility: bool           # Visible to students? (default: True)
    test_code: str             # Test code (Text field)
    order: int | None          # Optional ordering
    created_at: datetime       # Creation timestamp
    assignment: relationship   # Many-to-one with Assignment
```

**Key Features**:
- Supports hidden test cases (`visibility: False`)
- Each test case has a point value
- Test code is language-specific (Python assert, Java assertions, etc.)
- Cascading delete when assignment is deleted

#### 5. StudentSubmission Model
**Location**: `app/models/models.py:80-89`

```python
class StudentSubmission(Base):
    id: int                    # Primary key
    student_id: int            # Foreign key to User
    assignment_id: int         # Foreign key to Assignment
    earned_points: int | None  # Points earned (calculated from test results)
    code: str | None           # Student's submitted code
    created_at: datetime       # Submission timestamp
    student: relationship      # Many-to-one with User
    assignment: relationship   # Many-to-one with Assignment
```

**Key Features**:
- Stores student code and calculated grade
- Multiple submissions per assignment allowed
- No cascading delete (preserves submission history)

#### 6. user_course_association Table
**Location**: `app/models/models.py:7-14`

Many-to-many join table connecting Users and Courses:
- Supports both student enrollments and faculty course assignments
- Unique constraint on `(user_id, course_id)` pair
- Cascading delete: Removing user/course removes associations

---

## API Routes & Endpoints

### Route Organization

Routes are organized into separate router modules under `app/api/`:

1. **Login Routes** (`LoginPage.py`) - `/api/v1/login`
2. **Course Routes** (`courses.py`) - `/api/v1/courses`
3. **Assignment Routes** (`assignments.py`) - `/api/v1/assignments`
4. **Registration Routes** (`registrations.py`) - `/api/v1/registrations`
5. **Attempt Routes** (`attempt_submission_test.py`) - `/api/v1/attempts`
6. **Language Routes** (`languages.py`) - `/api/v1/languages`
7. **Syntax Routes** (`syntax.py`) - `/api/v1/syntax` (currently disabled)

### Endpoint Catalog

#### Authentication Endpoints

**POST `/api/v1/login`**
- **Purpose**: User authentication
- **Request Body**: `{ username, password, role }`
- **Response**: `{ user_id, userId, role, status, token, username, email }`
- **Auth**: None required
- **Location**: `app/api/LoginPage.py:16-77`

**Flow**:
1. Validates username, password, and role
2. Looks up user by username
3. Verifies password hash using `pbkdf2_sha256`
4. Verifies user role matches request
5. Returns user info (no JWT token - session-based via headers)

#### Course Management Endpoints

**POST `/api/v1/courses`**
- **Purpose**: Create a new course
- **Request Body**: `{ course_code, name, description? }`
- **Headers**: `X-User-Id`, `X-User-Role` (faculty required)
- **Response**: `{ id, course_code, enrollment_key, name, description }`
- **Location**: `app/api/courses.py:111-160`

**Key Logic**:
- Auto-generates unique 12-character enrollment key
- Auto-associates creator (faculty) with the course
- Checks for duplicate course codes

**GET `/api/v1/courses`**
- **Purpose**: List all courses (with optional filtering)
- **Query Params**: `professor_id?`, `q?`, `limit?`
- **Response**: `{ items: Course[], nextCursor: null }`
- **Location**: `app/api/courses.py:163-204`

**GET `/api/v1/courses/{course_key}`**
- **Purpose**: Get course details by ID or course_code
- **Response**: `{ id, course_code, enrollment_key, name, description }`
- **Location**: `app/api/courses.py:265-276`

**GET `/api/v1/courses/faculty/{faculty_id}`**
- **Purpose**: List courses for a specific faculty member
- **Response**: `Course[]`
- **Location**: `app/api/courses.py:208-231`

**GET `/api/v1/courses/students/{student_id}`**
- **Purpose**: List courses for a specific student
- **Response**: `Course[]`
- **Location**: `app/api/courses.py:235-262`

**GET `/api/v1/courses/{course_key}/faculty`**
- **Purpose**: List faculty members for a course
- **Response**: `[{ id, name }]`
- **Location**: `app/api/courses.py:280-302`

**POST `/api/v1/courses/{course_key}/faculty`**
- **Purpose**: Add co-instructor to a course
- **Request Body**: `{ faculty_id: int }`
- **Location**: `app/api/courses.py:305-340`

**DELETE `/api/v1/courses/{course_key}/faculty/{faculty_id}`**
- **Purpose**: Remove co-instructor from a course
- **Location**: `app/api/courses.py:343-364`

**GET `/api/v1/courses/{course_key}/students`**
- **Purpose**: List enrolled students for a course
- **Response**: `[{ id, name }]`
- **Location**: `app/api/courses.py:368-390`

**DELETE `/api/v1/courses/{course_key}/students/{student_id}`**
- **Purpose**: Remove student from course (with cascade deletion of submissions)
- **Location**: `app/api/courses.py:393-443`

**GET `/api/v1/courses/{course_key}/assignments`**
- **Purpose**: List assignments for a course
- **Query Params**: `student_id?` (for attempt counts)
- **Response**: `Assignment[]` (with attempt counts and total points)
- **Location**: `app/api/courses.py:447-484`

**POST `/api/v1/courses/{course_key}/assignments`**
- **Purpose**: Create an assignment for a course
- **Request Body**: `{ title, description?, language?, sub_limit?, start?, stop?, instructions? }`
- **Response**: `Assignment`
- **Location**: `app/api/courses.py:487-550`

**DELETE `/api/v1/courses/{course_key}/assignments/{assignment_id}`**
- **Purpose**: Delete an assignment (cascades to test cases and submissions)
- **Location**: `app/api/courses.py:553-590`

#### Assignment Management Endpoints

**GET `/api/v1/assignments`**
- **Purpose**: List all assignments
- **Response**: `Assignment[]`
- **Location**: `app/api/assignments.py:236-239`

**GET `/api/v1/assignments/by-course/{course_key}`**
- **Purpose**: List assignments for a course (by course ID or code)
- **Response**: `Assignment[]`
- **Location**: `app/api/assignments.py:241-247`

**GET `/api/v1/assignments/{assignment_id}`**
- **Purpose**: Get assignment details
- **Response**: `Assignment`
- **Location**: `app/api/assignments.py:251-256`

**POST `/api/v1/assignments`**
- **Purpose**: Create an assignment (standalone, not under course route)
- **Request Body**: `{ course_id, title, description?, language?, sub_limit?, start?, stop?, instructions? }`
- **Response**: `Assignment`
- **Location**: `app/api/assignments.py:260-322`

**PUT `/api/v1/assignments/{assignment_id}`**
- **Purpose**: Update an assignment (partial update)
- **Request Body**: Any subset of assignment fields
- **Response**: `Assignment`
- **Location**: `app/api/assignments.py:356-432`

**DELETE `/api/v1/assignments/{assignment_id}`**
- **Purpose**: Delete an assignment
- **Location**: `app/api/assignments.py:324-353`

#### Test Case Management Endpoints

**POST `/api/v1/assignments/{assignment_id}/test-cases/batch`**
- **Purpose**: Create multiple test cases at once (replaces existing)
- **Request Body**: `{ test_cases: [{ point_value, visibility, test_code, order? }] }`
- **Response**: `{ ok: true, test_cases: TestCase[] }`
- **Location**: `app/api/assignments.py:438-522`

**Key Logic**:
- Deletes all existing test cases before creating new ones
- Validates that assignment has a language set
- Sets defaults: `point_value=10`, `visibility=True`

**GET `/api/v1/assignments/{assignment_id}/test-cases`**
- **Purpose**: List test cases for an assignment
- **Query Params**: `student_id?`, `include_hidden?`, `user_id?`
- **Response**: `TestCase[]` (filtered by visibility for students)
- **Location**: `app/api/assignments.py:525-583`

**Key Logic**:
- Students only see visible test cases
- Faculty can see all test cases if `include_hidden=true`

**GET `/api/v1/assignments/{assignment_id}/test-cases/{test_case_id}`**
- **Purpose**: Get a single test case
- **Response**: `TestCase`
- **Location**: `app/api/assignments.py:586-607`

**PUT `/api/v1/assignments/{assignment_id}/test-cases/{test_case_id}`**
- **Purpose**: Update a test case
- **Request Body**: `{ point_value?, visibility?, test_code?, order? }`
- **Response**: `TestCase`
- **Location**: `app/api/assignments.py:610-652`

**DELETE `/api/v1/assignments/{assignment_id}/test-cases/{test_case_id}`**
- **Purpose**: Delete a test case
- **Location**: `app/api/assignments.py:655-674`

#### Submission & Grading Endpoints

**POST `/api/v1/assignments/{assignment_id}/submit`**
- **Purpose**: Submit student code for grading
- **Request**: `multipart/form-data` with:
  - `submission`: File (optional)
  - `code`: string (optional)
  - `student_id`: int (required)
- **Response**: 
  ```json
  {
    "ok": true,
    "submission_id": int,
    "grade": float,
    "result": {...},  // Piston execution result
    "test_cases": [...],  // Filtered for student visibility
    "console_output": string
  }
  ```
- **Location**: `app/api/assignments.py:702-928`

**Key Logic**:
1. Checks if Piston (grading service) is available before accepting submission
2. Validates file extension matches assignment language
3. Reads student code from file or text input
4. Fetches all test cases (including hidden ones)
5. Executes code via Piston service
6. Calculates grade from all test cases (visible + hidden)
7. Sanitizes output to hide hidden test case information
8. Creates submission record in database
9. Returns filtered results (students don't see hidden test details)

**GET `/api/v1/assignments/{assignment_id}/attempts`**
- **Purpose**: Get all attempts for a student on an assignment
- **Query Params**: `student_id` (required)
- **Response**: `[{ id, grade }]`
- **Location**: `app/api/assignments.py:677-700`

**GET `/api/v1/assignments/{assignment_id}/submissions/{submission_id}/code`**
- **Purpose**: Faculty endpoint to download submission code
- **Query Params**: `user_id` (faculty required)
- **Response**: Text file download
- **Location**: `app/api/assignments.py:930-973`

**GET `/api/v1/assignments/{assignment_id}/submission-detail/{submission_id}`**
- **Purpose**: Get detailed submission information (faculty only)
- **Query Params**: `user_id` (faculty required)
- **Response**: Detailed submission data with navigation info
- **Location**: `app/api/assignments.py:975-1090`

**GET `/api/v1/assignments/{assignment_id}/students/{student_id}/attempts`**
- **Purpose**: Get all attempts by a student (faculty view)
- **Query Params**: `user_id` (faculty required)
- **Response**: `Attempt[]`
- **Location**: `app/api/assignments.py:1093-1133`

**GET `/api/v1/assignments/{assignment_id}/grades`**
- **Purpose**: Get gradebook for an assignment (all students)
- **Response**: 
  ```json
  {
    "assignment": { "id", "title" },
    "students": [
      {
        "student_id": int,
        "username": string,
        "attempts": [{ "id", "earned_points" }],
        "best": int | null
      }
    ]
  }
  ```
- **Location**: `app/api/assignments.py:1136-1207`

**GET `/api/v1/assignments/gradebook/by-course/{course_key}`**
- **Purpose**: Get full gradebook for a course (matrix view)
- **Response**: 
  ```json
  {
    "course": { "id", "name", "course_code" },
    "assignments": [{ "id", "title", "total_points" }],
    "students": [
      {
        "student_id": int,
        "username": string,
        "grades": { "<assignment_id>": best_grade | null }
      }
    ]
  }
  ```
- **Location**: `app/api/assignments.py:1209-1294`

**POST `/api/v1/assignments/{assignment_id}/rerun-student-attempts/{student_id}`**
- **Purpose**: Faculty endpoint to rerun all attempts for a student
- **Query Params**: `user_id` (faculty required)
- **Response**: Rerun results
- **Location**: `app/api/assignments.py:1297-1416`

#### Registration Endpoints

**POST `/api/v1/registrations`**
- **Purpose**: Register a student or faculty member to a course
- **Request Body**: 
  ```json
  {
    "student_id"?: int,
    "faculty_id"?: int,
    "course_id"?: int,
    "enrollment_key"?: string
  }
  ```
- **Response**: `{ id, student_id/faculty_id, course_id }`
- **Location**: `app/api/registrations.py:19-68`

**Key Logic**:
- Requires either `student_id` OR `faculty_id` (not both)
- Can use either `course_id` OR `enrollment_key` to find course
- Checks for duplicate registrations
- Inserts into `user_course_association` table

**GET `/api/v1/students/{student_id}/courses`**
- **Purpose**: List courses for a student
- **Response**: `Course[]`
- **Location**: `app/api/registrations.py:70-79`

#### Language Support Endpoints

**GET `/api/v1/languages`**
- **Purpose**: Get list of supported programming languages
- **Response**: `[{ id, name, piston_name }]`
- **Location**: `app/api/languages.py:7-51`

**GET `/api/v1/assignments/_languages`**
- **Purpose**: Alternative endpoint for supported languages
- **Response**: Same as above
- **Location**: `app/api/assignments.py:22-66`

#### Test/Debug Endpoints

**POST `/api/v1/attempts`**
- **Purpose**: Test code execution with a single test case (debug endpoint)
- **Request**: `multipart/form-data` with `submission` (file), `test_case` (string), `language`
- **Response**: Piston execution result
- **Location**: `app/api/attempt_submission_test.py:87-118`

**POST `/api/v1/attempts/bridge`**
- **Purpose**: Alternative test endpoint
- **Location**: `app/api/attempt_submission_test.py:47-84`

**GET `/api/v1/attempts/test-route`**
- **Purpose**: Health check endpoint
- **Response**: `{ message: "Test route works" }`
- **Location**: `app/api/attempt_submission_test.py:42-45`

---

## Authentication & Authorization

### Authentication Mechanism

The backend uses a **header-based authentication** system (not JWT tokens):

1. **Login Flow**:
   - Student/faculty submits credentials to `/api/v1/login`
   - Backend validates credentials and returns user info
   - Frontend stores `user_id` and `role` in localStorage
   - Frontend includes these in subsequent requests as headers

2. **Request Headers**:
   - `X-User-Id`: User's ID (integer)
   - `X-User-Role`: User's role (`student`, `faculty`, or `admin`)

3. **Header Extraction**:
   - Many endpoints use `get_identity()` helper function
   - Located in `app/api/courses.py:97-107`
   - Returns `(user_id, role)` tuple or `(None, None)` if missing

### Password Storage

- **Algorithm**: `pbkdf2_sha256` (via Passlib)
- **Storage**: Hashed passwords stored in `User.password_hash` field
- **Verification**: Done in `app/api/LoginPage.py:48`

### Authorization Checks

Authorization is **mostly implicit** in the current implementation:

1. **Role-Based Access**:
   - Some endpoints check `X-User-Role` header
   - Example: Faculty-only endpoints require `role == "faculty"`

2. **Common Authorization Patterns**:

   **Faculty-Only Endpoints**:
   - `/courses/{course_key}/faculty` (add/remove)
   - `/assignments/{id}/submissions/{id}/code` (view submission code)
   - `/assignments/{id}/submission-detail/{id}` (view details)
   - `/assignments/{id}/rerun-student-attempts/{student_id}`

   **Student Access**:
   - Students can only see visible test cases
   - Hidden test cases are filtered out in responses
   - Students cannot access other students' submissions

3. **Enrollment Checks**:
   - Some endpoints verify enrollment via `user_course_association` table
   - Example: Submitting to an assignment (relaxed in dev mode)

### Security Considerations

- **No JWT Tokens**: Authentication relies on headers set by frontend
- **No Session Management**: Stateless API (headers on every request)
- **Password Hashing**: Secure hashing with pbkdf2_sha256
- **CORS**: Configured in `app/api/main.py:43-49` (allows specific origins)

---

## Code Execution System

### Architecture

The backend integrates with **Piston**, a Docker-based code execution engine:

```
┌─────────────────┐
│  FastAPI Backend│
└────────┬────────┘
         │
         │ HTTP API
         │
┌────────▼────────┐
│  Piston Service │
│  (Docker)       │
│  Port: 2000     │
└─────────────────┘
```

### Piston Integration

**Service Location**: `app/services/piston.py`

**Key Functions**:

1. **`execute_code(language, student_code, test_cases)`**
   - Main function for executing student code
   - Generates test harness using templates
   - Sends execution request to Piston API
   - Parses results and calculates grades
   - **Location**: `app/services/piston.py:267-456`

2. **`check_piston_available()`**
   - Checks if Piston service is accessible
   - Implements connection backoff on failures
   - **Location**: `app/services/piston.py:63-95`

3. **`get_runtimes()`**
   - Fetches available language runtimes from Piston
   - **Location**: `app/services/piston.py:459-482`

4. **`ensure_languages_installed()`**
   - Ensures required languages are installed in Piston
   - Called on server startup (background task)
   - **Location**: `app/services/piston.py:637-782`

### Test Harness Generation

The system uses a **template-based approach** to generate test harnesses:

1. **Template Files**: Located in `app/services/templates/`
   - `python_test.py`
   - `java_test.java`
   - `cpp_test.cpp`
   - `rust_test.rs`
   - `generic_test.txt` (fallback)

2. **Template System Flow**:

   ```
   Student Code + Test Cases
            │
            ▼
   Load Language Template
            │
            ▼
   Generate Test Execution Code
   (Language-specific)
            │
            ▼
   Substitute into Template
            │
            ▼
   Combined Test Harness
            │
            ▼
   Send to Piston
   ```

3. **Template Functions**:
   - `load_template(language)`: Loads template file
   - `generate_test_execution_code(language, test_cases)`: Generates language-specific test code
   - `generate_test_harness(language, student_code, test_cases)`: Combines everything
   - **Location**: `app/services/piston.py:807-1256`

### Language-Specific Test Generation

Each language has a custom test execution generator:

1. **Python** (`_generate_python_test_execution`):
   - Wraps test code in try/except blocks
   - Captures stdout/stderr per test case
   - Formats output as `PASSED: test_case_{id}:{points}`

2. **Java** (`_generate_java_test_execution`):
   - Converts Python-style asserts to Java if-throw statements
   - Captures output using ByteArrayOutputStream
   - Handles Solution class (package-private)

3. **C++** (`_generate_cpp_test_execution`):
   - Uses custom `test_assert()` macro
   - Captures output using stringstream
   - Handles exceptions

4. **Rust** (`_generate_rust_test_execution`):
   - Uses `std::panic::catch_unwind`
   - Handles panic messages

### Output Parsing

**Function**: `parse_test_output(stdout, stderr)`
**Location**: `app/services/piston.py:99-248`

Parses Piston output to extract:
- Test pass/fail status
- Points earned per test
- Error messages per test
- Console output (dry run)
- Summary statistics

**Output Format**:
```
PASSED: test_case_1:10
FAILED: test_case_2:5
ERROR_2: NameError: name 'x' is not defined
OUTPUT_2: 'actual output'
STDERR_2: 'stderr content'
=== Test Results ===
Total: 2
Passed: 1
Failed: 1
Earned: 10
TotalPoints: 15
```

### Error Handling

1. **Connection Failures**:
   - Implements exponential backoff
   - Prevents overwhelming Piston service
   - Returns 503 errors when unavailable

2. **Execution Errors**:
   - Compilation errors: Returned in stderr
   - Runtime errors: Caught and reported per test
   - Timeout errors: Status code 5 (Time Limit Exceeded)

3. **Student Error Visibility**:
   - Compilation errors: Always shown
   - Runtime errors: Only for visible test cases
   - Hidden test cases: Errors hidden from students

---

## Services & Utilities

### File Converter Service

**Location**: `app/services/FileConverter.py`

**Function**: `file_to_text(file: UploadFile) -> str`
- Converts uploaded file to UTF-8 text
- Handles empty files and encoding errors
- Used for reading student code submissions

### Settings Configuration

**Location**: `app/core/settings.py`

**Key Settings**:
- `DATABASE_URL`: SQLite database path (defaults to `backend/app.db`)
- `CORS_ORIGINS`: Allowed frontend origins (defaults to `localhost:5173`)
- `PISTON_URL`: Piston service URL (defaults to `http://localhost:2000`)
- `DEBUG`: Debug mode flag

**Configuration Source**:
- Environment variables (via Pydantic Settings)
- `.env` file (if present)
- Default values (fallback)

### Database Connection

**Location**: `app/core/db.py`

**Key Components**:
- `Base`: SQLAlchemy declarative base
- `engine`: Database engine (SQLite)
- `SessionLocal`: Session factory
- `get_db()`: Dependency function for FastAPI routes

**Session Management**:
- Sessions are created per request
- Automatically closed after request completion
- Used via FastAPI `Depends(get_db)`

---

## Request/Response Flow

### Example: Student Submits Assignment

```
1. Frontend Request
   POST /api/v1/assignments/{id}/submit
   Headers: X-User-Id: 123, X-User-Role: student
   Body: multipart/form-data (code file)

2. FastAPI Route Handler
   app/api/assignments.py:submit_to_assignment()
   ├─ Validate Piston availability
   ├─ Get assignment from database
   ├─ Validate student exists and is enrolled
   ├─ Fetch all test cases
   └─ Read student code (file or text)

3. Service Layer
   app/services/piston.py:execute_code()
   ├─ Generate test harness (template system)
   ├─ Get language version from Piston
   ├─ Build Piston API request
   └─ Send to Piston HTTP API

4. Piston Execution
   Docker container executes code
   ├─ Compile (if needed)
   ├─ Run test harness
   └─ Return stdout/stderr

5. Result Processing
   app/services/piston.py:parse_test_output()
   ├─ Parse test results
   ├─ Calculate points
   └─ Extract error messages

6. Database Update
   Create StudentSubmission record
   ├─ Store student code
   ├─ Store earned points
   └─ Commit transaction

7. Response Sanitization
   app/api/assignments.py:_sanitize_output_for_students()
   ├─ Filter hidden test case info
   ├─ Update summary counts
   └─ Prepare student-safe response

8. Frontend Response
   JSON with:
   - submission_id
   - grade (percentage)
   - test_cases (filtered)
   - console_output
```

### Example: Faculty Views Gradebook

```
1. Frontend Request
   GET /api/v1/assignments/gradebook/by-course/{course_key}
   Headers: X-User-Id: 456, X-User-Role: faculty

2. FastAPI Route Handler
   app/api/assignments.py:gradebook_for_course()
   ├─ Get course by key (ID or course_code)
   ├─ Fetch all assignments for course
   └─ Calculate total points per assignment

3. Database Queries
   ├─ Get enrolled students (user_course_association)
   ├─ Get all submissions for assignments
   └─ Group by student, find best grade

4. Response Building
   Build matrix structure:
   {
     "course": {...},
     "assignments": [...],
     "students": [
       {
         "student_id": int,
         "username": string,
         "grades": {
           "1": 85,  // assignment_id -> best_grade
           "2": null
         }
       }
     ]
   }

5. Frontend Response
   JSON gradebook matrix
```

---

## Configuration

### Environment Variables

The backend reads configuration from environment variables (via Pydantic Settings):

```bash
# Database
DATABASE_URL=sqlite:///backend/app.db

# CORS (comma-separated or JSON array)
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
# OR
CORS_ORIGINS=["http://localhost:5173"]

# Piston Service
PISTON_URL=http://localhost:2000

# Debug Mode
DEBUG=true
```

### Database Migrations

**Migration Tool**: Alembic

**Location**: `backend/alembic/`

**Key Files**:
- `alembic.ini`: Alembic configuration
- `env.py`: Migration environment setup
- `versions/`: Migration scripts

**Running Migrations**:
```bash
cd backend
alembic upgrade head
```

### Startup Sequence

1. **Application Initialization** (`app/api/main.py`):
   - Create FastAPI app
   - Add CORS middleware
   - Register routers
   - Set up startup events

2. **Startup Events**:
   - **Database Verification**: Checks connection, lists tables
   - **Piston Bootstrap**: 
     - Checks Piston availability
     - Lists available languages
     - Background task to ensure languages installed

3. **Router Registration**:
   - All routers mounted under `/api/v1` prefix
   - Tags added for OpenAPI documentation

### Database Schema

**Current Schema Version**: See `alembic/versions/1437b4be392c_baseline_schema.py`

**Tables**:
- `users`
- `courses`
- `user_course_association`
- `assignments`
- `test_cases`
- `student_submissions`

---

## Key Design Decisions

### 1. Stateless Authentication
- No JWT tokens or session storage
- Headers on every request
- **Rationale**: Simpler implementation, sufficient for current use case

### 2. Template-Based Test Harness
- Language-specific templates
- Dynamic test code generation
- **Rationale**: Supports multiple languages, maintainable

### 3. Hidden Test Cases
- Visibility flag on test cases
- Server-side filtering
- **Rationale**: Allows for comprehensive grading while hiding implementation details

### 4. Multiple Submissions
- No automatic "best grade" selection
- All attempts stored
- **Rationale**: Preserves submission history, flexible grading

### 5. SQLite Database
- File-based database
- Easy deployment
- **Rationale**: Simplicity, no external database server needed

### 6. Piston Integration
- External Docker service
- HTTP API communication
- **Rationale**: Isolated code execution, security, language support

---

## Testing

**Test Location**: `backend/tests/`

**Test Files**:
- `test_api.py`: General API tests
- `test_assignments.py`: Assignment endpoint tests
- `test_courses.py`: Course endpoint tests
- `test_LoginPage.py`: Authentication tests
- `test_registrations.py`: Registration tests
- `test_settings.py`: Settings tests
- `conftest.py`: Pytest configuration and fixtures

**Test Framework**: Pytest with FastAPI TestClient

---

## Error Handling Patterns

### HTTP Status Codes

- **200 OK**: Successful GET request
- **201 Created**: Successful POST request (resource created)
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication failed
- **403 Forbidden**: Authorization failed (wrong role)
- **404 Not Found**: Resource not found
- **409 Conflict**: Duplicate resource (e.g., already enrolled)
- **415 Unsupported Media Type**: Invalid file format
- **503 Service Unavailable**: Piston/grading service unavailable

### Error Response Format

```json
{
  "detail": "Error message here"
}
```

### Exception Handling

- Most endpoints use `HTTPException` from FastAPI
- Database errors are caught and converted to HTTP errors
- Piston connection errors return 503 status
- Validation errors return 400 with details

---

## Performance Considerations

### Database Queries

- Uses SQLAlchemy ORM (some N+1 query potential)
- Indexes on: `courses.enrollment_key`, `courses.course_code`
- Cascading deletes handled by database

### Piston Connection Pooling

- Shared `httpx.AsyncClient` instance
- Connection limits: 10 max, 5 keepalive
- Timeout: 10s connect, 30s request

### Submission Processing

- Synchronous execution (blocks request)
- Timeout protection: 3s max execution time
- Connection backoff prevents overwhelming Piston

---

## Future Enhancement Opportunities

1. **Authentication**:
   - JWT token-based authentication
   - Refresh token mechanism
   - Session management

2. **Authorization**:
   - More granular permissions
   - Course-level roles (TA, etc.)
   - Resource-level access control

3. **Performance**:
   - Database query optimization
   - Caching layer
   - Async submission processing

4. **Features**:
   - Plagiarism detection
   - Code review functionality
   - Real-time grading updates
   - Export gradebooks (CSV, Excel)

5. **Infrastructure**:
   - PostgreSQL support
   - Redis caching
   - Background job queue (Celery)

---

## Summary

The AutoGrader backend is a FastAPI-based REST API that:

- **Manages** courses, assignments, test cases, and student submissions
- **Executes** student code using the Piston Docker service
- **Grades** submissions automatically using test cases
- **Supports** multiple programming languages (Python, Java, C++, Rust)
- **Enforces** hidden test cases and visibility rules
- **Provides** gradebook functionality for faculty
- **Uses** SQLite for data persistence
- **Implements** header-based authentication (no JWT)

The system is designed for educational use, prioritizing security (isolated code execution), flexibility (multiple languages), and comprehensive grading (visible and hidden test cases).
