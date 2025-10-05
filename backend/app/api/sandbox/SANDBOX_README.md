# Secure Offline Code Execution Sandbox

This auto-grader system includes a secure, offline sandbox environment for running untrusted student code using Judge0. The sandbox executes code in isolated Docker containers with no internet access.

## Features

- **Secure Execution**: Code runs in isolated Docker containers with resource limits
- **Offline Operation**: No internet access required for code execution
- **Multi-language Support**: Python, C/C++, Java, JavaScript, and more via Judge0
- **Multiple Test Cases**: Support for multiple input/output test case files
- **Real-time Results**: Detailed execution results with stdout, stderr, and performance metrics
- **Extensible Runtime Registry**: Pluggable runtime system for adding new languages

## Architecture

### Components

1. **Judge0 Service**: Self-hosted code execution engine running in Docker
2. **Backend API**: FastAPI server managing submissions, test suites, and execution
3. **Frontend**: React-based web interface for managing and viewing executions
4. **Database**: SQLite/PostgreSQL for storing files, runs, and metadata

### Security Features

- **Container Isolation**: Each execution runs in a separate Docker container
- **Resource Limits**: CPU time (10s), memory (256MB), and output size limits
- **No Internet Access**: JUDGE0_DISABLE_INTERNET=true prevents network access
- **File System Isolation**: Code cannot access host file system

## Setup and Usage

### 1. Start the System

```bash
# From the project root
docker-compose up --build
```

This starts:
- Backend API on port 8000
- Judge0 service on port 2358
- Frontend on port 8080

### 2. Initialize Runtimes

After startup, sync the available Judge0 languages:

```bash
curl -X POST http://localhost:8000/api/v1/runtimes/sync
```

Or use the web interface to initialize default runtimes.

### 3. Upload Files

Upload submission files (source code) and test case files via the web interface:

- **Submissions**: Source code files (e.g., `solution.py`, `main.c`)
- **Test Cases**: Input/output pairs following naming convention:
  - `test1.in` / `test1.out`
  - `test2.input` / `test2.expected`
  - `sample.in` / `sample.out`

### 4. Create Test Suites

Group related test case files into test suites through the web interface.

### 5. Execute Code

1. Select a submission, test suite, and runtime
2. Create a run
3. Execute the run to see results

## File Organization

### Test Case Naming Convention

The sandbox automatically pairs input and output files:

```
test_cases/
├── test1.in       # Input for test case 1
├── test1.out      # Expected output for test case 1
├── test2.in       # Input for test case 2
├── test2.out      # Expected output for test case 2
└── sample.in      # Additional test input
  └── sample.out   # Additional test output
```

### Submission Files

Multiple files per submission are supported:

```
submission/
├── main.py        # Main source file
├── utils.py       # Helper module
└── config.json    # Configuration file
```

## API Endpoints

### Judge0 Management
- `GET /api/v1/judge0/health` - Check Judge0 service status
- `GET /api/v1/judge0/languages` - List available languages

### Runtime Management
- `GET /api/v1/runtimes` - List runtimes
- `POST /api/v1/runtimes/sync` - Sync with Judge0 languages
- `POST /api/v1/runtimes/initialize` - Initialize default runtimes

### Execution
- `POST /api/v1/runs` - Create execution run
- `POST /api/v1/runs/{id}/execute` - Execute run
- `GET /api/v1/runs/{id}` - Get run status
- `GET /api/v1/files/results/{run_id}` - Get execution results

## Supported Languages

The system supports all languages available in Judge0, including:

- Python (2.7, 3.x)
- C/C++
- Java
- JavaScript/Node.js
- Go
- Rust
- PHP
- Ruby
- And many more...

## Configuration

### Environment Variables

```bash
# Backend
DATABASE_URL=sqlite:///./app.db
CORS_ORIGINS=http://localhost:5173
JUDGE0_URL=http://judge0:2358

# Judge0
JUDGE0_DISABLE_INTERNET=true
JUDGE0_MAX_QUEUE_SIZE=100
JUDGE0_MAX_RUNTIME_CPU_TIME=10
JUDGE0_MAX_RUNTIME_MEMORY=512000000
```

### Resource Limits

- **CPU Time**: 10 seconds per execution
- **Memory**: 256MB per execution
- **Output Size**: 1MB per execution
- **Stack Size**: 128MB

## Troubleshooting

### Judge0 Service Issues

Check Judge0 health:
```bash
curl http://localhost:2358/languages
```

### Runtime Sync Issues

If runtimes aren't appearing:
1. Ensure Judge0 is running: `docker-compose ps`
2. Check Judge0 health endpoint
3. Try manual sync: `POST /api/v1/runtimes/sync`

### Execution Failures

Common issues:
- **Timeout**: Code takes too long to execute
- **Memory Limit**: Code uses too much memory
- **Compilation Errors**: Syntax errors in source code
- **Test Case Mismatch**: Input/output files not properly paired

## Extending the System

### Adding New Languages

1. Judge0 automatically detects new languages
2. Run sync: `POST /api/v1/runtimes/sync`
3. Configure runtime-specific settings if needed

### Custom Runtimes

For languages not supported by Judge0, create custom runtime configurations:

```python
# In runtime_service.py
CUSTOM_RUNTIMES = {
    999: {
        "language": "CustomLang",
        "version": "1.0",
        "host_path": "/usr/local/bin/customlang",
        "compile_cmd": "customlang-compile",
        "run_cmd": "customlang-run"
    }
}
```

### Security Enhancements

Additional security measures can be added:

- **AppArmor/SELinux**: Additional container restrictions
- **Network Policies**: Kubernetes network policies
- **File Access Control**: Limit file system access
- **Process Monitoring**: Track system calls and resource usage

## Development

### Testing

Run the test suite:
```bash
# Backend tests
cd backend && pytest

# Frontend tests
cd frontend && npm test
```

### Local Development

For local development without Docker:
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

Note: Judge0 requires Docker for execution, so full sandbox testing requires Docker Compose.
