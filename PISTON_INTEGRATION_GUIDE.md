# Piston Integration Guide

## Overview

This guide explains how our autograder integrates with the Piston API to execute and grade student code submissions. The system uses a template-based approach that is language-agnostic, making it easy to support multiple programming languages.

## Table of Contents

1. [Template System Architecture](#template-system-architecture)
2. [Placeholder Variable Injection](#placeholder-variable-injection)
3. [Test Execution Code Generation](#test-execution-code-generation)
4. [Request Body Construction](#request-body-construction)
5. [Piston Grading Workflow](#piston-grading-workflow)
6. [Code Flow Diagram](#code-flow-diagram)
7. [Complete Example Walkthrough](#complete-example-walkthrough)

---

## Template System Architecture

### Location and Structure

Templates are stored in `backend/app/services/templates/` and follow a naming convention:
- `{language}_test.{extension}` (e.g., `python_test.py`, `java_test.java`, `cpp_test.cpp`, `rust_test.rs`)
- `generic_test.txt` (fallback template for unsupported languages)

### Purpose

Templates provide a **language-agnostic test harness structure** that:
- Loads and executes student code safely
- Captures console output from student code
- Executes test cases with proper error handling
- Formats output in a standardized way for parsing

### Template Loading

The `load_template()` function (lines 807-828 in `piston.py`) handles template loading:

```python
def load_template(language: str) -> str:
    """Load template file for a language."""
    template_dir = Path(__file__).parent / "templates"
    language_lower = language.lower()
    
    # Map gcc to cpp for template lookup (templates use cpp naming)
    template_language = "cpp" if language_lower == "gcc" else language_lower
    
    extension = get_file_extension(language)
    template_path = template_dir / f"{template_language}_test{extension}"
    
    # Try to load language-specific template
    if template_path.exists():
        return template_path.read_text(encoding="utf-8")
    
    # Fallback to generic template
    generic_path = template_dir / "generic_test.txt"
    if generic_path.exists():
        return generic_path.read_text(encoding="utf-8")
    
    # Last resort: return empty template
    return "# Template not found\n$student_code\n$test_execution_code"
```

**Key Features**:
- Language name normalization (e.g., `gcc` → `cpp`)
- File extension mapping via `get_file_extension()`
- Graceful fallback to generic template
- Last resort empty template to prevent crashes

---

## Placeholder Variable Injection

### Placeholder Variables

Templates use two main placeholders that get replaced during test harness generation:

1. **`$student_code`**: The student's submitted code
2. **`$test_execution_code`**: Generated code that executes all test cases

### Template Substitution Process

The `generate_test_harness()` function (lines 1219-1256 in `piston.py`) performs the substitution:

```python
def generate_test_harness(language: str, student_code: str, test_cases: list[dict]) -> str:
    """Generate complete test harness using template system."""
    # For Java: Make student's class package-private (remove 'public' modifier)
    if language.lower() == "java":
        student_code = re.sub(r'\bpublic\s+class\s+(\w+)\b', r'class \1', student_code)
    
    # Load template
    template_content = load_template(language)
    
    # Generate test execution code
    test_execution_code = generate_test_execution_code(language, test_cases)
    
    # For Python template: use simple string replacement to preserve indentation
    if language.lower() == "python":
        rendered = template_content.replace("$student_code", student_code)
        rendered = rendered.replace("$test_execution_code", test_execution_code)
        return rendered
    
    # For other languages, use Template substitution
    template = Template(template_content)
    
    # Render template
    try:
        rendered = template.substitute(
            student_code=student_code,
            test_execution_code=test_execution_code
        )
        return rendered
    except KeyError as e:
        # Handle missing placeholders
        raise ValueError(f"Template missing placeholder: {e}")
```

**Important Notes**:
- **Python**: Uses string replacement (not `Template` class) to preserve indentation in the generated code
- **Other languages**: Uses Python's `string.Template` class for safe substitution
- **Java special handling**: Removes `public` modifier from student classes (Java only allows one public class per file)

### Example: Python Template Substitution

**Template snippet** (`python_test.py`):
```python
_student_code_loaded = False
try:
    # Student code starts here
    exec('''
$student_code
''', globals())
    _student_code_loaded = True
except Exception as _load_err:
    print(f"Error: {_load_err}", file=_student_code_error)

# Only run tests if student code loaded successfully
if _student_code_loaded:
$test_execution_code
```

**After substitution** (with student code `def add(a, b): return a + b`):
```python
_student_code_loaded = False
try:
    # Student code starts here
    exec('''
def add(a, b): return a + b
''', globals())
    _student_code_loaded = True
except Exception as _load_err:
    print(f"Error: {_load_err}", file=_student_code_error)

# Only run tests if student code loaded successfully
if _student_code_loaded:
    # Test case 1
    _tc_1_out = io.StringIO()
    # ... (test execution code)
```

---

## Test Execution Code Generation

### Language-Specific Generators

Each language has a dedicated generator function that converts test cases into executable test code:

- **Python**: `_generate_python_test_execution()` (lines 831-902)
- **Java**: `_generate_java_test_execution()` (lines 905-985)
- **C++**: `_generate_cpp_test_execution()` (lines 988-1083)
- **Rust**: `_generate_rust_test_execution()` (lines 1086-1182)

### Assert Statement Conversion

Each generator converts faculty-written `assert` statements into language-appropriate test code:

#### Python
- Keeps `assert` statements as-is
- Wraps in try/except to catch `AssertionError` (test failure) vs other exceptions (student code errors)

#### Java
- Converts `assert condition;` → `if (!(condition)) throw new AssertionError();`
- Wraps in try/catch blocks

#### C++
- Converts `assert(...)` → `test_assert(...)` (uses custom macro defined in template)
- The `test_assert` macro throws `std::runtime_error` instead of aborting

#### Rust
- Converts `assert ...` → `assert!(...)` or keeps `assert_eq!`/`assert_ne!` as-is
- Uses `std::panic::catch_unwind()` to catch panics

### Test Result Formatting

All generators produce output in a standardized format:

```
PASSED: test_case_{id}:{points}
FAILED: test_case_{id}:{points}
ERROR_{id}: error message
OUTPUT_{id}: 'output string'
STDERR_{id}: 'stderr string'
```

**Example Python Generator Output**:
```python
# Test case 1
_tc_1_out = io.StringIO()
_tc_1_err = io.StringIO()
sys.stdout = _tc_1_out
sys.stderr = _tc_1_err
_tc_1_error_msg = None
_tc_1_passed = False
try:
    assert add(2, 3) == 5
    _tc_1_passed = True
except AssertionError:
    pass
except Exception as e:
    _tc_1_error_msg = f"{type(e).__name__}: {e}"
finally:
    sys.stdout = _original_stdout
    sys.stderr = _original_stderr

if _tc_1_passed:
    print(f"PASSED: test_case_1:10")
else:
    print(f"FAILED: test_case_1:10")
    if _tc_1_error_msg:
        print(f"ERROR_1: {_tc_1_error_msg}")
```

---

## Request Body Construction

### The `execute_code()` Function

The `execute_code()` function (lines 267-456 in `piston.py`) orchestrates the entire execution process:

1. Generates test harness via `generate_test_harness()`
2. Gets language version from Piston
3. Builds request body
4. Sends POST request to Piston API
5. Parses response and returns structured result

### Request Body Structure

The request body sent to Piston's `/api/v2/execute` endpoint:

```python
request_body = {
    "language": piston_language,      # Normalized language name (e.g., "c++" not "gcc")
    "version": language_version,      # Version string from get_language_version()
    "files": [{
        "name": main_file,            # e.g., "main.py", "main.java", "main.cpp"
        "content": combined_code      # Complete test harness with student code
    }],
    "stdin": "",                      # Standard input (empty for our use case)
    "args": [],                       # Command-line arguments (empty)
    "compile_timeout": 10000,         # 10 seconds for compilation
    "run_timeout": capped_timeout,    # Execution timeout (capped at 3000ms)
    "compile_memory_limit": -1,       # No memory limit for compilation
    "run_memory_limit": -1            # No memory limit for execution
}
```

### Language Normalization

Before building the request, languages are normalized:

```python
piston_language = language.lower()
if piston_language == "gcc":
    piston_language = "c++"  # Piston uses "c++" for C++ compilation
```

**Why?** Piston's API expects `"c++"` for C++ code, but users might specify `"gcc"` or `"cpp"` in assignments.

### File Extension Mapping

The `get_file_extension()` function (lines 789-804) maps languages to file extensions:

```python
extensions = {
    "python": ".py",
    "java": ".java",
    "gcc": ".cpp",
    "cpp": ".cpp",
    "c": ".c",
    "rust": ".rs",
    # ... more languages
}
```

This ensures the generated file has the correct extension for Piston to recognize the language.

---

## Piston Grading Workflow

### Execution Flow

1. **Generate Test Harness**
   - Load template for the language
   - Generate test execution code
   - Substitute placeholders with student code and test code
   - Result: Complete executable program

2. **Build Request Body**
   - Normalize language name
   - Get language version from Piston
   - Create file with generated code
   - Set timeouts and limits

3. **POST to Piston API**
   - Endpoint: `{PISTON_URL}/api/v2/execute`
   - Method: POST
   - Body: JSON request body (see above)

4. **Handle Piston Response**

   Piston returns a structured response:
   ```json
   {
     "compile": {
       "stdout": "...",
       "stderr": "...",
       "code": 0
     },
     "run": {
       "stdout": "...",
       "stderr": "...",
       "code": 0,
       "signal": null
     }
   }
   ```

   **Error Handling**:
   - If `compile.stderr` is non-empty → compilation error
   - If `run.code != 0` → execution error or test failure
   - If `run.signal == "SIGKILL"` → timeout

### Output Parsing

The `parse_test_output()` function (lines 99-248 in `piston.py`) parses the structured output from the test harness.

#### Parsed Output Format

The parser looks for these patterns in stdout/stderr:

1. **Test Results**:
   - `PASSED: test_case_{id}:{points}`
   - `FAILED: test_case_{id}:{points}`

2. **Per-Test Details**:
   - `ERROR_{id}: message` - Error message for a specific test
   - `OUTPUT_{id}: 'output'` - Captured stdout for a test
   - `STDERR_{id}: 'stderr'` - Captured stderr for a test

3. **Console Output** (student code output):
   - Between `=== Console Output ===` and `=== End Console Output ===`

4. **Summary Section**:
   ```
   === Test Results ===
   Passed: {count}
   Failed: {count}
   Total: {count}
   Earned: {points}
   TotalPoints: {points}
   ```

#### Parsing Logic

```python
def parse_test_output(stdout: str, stderr: str) -> Dict[str, Any]:
    combined_output = (stdout or "") + "\n" + (stderr or "")
    lines = combined_output.split('\n')
    
    # Parse individual test case results
    for line in lines:
        if line.startswith('PASSED:'):
            # Extract test_case_{id}:{points}
            match = re.match(r'PASSED:\s*test_case_(\d+):(\d+)', line)
            # ... store in test_case_results
        
        elif line.startswith('FAILED:'):
            # Similar extraction for failed tests
        
        elif line.startswith('ERROR_'):
            # Extract error message for specific test
        
        # ... more parsing logic
    
    # Build result dictionary
    return {
        "total_tests": total_tests,
        "passed_tests": passed_tests,
        "failed_tests": failed_tests,
        "earned_points": earned_points,
        "total_points": total_points,
        "test_case_results": test_case_results,  # Per-test details
        "console_output": console_output
    }
```

### Status Mapping

The `_map_status_to_result()` function (lines 253-264) maps execution results to status codes:

```python
def _map_status_to_result(returncode: int | None, timed_out: bool = False) -> int:
    if timed_out:
        return 5  # Time Limit Exceeded
    if returncode is None:
        return 13  # Internal Error
    if returncode == 0:
        return 3  # Accepted
    return 4  # Wrong Answer
```

**Status Code Meanings**:
- `3`: Accepted (all tests passed)
- `4`: Wrong Answer (some tests failed)
- `5`: Time Limit Exceeded
- `13`: Internal Error (compilation error, runtime error, etc.)

---

## Code Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Student Code + Test Cases                                    │
│ Input: def add(a, b): return a + b                         │
│        assert add(2, 3) == 5                                │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ generate_test_harness(language, student_code, test_cases)  │
│                                                              │
│  ├─ load_template(language)                                 │
│  │   └─ Returns: python_test.py template                   │
│  │                                                           │
│  ├─ generate_test_execution_code(language, test_cases)      │
│  │   └─ Returns: Python test execution code                 │
│  │      (with try/except, output capture, etc.)            │
│  │                                                           │
│  └─ Template.substitute() or string.replace()              │
│      └─ Replaces $student_code and $test_execution_code    │
│      └─ Returns: Complete test harness                      │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ execute_code(language, student_code, test_cases)           │
│                                                              │
│  ├─ Generate test harness (above)                           │
│  ├─ get_language_version(language)                         │
│  │   └─ Returns: "3.12.0" (for Python)                     │
│  ├─ get_file_extension(language)                           │
│  │   └─ Returns: ".py"                                     │
│  ├─ Build request body:                                    │
│  │   {                                                      │
│  │     "language": "python",                               │
│  │     "version": "3.12.0",                                │
│  │     "files": [{"name": "main.py", "content": "..."}],  │
│  │     "run_timeout": 3000,                                 │
│  │     ...                                                 │
│  │   }                                                      │
│  └─ POST to {PISTON_URL}/api/v2/execute                   │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Piston API Execution                                        │
│                                                              │
│  1. Compiles code (if needed)                               │
│  2. Executes code in sandbox                                │
│  3. Captures stdout/stderr                                  │
│  4. Returns response:                                       │
│     {                                                       │
│       "compile": {...},                                    │
│       "run": {                                             │
│         "stdout": "PASSED: test_case_1:10\n...",           │
│         "stderr": "",                                      │
│         "code": 0                                          │
│       }                                                     │
│     }                                                       │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ parse_test_output(stdout, stderr)                          │
│                                                              │
│  ├─ Parse "PASSED:" and "FAILED:" lines                    │
│  ├─ Extract ERROR_{id}, OUTPUT_{id}, STDERR_{id}          │
│  ├─ Extract console output between markers                 │
│  └─ Build grading dictionary:                              │
│      {                                                      │
│        "total_tests": 1,                                    │
│        "passed_tests": 1,                                   │
│        "earned_points": 10,                                │
│        "total_points": 10,                                 │
│        "test_case_results": {...},                         │
│        "console_output": ""                                │
│      }                                                      │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Return to assignments.py                                   │
│                                                              │
│  Final result includes:                                     │
│  - Grading dictionary                                       │
│  - Status code (3 = Accepted)                              │
│  - stdout/stderr for display                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Complete Example Walkthrough

### Input

**Student Code**:
```python
def add(a, b):
    return a + b
```

**Test Case**:
```python
assert add(2, 3) == 5
```
- Test ID: 1
- Points: 10

### Step 1: Template Loading

**Template** (`python_test.py`):
```python
# ... imports and setup code ...

_student_code_loaded = False
try:
    exec('''
$student_code
''', globals())
    _student_code_loaded = True
except Exception as _load_err:
    print(f"Error: {_load_err}", file=_student_code_error)

# Only run tests if student code loaded successfully
if _student_code_loaded:
$test_execution_code

# ... summary output code ...
```

### Step 2: Test Execution Code Generation

**Generated Test Code** (from `_generate_python_test_execution()`):
```python
    # Test case 1
    _tc_1_out = io.StringIO()
    _tc_1_err = io.StringIO()
    sys.stdout = _tc_1_out
    sys.stderr = _tc_1_err
    _tc_1_error_msg = None
    _tc_1_passed = False
    try:
        assert add(2, 3) == 5
        _tc_1_passed = True
    except AssertionError:
        pass
    except Exception as e:
        _tc_1_error_msg = f"{type(e).__name__}: {e}"
    finally:
        sys.stdout = _original_stdout
        sys.stderr = _original_stderr

    _tc_1_output = _tc_1_out.getvalue()
    _tc_1_stderr = _tc_1_err.getvalue()

    test_results.append({
        "id": 1,
        "passed": _tc_1_passed,
        "points": 10,
        "output": _tc_1_output,
        "error": _tc_1_error_msg,
        "stderr": _tc_1_stderr
    })

    if _tc_1_passed:
        print(f"PASSED: test_case_1:10")
    else:
        print(f"FAILED: test_case_1:10")
        if _tc_1_error_msg:
            print(f"ERROR_1: {_tc_1_error_msg}")
        if _tc_1_output:
            print(f"OUTPUT_1: {repr(_tc_1_output)}")
        if _tc_1_stderr:
            print(f"STDERR_1: {repr(_tc_1_stderr)}")
```

### Step 3: Template Substitution

**Final Test Harness** (after substitution):
```python
# ... imports and setup ...

_student_code_loaded = False
try:
    exec('''
def add(a, b):
    return a + b
''', globals())
    _student_code_loaded = True
except Exception as _load_err:
    print(f"Error: {_load_err}", file=_student_code_error)

# Only run tests if student code loaded successfully
if _student_code_loaded:
    # Test case 1
    _tc_1_out = io.StringIO()
    # ... (full test execution code from Step 2) ...

# ... summary output ...
```

### Step 4: Request Body Construction

**Request Body**:
```json
{
  "language": "python",
  "version": "3.12.0",
  "files": [
    {
      "name": "main.py",
      "content": "# ... (complete test harness from Step 3) ..."
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

### Step 5: Piston Response

**Piston API Response**:
```json
{
  "compile": {
    "stdout": "",
    "stderr": "",
    "code": 0
  },
  "run": {
    "stdout": "PASSED: test_case_1:10\n\n=== Test Results ===\nPassed: 1\nFailed: 0\nTotal: 1\nEarned: 10\nTotalPoints: 10\n",
    "stderr": "",
    "code": 0,
    "signal": null
  }
}
```

### Step 6: Output Parsing

**Parsed Result** (from `parse_test_output()`):
```python
{
    "total_tests": 1,
    "passed_tests": 1,
    "failed_tests": 0,
    "earned_points": 10,
    "total_points": 10,
    "passed": True,
    "all_passed": True,
    "has_tests": True,
    "test_case_results": {
        1: {
            "passed": True,
            "points": 10,
            "output": "",
            "error": None,
            "stderr": ""
        }
    },
    "console_output": ""
}
```

### Step 7: Final Response

**Returned to `assignments.py`**:
```python
{
    "stdout": "PASSED: test_case_1:10\n\n=== Test Results ===\n...",
    "stderr": "",
    "returncode": 0,
    "status": {"id": 3},  # Accepted
    "time": None,
    "memory": None,
    "language_id_used": 0,
    "grading": {
        "total_tests": 1,
        "passed_tests": 1,
        "failed_tests": 0,
        "earned_points": 10,
        "total_points": 10,
        "passed": True,
        "all_passed": True,
        "has_tests": True,
        "test_case_results": {...},
        "console_output": ""
    }
}
```

---

## Key Design Principles

### 1. Language-Agnostic Architecture

The template system allows adding new languages by:
- Creating a new template file: `{language}_test.{extension}`
- Adding a generator function: `_generate_{language}_test_execution()`
- Updating `generate_test_execution_code()` to route to the new generator

### 2. Separation of Concerns

- **Templates**: Define the structure and flow
- **Generators**: Handle language-specific test code generation
- **Parser**: Interprets standardized output format
- **Executor**: Handles Piston API communication

### 3. Standardized Output Format

All languages produce the same output format:
- `PASSED: test_case_{id}:{points}`
- `FAILED: test_case_{id}:{points}`
- `ERROR_{id}: message`
- Summary section with totals

This allows a single parser to work for all languages.

### 4. Error Handling

- Compilation errors are caught and reported
- Runtime errors are distinguished from test failures
- Timeouts are handled gracefully
- Connection failures trigger backoff mechanism

---

## Code References

### Main File
- `backend/app/services/piston.py` - Core Piston integration

### Key Functions
- `generate_test_harness()` (line 1219) - Main harness generator
- `load_template()` (line 807) - Template loader
- `generate_test_execution_code()` (line 1203) - Test code generator router
- `execute_code()` (line 267) - Main execution function
- `parse_test_output()` (line 99) - Output parser
- `_map_status_to_result()` (line 253) - Status code mapper

### Template Files
- `backend/app/services/templates/python_test.py`
- `backend/app/services/templates/java_test.java`
- `backend/app/services/templates/cpp_test.cpp`
- `backend/app/services/templates/rust_test.rs`
- `backend/app/services/templates/generic_test.txt`

---

## Summary

The Piston integration uses a **template-based, language-agnostic approach** that:

1. **Loads** language-specific templates with placeholders
2. **Generates** test execution code from faculty-written test cases
3. **Substitutes** placeholders to create a complete test harness
4. **Sends** the harness to Piston API for execution
5. **Parses** the standardized output to extract grading results

This design makes it easy to add new languages while maintaining consistent grading behavior across all supported languages.

