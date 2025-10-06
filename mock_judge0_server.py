#!/usr/bin/env python3
"""
Mock Judge0 server for testing the sandbox implementation.
Mimics the Judge0 API to allow testing without the full Docker setup.
"""

import json
import time
import uuid
import tempfile
import subprocess
import os
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
    """Execute Python code using subprocess for realistic behavior."""
    try:
        print(f"[MOCK] Executing Python code with subprocess")
        print(f"[MOCK] Code length: {len(source_code)} chars")
        print(f"[MOCK] Stdin: {repr(stdin)}")

        # Create temporary file for the Python code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as code_file:
            code_file.write(source_code)
            code_file_path = code_file.name

        try:
            # Execute the Python code with subprocess
            result = subprocess.run(
                ['python3', code_file_path],
                input=stdin,
                text=True,
                capture_output=True,
                timeout=10,  # 10 second timeout
                env={'PYTHONPATH': os.environ.get('PYTHONPATH', '')}
            )

            # Clean up the temporary file
            os.unlink(code_file_path)

            # Determine status based on return code
            if result.returncode == 0:
                status = {"id": 3, "description": "Accepted"}
            else:
                status = {"id": 5, "description": "Runtime Error"}

            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "compile_output": "",
                "status": status,
                "time": "0.05",  # Mock execution time
                "memory": 2048   # Mock memory usage
            }

        except subprocess.TimeoutExpired:
            # Clean up on timeout
            os.unlink(code_file_path)
            return {
                "stdout": "",
                "stderr": "Execution timed out after 10 seconds",
                "compile_output": "",
                "status": {"id": 5, "description": "Time Limit Exceeded"},
                "time": "10.00",
                "memory": 1024
            }
        except FileNotFoundError:
            # Clean up if python3 not found
            os.unlink(code_file_path)
            return {
                "stdout": "",
                "stderr": "Python interpreter not found",
                "compile_output": "",
                "status": {"id": 5, "description": "Runtime Error"},
                "time": "0.01",
                "memory": 512
            }

    except Exception as e:
        print(f"[MOCK] Execution error: {e}")
        return {
            "stdout": "",
            "stderr": f"Execution error: {str(e)}",
            "compile_output": "",
            "status": {"id": 5, "description": "Runtime Error"},
            "time": "0.01",
            "memory": 512
        }

def execute_java_code(source_code, stdin):
    """Execute Java code using subprocess."""
    try:
        print(f"[MOCK] Executing Java code")

        # For Java, we need a class. If it's just a snippet, wrap it
        if "public class" not in source_code and "class " not in source_code:
            # Wrap as a simple Java class
            source_code = f"""
import java.util.Scanner;

public class Main {{
    public static void main(String[] args) {{
        Scanner scanner = new Scanner(System.in);
        {source_code.replace('input(', 'scanner.nextLine()').replace('print(', 'System.out.println(')}
    }}
}}
"""

        # Create temporary file for the Java code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.java', delete=False) as code_file:
            code_file.write(source_code)
            code_file_path = code_file.name

        try:
            # Compile the Java code
            class_name = "Main"  # Assume Main class
            compile_result = subprocess.run(
                ['javac', code_file_path],
                capture_output=True,
                text=True,
                timeout=10
            )

            if compile_result.returncode != 0:
                os.unlink(code_file_path)
                return {
                    "stdout": "",
                    "stderr": "",
                    "compile_output": compile_result.stderr,
                    "status": {"id": 6, "description": "Compilation Error"},
                    "time": "0.01",
                    "memory": 512
                }

            # Execute the compiled Java code
            result = subprocess.run(
                ['java', '-cp', os.path.dirname(code_file_path), class_name],
                input=stdin,
                text=True,
                capture_output=True,
                timeout=10
            )

            # Clean up files
            os.unlink(code_file_path)
            class_file = code_file_path.replace('.java', '.class')
            if os.path.exists(class_file):
                os.unlink(class_file)

            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "compile_output": "",
                "status": {"id": 3, "description": "Accepted"} if result.returncode == 0 else {"id": 5, "description": "Runtime Error"},
                "time": "0.05",
                "memory": 2048
            }

        except subprocess.TimeoutExpired:
            os.unlink(code_file_path)
            return {
                "stdout": "",
                "stderr": "Execution timed out",
                "compile_output": "",
                "status": {"id": 5, "description": "Time Limit Exceeded"},
                "time": "10.00",
                "memory": 1024
            }

    except Exception as e:
        print(f"[MOCK] Java execution error: {e}")
        return {
            "stdout": "",
            "stderr": f"Execution error: {str(e)}",
            "compile_output": "",
            "status": {"id": 5, "description": "Runtime Error"},
            "time": "0.01",
            "memory": 512
        }

