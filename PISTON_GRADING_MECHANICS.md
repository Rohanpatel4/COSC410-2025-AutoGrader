# Piston Grading Mechanics Guide

## Overview

This guide explains how **Piston** (the code execution service) internally processes our request body and executes code to produce grading results. This is separate from our integration code - this document focuses on what happens **inside Piston** when we send a request to the `/api/v2/execute` endpoint.

## Table of Contents

1. [Piston Architecture Overview](#piston-architecture-overview)
2. [Request Processing Flow](#request-processing-flow)
3. [File System and Sandboxing](#file-system-and-sandboxing)
4. [Compilation Phase](#compilation-phase)
5. [Execution Phase](#execution-phase)
6. [How Student Code and Test Cases Interact](#how-student-code-and-test-cases-interact)
7. [Output Capture](#output-capture)
8. [Response Generation](#response-generation)
9. [Complete Execution Example](#complete-execution-example)

---

## Piston Architecture Overview

### What is Piston?

Piston is a **containerized code execution engine** that:
- Runs code in isolated Docker containers
- Supports multiple programming languages
- Provides a REST API for code execution
- Handles compilation, execution, and resource limits

### Key Components

1. **API Server**: Receives HTTP requests and routes them
2. **Language Runtimes**: Docker containers with language-specific toolchains
3. **Sandbox Environment**: Isolated execution environment for each request
4. **Resource Manager**: Enforces timeouts and memory limits

---

## Request Processing Flow

### 1. Request Reception

When we send a POST request to `{PISTON_URL}/api/v2/execute`, Piston's API server receives:

```json
{
  "language": "python",
  "version": "3.12.0",
  "files": [
    {
      "name": "main.py",
      "content": "# Complete test harness code..."
    }
  ],
  "stdin": "",
  "args": [],
  "compile_timeout": 10000,
  "run_timeout": 3000,
  "compile_memory_limit": -1,
  "run_memory_limit": -1
}
```

### 2. Request Validation

Piston validates:
- Language is supported
- Version exists for that language
- Files array is not empty
- Timeouts are within acceptable ranges
- Memory limits are valid

### 3. Container Selection

Piston selects or creates a Docker container for the specified language and version:
- Each language/version combination has its own container image
- Containers are pre-configured with compilers, interpreters, and standard libraries
- Example: `piston/python:3.12.0` container for Python 3.12.0

---

## File System and Sandboxing

### Sandbox Creation

For each execution request, Piston creates an **isolated sandbox**:

```
/tmp/piston/{unique_job_id}/
├── main.py          (our test harness file)
└── (any other files we specify)
```

**Key Properties**:
- **Isolated**: Each execution runs in its own directory
- **Ephemeral**: Directory is deleted after execution completes
- **Read-only base**: Base container filesystem is read-only
- **Writable workspace**: Only the job directory is writable

### File Writing

Piston writes each file from the `files` array to the sandbox:

```python
# Pseudo-code of what Piston does internally:
for file in request_body["files"]:
    file_path = f"/tmp/piston/{job_id}/{file['name']}"
    with open(file_path, 'w') as f:
        f.write(file['content'])
```

**Important**: We send **one file** (`main.py`) containing the **complete test harness** (student code + test execution code already combined). Piston doesn't know about "student code" vs "test code" - it just sees one file to execute.

---

## Compilation Phase

### When Compilation Happens

Some languages require compilation before execution:
- **Compiled languages**: C++, Java, Rust, Go
- **Interpreted languages**: Python, JavaScript, Ruby (skip compilation)

### Compilation Process

For compiled languages, Piston:

1. **Runs the compiler** in the sandbox:
   ```bash
   # Example for C++
   g++ -o main main.cpp -std=c++17
   
   # Example for Java
   javac Main.java
   ```

2. **Captures compilation output**:
   - `stdout`: Compiler messages, warnings
   - `stderr`: Compilation errors
   - `returncode`: 0 = success, non-zero = failure

3. **Stops if compilation fails**:
   - Returns response with `compile.stderr` containing error messages
   - Does NOT proceed to execution phase

### Compilation Response Structure

```json
{
  "compile": {
    "stdout": "Compilation successful",
    "stderr": "",
    "code": 0
  },
  "run": {
    // ... (only if compilation succeeded)
  }
}
```

---

## Execution Phase

### Execution Environment

Once compilation succeeds (or for interpreted languages), Piston executes the code:

1. **Sets up environment**:
   - Working directory: `/tmp/piston/{job_id}/`
   - Standard input: From `request_body["stdin"]`
   - Command-line arguments: From `request_body["args"]`

2. **Runs the program**:
   ```bash
   # For Python
   python3 main.py
   
   # For Java
   java Main
   
   # For C++
   ./main
   ```

3. **Monitors execution**:
   - **Timeout**: Kills process if `run_timeout` exceeded
   - **Memory**: Monitors memory usage (if limit set)
   - **Signals**: Captures termination signals (SIGKILL, SIGTERM, etc.)

### Resource Limits

Piston enforces:
- **Time limit**: Process is killed if execution exceeds `run_timeout` milliseconds
- **Memory limit**: Process is killed if memory exceeds `run_memory_limit` (if set)
- **CPU limits**: Container CPU quotas
- **Network isolation**: No network access (unless explicitly enabled)

---

## How Student Code and Test Cases Interact

### Critical Understanding

**Piston does NOT see "student code" and "test cases" as separate entities.**

Instead, Piston receives **one complete program** (our test harness) that we've already assembled. Here's how it works:

### Our Test Harness Structure

Before sending to Piston, we combine everything into one file:

```python
# This is what we send to Piston as "main.py"

# ===== STUDENT CODE SECTION =====
def add(a, b):
    return a + b
# (Student's actual submission)

# ===== TEST HARNESS INFRASTRUCTURE =====
import sys
import io
# ... (test harness setup code)

# ===== TEST EXECUTION CODE =====
# Test case 1
_tc_1_passed = False
try:
    assert add(2, 3) == 5  # This calls the student's function!
    _tc_1_passed = True
except AssertionError:
    pass
# ... (more test cases)

# ===== OUTPUT FORMATTING =====
if _tc_1_passed:
    print("PASSED: test_case_1:10")
else:
    print("FAILED: test_case_1:10")
```

### Execution Flow Inside Piston

When Piston executes this file:

1. **Python interpreter loads the file**:
   - All code is in the same namespace
   - Student's functions are defined first
   - Test harness code runs after

2. **Student code executes**:
   ```python
   def add(a, b):  # ← Defined in global scope
       return a + b
   ```

3. **Test code executes**:
   ```python
   assert add(2, 3) == 5  # ← Calls student's function
   ```

4. **Output is printed**:
   ```python
   print("PASSED: test_case_1:10")  # ← Goes to stdout
   ```

### Why This Works

- **Same namespace**: Student code and test code share the same Python `globals()` dictionary
- **Execution order**: Student code is loaded first, then tests run
- **Direct function calls**: Tests directly call student functions by name
- **Exception handling**: Test harness catches exceptions and formats output

### Example: Java Execution

For Java, the structure is similar but uses classes:

```java
// ===== TEST HARNESS (Main class) =====
public class Main {
    public static void main(String[] args) {
        Solution s = new Solution();  // ← Creates student's class
        // Run tests...
    }
}

// ===== STUDENT CODE =====
class Solution {  // ← Student's class (package-private)
    public int add(int a, int b) {
        return a + b;
    }
}
```

When Piston compiles and runs:
1. `javac Main.java` compiles both classes
2. `java Main` runs the main method
3. Main creates a `Solution` instance and calls its methods
4. Test results are printed to stdout

---

## Output Capture

### Standard Output (stdout)

Piston captures everything printed to `stdout`:
- `print()` statements in Python
- `System.out.println()` in Java
- `std::cout` in C++
- Any other stdout writes

### Standard Error (stderr)

Piston captures everything printed to `stderr`:
- Error messages
- Stack traces
- Compiler warnings (during compilation)
- Runtime errors

### Capture Mechanism

Piston uses process pipes to capture output:

```python
# Pseudo-code of Piston's capture mechanism:
process = subprocess.Popen(
    ["python3", "main.py"],
    stdout=subprocess.PIPE,  # ← Capture stdout
    stderr=subprocess.PIPE,  # ← Capture stderr
    cwd=f"/tmp/piston/{job_id}/"
)

stdout_data, stderr_data = process.communicate(timeout=run_timeout)
returncode = process.returncode
```

### Output Format

Our test harness produces structured output:

```
PASSED: test_case_1:10
FAILED: test_case_2:5
ERROR_2: NameError: name 'x' is not defined
OUTPUT_2: 'some output'
=== Test Results ===
Passed: 1
Failed: 1
Total: 2
Earned: 10
TotalPoints: 15
```

Piston captures this **exactly as printed** and returns it in the response.

---

## Response Generation

### Response Structure

After execution completes, Piston builds the response:

```json
{
  "compile": {
    "stdout": "...",
    "stderr": "...",
    "code": 0
  },
  "run": {
    "stdout": "PASSED: test_case_1:10\n...",
    "stderr": "",
    "code": 0,
    "signal": null
  }
}
```

### Response Fields

#### Compile Section
- `stdout`: Compiler output (warnings, messages)
- `stderr`: Compilation errors (if any)
- `code`: Compilation return code (0 = success)

#### Run Section
- `stdout`: Program output (our test results)
- `stderr`: Runtime errors, exceptions
- `code`: Program exit code (0 = success, non-zero = failure)
- `signal`: Termination signal (SIGKILL if timeout, null otherwise)

### Exit Code Interpretation

- **0**: Program completed successfully
- **Non-zero**: Program failed (exception, assertion failure, etc.)
- **Signal**: Process was killed (timeout, memory limit, etc.)

**Important**: A non-zero exit code doesn't necessarily mean the student code is wrong - it could mean:
- A test assertion failed (expected behavior)
- A runtime error occurred (student code bug)
- The program was killed (timeout)

We parse the stdout to determine actual test results.

---

## Complete Execution Example

### Step-by-Step: Python Execution

#### 1. Request Received

```json
{
  "language": "python",
  "version": "3.12.0",
  "files": [{
    "name": "main.py",
    "content": "# ... (complete test harness) ..."
  }],
  "run_timeout": 3000
}
```

#### 2. Sandbox Created

```
/tmp/piston/job_abc123/
└── main.py  (written from files[0].content)
```

#### 3. Compilation Phase (Skipped for Python)

Python is interpreted, so no compilation step.

#### 4. Execution Phase

Piston runs:
```bash
cd /tmp/piston/job_abc123/
python3 main.py
```

#### 5. Program Execution

Inside the Python process:

```python
# 1. Student code loads
def add(a, b):
    return a + b  # ← Defined in globals()

# 2. Test harness setup
import sys, io
# ... (setup code)

# 3. Test execution
try:
    assert add(2, 3) == 5  # ← Calls student function
    _tc_1_passed = True
except AssertionError:
    pass

# 4. Output printing
print("PASSED: test_case_1:10")  # ← Goes to stdout
print("\n=== Test Results ===")
print("Passed: 1")
# ... (more output)
```

#### 6. Output Capture

Piston captures stdout:
```
PASSED: test_case_1:10

=== Test Results ===
Passed: 1
Failed: 0
Total: 1
Earned: 10
TotalPoints: 10
```

#### 7. Response Sent

```json
{
  "compile": {
    "stdout": "",
    "stderr": "",
    "code": 0
  },
  "run": {
    "stdout": "PASSED: test_case_1:10\n\n=== Test Results ===\nPassed: 1\n...",
    "stderr": "",
    "code": 0,
    "signal": null
  }
}
```

### Step-by-Step: C++ Execution

#### 1. Request Received

```json
{
  "language": "c++",
  "version": "10.2.0",
  "files": [{
    "name": "main.cpp",
    "content": "#include <iostream>\n// ... (complete test harness) ..."
  }],
  "compile_timeout": 10000,
  "run_timeout": 3000
}
```

#### 2. Sandbox Created

```
/tmp/piston/job_xyz789/
└── main.cpp
```

#### 3. Compilation Phase

Piston runs:
```bash
cd /tmp/piston/job_xyz789/
g++ -o main main.cpp -std=c++17
```

**If compilation fails**:
```json
{
  "compile": {
    "stdout": "",
    "stderr": "main.cpp:5:10: error: expected ';' before 'return'",
    "code": 1
  }
}
```
Execution phase is skipped.

**If compilation succeeds**:
```json
{
  "compile": {
    "stdout": "",
    "stderr": "",
    "code": 0
  }
}
```
Proceeds to execution.

#### 4. Execution Phase

Piston runs:
```bash
cd /tmp/piston/job_xyz789/
./main
```

#### 5. Program Execution

Inside the C++ process:
- Student code functions are defined
- Test harness calls those functions
- Results are printed to `std::cout`

#### 6. Output Capture

Piston captures `stdout`:
```
PASSED: test_case_1:10
```

#### 7. Response Sent

```json
{
  "compile": {
    "stdout": "",
    "stderr": "",
    "code": 0
  },
  "run": {
    "stdout": "PASSED: test_case_1:10\n...",
    "stderr": "",
    "code": 0,
    "signal": null
  }
}
```

---

## Key Insights

### 1. Single File Execution

Piston executes **one file** containing the complete program. We combine student code and test code **before** sending to Piston.

### 2. Shared Namespace

Student code and test code share the same execution environment:
- Same global variables
- Same function definitions
- Same imports/libraries

### 3. Execution Order Matters

Our test harness ensures:
1. Student code loads first
2. Test code runs after
3. Output is formatted consistently

### 4. Output is Just Text

Piston doesn't understand our output format - it just captures text. We parse it on our side to extract grading information.

### 5. Sandbox Isolation

Each execution is completely isolated:
- No access to previous executions
- No access to other users' code
- No network access (by default)
- Ephemeral filesystem

### 6. Resource Limits

Piston enforces strict limits:
- Time: Process killed after timeout
- Memory: Process killed if limit exceeded
- CPU: Container quotas
- Disk: Limited to sandbox directory

---

## Summary

Piston's grading process:

1. **Receives** our request with a complete test harness file
2. **Creates** an isolated sandbox environment
3. **Compiles** (if needed) the code
4. **Executes** the program in the sandbox
5. **Captures** stdout and stderr
6. **Returns** structured response with output

The "grading" happens because:
- Our test harness calls student functions
- Test assertions verify correctness
- Results are printed in a structured format
- We parse the output to extract grades

Piston itself doesn't "grade" - it just executes code. **We do the grading** by designing test harnesses that verify student code and produce parseable output.

---

## References

- [Piston GitHub Repository](https://github.com/engineer-man/piston)
- [Piston API Documentation](https://github.com/engineer-man/piston#api)
- Our Integration: See `PISTON_INTEGRATION_GUIDE.md`

