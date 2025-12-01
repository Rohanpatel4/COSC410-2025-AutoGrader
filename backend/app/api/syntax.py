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
        match = re.search(r'\.cpp:(\d+):(\d+):\s*(?:error:\s*)?(.+)', line)
        if match:
            line_num = int(match.group(1))
            col_num = int(match.group(2))
            message = match.group(3).strip()
            errors.append(CodeError(line=line_num, column=col_num, message=f"error: {message}"))
            continue
        
        # Without column: main.cpp:5: error: ...
        match = re.search(r'\.cpp:(\d+):\s*(?:error:\s*)?(.+)', line)
        if match:
            line_num = int(match.group(1))
            message = match.group(2).strip()
            errors.append(CodeError(line=line_num, message=f"error: {message}"))
    
    if not errors and error_text.strip():
        errors.append(CodeError(line=1, message=error_text.strip()[:200]))
    
    return errors


@router.post("/validate", response_model=SyntaxCheckResponse)
async def validate_syntax(request: SyntaxCheckRequest):
    """
    Validate code by actually executing it using Piston.
    Catches syntax errors, compilation errors, AND runtime errors (like undefined variables).
    """
    code = request.code
    language = request.language.lower()
    
    if not code.strip():
        return SyntaxCheckResponse(valid=True, errors=[])
    
    # Map frontend language IDs to Piston language names
    piston_language = language
    if language == "cpp":
        piston_language = "c++"
    
    piston_url = settings.PISTON_URL
    
    try:
        # Get language version
        language_version = await get_language_version(piston_language)
        
        # Get file extension
        extension = get_file_extension(piston_language)
        main_file = f"main{extension}"
        
        # For all languages, we actually EXECUTE the code to catch runtime errors
        # This catches both syntax errors and runtime errors like undefined variables
        
        if language == "python":
            # Python: Execute the code directly
            # The code runs and any NameError, SyntaxError, etc. will be caught
            check_code = code
        elif language == "java":
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
        else:
            # For C++, wrap in main if needed
            if "int main" not in code and "void main" not in code:
                check_code = f'''
#include <iostream>
using namespace std;

int main() {{
    {code}
    return 0;
}}
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
            
            if compile_stderr or (compile_code is not None and compile_code != 0):
                # Compilation error
                if language == "java":
                    errors = parse_java_error(compile_stderr)
                elif language in ["cpp", "c++", "c"]:
                    errors = parse_cpp_error(compile_stderr)
                else:
                    errors = parse_python_error(compile_stderr)
                
                if errors:
                    return SyntaxCheckResponse(valid=False, errors=errors)
            
            # Check for runtime errors
            run_result = result.get("run", {})
            stdout = run_result.get("stdout", "")
            stderr = run_result.get("stderr", "")
            run_code = run_result.get("code")
            
            # If there's any error output or non-zero exit code, it's invalid
            if stderr or (run_code is not None and run_code != 0):
                if language == "python":
                    errors = parse_python_error(stderr)
                elif language == "java":
                    errors = parse_java_error(stderr)
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

