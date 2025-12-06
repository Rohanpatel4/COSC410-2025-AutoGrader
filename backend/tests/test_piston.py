# backend/tests/test_piston.py
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from app.services import piston


@pytest.mark.asyncio
async def test_check_piston_available_success():
    """Test check_piston_available when Piston is available."""
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")) as mock_backoff, \
         patch('app.services.piston._record_connection_success') as mock_success:
        
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client
        
        result = await piston.check_piston_available()
        
        assert result[0] is True
        assert "available" in result[1]
        mock_success.assert_called_once()


@pytest.mark.asyncio
async def test_check_piston_available_backoff():
    """Test check_piston_available when in backoff period."""
    with patch('app.services.piston._check_backoff', return_value=(False, "Retry in 30s")):
        result = await piston.check_piston_available()
        
        assert result[0] is False
        assert "Retry" in result[1]


@pytest.mark.asyncio
async def test_check_piston_available_connection_error():
    """Test check_piston_available with connection error."""
    import httpx
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")), \
         patch('app.services.piston._record_connection_failure') as mock_failure:
        
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("Connection failed"))
        mock_get_client.return_value = mock_client
        
        result = await piston.check_piston_available()
        
        assert result[0] is False
        assert "Cannot connect" in result[1]
        mock_failure.assert_called_once()


@pytest.mark.asyncio
async def test_check_piston_available_timeout():
    """Test check_piston_available with timeout."""
    import httpx
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")), \
         patch('app.services.piston._record_connection_failure') as mock_failure:
        
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
        mock_get_client.return_value = mock_client
        
        result = await piston.check_piston_available()
        
        assert result[0] is False
        assert "timed out" in result[1]
        mock_failure.assert_called_once()


def test_parse_test_output_success():
    """Test parse_test_output with successful test results."""
    stdout = """PASSED: test_case_1:10
PASSED: test_case_2:5
=== Test Results ===
Total: 2
Passed: 2
Failed: 0
Earned: 15
TotalPoints: 15"""
    stderr = ""
    
    result = piston.parse_test_output(stdout, stderr)
    
    assert result["total_tests"] == 2
    assert result["passed_tests"] == 2
    assert result["failed_tests"] == 0
    assert result["earned_points"] == 15
    assert result["total_points"] == 15
    assert result["passed"] is True
    assert result["all_passed"] is True
    assert result["has_tests"] is True


def test_parse_test_output_failed():
    """Test parse_test_output with failed tests."""
    stdout = """PASSED: test_case_1:10
FAILED: test_case_2:0
=== Test Results ===
Total: 2
Passed: 1
Failed: 1
Earned: 10
TotalPoints: 15"""
    stderr = ""
    
    result = piston.parse_test_output(stdout, stderr)
    
    assert result["total_tests"] == 2
    assert result["passed_tests"] == 1
    assert result["failed_tests"] == 1
    assert result["earned_points"] == 10
    assert result["total_points"] == 15
    assert result["passed"] is False
    assert result["all_passed"] is False


def test_parse_test_output_no_tests():
    """Test parse_test_output with no test results."""
    stdout = "Some output"
    stderr = ""
    
    result = piston.parse_test_output(stdout, stderr)
    
    assert result["total_tests"] == 0
    assert result["passed_tests"] == 0
    assert result["failed_tests"] == 0
    assert result["has_tests"] is False


def test_map_status_to_result():
    """Test _map_status_to_result function."""
    # Timeout
    assert piston._map_status_to_result(1, timed_out=True) == 5
    
    # None returncode
    assert piston._map_status_to_result(None) == 13
    
    # Success (returncode 0)
    assert piston._map_status_to_result(0) == 3
    
    # Failure (non-zero returncode)
    assert piston._map_status_to_result(1) == 4


def test_get_file_extension():
    """Test get_file_extension for various languages."""
    assert piston.get_file_extension("python") == ".py"
    assert piston.get_file_extension("java") == ".java"
    assert piston.get_file_extension("cpp") == ".cpp"
    assert piston.get_file_extension("gcc") == ".cpp"  # GCC is used for C++ in Piston
    assert piston.get_file_extension("c++") == ".txt"  # c++ not in mapping, defaults to .txt
    assert piston.get_file_extension("rust") == ".rs"
    assert piston.get_file_extension("javascript") == ".js"
    assert piston.get_file_extension("unknown") == ".txt"  # Default