def execute_c_code(source_code, stdin):
    """Execute C code using subprocess."""
    try:
        print(f"[MOCK] Executing C code")

        # Create temporary file for the C code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.c', delete=False) as code_file:
            code_file.write(source_code)
            code_file_path = code_file.name

        try:
            # Compile the C code
            exe_path = code_file_path.replace('.c', '')
            compile_result = subprocess.run(
                ['gcc', code_file_path, '-o', exe_path],
                capture_output=True,
                text=True,
                timeout=10
            )

            if compile_result.returncode != 0:
                os.unlink(code_file_path)
                return {
                    "stdout": "",
                    "stderr": "",
                    "compile_output": compile_result.stderr,
                    "status": {"id": 6, "description": "Compilation Error"},
                    "time": "0.01",
                    "memory": 512
                }

            # Execute the compiled C program
            result = subprocess.run(
                [exe_path],
                input=stdin,
                text=True,
                capture_output=True,
                timeout=10
            )

            # Clean up files
            os.unlink(code_file_path)
            if os.path.exists(exe_path):
                os.unlink(exe_path)

            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "compile_output": "",
                "status": {"id": 3, "description": "Accepted"} if result.returncode == 0 else {"id": 5, "description": "Runtime Error"},
                "time": "0.05",
                "memory": 2048
            }

        except subprocess.TimeoutExpired:
            os.unlink(code_file_path)
            exe_path = code_file_path.replace('.c', '')
            if os.path.exists(exe_path):
                os.unlink(exe_path)
            return {
                "stdout": "",
                "stderr": "Execution timed out",
                "compile_output": "",
                "status": {"id": 5, "description": "Time Limit Exceeded"},
                "time": "10.00",
                "memory": 1024
            }

    except Exception as e:
        print(f"[MOCK] C execution error: {e}")
        return {
            "stdout": "",
            "stderr": f"Execution error: {str(e)}",
            "compile_output": "",
            "status": {"id": 5, "description": "Runtime Error"},
            "time": "0.01",
            "memory": 512
        }

def execute_cpp_code(source_code, stdin):
    """Execute C++ code using subprocess."""
    try:
        print(f"[MOCK] Executing C++ code")

        # Create temporary file for the C++ code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.cpp', delete=False) as code_file:
            code_file.write(source_code)
            code_file_path = code_file.name

        try:
            # Compile the C++ code
            exe_path = code_file_path.replace('.cpp', '')
            compile_result = subprocess.run(
                ['g++', code_file_path, '-o', exe_path],
                capture_output=True,
                text=True,
                timeout=10
            )

            if compile_result.returncode != 0:
                os.unlink(code_file_path)
                return {
                    "stdout": "",
                    "stderr": "",
                    "compile_output": compile_result.stderr,
                    "status": {"id": 6, "description": "Compilation Error"},
                    "time": "0.01",
                    "memory": 512
                }

            # Execute the compiled C++ program
            result = subprocess.run(
                [exe_path],
                input=stdin,
                text=True,
                capture_output=True,
                timeout=10
            )

            # Clean up files
            os.unlink(code_file_path)
            if os.path.exists(exe_path):
                os.unlink(exe_path)

            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "compile_output": "",
                "status": {"id": 3, "description": "Accepted"} if result.returncode == 0 else {"id": 5, "description": "Runtime Error"},
                "time": "0.05",
                "memory": 2048
            }

        except subprocess.TimeoutExpired:
            os.unlink(code_file_path)
            exe_path = code_file_path.replace('.cpp', '')
            if os.path.exists(exe_path):
                os.unlink(exe_path)
            return {
                "stdout": "",
                "stderr": "Execution timed out",
                "compile_output": "",
                "status": {"id": 5, "description": "Time Limit Exceeded"},
                "time": "10.00",
                "memory": 1024
            }

    except Exception as e:
        print(f"[MOCK] C++ execution error: {e}")
        return {
            "stdout": "",
            "stderr": f"Execution error: {str(e)}",
            "compile_output": "",
            "status": {"id": 5, "description": "Runtime Error"},
            "time": "0.01",
            "memory": 512
        }

