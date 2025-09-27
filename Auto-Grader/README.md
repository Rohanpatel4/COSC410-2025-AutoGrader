# Auto-Grader

A secure, offline sandbox environment for running untrusted student code submissions against test cases. Built with FastAPI, React, and containerized for easy deployment.

## Features

- **Secure Sandbox Execution**: Runs untrusted code in isolated environments with resource limits
- **Multi-Language Support**: Pluggable runtime system supporting Python, JavaScript, C/C++, Java, and more
- **File Management**: Upload and organize test cases and student submissions
- **RESTful API**: Comprehensive API for managing files, test suites, submissions, runtimes, and executions
- **Modern Frontend**: React-based UI with TypeScript and Tailwind CSS
- **Containerized Deployment**: Docker Compose setup for easy development and production deployment
- **Database Flexibility**: SQLite for development, PostgreSQL for production

## Architecture

### Backend (FastAPI + SQLAlchemy)
- **Models**: File, TestSuite, Submission, Runtime, Run entities
- **Services**: Business logic with validation and security
- **Repositories**: Data access layer with async SQLAlchemy
- **API**: RESTful endpoints with Pydantic validation
- **Security**: Sandbox execution with resource limits and syscall restrictions

### Frontend (React + TypeScript)
- **Components**: Reusable UI components with accessibility
- **Pages**: File upload, test suite management, execution monitoring
- **API Client**: Typed fetch wrapper with error handling
- **Styling**: Tailwind CSS v4 for modern, responsive design

### Infrastructure
- **Docker**: Multi-stage builds for optimized images
- **Nginx**: Reverse proxy serving frontend and proxying API
- **Database**: SQLite (dev) / PostgreSQL (prod) with Alembic migrations

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Docker Deployment (Recommended)

1. **Clone and navigate to the project**:
   ```bash
   git clone <repository-url>
   cd auto-grader
   ```

2. **Build and run with Docker Compose**:
   ```bash
   docker compose up --build
   ```

3. **Access the application**:
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Local Development

#### Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## Usage

### 1. Upload Files
- Navigate to the Files page
- Upload test case files (inputs, expected outputs, fixtures)
- Upload student submission files (solution code)

### 2. Create Test Suites
- Go to Test Suites page
- Create test suites by selecting multiple test case files
- Each test suite groups related test files together

### 3. Create Submissions
- Visit Submissions page
- Create submissions by selecting student submission files
- Group multiple files if submissions span multiple files

### 4. Configure Runtimes (Admin)
- Access Runtimes page
- Register language runtimes with host paths and commands
- Enable/disable runtimes as needed

### 5. Execute Runs
- Go to Runs page
- Select a submission, test suite, and runtime
- Monitor execution status and view outputs

## API Documentation

### Files API
- `POST /api/v1/files/` - Upload file
- `GET /api/v1/files/{id}` - Get file metadata
- `GET /api/v1/files/?category=TEST_CASE|SUBMISSION` - List files
- `DELETE /api/v1/files/{id}` - Delete file

### Test Suites API
- `POST /api/v1/test-suites/` - Create test suite
- `GET /api/v1/test-suites/{id}` - Get test suite
- `GET /api/v1/test-suites/` - List test suites
- `DELETE /api/v1/test-suites/{id}` - Delete test suite

### Submissions API
- `POST /api/v1/submissions/` - Create submission
- `GET /api/v1/submissions/{id}` - Get submission
- `GET /api/v1/submissions/` - List submissions
- `DELETE /api/v1/submissions/{id}` - Delete submission

### Runtimes API
- `POST /api/v1/runtimes/` - Register runtime
- `GET /api/v1/runtimes/{id}` - Get runtime
- `GET /api/v1/runtimes/` - List runtimes
- `PATCH /api/v1/runtimes/{id}` - Update runtime
- `DELETE /api/v1/runtimes/{id}` - Delete runtime

### Runs API
- `POST /api/v1/runs/` - Create run
- `GET /api/v1/runs/{id}` - Get run status
- `GET /api/v1/runs/{id}/stdout` - Get stdout
- `GET /api/v1/runs/{id}/stderr` - Get stderr
- `DELETE /api/v1/runs/{id}` - Cancel run

## Database Migration

### Development (SQLite)
```bash
cd backend
alembic revision --autogenerate -m "Migration message"
alembic upgrade head
```

### Production (PostgreSQL)
1. Update `DATABASE_URL` environment variable:
   ```bash
   export DATABASE_URL="postgresql+psycopg://user:password@host:port/database"
   ```

2. Install PostgreSQL dependencies:
   ```bash
   pip install psycopg2-binary
   ```

3. Run migrations:
   ```bash
   alembic upgrade head
   ```

## Testing

### Backend Tests
```bash
cd backend
pytest -q --cov=app --cov-report=term-missing:skip-covered --cov-report=html --cov-fail-under=80
```

### Frontend Tests
```bash
cd frontend
npm run test:cov
```

## Security Considerations

### Sandbox Execution
- **No Network Access**: Containers run without network namespace
- **Non-root User**: All executions run as unprivileged user
- **Resource Limits**: CPU, memory, and time limits enforced
- **Read-only Inputs**: Test files mounted read-only
- **Isolated Working Directory**: Temporary directories for execution
- **Syscall Restrictions**: Seccomp/AppArmor profiles (when available)

### Host Runtime Resolution
- Language interpreters/compilers invoked from host system
- No runtime dependencies bundled in containers
- Host paths validated for existence and executability

## Configuration

### Environment Variables

#### Backend
- `DATABASE_URL`: Database connection string (default: `sqlite:///./app.db`)
- `MAX_UPLOAD_SIZE`: Maximum file upload size in bytes (default: 25MB)
- `UPLOAD_DIR`: Directory for uploaded files (default: `./uploads`)
- `RUNS_DIR`: Directory for run outputs (default: `./runs`)
- `BACKEND_CORS_ORIGINS`: Allowed CORS origins (default: `["http://localhost:5173"]`)

#### Frontend
- `VITE_API_URL`: API base URL (default: `/api` for production, `http://localhost:8000` for development)

## Project Structure

```
auto-grader/
├── backend/
│   ├── app/
│   │   ├── core/           # Configuration and database
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── repositories/   # Data access layer
│   │   ├── services/       # Business logic
│   │   ├── api/            # FastAPI routers
│   │   └── main.py         # Application entry point
│   ├── alembic/            # Database migrations
│   ├── tests/              # Backend tests
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/            # API client
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── styles/         # CSS styles
│   │   └── test/           # Test utilities
│   ├── public/
│   └── package.json
├── infra/
│   └── docker/             # Docker configurations
├── docker-compose.yml      # Docker Compose setup
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