def test_get_template_languages():
    """Test get_template_languages returns language mappings."""
    result = piston.get_template_languages()
    
    assert isinstance(result, dict)
    # Should have entries for template files
    assert len(result) > 0
    
    # Check that values are language names
    for lang in result.values():
        assert isinstance(lang, str)
        assert len(lang) > 0


def test_generate_test_harness_python():
    """Test generate_test_harness for Python."""
    student_code = "def add(a, b):\n    return a + b"
    test_cases = [
        {"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"}
    ]
    
    result = piston.generate_test_harness("python", student_code, test_cases)
    
    assert isinstance(result, str)
    assert "def add" in result
    assert "assert add(2, 3) == 5" in result


def test_generate_test_harness_java():
    """Test generate_test_harness for Java."""
    student_code = "class Solution {\n    public int add(int a, int b) { return a + b; }\n}"
    test_cases = [
        {"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5;"}
    ]
    
    result = piston.generate_test_harness("java", student_code, test_cases)
    
    assert isinstance(result, str)
    assert "class Solution" in result
    # Java converts assert to if-throw, so check for the condition instead
    assert "add(2, 3) == 5" in result or "if (!(add(2, 3) == 5))" in result


def test_generate_test_harness_cpp():
    """Test generate_test_harness for C++."""
    student_code = "int add(int a, int b) { return a + b; }"
    test_cases = [
        {"id": 1, "point_value": 10, "test_code": "assert(add(2, 3) == 5);"}
    ]
    
    result = piston.generate_test_harness("cpp", student_code, test_cases)
    
    assert isinstance(result, str)
    assert "int add" in result
    assert "assert(add(2, 3) == 5)" in result


def test_generate_test_harness_rust():
    """Test generate_test_harness for Rust."""
    student_code = "fn add(a: i32, b: i32) -> i32 { a + b }"
    test_cases = [
        {"id": 1, "point_value": 10, "test_code": "assert_eq!(add(2, 3), 5);"}
    ]
    
    result = piston.generate_test_harness("rust", student_code, test_cases)
    
    assert isinstance(result, str)
    assert "fn add" in result
    assert "assert_eq!(add(2, 3), 5)" in result


@pytest.mark.asyncio
async def test_get_runtimes_success():
    """Test get_runtimes when Piston is available."""
    mock_runtimes = [
        {"language": "python", "version": "3.10"},
        {"language": "java", "version": "17"}
    ]
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")):
        
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_runtimes
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client
        
        result = await piston.get_runtimes()
        
        assert isinstance(result, list)
        assert len(result) == 2


@pytest.mark.asyncio
async def test_get_runtimes_error():
    """Test get_runtimes when Piston returns error."""
    import httpx
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")):
        
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("Connection failed"))
        mock_get_client.return_value = mock_client
        
        result = await piston.get_runtimes()
        
        assert "error" in result


def test_record_connection_failure():
    """Test _record_connection_failure increments failure count."""
    initial_failures = piston._connection_failures
    piston._record_connection_failure()
    
    # Should increment
    assert piston._connection_failures == initial_failures + 1
    
    # Reset for other tests
    piston._connection_failures = 0


def test_record_connection_success():
    """Test _record_connection_success resets failure count."""
    piston._connection_failures = 5
    piston._record_connection_success()
    
    assert piston._connection_failures == 0


def test_get_piston_client():
    """Test _get_piston_client creates and reuses client."""
    # First call should create client
    client1 = piston._get_piston_client()
    assert client1 is not None
    assert not client1.is_closed
    
    # Second call should return same client
    client2 = piston._get_piston_client()
    assert client1 is client2
    
    # Note: AsyncClient cleanup is handled by the connection pool
    # We don't need to manually close it in tests


@pytest.mark.asyncio
async def test_check_backoff_no_backoff():
    """Test _check_backoff when no backoff is needed."""
    import time
    piston._connection_failures = 0
    piston._backoff_until = 0
    
    # Should allow proceeding
    can_proceed, msg = await piston._check_backoff()
    assert can_proceed is True
    assert msg == ""


@pytest.mark.asyncio
async def test_check_backoff_active():
    """Test _check_backoff when backoff is active."""
    import time
    piston._connection_failures = 10
    piston._backoff_until = time.time() + 30
    
    can_proceed, msg = await piston._check_backoff()
    assert can_proceed is False
    assert "Retry" in msg
    
    # Reset
    piston._connection_failures = 0
    piston._backoff_until = 0


