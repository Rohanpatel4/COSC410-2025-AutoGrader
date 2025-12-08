# COSC410 AutoGrader - Testing & Project Guide

## 📖 Project Overview

The **COSC410 AutoGrader** is a full-stack web application for automated code grading. It allows faculty to create programming assignments with test cases, and students to submit solutions that are automatically compiled, executed, and graded.

### Key Features
- **Multi-language support**: Python, Java, C++, Rust
- **Automatic grading**: Code execution via Piston sandbox
- **Real-time feedback**: Students see test results immediately
- **Role-based access**: Faculty and Student roles with different permissions
- **Rich assignment editing**: TipTap-based rich text editor for instructions

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│     Piston      │
│   (React/Vite)  │     │    (FastAPI)    │     │ (Code Executor) │
│   Port: 5173    │     │   Port: 8000    │     │   Port: 2000    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │    SQLite DB    │
                        │    (app.db)     │
                        └─────────────────┘
```

### Services (Docker Compose)

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| `frontend` | React + Vite + TypeScript | 5173 | User interface |
| `backend` | FastAPI + SQLAlchemy | 8000 | REST API |
| `piston` | Piston Sandbox | 2000 | Secure code execution |

---

## 📁 Project Structure

```
COSC410-2025-AutoGrader/
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── api/               # API endpoints
│   │   │   ├── assignments.py # Assignment CRUD, submissions, grading
│   │   │   ├── courses.py     # Course management
│   │   │   ├── LoginPage.py   # Authentication
│   │   │   ├── registrations.py # Student enrollments
│   │   │   └── syntax.py      # Code syntax validation
│   │   ├── core/              # Configuration
│   │   │   ├── db.py          # Database connection
│   │   │   └── settings.py    # Environment settings
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   └── services/          # Business logic
│   │       ├── piston.py      # Piston API integration
│   │       └── templates/     # Language test harness templates
│   ├── tests/                 # Backend tests (pytest)
│   └── scripts/               # Database seeding scripts
│
├── frontend/                   # React TypeScript frontend
│   ├── src/
│   │   ├── api/               # API client
│   │   ├── auth/              # Authentication context
│   │   ├── components/        # Reusable UI components
│   │   ├── test/              # Frontend tests (Vitest)
│   │   ├── webpages/          # Page components
│   │   └── main.tsx           # App entry point
│   └── vitest.config.ts       # Test configuration
│
├── docker-compose.yml          # Container orchestration
├── pytest.ini                  # Backend test config
└── htmlcov/                    # Coverage reports
```

---

## 🧪 Running Tests

### Backend Tests (pytest)

**Run all backend tests:**
```bash
pytest backend/tests/
```

**Run with coverage report:**
```bash
pytest backend/tests/ --cov=backend/app --cov-report=term-missing
```

**Generate HTML coverage report:**
```bash
pytest backend/tests/ --cov=backend/app --cov-report=html
# Open htmlcov/index.html in browser
```

**Run specific test file:**
```bash
pytest backend/tests/test_assignments.py
```

**Run specific test:**
```bash
pytest backend/tests/test_assignments.py::test_create_assignment_success
```

**Run tests with verbose output:**
```bash
pytest backend/tests/ -v
```

### Frontend Tests (Vitest)

**Run all frontend tests:**
```bash
cd frontend
npm test
```

**Run with coverage:**
```bash
cd frontend
npm run test:coverage
```

**Run in watch mode (for development):**
```bash
cd frontend
npm run test:watch
```

**Run specific test file:**
```bash
cd frontend
npm test -- src/test/AssignmentDetailPage.test.tsx
```

---

## 📊 Test Coverage Summary

### Backend Tests: 429 tests across 12 files

| File | Tests | Focus |
|------|-------|-------|
| `test_assignments.py` | 103 | CRUD, submissions, grading |
| `test_piston.py` | 97 | Code execution, parsing |
| `test_courses.py` | 64 | Course management |
| `test_syntax.py` | 57 | Code validation |
| `test_api.py` | 24 | API endpoints |
| `test_registrations.py` | 19 | Student enrollment |
| `test_LoginPage.py` | 16 | Authentication |

### Frontend Tests: 928 tests across 36 files

| File | Tests | Focus |
|------|-------|-------|
| `AssignmentDetailPage.test.tsx` | 119 | Assignment workflow |
| `CreateAssignmentPage.test.tsx` | 98 | Assignment creation |
| `CoursePage.test.tsx` | 98 | Course views |
| `StudentAssignmentView.test.tsx` | 87 | Student submission UI |

### Test Categories

| Category | Count | Description |
|----------|-------|-------------|
| ✅ Happy Path | 146 | Success scenarios |
| ❌ Error Cases | 137 | Invalid input, failures |
| 🔐 Auth/Permissions | 60 | Role-based access |
| ⚙️ Integration | 108 | Piston, API calls |
| 🔄 Edge Cases | 25 | Boundary conditions |

---

## 🛠️ Testing Strategies Used

### Mocking
We use `unittest.mock` and `pytest-mock` to isolate tests from external dependencies:

```python
@patch('app.api.assignments.execute_code', new_callable=AsyncMock)
def test_submit_assignment(mock_execute):
    mock_execute.return_value = {"stdout": "PASSED: test_case_1:10", ...}
    # Test without calling real Piston
