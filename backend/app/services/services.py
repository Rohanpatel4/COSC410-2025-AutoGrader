import os, uuid, json, shutil, hashlib, subprocess, shlex
from datetime import datetime, UTC
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import models as m
from app.judge0_client import get_judge0_client

STORAGE_ROOT = "storage"

def ensure_storage():
    os.makedirs(STORAGE_ROOT, exist_ok=True)

def store_uploaded_file(name: str, content: bytes, category: m.FileCategory):
    ensure_storage()
    fid = str(uuid.uuid4())
    path = os.path.join(STORAGE_ROOT, fid + "_" + name)
    with open(path, "wb") as f:
        f.write(content)
    sha = hashlib.sha256(content).hexdigest()
    size = len(content)
    return fid, path, sha, size

def validate_file_ids(db: Session, file_ids: List[str], category: m.FileCategory):
    files = db.query(m.File).filter(m.File.id.in_(file_ids)).all()
    if len(files) != len(file_ids):
        raise HTTPException(400, "Some file_ids not found")
    for f in files:
        if f.category != category:
            raise HTTPException(400, "file_ids must all be category=" + category.value)
    return files

def read_file_content(file_path: str) -> str:
    """Read content from a file path."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return ""
    except UnicodeDecodeError:
        # Try reading as binary and decode
        with open(file_path, 'rb') as f:
            return f.read().decode('utf-8', errors='ignore')

def read_submission_source_code(submission_files: List[m.File]) -> str:
    """Combine multiple submission files into source code."""
    source_parts = []
    for file in submission_files:
        content = read_file_content(file.path)
        # Add file header for multi-file submissions
        if len(submission_files) > 1:
            source_parts.append(f"# File: {file.name}")
        source_parts.append(content)
    return "\n".join(source_parts)

def group_test_files(test_files: List[m.File]) -> Dict[str, Dict[str, str]]:
    """Group test files by test case name (e.g., test1.in -> test1.out)."""
    test_cases = {}

    for file in test_files:
        # Assume naming convention: testname.in, testname.out, testname.expected, etc.
        name_parts = file.name.rsplit('.', 1)
        if len(name_parts) == 2:
            test_name, extension = name_parts
        else:
            test_name = file.name
            extension = ""

        if test_name not in test_cases:
            test_cases[test_name] = {}

        # Map extensions to file types
        if extension in ['in', 'input']:
            test_cases[test_name]['input'] = file.path
        elif extension in ['out', 'output', 'expected']:
            test_cases[test_name]['output'] = file.path
        elif extension in ['args', 'arguments']:
            test_cases[test_name]['args'] = file.path
        else:
            # Default to input if no clear extension
            test_cases[test_name]['input'] = file.path

    return test_cases

def store_execution_results(results: List[Dict[str, Any]]) -> str:
    """Store execution results as JSON and return the path."""
    ensure_storage()
    result_id = str(uuid.uuid4())
    result_path = os.path.join(STORAGE_ROOT, f"result_{result_id}.json")

    with open(result_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    return result_path

def create_run(db: Session, submission_id: str, testsuite_id: str, runtime_id: str) -> m.Run:
    if not db.get(m.Submission, submission_id): raise HTTPException(400, "submission not found")
    if not db.get(m.TestSuite, testsuite_id): raise HTTPException(400, "testsuite not found")
    runtime = db.get(m.Runtime, runtime_id)
    if not runtime or not runtime.enabled: raise HTTPException(400, "runtime missing or disabled")
    rid = str(uuid.uuid4())
    run = m.Run(id=rid, submission_id=submission_id, testsuite_id=testsuite_id, runtime_id=runtime_id, status=m.RunStatus.QUEUED)
    db.add(run); db.commit(); db.refresh(run)
    return run

def execute_run(db: Session, run: m.Run) -> m.Run:
    """Execute a run using Judge0 sandbox with multiple test cases."""
    try:
        # Mark as running
        run.status = m.RunStatus.RUNNING
        run.started_at = datetime.now(UTC)
        db.commit()

        # Get submission, test suite, and runtime
        submission = db.get(m.Submission, run.submission_id)
        testsuite = db.get(m.TestSuite, run.testsuite_id)
        runtime = db.get(m.Runtime, run.runtime_id)

        if not submission or not testsuite or not runtime:
            raise HTTPException(400, "Invalid submission, testsuite, or runtime")

        # Get submission files (should contain source code)
        submission_files = validate_file_ids(db, json.loads(submission.file_ids), m.FileCategory.SUBMISSION)
        test_files = validate_file_ids(db, json.loads(testsuite.file_ids), m.FileCategory.TEST_CASE)

        # Read source code from submission files
        source_code = read_submission_source_code(submission_files)

        # Group test files by test case (assuming naming convention: test1.in, test1.out, test2.in, test2.out, etc.)
        test_cases = group_test_files(test_files)

        # Initialize Judge0 client
        client = get_judge0_client()

        # Execute against each test case
        results = []
        all_passed = True

        for test_name, test_case in test_cases.items():
            # Read test input and expected output
            stdin = read_file_content(test_case.get('input'))
            expected_output = read_file_content(test_case.get('output', ''))

            try:
                # Submit to Judge0
                token = client.create_submission(
                    source_code=source_code,
                    language_id=runtime.judge0_id,
                    stdin=stdin,
                    expected_output=expected_output,
                    cpu_time_limit=5.0,
                    memory_limit=256000000  # 256MB
                )

                # Wait for completion
                result = client.wait_for_completion(token, timeout=30)

                # Check if test passed
                status = result.get("status", {})
                passed = status.get("id") == 3  # 3 = Accepted
                if not passed:
                    all_passed = False

                results.append({
                    "test_name": test_name,
                    "passed": passed,
                    "status": status.get("description", "Unknown"),
                    "stdout": result.get("stdout", ""),
                    "stderr": result.get("stderr", ""),
                    "compile_output": result.get("compile_output", ""),
                    "time": result.get("time", ""),
                    "memory": result.get("memory", "")
                })

            except Exception as e:
                all_passed = False
                results.append({
                    "test_name": test_name,
                    "passed": False,
                    "status": f"Execution error: {str(e)}",
                    "stdout": "",
                    "stderr": "",
                    "compile_output": "",
                    "time": "",
                    "memory": ""
                })

        # Store results
        result_path = store_execution_results(results)
        run.stdout_path = result_path
        run.exit_code = 0 if all_passed else 1

        # Mark as completed
        run.finished_at = datetime.now(UTC)
        run.status = m.RunStatus.SUCCEEDED if all_passed else m.RunStatus.FAILED
        db.commit()
        db.refresh(run)

        return run

    except Exception as e:
        # Handle execution errors
        run.status = m.RunStatus.FAILED
        run.finished_at = datetime.now(UTC)
        run.exit_code = 1
        run.stderr_path = store_execution_results([{"error": str(e)}])
        db.commit()
        db.refresh(run)
        return run