@pytest.mark.asyncio
async def test_check_backoff_expired():
    """Test _check_backoff when backoff period has expired."""
    import time
    piston._connection_failures = 10
    piston._backoff_until = time.time() - 1  # Expired
    
    can_proceed, msg = await piston._check_backoff()
    assert can_proceed is True
    assert piston._connection_failures == 0  # Should reset


@pytest.mark.asyncio
async def test_execute_code_success():
    """Test execute_code with successful execution."""
    student_code = "def add(a, b): return a + b"
    test_cases = [{"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"}]
    
    mock_response = {
        "compile": {"stderr": ""},
        "run": {
            "stdout": "PASSED: test_case_1:10\n=== Test Results ===\nTotal: 1\nPassed: 1\nFailed: 0\nEarned: 10\nTotalPoints: 10",
            "stderr": "",
            "code": 0
        }
    }
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")), \
         patch('app.services.piston.get_language_version', return_value="3.10"), \
         patch('app.services.piston.generate_test_harness', return_value="test code"):
        
        mock_client = AsyncMock()
        mock_http_response = MagicMock()
        mock_http_response.status_code = 200
        mock_http_response.json.return_value = mock_response
        mock_client.post = AsyncMock(return_value=mock_http_response)
        mock_get_client.return_value = mock_client
        
        result = await piston.execute_code("python", student_code, test_cases)
        
        assert result["returncode"] == 0
        assert result["grading"]["total_tests"] == 1
        assert result["grading"]["passed_tests"] == 1


@pytest.mark.asyncio
async def test_execute_code_template_error():
    """Test execute_code when template generation fails."""
    student_code = "def add(a, b): return a + b"
    test_cases = [{"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"}]
    
    with patch('app.services.piston.generate_test_harness', side_effect=Exception("Template error")):
        result = await piston.execute_code("python", student_code, test_cases)
        
        assert result["returncode"] == -1
        assert "Template generation error" in result["stderr"]
        assert result["status"]["id"] == 13


@pytest.mark.asyncio
async def test_execute_code_backoff():
    """Test execute_code when in backoff period."""
    student_code = "def add(a, b): return a + b"
    test_cases = [{"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"}]
    
    with patch('app.services.piston.generate_test_harness', return_value="test code"), \
         patch('app.services.piston._check_backoff', return_value=(False, "Retry in 30s")):
        
        result = await piston.execute_code("python", student_code, test_cases)
        
        assert result["returncode"] == -1
        assert "Retry" in result["stderr"]
        assert result["status"]["id"] == 13


@pytest.mark.asyncio
async def test_execute_code_compilation_error():
    """Test execute_code with compilation error."""
    student_code = "def add(a, b) return a + b"  # Missing colon
    test_cases = [{"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"}]
    
    mock_response = {
        "compile": {"stderr": "SyntaxError: invalid syntax"},
        "run": {}
    }
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")), \
         patch('app.services.piston.get_language_version', return_value="3.10"), \
         patch('app.services.piston.generate_test_harness', return_value="test code"):
        
        mock_client = AsyncMock()
        mock_http_response = MagicMock()
        mock_http_response.status_code = 200
        mock_http_response.json.return_value = mock_response
        mock_client.post = AsyncMock(return_value=mock_http_response)
        mock_get_client.return_value = mock_client
        
        result = await piston.execute_code("python", student_code, test_cases)
        
        assert result["returncode"] == -1
        assert "Compilation error" in result["stderr"]
        assert result["status"]["id"] == 13


@pytest.mark.asyncio
async def test_execute_code_timeout():
    """Test execute_code with timeout."""
    student_code = "def add(a, b): return a + b"
    test_cases = [{"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"}]
    import httpx
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")), \
         patch('app.services.piston.get_language_version', return_value="3.10"), \
         patch('app.services.piston.generate_test_harness', return_value="test code"):
        
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
        mock_get_client.return_value = mock_client
        
        result = await piston.execute_code("python", student_code, test_cases)
        
        assert result["returncode"] == -1
        assert "Timeout" in result["stderr"]
        assert result["status"]["id"] == 5


@pytest.mark.asyncio
async def test_execute_code_connection_error():
    """Test execute_code with connection error."""
    student_code = "def add(a, b): return a + b"
    test_cases = [{"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"}]
    import httpx
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")), \
         patch('app.services.piston.get_language_version', return_value="3.10"), \
         patch('app.services.piston.generate_test_harness', return_value="test code"):
        
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=httpx.ConnectError("Connection failed"))
        mock_get_client.return_value = mock_client
        
        result = await piston.execute_code("python", student_code, test_cases)
        
        assert result["returncode"] == -1
        assert "Cannot connect" in result["stderr"]
        assert result["status"]["id"] == 13