```

**Why mock?**
- Tests run fast (no network calls)
- Tests are deterministic
- Can simulate error scenarios
- No Docker/Piston required for CI

### Async Testing
Piston integration uses `async/await` for non-blocking I/O:

```python
async def execute_code(language, code, test_cases):
    response = await client.post(execute_url, json=request_body)
    # Server handles other requests while waiting
```

**Why async?**
- Multiple students can submit simultaneously
- Server isn't blocked during 3+ second compilations
- Better resource utilization

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop
- Node.js 20+
- Python 3.11+

### Start All Services
```bash
docker compose up -d
```

### Seed Demo Data
```bash
docker compose exec backend python /app/backend/scripts/seed_demo.py
```

### Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000/docs
- **Piston API**: http://localhost:2000/api/v2/runtimes

### Default Users (after seeding)
| Username | Password | Role |
|----------|----------|------|
| profx | pass | Faculty |
| alice | pass | Student |
| bob | pass | Student |

---

## 🔧 Development Commands

### Backend
```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run locally (outside Docker)
uvicorn app.api.main:app --reload --port 8000

# Format code
black backend/app

# Lint
flake8 backend/app
```

### Frontend
```bash
# Install dependencies
cd frontend
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

### Docker
```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f backend

# Restart a service
docker compose restart piston

# Stop all
docker compose down

# Rebuild after code changes
docker compose up -d --build
```

---

## 📚 Additional Documentation

| Document | Description |
|----------|-------------|
| `PISTON_INTEGRATION_GUIDE.md` | How Piston executes code |
| `PISTON_GRADING_MECHANICS.md` | Test harness and grading logic |
| `TEST_CASE_GUIDE.md` | How to write test cases |
| `BACKEND_DOCUMENTATION.md` | API endpoint reference |
| `frontend/THEMES_AND_STYLES.md` | UI theming guide |

---

## 🐛 Troubleshooting Tests

### "Module not found" errors
```bash
# Ensure you're in the project root
cd COSC410-2025-AutoGrader
pytest backend/tests/
```

### Async test failures
Ensure `pytest-asyncio` is installed:
```bash
pip install pytest-asyncio
```

### Frontend test timeouts
Increase timeout in `vitest.config.ts`:
```typescript
test: {
  testTimeout: 10000,
}
```

### Piston-related test failures
Tests mock Piston by default. If integration tests fail:
```bash
# Check Piston is running
docker compose ps piston

# Restart if unhealthy
docker compose restart piston
```

