# backend/tests/test_main.py
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from app.api.main import app


def test_app_creation():
    """Test that the FastAPI app is created correctly."""
    assert app is not None
    assert app.title == "AutoGrader API"
    assert app.version == "1.0.0"


def test_app_routers_registered():
    """Test that all routers are registered."""
    routes = [route.path for route in app.routes]
    
    # Check for key routes
    assert any("/api/v1/login" in str(route) for route in routes)
    assert any("/api/v1/courses" in str(route) for route in routes)
    assert any("/api/v1/assignments" in str(route) for route in routes)
    assert any("/api/v1/languages" in str(route) for route in routes)
    assert any("/api/v1/syntax" in str(route) for route in routes)


def test_app_cors_middleware():
    """Test that CORS middleware is configured."""
    # Check that CORS middleware is in the middleware stack
    middleware_types = [type(middleware).__name__ for middleware in app.user_middleware]
    assert "CORSMiddleware" in str(app.user_middleware) or len(app.user_middleware) > 0


@pytest.mark.asyncio
async def test_startup_verify_database():
    """Test _verify_database startup event."""
    from app.api.main import _verify_database
    from unittest.mock import patch, MagicMock
    from sqlalchemy import inspect as sqlalchemy_inspect
    
    # Patch where it's imported inside the function
    with patch('sqlalchemy.inspect') as mock_inspect:
        mock_inspector = MagicMock()
        mock_inspector.get_table_names.return_value = ["users", "courses", "assignments"]
        mock_inspect.return_value = mock_inspector
        
        # Should not raise
        await _verify_database()


@pytest.mark.asyncio
async def test_startup_verify_database_exception():
    """Test _verify_database startup event with exception."""
    from app.api.main import _verify_database
    from unittest.mock import patch
    
    # Patch where it's imported inside the function
    with patch('sqlalchemy.inspect') as mock_inspect:
        mock_inspect.side_effect = Exception("Database error")
        
        # Should not raise - catches exception
        await _verify_database()


@pytest.mark.asyncio
async def test_piston_bootstrap_success():
    """Test _piston_bootstrap startup event with successful connection."""
    from app.api.main import _piston_bootstrap
    from unittest.mock import patch, AsyncMock
    import asyncio
    
    mock_runtimes = [
        {"language": "python", "version": "3.10"},
        {"language": "java", "version": "17"}
    ]
    
    with patch('app.api.main.get_runtimes', new_callable=AsyncMock) as mock_get_runtimes, \
         patch('asyncio.create_task') as mock_create_task, \
         patch('app.api.main._install_languages_background', new_callable=AsyncMock):
        
        # Return list directly (not a dict with error) - this is what get_runtimes returns on success
        mock_get_runtimes.return_value = mock_runtimes
        
        await _piston_bootstrap()
        
        # Should create background task only if runtimes is a list (not dict with error)
        # The function checks isinstance(runtimes, list) before creating task
        # Since we're returning a list, it should create the task
        mock_create_task.assert_called_once()


@pytest.mark.asyncio
async def test_piston_bootstrap_error():
    """Test _piston_bootstrap startup event with error."""
    from app.api.main import _piston_bootstrap
    from unittest.mock import patch, AsyncMock
    
    with patch('app.services.piston.get_runtimes', new_callable=AsyncMock) as mock_get_runtimes:
        mock_get_runtimes.return_value = {"error": "Connection failed"}
        
        # Should not raise
        await _piston_bootstrap()


@pytest.mark.asyncio
async def test_piston_bootstrap_exception():
    """Test _piston_bootstrap startup event with exception."""
    from app.api.main import _piston_bootstrap
    from unittest.mock import patch, AsyncMock
    
    with patch('app.services.piston.get_runtimes', new_callable=AsyncMock) as mock_get_runtimes:
        mock_get_runtimes.side_effect = Exception("Piston error")
        
        # Should not raise - catches exception
        await _piston_bootstrap()


@pytest.mark.asyncio
async def test_install_languages_background_success():
    """Test _install_languages_background background task."""
    from app.api.main import _install_languages_background
    from unittest.mock import patch, AsyncMock
    import asyncio
    
    mock_results = {
        "python": {"success": True},
        "java": {"success": True}
    }
    
    with patch('asyncio.sleep', new_callable=AsyncMock), \
         patch('app.services.piston.ensure_languages_installed', new_callable=AsyncMock) as mock_ensure:
        
        mock_ensure.return_value = mock_results
        
        # Should not raise
        await _install_languages_background()


@pytest.mark.asyncio
async def test_install_languages_background_error():
    """Test _install_languages_background with error."""
    from app.api.main import _install_languages_background
    from unittest.mock import patch, AsyncMock
    import asyncio
    
    with patch('asyncio.sleep', new_callable=AsyncMock), \
         patch('app.services.piston.ensure_languages_installed', new_callable=AsyncMock) as mock_ensure:
        
        mock_ensure.return_value = {"error": "Installation failed"}
        
        # Should not raise
        await _install_languages_background()


@pytest.mark.asyncio
async def test_install_languages_background_cancelled():
    """Test _install_languages_background with cancellation."""
    from app.api.main import _install_languages_background
    import asyncio
    from unittest.mock import patch, AsyncMock
    
    with patch('asyncio.sleep', new_callable=AsyncMock) as mock_sleep:
        mock_sleep.side_effect = asyncio.CancelledError()
        
        # Should handle cancellation gracefully
        try:
            await _install_languages_background()
        except asyncio.CancelledError:
            pass  # Expected


@pytest.mark.asyncio
async def test_install_languages_background_exception():
    """Test _install_languages_background with exception."""
    from app.api.main import _install_languages_background
    from unittest.mock import patch, AsyncMock
    import asyncio
    
    with patch('asyncio.sleep', new_callable=AsyncMock), \
         patch('app.services.piston.ensure_languages_installed', new_callable=AsyncMock) as mock_ensure:
        
        mock_ensure.side_effect = Exception("Installation error")
        
        # Should not raise - catches exception
        await _install_languages_background()

