"""
Pytest Configuration and Fixtures

Shared fixtures for coordination system tests.
"""

import os
import pytest
import tempfile
from pathlib import Path


@pytest.fixture
def temp_db():
    """Create a temporary database for testing."""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = Path(f.name)
    yield db_path
    # Cleanup
    if db_path.exists():
        db_path.unlink()


@pytest.fixture
def temp_dir():
    """Create a temporary directory for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def project_root():
    """Get the project root directory."""
    return Path(__file__).parent.parent.parent


@pytest.fixture
def coding_loops_dir():
    """Get the coding-loops directory."""
    return Path(__file__).parent.parent


# TODO: Add more fixtures as components are implemented
# - mock_message_bus: Pre-configured mock message bus
# - mock_claude: Mock Claude API responses
# - sample_events: Sample events for testing
# - sample_test_state: Sample test state for testing