def execute_javascript_code(source_code, stdin):
    """Execute JavaScript code using Node.js."""
    try:
        print(f"[MOCK] Executing JavaScript code")

        # Create temporary file for the JavaScript code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as code_file:
            code_file.write(source_code)
            code_file_path = code_file.name

        try:
            # Execute the JavaScript code with Node.js
            result = subprocess.run(
                ['node', code_file_path],
                input=stdin,
                text=True,
                capture_output=True,
                timeout=10
            )

            # Clean up the temporary file
            os.unlink(code_file_path)

            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "compile_output": "",
                "status": {"id": 3, "description": "Accepted"} if result.returncode == 0 else {"id": 5, "description": "Runtime Error"},
                "time": "0.05",
                "memory": 2048
            }

        except subprocess.TimeoutExpired:
            os.unlink(code_file_path)
            return {
                "stdout": "",
                "stderr": "Execution timed out after 10 seconds",
                "compile_output": "",
                "status": {"id": 5, "description": "Time Limit Exceeded"},
                "time": "10.00",
                "memory": 1024
            }
        except FileNotFoundError:
            os.unlink(code_file_path)
            return {
                "stdout": "",
                "stderr": "Node.js not found",
                "compile_output": "",
                "status": {"id": 5, "description": "Runtime Error"},
                "time": "0.01",
                "memory": 512
            }

    except Exception as e:
        print(f"[MOCK] JavaScript execution error: {e}")
        return {
            "stdout": "",
            "stderr": f"Execution error: {str(e)}",
            "compile_output": "",
            "status": {"id": 5, "description": "Runtime Error"},
            "time": "0.01",
            "memory": 512
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

    # Execute the code based on language
    if submission["language_id"] == 71:  # Python
        result = execute_python_code(submission["source_code"], submission["stdin"])
        print(f"[MOCK] Python execution result: {result}")
    elif submission["language_id"] == 62:  # Java
        result = execute_java_code(submission["source_code"], submission["stdin"])
        print(f"[MOCK] Java execution result: {result}")
    elif submission["language_id"] == 50:  # C
        result = execute_c_code(submission["source_code"], submission["stdin"])
        print(f"[MOCK] C execution result: {result}")
    elif submission["language_id"] == 54:  # C++
        result = execute_cpp_code(submission["source_code"], submission["stdin"])
        print(f"[MOCK] C++ execution result: {result}")
    elif submission["language_id"] == 63:  # JavaScript (Node.js)
        result = execute_javascript_code(submission["source_code"], submission["stdin"])
        print(f"[MOCK] JavaScript execution result: {result}")
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
    return jsonify({"status": "healthy", "mock": True, "execution": "real"})

if __name__ == '__main__':
    port = 2358
    print(f"Starting Enhanced Judge0 Mock Server on port {port}...")
    print("This server can execute real Python, Java, C, C++, and JavaScript code!")
    print("Available endpoints:")
    print("  GET  /languages")
    print("  POST /submissions")
    print("  GET  /submissions/<token>")
    print("  GET  /health")
    print()
    print("Supported languages:")
    print("  - Python 3 (real execution)")
    print("  - Java (compilation + execution)")
    print("  - C (compilation + execution)")
    print("  - C++ (compilation + execution)")
    print("  - JavaScript/Node.js (real execution)")
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