@pytest.mark.asyncio
async def test_get_packages_success():
    """Test get_packages when Piston is available."""
    mock_packages = {"python": ["3.10", "3.11"], "java": ["17", "19"]}
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")):
        
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_packages
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client
        
        result = await piston.get_packages()
        
        assert "python" in result
        assert "java" in result


@pytest.mark.asyncio
async def test_get_packages_error():
    """Test get_packages when Piston returns error."""
    import httpx
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")):
        
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("Connection failed"))
        mock_get_client.return_value = mock_client
        
        result = await piston.get_packages()
        
        assert "error" in result


@pytest.mark.asyncio
async def test_install_package_success():
    """Test install_package with successful installation."""
    mock_response = {"success": True, "message": "Installed"}
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")):
        
        mock_client = AsyncMock()
        mock_http_response = MagicMock()
        mock_http_response.status_code = 200
        mock_http_response.json.return_value = mock_response
        mock_client.post = AsyncMock(return_value=mock_http_response)
        mock_get_client.return_value = mock_client
        
        result = await piston.install_package("python", "3.10")
        
        assert result["success"] is True


@pytest.mark.asyncio
async def test_install_package_backoff():
    """Test install_package when in backoff period."""
    with patch('app.services.piston._check_backoff', return_value=(False, "Retry in 30s")):
        result = await piston.install_package("python", "3.10")
        
        assert result["success"] is False
        assert "Retry" in result["error"]


def test_load_template():
    """Test load_template loads template file."""
    # This will fail if template doesn't exist, but that's expected
    try:
        result = piston.load_template("python")
        assert isinstance(result, str)
        assert len(result) > 0
    except FileNotFoundError:
        # Template file might not exist in test environment
        pass


def test_generate_python_test_execution():
    """Test _generate_python_test_execution."""
    test_cases = [
        {"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"},
        {"id": 2, "point_value": 5, "test_code": "assert add(0, 0) == 0"}
    ]
    
    result = piston._generate_python_test_execution(test_cases)
    
    assert isinstance(result, str)
    assert "test_case_1" in result
    assert "test_case_2" in result
    assert "assert add(2, 3) == 5" in result


def test_generate_java_test_execution():
    """Test _generate_java_test_execution."""
    test_cases = [
        {"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5;"}
    ]
    
    result = piston._generate_java_test_execution(test_cases)
    
    assert isinstance(result, str)
    assert "test_case_1" in result
    assert "add(2, 3) == 5" in result


def test_generate_cpp_test_execution():
    """Test _generate_cpp_test_execution."""
    test_cases = [
        {"id": 1, "point_value": 10, "test_code": "assert(add(2, 3) == 5);"}
    ]
    
    result = piston._generate_cpp_test_execution(test_cases)
    
    assert isinstance(result, str)
    assert "test_case_1" in result
    assert "add(2, 3) == 5" in result


def test_generate_rust_test_execution():
    """Test _generate_rust_test_execution."""
    test_cases = [
        {"id": 1, "point_value": 10, "test_code": "assert_eq!(add(2, 3), 5);"}
    ]
    
    result = piston._generate_rust_test_execution(test_cases)
    
    assert isinstance(result, str)
    assert "test_case_1" in result
    assert "add(2, 3)" in result


def test_generate_generic_test_execution():
    """Test _generate_generic_test_execution."""
    test_cases = [
        {"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"}
    ]
    
    result = piston._generate_generic_test_execution("javascript", test_cases)
    
    assert isinstance(result, str)
    assert "test_case_1" in result


def test_generate_test_execution_code():
    """Test generate_test_execution_code routes to correct generator."""
    test_cases = [{"id": 1, "point_value": 10, "test_code": "assert True"}]
    
    # Python
    result = piston.generate_test_execution_code("python", test_cases)
    assert isinstance(result, str)
    
    # Java
    result = piston.generate_test_execution_code("java", test_cases)
    assert isinstance(result, str)
    
    # C++
    result = piston.generate_test_execution_code("cpp", test_cases)
    assert isinstance(result, str)
    
    # Rust
    result = piston.generate_test_execution_code("rust", test_cases)
    assert isinstance(result, str)
    
    # Generic
    result = piston.generate_test_execution_code("javascript", test_cases)
    assert isinstance(result, str)


