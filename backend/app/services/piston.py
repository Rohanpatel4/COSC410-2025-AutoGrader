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


async def get_packages() -> Dict[str, Any]:
    """
    Fetch installed packages from Piston API.
    
    Returns:
        Dictionary with installed packages and their status
    """
    piston_url = settings.PISTON_URL
    packages_url = f"{piston_url}/api/v2/packages"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(packages_url)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        return {"error": str(e)}


async def install_package(language: str, version: str = "*") -> Dict[str, Any]:
    """
    Install a language package in Piston via API.
    
    Args:
        language: The language name (e.g., "python", "java", "c++")
        version: The version to install, or "*" for latest
        
    Returns:
        Dictionary with installation result
    """
    piston_url = settings.PISTON_URL
    
    # Map user-facing language names to Piston language names
    language_lower = language.lower()
    piston_language = language_lower
    # Piston uses "gcc" as the package name for C++ compilation
    if piston_language == "c++" or piston_language == "cpp":
        piston_language = "gcc"
    # If already "gcc", keep it as is
    
    # Piston API v2 package installation endpoint
    # Format: POST /api/v2/packages with JSON body {"language": "...", "version": "..."}
    install_url = f"{piston_url}/api/v2/packages"
    
    # Get the actual version if "*" is specified
    if version == "*":
        # Try to get the version from available packages
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                packages_response = await client.get(f"{piston_url}/api/v2/packages")
                packages_response.raise_for_status()
                packages = packages_response.json()
                matching_packages = [
                    pkg for pkg in packages
                    if isinstance(pkg, dict)
                    and pkg.get("language", "").lower() == piston_language
                ]
                if matching_packages:
                    version = matching_packages[0].get("language_version", "*")
        except:
            version = "*"  # Fallback to * if we can't determine version
    
    request_body = {"language": piston_language, "version": version}
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:  # Longer timeout for installation
            headers = {"Content-Type": "application/json"}
            response = await client.post(install_url, headers=headers, json=request_body)
            # 200 = success, 201 = created
            if response.status_code in [200, 201]:
                try:
                    response_data = response.json()
                    message = response_data.get("message", f"Installed {piston_language} {version}")
                    # "Already installed" is also a success
                    if "already installed" in message.lower():
                        return {"success": True, "message": f"{piston_language} already installed"}
                    return {"success": True, "message": message}
                except:
                    return {"success": True, "message": f"Installed {piston_language} {version}"}
            elif response.status_code == 400:
                # Package might already be installed or invalid request
                try:
                    error_data = response.json()
                    error_msg = error_data.get("message", "Installation failed")
                    # Check if it's actually "already installed" (success case)
                    if "already installed" in error_msg.lower():
                        return {"success": True, "message": f"{piston_language} already installed"}
                    return {"success": False, "error": error_msg}
                except:
                    return {"success": False, "error": response.text or "Installation failed"}
            else:
                response.raise_for_status()
                return {"success": True, "message": response.json()}
    except httpx.HTTPStatusError as e:
        return {"success": False, "error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_template_languages() -> Dict[str, str]:
    """
    Detect which languages we have templates for by scanning the templates directory.
    Maps template filenames to Piston language names.
    
    Returns:
        Dictionary mapping template language names to Piston language names
        Example: {"python": "python", "java": "java", "cpp": "c++"}
    """
    template_dir = Path(__file__).parent / "templates"
    template_languages = {}
    
    # Map of template filename patterns to Piston language names
    # Format: {template_file_pattern: piston_language_name}
    language_map = {
        "python_test.py": "python",
        "java_test.java": "java",
        "cpp_test.cpp": "c++",  # Piston uses "c++" not "cpp"
    }
    
    # Scan templates directory for existing template files
    if template_dir.exists():
        for template_file in template_dir.iterdir():
            if template_file.is_file() and not template_file.name.startswith("."):
                filename = template_file.name
                if filename in language_map:
                    template_languages[filename] = language_map[filename]
    
    return template_languages


async def ensure_languages_installed() -> Dict[str, Any]:
    """
    Ensure all template-supported languages are installed in Piston.
    Checks what's installed and installs missing languages.
    
    Returns:
        Dictionary with installation results for each language
    """
    # Get languages we have templates for
    template_languages = get_template_languages()
    piston_languages = set(template_languages.values())
    
    if not piston_languages:
        return {"error": "No template languages found"}
    
    # Get currently installed packages and available packages
    packages_result = await get_packages()
    installed_languages = set()
    available_package_languages = set()  # Languages available as packages (even if not installed)
    
    # Handle both list and dict response formats from packages endpoint
    if "error" not in packages_result:
        packages = packages_result if isinstance(packages_result, list) else packages_result.get("packages", [])
        
        for pkg in packages:
            if isinstance(pkg, dict):
                lang = pkg.get("language", "").lower()
                if lang:
                    # Track available package languages (even if not installed)
                    available_package_languages.add(lang)
                    # Track installed languages
                    if pkg.get("installed", False):
                        installed_languages.add(lang)
    else:
        # If packages endpoint fails, log warning but continue
        print(f"[piston] Warning: Could not fetch packages: {packages_result.get('error', 'Unknown error')}. Will attempt installation anyway.", flush=True)
    
    # Also check runtimes endpoint to see what's available
    # This helps identify if a language exists even if package endpoint fails
    runtimes_result = await get_runtimes()
    available_runtime_languages = set()
    if "error" not in runtimes_result:
        runtimes = runtimes_result if isinstance(runtimes_result, list) else []
        for rt in runtimes:
            if isinstance(rt, dict):
                lang = rt.get("language", "").lower()
                version = rt.get("version", "")
                if lang and version:
                    available_runtime_languages.add(lang)
    
    # Combine both sources - a language is available if it's in either runtimes or packages
    # Also normalize language names: gcc, cpp, and c++ are all C++
    available_languages = available_runtime_languages | available_package_languages
    
    # Normalize C++ variants: if any variant exists, mark all as available
    cpp_variants = {"c++", "cpp", "gcc"}
    has_cpp = any(variant in available_languages for variant in cpp_variants)
    if has_cpp:
        available_languages.update(cpp_variants)
    
    results = {}
    # Check each required language and install if missing
    for template_file, piston_lang in template_languages.items():
        piston_lang_lower = piston_lang.lower()
        original_lang = piston_lang
        
        # Check if already installed
        if piston_lang_lower in installed_languages:
            results[piston_lang] = {"success": True, "message": "Already installed"}
            print(f"[piston] ✓ {piston_lang} already installed", flush=True)
            continue
        
        # Check if language is available (exists in Piston runtimes or packages)
        if available_languages and piston_lang_lower not in available_languages:
            # Try alternative names (e.g., "cpp" vs "c++" vs "gcc")
            if piston_lang_lower == "c++":
                if "cpp" in available_languages:
                    piston_lang = "cpp"
                    piston_lang_lower = "cpp"
                elif "gcc" in available_languages:
                    piston_lang = "gcc"
                    piston_lang_lower = "gcc"
            elif piston_lang_lower == "cpp":
                if "c++" in available_languages:
                    piston_lang = "c++"
                    piston_lang_lower = "c++"
                elif "gcc" in available_languages:
                    piston_lang = "gcc"
                    piston_lang_lower = "gcc"
            elif piston_lang_lower == "gcc":
                if "c++" in available_languages:
                    piston_lang = "c++"
                    piston_lang_lower = "c++"
                elif "cpp" in available_languages:
                    piston_lang = "cpp"
                    piston_lang_lower = "cpp"
        
        # Check if language exists in runtimes or packages before attempting installation
        if available_languages and piston_lang_lower not in available_languages:
            error_msg = f"Language '{original_lang}' is not available in Piston (checked runtimes and packages). Available languages: {', '.join(sorted(available_languages))}"
            print(f"[piston] ✗ {error_msg}", flush=True)
            results[original_lang] = {"success": False, "error": error_msg}
            continue
        
        # Map to Piston package name before installation (install_package will do this too, but for logging)
        install_lang = piston_lang
        if install_lang.lower() in ["c++", "cpp"]:
            install_lang = "gcc"
        
        # Attempt installation
        print(f"[piston] Installing {install_lang} (from {template_file}, mapped from {original_lang})...", flush=True)
        install_result = await install_package(piston_lang, "*")  # Install latest version
        results[original_lang] = install_result
        
        if install_result.get("success"):
            print(f"[piston] ✓ Successfully installed {piston_lang}", flush=True)
        else:
            error_msg = install_result.get("error", "Unknown error")
            # If error mentions already installed, treat as success
            if "already" in error_msg.lower() or "installed" in error_msg.lower():
                print(f"[piston] ✓ {piston_lang} already installed", flush=True)
                results[original_lang] = {"success": True, "message": "Already installed"}
            else:
                print(f"[piston] ✗ Failed to install {piston_lang}: {error_msg}", flush=True)
    
    return results


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

        # Clean up the test code - remove comments and extract just the assert statement
        lines = test_code.split('\n')
        assert_lines = []
        for line in lines:
            line = line.strip()
            if line.startswith('assert'):
                assert_lines.append(line)

        if assert_lines:
            # Execute all assert statements in this test case
            indented_code = textwrap.indent('\n'.join(assert_lines), "    ")
        else:
            # If no assert found, execute the whole code
            dedented_code = textwrap.dedent(test_code).strip()
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

        # Clean up the test code - remove comments and extract just the assert statement
        lines = test_code.split('\n')
        assert_lines = []
        for line in lines:
            line = line.strip()
            if line.startswith('assert'):
                assert_lines.append(line)

        if assert_lines:
            # Convert assert statements to if-throw statements
            java_asserts = []
            for line in assert_lines:
                # Replace assert statements
                java_line = re.sub(
                    r'assert\s+([^;]+);',
                    r'if (!(\1)) throw new AssertionError();',
                    line
                )
                java_asserts.append(java_line)

            java_test_code = '\n'.join(java_asserts)
        else:
            # If no assert found, use the whole code
            java_test_code = test_code
            java_test_code = re.sub(
                r'assert\s+([^;]+);',
                r'if (!(\1)) throw new AssertionError();',
                java_test_code
            )

        # Indent the java test code for inside the try block
        indented_java_test_code = textwrap.indent(java_test_code, "            ")

        code_parts.append(f"""        try {{
            Solution s = new Solution();
            {indented_java_test_code}
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

        # Clean up the test code - remove comments and extract just the assert statement
        lines = test_code.split('\n')
        assert_lines = []
        for line in lines:
            line = line.strip()
            if line.startswith('assert'):
                assert_lines.append(line)

        if assert_lines:
            # Replace assert with test_assert for all assert statements
            cpp_asserts = []
            for line in assert_lines:
                if "test_assert" not in line:
                    cpp_line = line.replace("assert(", "test_assert(").replace("assert ", "test_assert ")
                else:
                    cpp_line = line
                # Ensure semicolon is present
                if not cpp_line.rstrip().endswith(';'):
                    cpp_line += ';'
                cpp_asserts.append(cpp_line)

            cpp_test_code = '\n'.join(cpp_asserts)
        else:
            # If no assert found, use the whole code with replacements
            if "test_assert" not in test_code:
                cpp_test_code = test_code.replace("assert(", "test_assert(").replace("assert ", "test_assert ")
            else:
                cpp_test_code = test_code
            # Ensure semicolons are present for any assert statements
            lines = cpp_test_code.split('\n')
            processed_lines = []
            for line in lines:
                line = line.strip()
                if line.startswith('test_assert') and not line.endswith(';'):
                    line += ';'
                processed_lines.append(line)
            cpp_test_code = '\n'.join(processed_lines)

        # Indent the C++ test code for inside the try block
        indented_cpp_test_code = textwrap.indent(cpp_test_code, "            ")

        code_parts.append(f"""    {{
        bool test_passed = true;
        try {{
{indented_cpp_test_code}
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
    # Note: For packages, Piston uses "gcc" for C++, but for execution it might use "c++"
    # We'll check both when looking for versions
    language_lower = language.lower()
    
    # Determine which Piston language names to check
    if language_lower in ["gcc", "cpp", "c++"]:
        # For C++, check both "gcc" (packages) and "c++" (runtimes)
        package_language = "gcc"
        runtime_language = "c++"
    else:
        package_language = language_lower
        runtime_language = language_lower
    
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
                and pkg.get("language", "").lower() == package_language
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
            
            # Find matching language (using Piston's runtime language name)
            matching_runtimes = [
                rt for rt in runtimes
                if isinstance(rt, dict) and rt.get("language", "").lower() == runtime_language
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

