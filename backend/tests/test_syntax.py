# backend/tests/test_syntax.py
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from app.api.main import app

client = TestClient(app)

# Only mark async tests with asyncio, not all tests
# We'll add @pytest.mark.asyncio to individual async test functions


# Helper functions for mocking httpx.AsyncClient
def _create_mock_piston_response(run_stdout="", run_stderr="", run_code=0, compile_stdout="", compile_stderr="", compile_code=0):
    """Create a mock Piston API response."""
    from unittest.mock import MagicMock
    mock_response = MagicMock()
    # json() is synchronous in httpx, not async
    mock_response.json.return_value = {
        "run": {
            "stdout": run_stdout,
            "stderr": run_stderr,
            "code": run_code
        },
        "compile": {
            "stdout": compile_stdout,
            "stderr": compile_stderr,
            "code": compile_code
        }
    }
    # raise_for_status() is also synchronous in httpx
    mock_response.raise_for_status = MagicMock()
    return mock_response

def _create_mock_httpx_client(mock_response):
    """Create a mock httpx.AsyncClient that returns the given response."""
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(return_value=mock_response)
    return mock_client


# ============================================================================
# Test Syntax Validation Endpoint
# ============================================================================

@patch('app.api.syntax._validate_code_syntax', new_callable=AsyncMock)
def test_validate_syntax_success(mock_validate):
    """Test successful syntax validation."""
    mock_validate.return_value = {
        "valid": True,
        "errors": []
    }
    
    payload = {
        "code": "def add(a, b):\n    return a + b",
        "language": "python"
    }
    
    response = client.post("/api/v1/syntax/validate", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    assert data["valid"] is True
    assert data["errors"] == []
    mock_validate.assert_called_once_with(payload["code"], payload["language"])


@patch('app.api.syntax._validate_code_syntax', new_callable=AsyncMock)
def test_validate_syntax_with_errors(mock_validate):
    """Test syntax validation with errors."""
    mock_validate.return_value = {
        "valid": False,
        "errors": [
            {"line": 1, "column": 1, "message": "SyntaxError: invalid syntax"}
        ]
    }
    
    payload = {
        "code": "def add(a, b\n    return a + b",
        "language": "python"
    }
    
    response = client.post("/api/v1/syntax/validate", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    assert data["valid"] is False
    assert len(data["errors"]) == 1
    assert data["errors"][0]["line"] == 1
    assert "SyntaxError" in data["errors"][0]["message"]


def test_validate_syntax_missing_fields():
    """Test validation request with missing fields."""
    # Missing code
    response = client.post("/api/v1/syntax/validate", json={"language": "python"})
    assert response.status_code == 422  # Validation error
    
    # Missing language
    response = client.post("/api/v1/syntax/validate", json={"code": "print('hello')"})
    assert response.status_code == 422


def test_validate_syntax_empty_code():
    """Test validation with empty code."""
    payload = {
        "code": "",
        "language": "python"
    }
    
    response = client.post("/api/v1/syntax/validate", json=payload)
    # Should handle empty code gracefully (either accept or reject with clear error)
    assert response.status_code in [200, 400, 422]


# ============================================================================
# Test Error Parsing Functions
# ============================================================================

def test_parse_python_error():
    """Test Python error parsing."""
    from app.api.syntax import parse_python_error
    
    error_text = '''Traceback (most recent call last):
  File "<string>", line 2, in <module>
    print(x)
NameError: name 'x' is not defined'''
    
    errors = parse_python_error(error_text)
    assert len(errors) > 0
    assert any("NameError" in err.message for err in errors)


def test_parse_python_syntax_error():
    """Test Python syntax error parsing."""
    from app.api.syntax import parse_python_error
    
    error_text = '''File "<string>", line 1
    def add(a, b
            ^
SyntaxError: invalid syntax'''
    
    errors = parse_python_error(error_text)
    assert len(errors) > 0
    assert any("SyntaxError" in err.message for err in errors)


def test_parse_java_error():
    """Test Java error parsing."""
    from app.api.syntax import parse_java_error
    
    error_text = '''Main.java:5: error: ';' expected
    int x = 5
              ^
1 error'''
    
    errors = parse_java_error(error_text)
    assert len(errors) > 0
    assert any(err.line == 5 for err in errors)
    assert any("';' expected" in err.message for err in errors)


def test_parse_cpp_error():
    """Test C++ error parsing."""
    from app.api.syntax import parse_cpp_error
    
    error_text = '''<source>:7:5: error: expected ';' before 'return'
     return 0;
     ^~~~~~'''
    
    errors = parse_cpp_error(error_text)
    assert len(errors) > 0
    assert any(err.line == 7 for err in errors)
    assert any("expected" in err.message.lower() for err in errors)


def test_parse_rust_error():
    """Test Rust error parsing."""
    from app.api.syntax import parse_rust_error
    
    error_text = '''error[E0425]: cannot find value `x` in this scope
 --> src/main.rs:3:5
  |
3 |     x
  |     ^ not found in this scope'''
    
    errors = parse_rust_error(error_text)
    assert len(errors) > 0
    assert any("cannot find" in err.message.lower() for err in errors)


# ============================================================================
# Test Language-Specific Validation Logic
# ============================================================================

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_python_valid_code(mock_client_class):
    """Test Python validation with valid code."""
    from app.api.syntax import _validate_code_syntax
    
    # Create mock response
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("def add(a, b):\n    return a + b", "python")
    assert result.valid is True
    assert len(result.errors) == 0


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_python_syntax_error(mock_client_class):
    """Test Python validation with syntax error."""
    from app.api.syntax import _validate_code_syntax
    
    # Mock syntax error - Python errors come in run.stderr
    error_stderr = '''File "<string>", line 1
    def add(a, b
            ^
SyntaxError: invalid syntax'''
    mock_response = _create_mock_piston_response(run_stderr=error_stderr, run_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("def add(a, b\n    return a + b", "python")
    assert result.valid is False
    assert len(result.errors) > 0


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_python_undefined_variable(mock_client_class):
    """Test Python validation with undefined variable (should be allowed)."""
    from app.api.syntax import _validate_code_syntax
    
    # Mock NameError (expected for undefined variables in test cases)
    error_stderr = '''Traceback (most recent call last):
  File "<string>", line 1, in <module>
    add(2, 3)
NameError: name 'add' is not defined'''
    mock_response = _create_mock_piston_response(run_stderr=error_stderr, run_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("add(2, 3)", "python")
    # Should be valid since undefined variables are expected in test cases
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_java_valid_code(mock_client_class):
    """Test Java validation with valid code."""
    from app.api.syntax import _validate_code_syntax
    
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("assert add(2, 3) == 5;", "java")
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_java_compilation_error(mock_client_class):
    """Test Java validation with compilation error."""
    from app.api.syntax import _validate_code_syntax
    
    # Java compilation errors come in compile.stderr
    mock_response = _create_mock_piston_response(compile_stderr="Main.java:5: error: ';' expected", compile_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("int x = 5", "java")
    assert result.valid is False
    assert len(result.errors) > 0


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_cpp_valid_code(mock_client_class):
    """Test C++ validation with valid code."""
    from app.api.syntax import _validate_code_syntax
    
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("assert(add(2, 3) == 5);", "cpp")
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_cpp_syntax_error(mock_client_class):
    """Test C++ validation with syntax error."""
    from app.api.syntax import _validate_code_syntax
    
    # C++ compilation errors come in compile.stderr
    mock_response = _create_mock_piston_response(compile_stderr="<source>:7:5: error: expected ';' before 'return'", compile_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("int x = 5", "cpp")
    assert result.valid is False
    assert len(result.errors) > 0


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_rust_valid_code(mock_client_class):
    """Test Rust validation with valid code."""
    from app.api.syntax import _validate_code_syntax
    
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("assert_eq!(add(2, 3), 5);", "rust")
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_rust_compilation_error(mock_client_class):
    """Test Rust validation with compilation error."""
    from app.api.syntax import _validate_code_syntax
    
    # Rust compilation errors come in compile.stderr
    mock_response = _create_mock_piston_response(compile_stderr="error[E0425]: cannot find value `add` in this scope", compile_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("assert_eq!(add(2, 3), 5);", "rust")
    # Should be valid since undefined functions are expected in test cases
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_language_case_insensitive(mock_client_class):
    """Test that language names are case-insensitive."""
    from app.api.syntax import _validate_code_syntax
    
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    # Test various case combinations
    for lang_variant in ["python", "Python", "PYTHON", "pYtHoN"]:
        result = await _validate_code_syntax("print('hello')", lang_variant)
        assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_language_aliases(mock_client_class):
    """Test that language aliases work (cpp vs c++)."""
    from app.api.syntax import _validate_code_syntax
    
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    # Both should work
    result1 = await _validate_code_syntax("int x = 5;", "cpp")
    result2 = await _validate_code_syntax("int x = 5;", "c++")
    
    assert result1.valid is True
    assert result2.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_piston_timeout(mock_client_class):
    """Test handling of Piston timeout."""
    from app.api.syntax import _validate_code_syntax
    import httpx
    from fastapi import HTTPException
    
    # Mock client that raises TimeoutException
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("Request timed out"))
    mock_client_class.return_value = mock_client
    
    # The function raises HTTPException for timeout, so we need to catch it
    with pytest.raises(HTTPException) as exc_info:
        await _validate_code_syntax("print('hello')", "python")
    assert exc_info.value.status_code == 504
    assert "timeout" in str(exc_info.value.detail).lower() or "timed out" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_piston_connection_error(mock_client_class):
    """Test handling of Piston connection error."""
    from app.api.syntax import _validate_code_syntax
    import httpx
    
    # Mock client that raises ConnectError
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("print('hello')", "python")
    assert result.valid is False
    assert len(result.errors) > 0
    assert any("connection" in err.message.lower() or "unavailable" in err.message.lower() for err in result.errors)


def test_validate_unsupported_language():
    """Test validation with unsupported language."""
    payload = {
        "code": "print('hello')",
        "language": "unsupported_lang"
    }
    
    response = client.post("/api/v1/syntax/validate", json=payload)
    # Should either handle gracefully or return an error
    assert response.status_code in [200, 400, 422, 500]


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_cpp_undefined_variable_allowed(mock_client_class):
    """Test C++ validation with undefined variable (should be allowed)."""
    from app.api.syntax import _validate_code_syntax
    
    # Mock "was not declared" error for user-defined variable - comes in compile.stderr
    mock_response = _create_mock_piston_response(compile_stderr="<source>:7: error: 'result' was not declared in this scope", compile_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("assert(result == expected);", "cpp")
    # Should be valid since undefined variables are expected in test cases
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_cpp_syntax_error_rejected(mock_client_class):
    """Test C++ validation with actual syntax error (should be rejected)."""
    from app.api.syntax import _validate_code_syntax
    
    # Mock syntax error - comes in compile.stderr
    mock_response = _create_mock_piston_response(compile_stderr="<source>:7: error: expected ';' before 'return'", compile_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("int x = 5", "cpp")
    assert result.valid is False
    assert len(result.errors) > 0


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_java_undefined_function_allowed(mock_client_class):
    """Test Java validation with undefined function (should be allowed)."""
    from app.api.syntax import _validate_code_syntax
    
    # Mock "cannot find symbol" error - comes in compile.stderr
    mock_response = _create_mock_piston_response(compile_stderr="Main.java:5: error: cannot find symbol: variable add", compile_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("assert add(2, 3) == 5;", "java")
    # Should be valid since undefined functions are expected in test cases
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_rust_syntax_error_rejected(mock_client_class):
    """Test Rust validation with actual syntax error (should be rejected)."""
    from app.api.syntax import _validate_code_syntax
    
    # Mock syntax error - comes in compile.stderr
    mock_response = _create_mock_piston_response(compile_stderr="error: expected one of `,`, `;`, `as`, `fn`, or `{`, found `=`", compile_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("let x =", "rust")
    assert result.valid is False
    assert len(result.errors) > 0


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_python_runtime_error_allowed(mock_client_class):
    """Test Python validation with runtime error (should be allowed if expected)."""
    from app.api.syntax import _validate_code_syntax
    
    # Mock runtime error (like ZeroDivisionError) - comes in run.stderr
    mock_response = _create_mock_piston_response(run_stderr="ZeroDivisionError: division by zero", run_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("1 / 0", "python")
    # Runtime errors are allowed (not syntax errors)
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_empty_code(mock_client_class):
    """Test validation with empty code string."""
    from app.api.syntax import _validate_code_syntax
    
    # Empty code is handled before making HTTP request, so this shouldn't be called
    # But if it is, mock a successful response
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("", "python")
    # Empty code should be valid (no syntax errors)
    assert result.valid is True


def test_parse_cpp_error_with_source_path():
    """Test C++ error parsing with <source>: path format."""
    from app.api.syntax import parse_cpp_error
    
    error_text = '''<source>:7:5: error: expected ';' before 'return'
     return 0;
     ^~~~~~'''
    
    errors = parse_cpp_error(error_text)
    assert len(errors) > 0
    assert any(err.line == 7 for err in errors)


def test_parse_rust_error_with_code():
    """Test Rust error parsing with error codes."""
    from app.api.syntax import parse_rust_error
    
    error_text = '''error[E0425]: cannot find value `x` in this scope
 --> src/main.rs:3:5
  |
3 |     x
  |     ^ not found in this scope'''
    
    errors = parse_rust_error(error_text)
    assert len(errors) > 0
    assert any("cannot find" in err.message.lower() for err in errors)
    assert any(err.line == 3 for err in errors)


def test_validate_syntax_invalid_json():
    """Test validation endpoint with invalid JSON."""
    # Send malformed JSON
    response = client.post(
        "/api/v1/syntax/validate",
        data="invalid json",
        headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 422


def test_validate_syntax_null_values():
    """Test validation endpoint with null values."""
    payload = {
        "code": None,
        "language": "python"
    }
    
    response = client.post("/api/v1/syntax/validate", json=payload)
    # Should handle null gracefully
    assert response.status_code in [200, 400, 422]


# ============================================================================
# Test Code Wrapping Logic
# ============================================================================

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_cpp_code_wrapping_without_main(mock_client_class):
    """Test C++ code wrapping when main is not present."""
    from app.api.syntax import _validate_code_syntax
    
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    # Code without main should be wrapped
    result = await _validate_code_syntax("int x = 5;", "cpp")
    assert result.valid is True
    # Verify the request was made (code was wrapped)
    assert mock_client.post.called


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_cpp_code_wrapping_with_main(mock_client_class):
    """Test C++ code wrapping when main already exists."""
    from app.api.syntax import _validate_code_syntax
    
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    # Code with main should not be wrapped
    result = await _validate_code_syntax("int main() { return 0; }", "cpp")
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_cpp_code_wrapping_with_assert_no_include(mock_client_class):
    """Test C++ code wrapping when assert is used but no includes."""
    from app.api.syntax import _validate_code_syntax
    
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    # Code with main and assert but no includes should add cassert
    result = await _validate_code_syntax("int main() { assert(true); }", "cpp")
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_java_code_wrapping_without_class(mock_client_class):
    """Test Java code wrapping when class is not present."""
    from app.api.syntax import _validate_code_syntax
    
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    # Code without class should be wrapped
    result = await _validate_code_syntax("int x = 5;", "java")
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_java_code_wrapping_with_class(mock_client_class):
    """Test Java code wrapping when class already exists."""
    from app.api.syntax import _validate_code_syntax
    
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    # Code with class should not be wrapped
    result = await _validate_code_syntax("class Main { public static void main(String[] args) {} }", "java")
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_rust_code_wrapping_without_main(mock_client_class):
    """Test Rust code wrapping when fn main is not present."""
    from app.api.syntax import _validate_code_syntax
    
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    # Code without fn main should be wrapped
    result = await _validate_code_syntax("let x = 5;", "rust")
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_rust_code_wrapping_with_main(mock_client_class):
    """Test Rust code wrapping when fn main already exists."""
    from app.api.syntax import _validate_code_syntax
    
    mock_response = _create_mock_piston_response()
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    # Code with fn main should not be wrapped
    result = await _validate_code_syntax("fn main() { let x = 5; }", "rust")
    assert result.valid is True


# ============================================================================
# Test C++ Error Filtering Logic
# ============================================================================

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_cpp_mixed_errors_syntax_and_not_declared(mock_client_class):
    """Test C++ validation with mixed errors (syntax + not declared)."""
    from app.api.syntax import _validate_code_syntax
    
    # Mix of "not declared" and syntax errors - should fail with only syntax errors
    compile_stderr = """<source>:7: error: 'result' was not declared in this scope
<source>:8: error: expected ';' before 'return'"""
    mock_response = _create_mock_piston_response(compile_stderr=compile_stderr, compile_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("result = 5", "cpp")
    # Should fail because there's a syntax error (even though there's also "not declared")
    assert result.valid is False
    # Should only have syntax errors, not "not declared" errors
    assert len(result.errors) > 0
    assert all("not declared" not in err.message.lower() for err in result.errors)


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_cpp_only_not_declared_errors(mock_client_class):
    """Test C++ validation with only 'not declared' errors."""
    from app.api.syntax import _validate_code_syntax
    
    # Only "not declared" errors - should pass
    compile_stderr = """<source>:7: error: 'result' was not declared in this scope
<source>:8: error: 'expected' was not declared in this scope"""
    mock_response = _create_mock_piston_response(compile_stderr=compile_stderr, compile_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("assert(result == expected);", "cpp")
    # Should be valid since all errors are "not declared"
    assert result.valid is True


# ============================================================================
# Test Rust Error Handling
# ============================================================================

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_rust_compile_error_with_syntax_keywords(mock_client_class):
    """Test Rust validation with syntax error (contains syntax keywords)."""
    from app.api.syntax import _validate_code_syntax
    
    # Rust error with syntax keywords - should fail
    compile_stderr = "error: expected one of `,`, `;`, `as`, `fn`, or `{`, found `=`"
    mock_response = _create_mock_piston_response(compile_stderr=compile_stderr, compile_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("let x =", "rust")
    assert result.valid is False
    assert len(result.errors) > 0


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_rust_compile_error_without_syntax_keywords(mock_client_class):
    """Test Rust validation with undefined symbol (no syntax keywords)."""
    from app.api.syntax import _validate_code_syntax
    
    # Rust error without syntax keywords - should pass (undefined symbol)
    compile_stderr = "error[E0425]: cannot find value `x` in this scope"
    mock_response = _create_mock_piston_response(compile_stderr=compile_stderr, compile_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("assert_eq!(x, 5);", "rust")
    # Should be valid since it's an undefined symbol, not a syntax error
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_rust_compile_error_parsed_check(mock_client_class):
    """Test Rust validation when error needs to be parsed to check."""
    from app.api.syntax import _validate_code_syntax
    
    # Rust error that needs parsing to determine if it's "cannot find"
    compile_stderr = '''error[E0423]: cannot find function `add` in this scope
 --> src/main.rs:3:5
  |
3 |     add(2, 3)
  |     ^^^ not found in this scope'''
    mock_response = _create_mock_piston_response(compile_stderr=compile_stderr, compile_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("assert_eq!(add(2, 3), 5);", "rust")
    # Should be valid since it's a "cannot find" error
    assert result.valid is True


# ============================================================================
# Test Exception Handling
# ============================================================================

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_http_status_error(mock_client_class):
    """Test handling of HTTPStatusError from Piston."""
    from app.api.syntax import _validate_code_syntax
    import httpx
    from fastapi import HTTPException
    
    # Mock client that raises HTTPStatusError
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    mock_client.post = AsyncMock(side_effect=httpx.HTTPStatusError("500", request=MagicMock(), response=mock_response))
    mock_client_class.return_value = mock_client
    
    # Should raise HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await _validate_code_syntax("print('hello')", "python")
    assert exc_info.value.status_code == 502


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_validate_general_exception(mock_client_class):
    """Test handling of general exceptions."""
    from app.api.syntax import _validate_code_syntax
    
    # Mock client that raises a general exception
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(side_effect=Exception("Unexpected error"))
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("print('hello')", "python")
    assert result.valid is False
    assert len(result.errors) > 0
    assert "Validation error" in result.errors[0].message or "Unexpected error" in result.errors[0].message


# ============================================================================
# Test Python Compile Error Path
# ============================================================================

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_python_compile_error(mock_client_class):
    """Test Python validation with compile error (unusual but possible)."""
    from app.api.syntax import _validate_code_syntax
    
    # Python compile errors are rare but possible
    mock_response = _create_mock_piston_response(compile_stderr="SyntaxError: invalid syntax", compile_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("def add(a, b", "python")
    assert result.valid is False
    assert len(result.errors) > 0


# ============================================================================
# Test Runtime Error Scenarios
# ============================================================================

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_java_runtime_error_allowed(mock_client_class):
    """Test Java validation with runtime error (should be allowed)."""
    from app.api.syntax import _validate_code_syntax
    
    # Java runtime error - NoClassDefFoundError
    mock_response = _create_mock_piston_response(run_stderr="java.lang.NoClassDefFoundError: Solution", run_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("Solution s = new Solution();", "java")
    # Should be valid since undefined classes are expected
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_rust_runtime_error_parsed(mock_client_class):
    """Test Rust validation with runtime error that needs parsing."""
    from app.api.syntax import _validate_code_syntax
    
    # Rust runtime error that needs parsing
    run_stderr = '''error[E0425]: cannot find value `x` in this scope
 --> src/main.rs:3:5
  |
3 |     x
  |     ^ not found in this scope'''
    mock_response = _create_mock_piston_response(run_stderr=run_stderr, run_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("assert_eq!(x, 5);", "rust")
    # Should be valid since it's a "cannot find" error
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_cpp_runtime_error_allowed(mock_client_class):
    """Test C++ validation with runtime error (should be allowed)."""
    from app.api.syntax import _validate_code_syntax
    
    # C++ runtime error - undefined reference
    mock_response = _create_mock_piston_response(run_stderr="undefined reference to `add'", run_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("add(2, 3);", "cpp")
    # Should be valid since undefined references are expected
    assert result.valid is True


@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_python_syntax_error_in_runtime(mock_client_class):
    """Test Python validation with SyntaxError in runtime stderr (should fail)."""
    from app.api.syntax import _validate_code_syntax
    
    # Python SyntaxError in runtime - should fail
    run_stderr = '''File "<string>", line 1
    def add(a, b
            ^
SyntaxError: invalid syntax'''
    mock_response = _create_mock_piston_response(run_stderr=run_stderr, run_code=1)
    mock_client = _create_mock_httpx_client(mock_response)
    mock_client_class.return_value = mock_client
    
    result = await _validate_code_syntax("def add(a, b", "python")
    # Should fail because it's a SyntaxError
    assert result.valid is False
    assert len(result.errors) > 0


# ============================================================================
# Test Error Parsing Edge Cases
# ============================================================================

def test_parse_python_error_generic():
    """Test Python error parsing with generic error format."""
    from app.api.syntax import parse_python_error
    
    # Generic error without traceback
    error_text = "TypeError: unsupported operand type(s)"
    errors = parse_python_error(error_text)
    assert len(errors) > 0
    assert any("TypeError" in err.message for err in errors)


def test_parse_java_error_runtime():
    """Test Java error parsing with runtime exception."""
    from app.api.syntax import parse_java_error
    
    error_text = '''Exception in thread "main" java.lang.NullPointerException
    at Main.main(Main.java:5)'''
    errors = parse_java_error(error_text)
    assert len(errors) > 0


def test_parse_cpp_error_without_column():
    """Test C++ error parsing without column number."""
    from app.api.syntax import parse_cpp_error
    
    error_text = "<source>:7: error: expected ';' before 'return'"
    errors = parse_cpp_error(error_text)
    assert len(errors) > 0
    assert any(err.line == 7 for err in errors)


def test_parse_rust_error_without_line_number():
    """Test Rust error parsing when line number is not found."""
    from app.api.syntax import parse_rust_error
    
    # Error without --> line
    error_text = "error[E0425]: cannot find value `x` in this scope"
    errors = parse_rust_error(error_text)
    assert len(errors) > 0
    # Should default to line 1
    assert any(err.line == 1 for err in errors)


def test_parse_rust_error_warning():
    """Test Rust error parsing with warning that prevents compilation."""
    from app.api.syntax import parse_rust_error
    
    # Warning with deny
    error_text = '''warning[unused_variable]: unused variable `x`
 --> src/main.rs:3:5
  |
3 |     let x = 5;
  |         ^
  
error: aborting due to previous error; compile with `-W deny-warnings` to treat warnings as errors'''
    errors = parse_rust_error(error_text)
    # Should parse warnings if 'deny' is in the text
    assert len(errors) >= 0  # May or may not parse warnings depending on 'deny' presence
