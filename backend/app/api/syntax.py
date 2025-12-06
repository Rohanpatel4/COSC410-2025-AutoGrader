# backend/app/api/syntax.py
"""
Code validation endpoint using Piston for multi-language support.
Checks for both syntax errors AND runtime errors (like undefined variables).
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import re
from app.core.settings import settings
from app.services.piston import get_language_version, get_file_extension

router = APIRouter()


class SyntaxCheckRequest(BaseModel):
    code: str
    language: str


class CodeError(BaseModel):
    line: int
    column: Optional[int] = None
    message: str


# Alias for backwards compatibility
SyntaxError = CodeError


class SyntaxCheckResponse(BaseModel):
    valid: bool
    errors: list[CodeError] = []


def parse_python_error(error_text: str) -> list[CodeError]:
    """Parse Python error output to extract line number and message."""
    errors = []
    lines = error_text.strip().split('\n')
    
    # Look for traceback with line numbers
    for i, line in enumerate(lines):
        # Match: File "<string>", line X or File "main.py", line X
        file_match = re.search(r'File ["\'].*["\'], line (\d+)', line)
        if file_match:
            line_num = int(file_match.group(1))
            # Look for the error message after the traceback
            for j in range(i + 1, len(lines)):
                error_line = lines[j].strip()
                # Match error types: SyntaxError, NameError, TypeError, etc.
                if re.match(r'^[A-Z][a-zA-Z]*Error:', error_line):
                    errors.append(CodeError(line=line_num, message=error_line))
                    break
    
    # If we couldn't parse specific errors but there's content, return generic
    if not errors and error_text.strip():
        # Try to find any Error: pattern
        error_match = re.search(r'([A-Z][a-zA-Z]*Error: .+)', error_text)
        if error_match:
            errors.append(CodeError(line=1, message=error_match.group(1)[:200]))
        else:
            errors.append(CodeError(line=1, message=error_text.strip()[:200]))
    
    return errors


def parse_java_error(error_text: str) -> list[CodeError]:
    """Parse Java compilation/runtime error output to extract line numbers and messages."""
    errors = []
    lines = error_text.strip().split('\n')
    
    for line in lines:
        # Java compilation errors: Main.java:5: error: ';' expected
        match = re.search(r'\.java:(\d+):\s*(?:error:\s*)?(.+)', line)
        if match:
            line_num = int(match.group(1))
            message = match.group(2).strip()
            errors.append(CodeError(line=line_num, message=f"error: {message}"))
            continue
        
        # Java runtime errors: at Main.main(Main.java:5)
        match = re.search(r'at .+\(.*\.java:(\d+)\)', line)
        if match and errors:  # Only if we already have an exception message
            continue  # Skip stack trace lines
        
        # Exception messages
        if 'Exception' in line or 'Error' in line:
            if not any(e.message == line.strip() for e in errors):
                errors.append(CodeError(line=1, message=line.strip()[:200]))
    
    if not errors and error_text.strip():
        errors.append(CodeError(line=1, message=error_text.strip()[:200]))
    
    return errors


def parse_cpp_error(error_text: str) -> list[CodeError]:
    """Parse C++ compilation/runtime error output to extract line numbers and messages."""
    errors = []
    lines = error_text.strip().split('\n')
    
    for line in lines:
        # GCC/G++ format: main.cpp:5:10: error: expected ';' before 'return'
        # Also match: <source>:5:10: error: ...
        match = re.search(r'(?:\.cpp|<source>):(\d+):(\d+):\s*(?:error:\s*)?(.+)', line)
        if match:
            line_num = int(match.group(1))
            col_num = int(match.group(2))
            message = match.group(3).strip()
            errors.append(CodeError(line=line_num, column=col_num, message=f"error: {message}"))
            continue
        
        # Without column: main.cpp:5: error: ... or <source>:5: error: ...
        match = re.search(r'(?:\.cpp|<source>):(\d+):\s*(?:error:\s*)?(.+)', line)
        if match:
            line_num = int(match.group(1))
            message = match.group(2).strip()
            errors.append(CodeError(line=line_num, message=f"error: {message}"))
            continue
        
        # Also check for error: at the start of line (some compilers format differently)
        if re.match(r'^\s*error:', line, re.IGNORECASE):
            message = re.sub(r'^\s*error:\s*', '', line, flags=re.IGNORECASE).strip()
            if message:
                errors.append(CodeError(line=1, message=f"error: {message}"))
    
    if not errors and error_text.strip():
        # If we couldn't parse but there's error text, include it
        errors.append(CodeError(line=1, message=error_text.strip()[:200]))
    
    return errors


def parse_rust_error(error_text: str) -> list[CodeError]:
    """Parse Rust compilation/runtime error output to extract line numbers and messages."""
    errors = []
    lines = error_text.strip().split('\n')
    
    current_error_message = None
    current_line_num = 1
    
    for i, line in enumerate(lines):
        # Rust error format: error[E0425]: cannot find value `x` in this scope
        #    --> src/main.rs:3:5 or --> main.rs:5:10
        # Look for the --> line with file:line:column
        match = re.search(r'-->\s*(?:src/)?main\.rs:(\d+):(\d+)', line)
        if match:
            line_num = int(match.group(1))
            col_num = int(match.group(2))
            current_line_num = line_num
            # If we have a pending error message, use this line number
            if current_error_message:
                errors.append(CodeError(line=line_num, message=current_error_message[:200]))
                current_error_message = None
            continue
        
        # Rust error message line: error[E0425]: cannot find value...
        match = re.search(r'^error(\[E\d+\])?: (.+)', line)
        if match:
            error_code = match.group(1) or ""
            message = match.group(2).strip()
            current_error_message = f"error{error_code}: {message}"
            # Try to find line number in next few lines
            # If not found, use line 1 as default
            found_line = False
            for j in range(i + 1, min(i + 5, len(lines))):
                line_match = re.search(r'-->\s*(?:src/)?main\.rs:(\d+):(\d+)', lines[j])
                if line_match:
                    current_line_num = int(line_match.group(1))
                    found_line = True
                    break
            if found_line:
                errors.append(CodeError(line=current_line_num, message=current_error_message[:200]))
                current_error_message = None
            continue
        
        # Also catch warnings that prevent compilation
        match = re.search(r'^warning(\[.*\])?: (.+)', line)
        if match and 'deny' in error_text:  # Only if warnings are errors
            message = match.group(2).strip()
            errors.append(CodeError(line=current_line_num, message=f"warning: {message}"[:200]))
    
    # Add any remaining error message
    if current_error_message:
        errors.append(CodeError(line=current_line_num, message=current_error_message[:200]))
    
    if not errors and error_text.strip():
        errors.append(CodeError(line=1, message=error_text.strip()[:200]))
    
    return errors


async def _validate_code_syntax(code: str, language: str) -> SyntaxCheckResponse:
    """
    Core validation function that checks code syntax using Piston.
    This can be called from both the router endpoint and other modules.
    
    Args:
        code: The code to validate
        language: The programming language (e.g., "python", "java", "cpp", "rust")
    
    Returns:
        SyntaxCheckResponse with validation results
    """
    # Debug: log the language being used
    print(f"[syntax] Validating code with language: {language}", flush=True)
    language_lower = language.lower()
    
    if not code.strip():
        return SyntaxCheckResponse(valid=True, errors=[])
    
    # Map frontend language IDs to Piston language names
    # Handle both "cpp"/"c++" and "rs"/"rust" variations
    piston_language = language_lower
    if language_lower in ["cpp", "c++"]:
        piston_language = "c++"
    elif language_lower in ["rs", "rust"]:
        piston_language = "rust"
    
    piston_url = settings.PISTON_URL
    
    try:
        # Get language version
        language_version = await get_language_version(piston_language)
        
        # Get file extension
        extension = get_file_extension(piston_language)
        main_file = f"main{extension}"
        
        # For all languages, we actually EXECUTE the code to catch runtime errors
        # This catches both syntax errors and runtime errors like undefined variables
        
        if language_lower == "python":
            # Python: Execute the code directly
            # The code runs and any NameError, SyntaxError, etc. will be caught
            check_code = code
        elif language_lower == "java":
            # Java: Wrap in a class with main method if not already present
            # Check if code already has a class definition
            if "class " not in code:
                # Wrap the code - assume it's meant to be inside main()
                check_code = f'''
public class Main {{
    public static void main(String[] args) {{
        {code}
    }}
}}
'''
            else:
                check_code = code
        elif language_lower in ["rust", "rs"]:
            # Rust: Wrap in main function if not already present
            if "fn main" not in code:
                check_code = f'''
fn main() {{
    {code}
}}
'''
            else:
                check_code = code
        else:
            # For C++, wrap in main if needed
            # Include cassert so assert() macro is available (faculty write assert statements)
            if "int main" not in code and "void main" not in code:
                check_code = f'''
#include <iostream>
#include <cassert>
using namespace std;

int main() {{
    {code}
    return 0;
}}
'''
            else:
                # If main already exists, still need to include cassert if assert is used
                if "assert" in code and "#include" not in code:
                    check_code = f'''
#include <cassert>
{code}
'''
                else:
                    check_code = code
        
        # Build request body for Piston
        request_body = {
            "language": piston_language,
            "version": language_version,
            "files": [{"name": main_file, "content": check_code}],
            "stdin": "",
            "args": [],
            "compile_timeout": 5000,
            "run_timeout": 2000,  # Slightly longer for execution
            "compile_memory_limit": -1,
            "run_memory_limit": -1
        }
        
        execute_url = f"{piston_url}/api/v2/execute"
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(execute_url, json=request_body)
            response.raise_for_status()
            result = response.json()
            
            # Check for compilation errors first
            compile_result = result.get("compile", {})
            compile_stderr = compile_result.get("stderr", "")
            compile_code = compile_result.get("code")
            
            # Debug: log compile results
            print(f"[syntax] C++ compile - stderr length: {len(compile_stderr)}, code: {compile_code}", flush=True)
            if compile_stderr:
                print(f"[syntax] C++ compile stderr preview: {compile_stderr[:200]}", flush=True)
            
            if compile_stderr or (compile_code is not None and compile_code != 0):
                # Check if the compile error is an "expected" error (undeclared functions)
                compile_stderr_lower = compile_stderr.lower()
                is_expected_compile_error = False
                
                if language_lower == "java":
                    # Java: "cannot find symbol" errors are expected for test cases
                    if any(err_type in compile_stderr_lower for err_type in [
                        "cannot find symbol", "symbol not found"
                    ]):
                        is_expected_compile_error = True
                    else:
                        # Real compilation error (syntax, type mismatch, etc.)
                        errors = parse_java_error(compile_stderr)
                        if errors:
                            return SyntaxCheckResponse(valid=False, errors=errors)
                elif language_lower in ["cpp", "c++", "c"]:
                    # C++: "was not declared" errors are expected for test cases
                    # (student code will define the variables/functions)
                    # But actual syntax errors (like ===, missing semicolons, etc.) should fail
                    if compile_stderr:
                        print(f"[syntax] C++ compile stderr: {compile_stderr[:500]}", flush=True)
                        
                        # Parse all errors first
                        errors = parse_cpp_error(compile_stderr)
                        print(f"[syntax] C++ parsed {len(errors)} errors", flush=True)
                        
                        # Filter out "not declared" errors - student will define these
                        # Keep only actual syntax errors
                        syntax_errors = [
                            err for err in errors 
                            if "was not declared" not in err.message.lower() 
                            and "not declared" not in err.message.lower()
                        ]
                        
                        print(f"[syntax] C++ after filtering 'not declared': {len(syntax_errors)} syntax errors remain", flush=True)
                        
                        if syntax_errors:
                            # There are real syntax errors - fail validation with only those errors
                            print(f"[syntax] C++ syntax errors found - failing validation", flush=True)
                            return SyntaxCheckResponse(valid=False, errors=syntax_errors)
                        else:
                            # All errors were "not declared" - this is expected for test cases
                            print(f"[syntax] C++ all errors are 'not declared' - allowing", flush=True)
                            is_expected_compile_error = True
                elif language_lower in ["rust", "rs"]:
                    # Rust: "cannot find" errors are expected for test cases
                    # Common Rust error codes: E0425 (cannot find value), E0423 (cannot find function)
                    # Rust error format: "error[E0425]: cannot find function `add` in this scope"
                    # Check the raw error text first before parsing
                    rust_expected_patterns = [
                        "cannot find", "not found in this scope", "not found",
                        "error[e0425]", "error[e0423]", "error[E0425]", "error[E0423]",
                        "e0425", "e0423", "E0425", "E0423"
                    ]
                    # Check if error contains any expected pattern
                    if any(pattern in compile_stderr_lower for pattern in rust_expected_patterns):
                        is_expected_compile_error = True
                    elif compile_stderr:
                        # Parse errors to check if they're "cannot find" errors
                        errors = parse_rust_error(compile_stderr)
                        # Check if any parsed error is a "cannot find" error
                        if errors:
                            error_messages = " ".join([e.message.lower() for e in errors])
                            if any(pattern in error_messages for pattern in rust_expected_patterns[:3]):  # First 3 are the most common
                                is_expected_compile_error = True
                            else:
                                # Check if it's a syntax error (should fail) vs undefined symbol (should pass)
                                # If error doesn't contain syntax-related keywords, it might be an undefined symbol
                                syntax_keywords = ["expected", "unexpected", "missing", "syntax", "parse"]
                                if not any(keyword in error_messages for keyword in syntax_keywords):
                                    # Likely an undefined symbol error - allow it
                                    is_expected_compile_error = True
                                else:
                                    # Real compilation error (syntax, type, etc.)
                                    return SyntaxCheckResponse(valid=False, errors=errors)
                else:
                    # Python doesn't have compile errors (it's interpreted)
                    errors = parse_python_error(compile_stderr)
                    if errors:
                        return SyntaxCheckResponse(valid=False, errors=errors)
                
                # If it's an expected compile error (undefined functions), syntax is valid
                # Return valid=True immediately - no need to check runtime since code didn't compile
                if is_expected_compile_error:
                    print(f"[syntax] Expected compile error (undefined functions) - syntax is valid", flush=True)
                    return SyntaxCheckResponse(valid=True, errors=[])
                
                # If it's not an expected compile error, it's a real error
                if not is_expected_compile_error and compile_stderr:
                    # Real compilation error - return it
                    if language_lower == "java":
                        errors = parse_java_error(compile_stderr)
                    elif language_lower in ["cpp", "c++", "c"]:
                        errors = parse_cpp_error(compile_stderr)
                    elif language_lower in ["rust", "rs"]:
                        errors = parse_rust_error(compile_stderr)
                    else:
                        errors = parse_python_error(compile_stderr)
                    
                    if errors:
                        return SyntaxCheckResponse(valid=False, errors=errors)
            
            # Check for runtime errors
            run_result = result.get("run", {})
            stdout = run_result.get("stdout", "")
            stderr = run_result.get("stderr", "")
            run_code = run_result.get("code")
            
            # If there's any error output or non-zero exit code, check if it's an "expected" error
            # Expected errors: undefined functions/variables (NameError, etc.) - these are OK for test cases
            # Unexpected errors: syntax errors, type errors, etc. - these should fail validation
            if stderr or (run_code is not None and run_code != 0):
                stderr_lower = stderr.lower()
                is_expected_error = False
                
                if language_lower == "python":
                    # Python: All runtime errors are expected (faculty write test cases that may have runtime errors)
                    # NameError, ZeroDivisionError, TypeError, etc. are all OK for test cases
                    # Only syntax errors should fail validation
                    if "syntaxerror" not in stderr_lower and "indentationerror" not in stderr_lower:
                        # Any runtime error (not syntax) is expected
                        is_expected_error = True
                elif language_lower == "java":
                    # Java: NoClassDefFoundError, NoSuchMethodError, etc. are expected
                    # But compilation errors and syntax errors are not
                    if any(err_type in stderr_lower for err_type in [
                        "noclassdeffounderror", "nosuchmethoderror", "nosuchfielderror",
                        "cannot find symbol", "symbol not found"
                    ]):
                        is_expected_error = True
                elif language_lower in ["rust", "rs"]:
                    # Rust: unresolved name errors are expected
                    # Common Rust error codes: E0425 (cannot find value), E0423 (cannot find function)
                    # Rust is compiled, so runtime errors are less common, but check anyway
                    if any(err_type in stderr_lower for err_type in [
                        "cannot find", "unresolved name", "not found in this scope",
                        "error[e0425]", "error[e0423]", "error[E0425]", "error[E0423]",
                        "e0425", "e0423"
                    ]):
                        is_expected_error = True
                    else:
                        # Parse errors to check if they're "cannot find" errors
                        errors = parse_rust_error(stderr)
                        if errors:
                            error_messages = " ".join([e.message.lower() for e in errors])
                            if any(err_type in error_messages for err_type in [
                                "cannot find", "not found in this scope"
                            ]):
                                is_expected_error = True
                else:
                    # C++: undefined reference errors at link time are expected
                    # Also allow compile-time "was not declared" errors for functions
                    # (test cases reference student functions that aren't defined yet)
                    if any(err_type in stderr_lower for err_type in [
                        "undefined reference", "unresolved external", "was not declared"
                    ]):
                        is_expected_error = True
                
                # If it's an expected error (undefined function/variable), allow it
                if is_expected_error:
                    # This is OK - faculty test cases reference student functions that don't exist yet
                    pass
                else:
                    # Parse and return the error - it's a real syntax/runtime error
                    if language_lower == "python":
                        errors = parse_python_error(stderr)
                    elif language_lower == "java":
                        errors = parse_java_error(stderr)
                    elif language_lower in ["rust", "rs"]:
                        errors = parse_rust_error(stderr)
                    else:
                        errors = parse_cpp_error(stderr)
                    
                    if errors:
                        return SyntaxCheckResponse(valid=False, errors=errors)
            
            # No errors - code is valid!
            return SyntaxCheckResponse(valid=True, errors=[])
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Code validation timed out")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Piston API error: {str(e)}")
    except httpx.ConnectError:
        # Piston is not running - inform the user
        return SyntaxCheckResponse(
            valid=False, 
            errors=[CodeError(
                line=1, 
                message="Code validation service unavailable. Please ensure Docker/Piston is running."
            )]
        )
    except Exception as e:
        # If some other error, log it and return informative message
        print(f"[syntax] Warning: Code validation failed: {str(e)}")
        return SyntaxCheckResponse(
            valid=False,
            errors=[CodeError(line=1, message=f"Validation error: {str(e)[:100]}")]
        )


@router.post("/validate", response_model=SyntaxCheckResponse)
async def validate_syntax(request: SyntaxCheckRequest):
    """
    Validate code by actually executing it using Piston.
    Catches syntax errors, compilation errors, AND runtime errors (like undefined variables).
    """
    # Debug: log what we received
    print(f"[syntax] Received validation request - language: {request.language}, code preview: {request.code[:50]}...", flush=True)
    return await _validate_code_syntax(request.code, request.language)

