# backend/app/services/piston.py
from typing import Any, Dict, Optional
import httpx
import re
import textwrap
from pathlib import Path
from string import Template
from app.core.settings import settings



def parse_test_output(stdout: str, stderr: str) -> Dict[str, Any]:
    """Parse test output to determine pass/fail status, test counts, and point values."""
    combined_output = (stdout or "") + "\n" + (stderr or "")

    lines = combined_output.split('\n')
    passed_tests = 0
    failed_tests = 0
    total_tests = 0
    earned_points = 0
    total_points = 0
    error_message = None
    test_case_results: Dict[int, Dict[str, Any]] = {}  # test_case_id -> {passed: bool, points: int}

    # Check for error about missing points
    if "ERROR: Tests without point markers:" in combined_output:
        error_start = combined_output.find("ERROR: Tests without point markers:")
        error_end = combined_output.find("All tests must use", error_start)
        if error_end == -1:
            error_end = len(combined_output)
        error_message = combined_output[error_start:error_end].strip()

    # Parse individual test case results
    # Lines look like: "PASSED: test_case_{id}:{points}" or "FAILED: test_case_{id}:{points}"
    for line in lines:
        line = line.strip()
        if line.startswith('PASSED:'):
            passed_tests += 1
            # Extract test case ID and points
            match = re.match(r'PASSED:\s*test_case_(\d+):(\d+)', line)
            if match:
                test_id = int(match.group(1))
                points = int(match.group(2))
                test_case_results[test_id] = {"passed": True, "points": points}
        elif line.startswith('FAILED:'):
            failed_tests += 1
            # Extract test case ID and points
            match = re.match(r'FAILED:\s*test_case_(\d+):(\d+)', line)
            if match:
                test_id = int(match.group(1))
                points = int(match.group(2))
                test_case_results[test_id] = {"passed": False, "points": points}

    # Look for summary section
    in_summary = False
    for line in lines:
        line = line.strip()
        if line == "=== Test Results ===":
            in_summary = True
            continue
        if in_summary:
            if line.startswith('Passed:'):
                try:
                    passed_tests = int(line.split(':')[1].strip())
                except:
                    pass
            elif line.startswith('Failed:'):
                try:
                    failed_tests = int(line.split(':')[1].strip())
                except:
                    pass
            elif line.startswith('Total:') and not line.startswith('TotalPoints:'):
                try:
                    total_tests = int(line.split(':')[1].strip())
                except:
                    pass
            elif line.startswith('Earned:'):
                try:
                    earned_points = int(line.split(':')[1].strip())
                except:
                    pass
            elif line.startswith('TotalPoints:'):
                try:
                    total_points = int(line.split(':')[1].strip())
                except:
                    pass

    # If we didn't get totals from summary, calculate from individual counts
    if total_tests == 0:
        total_tests = passed_tests + failed_tests

    result = {
        "total_tests": total_tests,
        "passed_tests": passed_tests,
        "failed_tests": failed_tests,
        "earned_points": earned_points,
        "total_points": total_points,
        "passed": failed_tests == 0 and total_tests > 0,  # Frontend compatibility
        "all_passed": failed_tests == 0 and total_tests > 0,
        "has_tests": total_tests > 0,
        "test_case_results": test_case_results  # Mapping of test_case_id -> {passed: bool, points: int}
    }
    
    if error_message:
        result["error"] = error_message
    
    return result




def _map_status_to_result(returncode: int | None, timed_out: bool = False) -> int:
    """
    Map Piston execution result to status IDs.
    Returns status codes compatible with existing grading logic.
    """
    if timed_out:
        return 5  # Time Limit Exceeded
    if returncode is None:
        return 13  # Internal Error (unknown state)
    if returncode == 0:
        return 3  # Accepted
    return 4  # Wrong Answer