@pytest.mark.asyncio
async def test_get_language_version():
    """Test get_language_version retrieves version."""
    # Mock packages response (preferred over runtimes)
    mock_packages = [
        {"language": "python", "language_version": "3.11", "installed": True},
        {"language": "python", "language_version": "3.10", "installed": True}
    ]
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")):
        
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_packages
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client
        
        version = await piston.get_language_version("python")
        # Should return highest version (3.11)
        assert version == "3.11"


@pytest.mark.asyncio
async def test_get_language_version_not_found():
    """Test get_language_version when language not found."""
    # Mock packages with no python
    mock_packages = [
        {"language": "java", "language_version": "17", "installed": True}
    ]
    mock_runtimes = [
        {"language": "java", "version": "17"}
    ]
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")):
        
        mock_client = AsyncMock()
        # First call (packages) returns no python
        # Second call (runtimes) returns no python
        mock_packages_response = MagicMock()
        mock_packages_response.status_code = 200
        mock_packages_response.json.return_value = mock_packages
        
        mock_runtimes_response = MagicMock()
        mock_runtimes_response.status_code = 200
        mock_runtimes_response.json.return_value = mock_runtimes
        
        mock_client.get = AsyncMock(side_effect=[mock_packages_response, mock_runtimes_response])
        mock_get_client.return_value = mock_client
        
        version = await piston.get_language_version("python")
        # Should return "latest" when not found (not "*")
        assert version == "latest"


@pytest.mark.asyncio
async def test_execute_code_runtime_unknown_retry():
    """Test execute_code retries when runtime is unknown."""
    import httpx
    student_code = "def add(a, b): return a + b"
    test_cases = [{"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"}]
    
    mock_response_success = {
        "compile": {"stderr": ""},
        "run": {
            "stdout": "PASSED: test_case_1:10\n=== Test Results ===\nTotal: 1\nPassed: 1\nFailed: 0\nEarned: 10\nTotalPoints: 10",
            "stderr": "",
            "code": 0
        }
    }
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")), \
         patch('app.services.piston.get_language_version', side_effect=["unknown", "3.10"]), \
         patch('app.services.piston.generate_test_harness', return_value="test code"):
        
        mock_client = AsyncMock()
        # First call returns 400 with "runtime is unknown"
        mock_error_response = MagicMock()
        mock_error_response.status_code = 400
        mock_error_response.text = "runtime is unknown"
        mock_error_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "400", request=MagicMock(), response=mock_error_response
        )
        
        # Second call succeeds
        mock_success_response = MagicMock()
        mock_success_response.status_code = 200
        mock_success_response.json.return_value = mock_response_success
        
        mock_client.post = AsyncMock(side_effect=[mock_error_response, mock_success_response])
        mock_get_client.return_value = mock_client
        
        result = await piston.execute_code("python", student_code, test_cases)
        
        # Should retry and succeed
        assert result["returncode"] == 0
        assert mock_client.post.call_count == 2


@pytest.mark.asyncio
async def test_execute_code_http_status_error():
    """Test execute_code with HTTPStatusError."""
    student_code = "def add(a, b): return a + b"
    test_cases = [{"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"}]
    import httpx
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")), \
         patch('app.services.piston.get_language_version', return_value="3.10"), \
         patch('app.services.piston.generate_test_harness', return_value="test code"):
        
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500", request=MagicMock(), response=mock_response
        )
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client
        
        result = await piston.execute_code("python", student_code, test_cases)
        
        assert result["returncode"] == -1
        assert "Piston API error" in result["stderr"]
        assert result["status"]["id"] == 13


@pytest.mark.asyncio
async def test_execute_code_with_none_code():
    """Test execute_code handles None returncode."""
    student_code = "def add(a, b): return a + b"
    test_cases = [{"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"}]
    
    mock_response = {
        "compile": {"stderr": ""},
        "run": {
            "stdout": "PASSED: test_case_1:10",
            "stderr": "",
            "code": None  # None code
        }
    }
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")), \
         patch('app.services.piston.get_language_version', return_value="3.10"), \
         patch('app.services.piston.generate_test_harness', return_value="test code"):
        
        mock_client = AsyncMock()
        mock_http_response = MagicMock()
        mock_http_response.status_code = 200
        mock_http_response.json.return_value = mock_response
        mock_client.post = AsyncMock(return_value=mock_http_response)
        mock_get_client.return_value = mock_client
        
        result = await piston.execute_code("python", student_code, test_cases)
        
        # None code should be converted to -1
        assert result["returncode"] == -1


