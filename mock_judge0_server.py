#!/usr/bin/env python3
"""
Mock Judge0 server for testing the sandbox implementation.
Mimics the Judge0 API to allow testing without the full Docker setup.
"""

import json
import time
import uuid
from flask import Flask, request, jsonify

app = Flask(__name__)

# Mock data
LANGUAGES = [
    {"id": 71, "name": "Python (3.8.1)"},
    {"id": 62, "name": "Java (11.0.6)"},
    {"id": 50, "name": "C (GCC 9.2.0)"},
    {"id": 54, "name": "C++ (GCC 9.2.0)"},
    {"id": 63, "name": "JavaScript (Node.js 12.14.0)"},
    {"id": 68, "name": "Ruby (2.7.0)"},
    {"id": 60, "name": "Go (1.13.5)"},
]

# Store submissions
submissions = {}

def execute_python_code(source_code, stdin):
    """Mock Python execution."""
    try:
        print(f"[MOCK] Executing code: {repr(source_code)}")
        print(f"[MOCK] With stdin: {repr(stdin)}")

        # Check if it's the square calculation code
        if "int(sys.stdin.read().strip())" in source_code and "print(n * n)" in source_code:
            # This is the square calculation from our test
            if stdin.strip() == "42":
                return {
                    "stdout": "1764",
                    "stderr": "",
                    "compile_output": "",
                    "status": {"id": 3, "description": "Accepted"},
                    "time": "0.01",
                    "memory": 1234
                }
            else:
                # Handle other numbers
                try:
                    n = int(stdin.strip())
                    result = n * n
                    return {
                        "stdout": str(result),
                        "stderr": "",
                        "compile_output": "",
                        "status": {"id": 3, "description": "Accepted"},
                        "time": "0.01",
                        "memory": 1234
                    }
                except ValueError:
                    return {
                        "stdout": "",
                        "stderr": "Invalid input",
                        "compile_output": "",
                        "status": {"id": 4, "description": "Wrong Answer"},
                        "time": "0.01",
                        "memory": 1234
                    }

        # Handle simple print statements
        elif source_code.strip().startswith("print(") and source_code.strip().endswith(")"):
            # Extract what's being printed
            content = source_code.strip()[6:-1]  # Remove "print(" and ")"
            if content == "42*42":
                return {
                    "stdout": "1764",
                    "stderr": "",
                    "compile_output": "",
                    "status": {"id": 3, "description": "Accepted"},
                    "time": "0.01",
                    "memory": 1234
                }
            else:
                # Try to evaluate simple expressions
                try:
                    result = str(eval(content))
                    return {
                        "stdout": result,
                        "stderr": "",
                        "compile_output": "",
                        "status": {"id": 3, "description": "Accepted"},
                        "time": "0.01",
                        "memory": 1234
                    }
                except:
                    return {
                        "stdout": content,
                        "stderr": "",
                        "compile_output": "",
                        "status": {"id": 3, "description": "Accepted"},
                        "time": "0.01",
                        "memory": 1234
                    }

        # Default case
        else:
            return {
                "stdout": "Mock execution successful",
                "stderr": "",
                "compile_output": "",
                "status": {"id": 3, "description": "Accepted"},
                "time": "0.01",
                "memory": 1234
            }
    except Exception as e:
        print(f"[MOCK] Execution error: {e}")
        return {
            "stdout": "",
            "stderr": f"Execution error: {str(e)}",
            "compile_output": "",
            "status": {"id": 5, "description": "Runtime Error"},
            "time": "0.01",
            "memory": 1234
        }

@app.route('/languages', methods=['GET'])
def get_languages():
    """Return available languages."""
    return jsonify(LANGUAGES)

@app.route('/submissions', methods=['POST'])
def create_submission():
    """Create a new submission."""
    data = request.get_json()

    # Validate required fields
    if not data or 'source_code' not in data or 'language_id' not in data:
        return jsonify({"error": "Missing required fields"}), 400

    # Generate token
    token = str(uuid.uuid4())

    # Store submission
    submissions[token] = {
        "source_code": data["source_code"],
        "language_id": data["language_id"],
        "stdin": data.get("stdin", ""),
        "expected_output": data.get("expected_output", ""),
        "status": {"id": 2, "description": "Processing"},  # Initially processing
        "created_at": time.time()
    }

    return jsonify({"token": token})

@app.route('/submissions/<token>', methods=['GET'])
def get_submission(token):
    """Get submission status/result."""
    if token not in submissions:
        return jsonify({"error": "Submission not found"}), 404

    submission = submissions[token]

    # Debug logging
    print(f"[MOCK] Getting submission {token}")
    print(f"[MOCK] Language: {submission['language_id']}")
    print(f"[MOCK] Source code: {repr(submission['source_code'])}")
    print(f"[MOCK] Stdin: {repr(submission['stdin'])}")
    print(f"[MOCK] Expected output: {repr(submission.get('expected_output'))}")

    # Simulate processing time
    elapsed = time.time() - submission["created_at"]
    if elapsed < 2:  # Still processing
        return jsonify({
            "status": {"id": 2, "description": "Processing"}
        })

    # Execute the code
    if submission["language_id"] == 71:  # Python
        result = execute_python_code(submission["source_code"], submission["stdin"])
        print(f"[MOCK] Python execution result: {result}")
    else:
        result = {
            "stdout": f"Mock output for language {submission['language_id']}",
            "stderr": "",
            "compile_output": "",
            "status": {"id": 3, "description": "Accepted"},
            "time": "0.01",
            "memory": 1234
        }

    # Check expected output
    if submission.get("expected_output") and submission["expected_output"].strip() != result["stdout"].strip():
        print(f"[MOCK] Expected '{submission['expected_output'].strip()}' but got '{result['stdout'].strip()}'")
        result["status"] = {"id": 4, "description": "Wrong Answer"}

    return jsonify(result)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "mock": True})

if __name__ == '__main__':
    port = 2358
    print(f"Starting Mock Judge0 Server on port {port}...")
    print("Available endpoints:")
    print("  GET  /languages")
    print("  POST /submissions")
    print("  GET  /submissions/<token>")
    print("  GET  /health")
    print()
    try:
        app.run(host='127.0.0.1', port=port, debug=False)
    except Exception as e:
        print(f"Failed to start server: {e}")
        # Try alternative port
        try:
            print("Trying port 2359...")
            app.run(host='127.0.0.1', port=2359, debug=False)
        except Exception as e2:
            print(f"Failed on alternative port too: {e2}")