async def execute_code(
    language: str,
    student_code: str,
    test_cases: list[dict],
    timeout_ms: int = 3000
) -> Dict[str, Any]:
    """
    Execute student code with tests using Piston API.
    
    Args:
        language: The programming language (e.g., "python", "java", "cpp")
        student_code: The student's submission code
        test_cases: List of test cases with {id, point_value, test_code}
        timeout_ms: Execution timeout in milliseconds
        
    Returns:
        Dictionary with execution results from Piston API
    """
    piston_url = settings.PISTON_URL
    
    # Generate test harness using template system
    try:
        combined_code = generate_test_harness(language, student_code, test_cases)
    except Exception as e:
        return {
            "stdout": "",
            "stderr": f"Template generation error: {str(e)}",
            "returncode": -1,
            "status": {"id": 13},  # Internal Error
            "time": None,
            "memory": None,
            "language_id_used": 0,
            "grading": {"total_tests": 0, "passed_tests": 0, "failed_tests": 0, "earned_points": 0, "total_points": 0, "passed": False, "all_passed": False, "has_tests": False}
        }
    
    # Get language version from Piston
    language_version = await get_language_version(language)
    
    # Get file extension and main file name
    extension = get_file_extension(language)
    main_file = f"main{extension}"
    
    # Piston API v2 execute endpoint
    # See: https://github.com/engineer-man/piston
    execute_url = f"{piston_url}/api/v2/execute"
    
    # Build request body for Piston
    # Piston has a max run_timeout of 3000ms, so cap it
    capped_timeout = min(timeout_ms, 3000)
    
    # Normalize language name for Piston API
    # Users can use "gcc" in assignments, but Piston expects "c++" for C++ compilation
    piston_language = language.lower()
    if piston_language == "gcc":
        piston_language = "c++"  # Piston uses "c++" for C++ compilation
    
    # For Java: Keep in single file but Main class comes first
    # This ensures Piston sees Main (public class matching filename) first
    # Student's Solution class is package-private and comes after Main
    files = [{"name": main_file, "content": combined_code}]
    
    request_body = {
        "language": piston_language,
        "version": language_version,
        "files": files,
        "stdin": "",
        "args": [],
        "compile_timeout": 10000,
        "run_timeout": capped_timeout,
        "compile_memory_limit": -1,
        "run_memory_limit": -1
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(execute_url, json=request_body)
            if response.status_code == 400 and "runtime is unknown" in (response.text or ""):
                # Try to get latest version and retry
                language_version = await get_language_version(language)
                request_body["version"] = language_version
                response = await client.post(execute_url, json=request_body)
            response.raise_for_status()
            result = response.json()
            
            # Check for compilation errors first (Piston v2 structure)
            compile_stderr = result.get("compile", {}).get("stderr", "")
            if compile_stderr:
                return {
                    "stdout": "",
                    "stderr": f"Compilation error: {compile_stderr}",
                    "returncode": -1,
                    "status": {"id": 13},  # Internal Error
                    "time": None,
                    "memory": None,
                    "language_id_used": 0,
                    "grading": {"total_tests": 0, "passed_tests": 0, "failed_tests": 0, "earned_points": 0, "total_points": 0, "passed": False, "all_passed": False, "has_tests": False}
                }
            
            # Extract Piston response - handle case where "run" might not exist
            run_result = result.get("run", {})
            if not isinstance(run_result, dict):
                run_result = {}
            
            stdout = run_result.get("stdout", "")
            stderr = run_result.get("stderr", "")
            code = run_result.get("code", -1)
            # Handle None/null code values
            if code is None:
                code = -1
            signal = run_result.get("signal", "")
            timed_out = "Timed out" in stderr or signal == "SIGKILL"
            
            # Parse test output for grading
            grading = parse_test_output(stdout, stderr)
            
            # Build response in Piston execution result format
            return {
                "stdout": stdout,
                "stderr": stderr,
                "returncode": code,
                "status": {"id": _map_status_to_result(code, timed_out)},
                "time": None,  # Piston doesn't provide precise timing
                "memory": None,  # Piston doesn't provide precise memory
                "language_id_used": 0,  # Language-agnostic
                "grading": grading
            }
            
    except httpx.TimeoutException:
        return {
            "stdout": "",
            "stderr": "Timeout: Code execution took too long",
            "returncode": -1,
            "status": {"id": 5},  # Time Limit Exceeded
            "time": None,
            "memory": None,
            "language_id_used": 0,
            "grading": {"total_tests": 0, "passed_tests": 0, "failed_tests": 0, "earned_points": 0, "total_points": 0, "passed": False, "all_passed": False, "has_tests": False}
        }
    except httpx.HTTPStatusError as e:
        return {
            "stdout": "",
            "stderr": f"Piston API error: {e.response.status_code} - {e.response.text[:200]}",
            "returncode": -1,
            "status": {"id": 13},  # Internal Error
            "time": None,
            "memory": None,
            "language_id_used": 0,
            "grading": {"total_tests": 0, "passed_tests": 0, "failed_tests": 0, "earned_points": 0, "total_points": 0, "passed": False, "all_passed": False, "has_tests": False}
        }
    except Exception as e:
        return {
            "stdout": "",
            "stderr": f"Execution error: {str(e)}",
            "returncode": -1,
            "status": {"id": 13},  # Internal Error
            "time": None,
            "memory": None,
            "language_id_used": 0,
            "grading": {"total_tests": 0, "passed_tests": 0, "failed_tests": 0, "earned_points": 0, "total_points": 0, "passed": False, "all_passed": False, "has_tests": False}
        }


async def get_runtimes() -> Dict[str, Any]:
    """
    Fetch available runtimes from Piston API.
    
    Returns:
        Dictionary with available languages and versions
    """
    piston_url = settings.PISTON_URL
    runtimes_url = f"{piston_url}/api/v2/runtimes"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(runtimes_url)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        return {"error": str(e)}


# ============================================================================
# Template System for Language-Agnostic Test Harness Generation
# ============================================================================

def get_file_extension(language: str) -> str:
    """Get file extension for a language."""
    extensions = {
        "python": ".py",
        "java": ".java",
        "javascript": ".js",
        "gcc": ".cpp",  # GCC is used for C++ compilation in Piston
        "cpp": ".cpp",  # Keep for backward compatibility
        "c": ".c",
        "csharp": ".cs",
        "go": ".go",
        "rust": ".rs",
        "ruby": ".rb",
        "php": ".php",
    }
    return extensions.get(language.lower(), ".txt")


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


def _generate_python_test_execution(test_cases: list[dict]) -> str:
    """Generate Python test execution code from test cases."""
    code_parts = []
    for test_case in test_cases:
        test_id = test_case["id"]
        points = test_case["point_value"]
        test_code = test_case["test_code"]
        
        # Dedent the test_code to remove common leading whitespace
        # Then re-indent it properly within the try block
        # Ensure test_code is a string and has proper newlines
        test_code_str = str(test_code) if test_code else ""
        # Dedent to remove common leading whitespace, then strip
        dedented_code = textwrap.dedent(test_code_str).strip()
        # Indent the entire test_code block by 4 spaces (inside try block)
        indented_code = textwrap.indent(dedented_code, "    ")
        
        code_parts.append(f"""try:
{indented_code}
    test_results.append({{"id": {test_id}, "passed": True, "points": {points}}})
    print("PASSED: test_case_{test_id}:{points}")
except Exception as e:
    test_results.append({{"id": {test_id}, "passed": False, "points": {points}}})
    print("FAILED: test_case_{test_id}:{points}")
""")
    return "\n".join(code_parts)


def _generate_java_test_execution(test_cases: list[dict]) -> str:
    """Generate Java test execution code from test cases."""
    code_parts = []
    for test_case in test_cases:
        test_id = test_case["id"]
        points = test_case["point_value"]
        test_code = test_case["test_code"]
        
        # Convert Java assert statements to if-throw statements
        # Java assert: "assert condition;" or "assert condition : message;"
        # Convert to: "if (!(condition)) throw new AssertionError();"
        # Pattern to match: assert <condition>; or assert <condition> : <message>;
        java_test_code = test_code
        # Replace assert statements
        java_test_code = re.sub(
            r'assert\s+([^;]+);',
            r'if (!(\1)) throw new AssertionError();',
            java_test_code
        )
        
        code_parts.append(f"""        try {{
            Solution s = new Solution();
            {java_test_code}
            Map<String, Object> r{test_id} = new HashMap<>();
            r{test_id}.put("id", {test_id});
            r{test_id}.put("passed", true);
            r{test_id}.put("points", {points});
            testResults.add(r{test_id});
            System.out.println("PASSED: test_case_{test_id}:{points}");
        }} catch (Throwable e) {{
            Map<String, Object> r{test_id} = new HashMap<>();
            r{test_id}.put("id", {test_id});
            r{test_id}.put("passed", false);
            r{test_id}.put("points", {points});
            testResults.add(r{test_id});
            System.out.println("FAILED: test_case_{test_id}:{points}");
        }}
""")
    return "\n".join(code_parts)


def _generate_cpp_test_execution(test_cases: list[dict]) -> str:
    """Generate C++ test execution code from test cases."""
    code_parts = []
    for test_case in test_cases:
        test_id = test_case["id"]
        points = test_case["point_value"]
        test_code = test_case["test_code"]
        
        # C++: Replace assert with test_assert (throws instead of aborting)
        # This allows try-catch to work
        # Also wrap the test code to catch exceptions
        # Replace assert( with test_assert( in the test code
        # Only replace if test_code doesn't already use test_assert
        if "test_assert" not in test_code:
            cpp_test_code = test_code.replace("assert(", "test_assert(").replace("assert ", "test_assert ")
        else:
            cpp_test_code = test_code
        
        code_parts.append(f"""    {{
        bool test_passed = true;
        try {{
            {cpp_test_code}
        }} catch (...) {{
            test_passed = false;
        }}
        TestResult r{test_id};
        r{test_id}.id = {test_id};
        r{test_id}.passed = test_passed;
        r{test_id}.points = {points};
        testResults.push_back(r{test_id});
        if (test_passed) {{
            std::cout << "PASSED: test_case_{test_id}:{points}" << std::endl;
        }} else {{
            std::cout << "FAILED: test_case_{test_id}:{points}" << std::endl;
        }}
    }}
""")
    return "\n".join(code_parts)


def _generate_generic_test_execution(language: str, test_cases: list[dict]) -> str:
    """Generate generic test execution code (fallback)."""
    code_parts = []
    for test_case in test_cases:
        test_id = test_case["id"]
        points = test_case["point_value"]
        test_code = test_case["test_code"]
        
        code_parts.append(f"""# Test case {test_id} ({points} points)
try:
    {test_code}
    print("PASSED: test_case_{test_id}:{points}")
except:
    print("FAILED: test_case_{test_id}:{points}")
""")
    return "\n".join(code_parts)


def generate_test_execution_code(language: str, test_cases: list[dict]) -> str:
    """Generate language-specific test execution code from test cases."""
    language_lower = language.lower()
    
    if language_lower == "python":
        return _generate_python_test_execution(test_cases)
    elif language_lower == "java":
        return _generate_java_test_execution(test_cases)
    elif language_lower in ["gcc", "cpp", "c++"]:
        return _generate_cpp_test_execution(test_cases)
    else:
        return _generate_generic_test_execution(language, test_cases)


def generate_test_harness(language: str, student_code: str, test_cases: list[dict]) -> str:
    """Generate complete test harness using template system."""
    # For Java: Make student's class package-private (remove 'public' modifier)
    # Java only allows one public class per file, and it must match the filename
    # Since our file is 'main.java', only 'Main' can be public
    if language.lower() == "java":
        # Replace "public class" with "class" in student code to make it package-private
        student_code = re.sub(r'\bpublic\s+class\s+(\w+)\b', r'class \1', student_code)
    
    # Load template
    template_content = load_template(language)
    template = Template(template_content)
    
    # Generate test execution code
    test_execution_code = generate_test_execution_code(language, test_cases)
    
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


async def get_language_version(language: str, version: Optional[str] = None) -> str:
    """Get available version for a language from Piston."""
    piston_url = settings.PISTON_URL
    
    # Map user-facing language names to Piston runtime names
    language_lower = language.lower()
    piston_language = language_lower
    if piston_language == "gcc" or piston_language == "cpp":
        piston_language = "c++"  # Piston uses "c++" for C++ runtimes
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # First, check installed packages to see what's actually installed
            packages_url = f"{piston_url}/api/v2/packages"
            response = await client.get(packages_url)
            response.raise_for_status()
            packages = response.json()
            
            # Find installed packages matching the Piston language name
            installed_packages = [
                pkg for pkg in packages
                if isinstance(pkg, dict) 
                and pkg.get("language", "").lower() == piston_language
                and pkg.get("installed", False)
            ]
            
            # If we found installed packages, return the first one's version
            if installed_packages:
                return installed_packages[0].get("language_version", "latest")
            
            # If not installed, check available runtimes
            runtimes_url = f"{piston_url}/api/v2/runtimes"
            response = await client.get(runtimes_url)
            response.raise_for_status()
            runtimes = response.json()
            
            # Find matching language (using Piston's language name)
            matching_runtimes = [
                rt for rt in runtimes
                if isinstance(rt, dict) and rt.get("language", "").lower() == piston_language
            ]
            
            if not matching_runtimes:
                # Language not found, return default version selector
                return "latest"
            
            # If version specified, try to find exact match
            if version:
                for rt in matching_runtimes:
                    if rt.get("version", "") == version:
                        return version
                # Version not found, return first available
                return matching_runtimes[0].get("version", "latest")
            
            # Return first available version
            return matching_runtimes[0].get("version", "latest")
            
    except Exception as e:
        # Fallback to default
        return "latest"

