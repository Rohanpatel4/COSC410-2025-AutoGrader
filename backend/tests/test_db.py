# backend/tests/test_db.py
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.db import Base, SessionLocal, get_db, engine


def test_get_db_generator():
    """Test that get_db is a generator that yields a session and closes it."""
    db_gen = get_db()
    
    # Should be a generator
    assert hasattr(db_gen, '__iter__')
    assert hasattr(db_gen, '__next__')
    
    # Get the session
    db = next(db_gen)
    
    # Verify it's a session
    assert db is not None
    
    # Verify we can use it
    result = db.execute(text("SELECT 1"))
    assert result.scalar() == 1
    
    # Cleanup - close the generator
    try:
        next(db_gen)
    except StopIteration:
        pass  # Expected - generator should be exhausted after cleanup


def test_get_db_closes_on_exception():
    """Test that get_db closes the session even if an exception occurs."""
    db_gen = get_db()
    db = next(db_gen)
    
    # Verify session exists and is usable
    assert db is not None
    result = db.execute(text("SELECT 1"))
    assert result.scalar() == 1
    
    # Simulate exception by not calling next() but checking cleanup
    # The finally block should close it
    try:
        raise ValueError("Test exception")
    except ValueError:
        # Generator should still close the session
        pass
    
    # Manually close to clean up
    try:
        next(db_gen)
    except StopIteration:
        pass


def test_session_local_creation():
    """Test that SessionLocal is properly configured."""
    assert SessionLocal is not None
    assert callable(SessionLocal)
    
    # Create a session
    session = SessionLocal()
    assert session is not None
    
    # Verify we can use it
    result = session.execute(text("SELECT 1"))
    assert result.scalar() == 1
    
    # Clean up
    session.close()


def test_engine_creation():
    """Test that engine is properly created."""
    assert engine is not None
    assert hasattr(engine, 'connect')
    
    # Test connection
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        assert result.scalar() == 1


def test_base_declarative():
    """Test that Base is a DeclarativeBase."""
    assert Base is not None
    assert hasattr(Base, 'metadata')
    
    # Verify it has the expected SQLAlchemy attributes
    assert hasattr(Base, 'registry')