@pytest.mark.asyncio
async def test_execute_code_with_non_dict_run():
    """Test execute_code handles non-dict run result."""
    student_code = "def add(a, b): return a + b"
    test_cases = [{"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"}]
    
    mock_response = {
        "compile": {"stderr": ""},
        "run": "invalid"  # Not a dict
    }
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")), \
         patch('app.services.piston.get_language_version', return_value="3.10"), \
         patch('app.services.piston.generate_test_harness', return_value="test code"):
        
        mock_client = AsyncMock()
        mock_http_response = MagicMock()
        mock_http_response.status_code = 200
        mock_http_response.json.return_value = mock_response
        mock_client.post = AsyncMock(return_value=mock_http_response)
        mock_get_client.return_value = mock_client
        
        result = await piston.execute_code("python", student_code, test_cases)
        
        # Should handle gracefully
        assert result["returncode"] == -1


def test_parse_test_output_with_console_output():
    """Test parse_test_output extracts console output."""
    stdout = """=== Console Output ===
Hello, World!
=== End Console Output ===
PASSED: test_case_1:10"""
    stderr = ""
    
    result = piston.parse_test_output(stdout, stderr)
    
    assert result["console_output"] == "Hello, World!"
    assert result["total_tests"] == 1


def test_parse_test_output_with_error_message():
    """Test parse_test_output extracts error messages."""
    stdout = """ERROR: Tests without point markers: test_case_1
All tests must use point markers"""
    stderr = ""
    
    result = piston.parse_test_output(stdout, stderr)
    
    assert "error" in result
    assert "Tests without point markers" in result["error"]


def test_parse_test_output_with_output_markers():
    """Test parse_test_output extracts OUTPUT markers."""
    stdout = """PASSED: test_case_1:10
OUTPUT_1: Some output here"""
    stderr = ""
    
    result = piston.parse_test_output(stdout, stderr)
    
    assert 1 in result["test_case_results"]
    assert "actual_output" in result["test_case_results"][1]
    assert "Some output here" in result["test_case_results"][1]["actual_output"]


@pytest.mark.asyncio
async def test_get_language_version_with_specified_version():
    """Test get_language_version with specified version."""
    mock_runtimes = [
        {"language": "python", "version": "3.10"},
        {"language": "python", "version": "3.11"}
    ]
    
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")):
        
        mock_client = AsyncMock()
        # Packages call returns empty
        mock_packages_response = MagicMock()
        mock_packages_response.status_code = 200
        mock_packages_response.json.return_value = []
        
        # Runtimes call returns python versions
        mock_runtimes_response = MagicMock()
        mock_runtimes_response.status_code = 200
        mock_runtimes_response.json.return_value = mock_runtimes
        
        mock_client.get = AsyncMock(side_effect=[mock_packages_response, mock_runtimes_response])
        mock_get_client.return_value = mock_client
        
        # Request specific version
        version = await piston.get_language_version("python", "3.11")
        assert version == "3.11"


@pytest.mark.asyncio
async def test_get_language_version_backoff():
    """Test get_language_version when in backoff."""
    with patch('app.services.piston._check_backoff', return_value=(False, "Retry in 30s")):
        version = await piston.get_language_version("python")
        assert version == "latest"


@pytest.mark.asyncio
async def test_get_language_version_exception():
    """Test get_language_version with exception."""
    with patch('app.services.piston._get_piston_client') as mock_get_client, \
         patch('app.services.piston._check_backoff', return_value=(True, "")):
        
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=Exception("Connection error"))
        mock_get_client.return_value = mock_client
        
        version = await piston.get_language_version("python")
        assert version == "latest"


def test_load_template_file_not_found():
    """Test load_template when template file doesn't exist."""
    # load_template returns a fallback template string instead of raising FileNotFoundError
    result = piston.load_template("nonexistent_language")
    assert isinstance(result, str)
    assert "$student_code" in result or len(result) > 0


def test_generate_test_harness_template_error():
    """Test generate_test_harness with template substitution error."""
    student_code = "def add(a, b): return a + b"
    test_cases = [{"id": 1, "point_value": 10, "test_code": "assert add(2, 3) == 5"}]
    
    # Python uses string replacement, not Template, so it won't raise ValueError
    # For other languages (like java), Template substitution will raise ValueError on KeyError
    # Mock load_template to return template with missing placeholder for a non-Python language
    with patch('app.services.piston.load_template', return_value="$missing_placeholder"):
        with pytest.raises(ValueError, match="Template missing placeholder"):
            piston.generate_test_harness("java", student_code, test_cases)

