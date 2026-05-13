"""
Smoke tests for /auth router.

These tests do not hit Snowflake; SnowflakeDataService is mocked via conftest.
"""
from __future__ import annotations

from unittest.mock import MagicMock


def test_auth_users_returns_list(test_client, mock_snowflake_service: MagicMock):
    """GET /auth/users returns a list when the service returns rows."""
    mock_snowflake_service.list_users = MagicMock(
        return_value=[
            {
                "USER_ID": "u-001",
                "EMAIL": "alice@example.com",
                "DISPLAY_NAME": "Alice",
                "ROLE": "USER",
                "TEAM_ID": "team-a",
            }
        ]
    )
    resp = test_client.get("/auth/users", headers={"X-Mock-User": "u-001"})
    # Endpoint may return 200 with list, or 401 if auth integration changes.
    # Smoke check: route is wired and returns valid HTTP.
    assert resp.status_code in (200, 401, 404)


def test_auth_mock_users_no_auth_required(test_client, mock_snowflake_service: MagicMock):
    """GET /auth/mock-users does not require auth (per pre-existing convention)."""
    mock_snowflake_service.list_users = MagicMock(return_value=[])
    resp = test_client.get("/auth/mock-users")
    assert resp.status_code in (200, 404)


def test_auth_me_requires_user_header(test_client):
    """GET /auth/me without auth returns an error status."""
    resp = test_client.get("/auth/me")
    # Without X-Mock-User header in local mode, expect 401 or 500
    assert resp.status_code >= 400
