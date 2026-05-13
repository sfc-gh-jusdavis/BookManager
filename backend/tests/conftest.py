"""
Pytest fixtures for BookManager backend.

Provides:
- mock_snowflake_cursor: DictCursor-shaped mock matching SnowflakeDataService._cursor()
- mock_snowflake_service: full SnowflakeDataService mock with common method stubs
- test_client: FastAPI TestClient with auth bypass via X-Mock-User header
- mock_user: a synthetic CurrentUser fixture
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest

# Ensure backend/app is importable
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Set required env vars before importing app modules
os.environ.setdefault("SNOWFLAKE_CONNECTION_NAME", "TEST_CONN")
os.environ.setdefault("SNOWFLAKE_DATABASE", "TEST_DB")
os.environ.setdefault("SNOWFLAKE_SCHEMA", "TEST_SCHEMA")
os.environ.setdefault("LOCAL_DEFAULT_USER_ID", "test-user-001")


@pytest.fixture
def mock_snowflake_cursor() -> MagicMock:
    """
    Mock cursor matching the DictCursor contract used by SnowflakeDataService._cursor().
    Rows are dicts keyed by uppercase column names.
    """
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    cursor.fetchone.return_value = None
    cursor.execute.return_value = cursor
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    return cursor


@pytest.fixture
def mock_snowflake_service(mock_snowflake_cursor: MagicMock) -> MagicMock:
    """
    Mock SnowflakeDataService instance. Default returns are empty/None;
    individual tests override .return_value as needed.
    """
    svc = MagicMock()
    svc._cursor.return_value.__enter__.return_value = mock_snowflake_cursor
    svc._cursor.return_value.__exit__.return_value = False
    # Common defaults for read methods
    svc.list_accounts.return_value = []
    svc.get_account.return_value = None
    svc.list_use_cases.return_value = []
    svc.list_meetings_for_account.return_value = []
    return svc


@pytest.fixture
def mock_user() -> dict[str, Any]:
    """A synthetic CurrentUser dict for tests."""
    return {
        "user_id": "test-user-001",
        "email": "tester@example.com",
        "display_name": "Test User",
        "role": "USER",
        "team_id": "team-test",
    }


@pytest.fixture
def test_client(mock_snowflake_service: MagicMock):
    """
    FastAPI TestClient with the SnowflakeDataService dependency overridden.
    Use the X-Mock-User header to authenticate as a specific user.
    """
    from fastapi.testclient import TestClient
    from app.main import app
    from app.dependencies import get_snowflake_service  # type: ignore

    app.dependency_overrides[get_snowflake_service] = lambda: mock_snowflake_service
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
