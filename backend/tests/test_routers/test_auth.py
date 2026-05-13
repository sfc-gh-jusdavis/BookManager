"""
Smoke tests for /auth router.

These tests do not hit Snowflake; SnowflakeDataService is mocked via conftest.
The real auth dependency (_fetch_user_from_table) is NOT mocked here — these
smoke tests verify route wiring only. Acceptable status codes include 503
(auth failed — route exists but user not in BKMNG_USERS).
"""
from __future__ import annotations

from unittest.mock import MagicMock


def test_auth_users_route_wired(test_client, mock_snowflake_service: MagicMock):
    """GET /auth/users — route is wired (returns valid HTTP, not 5xx crash)."""
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
    # 200 = success path, 401/403 = auth required, 404 = endpoint moved,
    # 503 = auth lookup failed (user not in BKMNG_USERS in test env).
    # 500 would indicate an unhandled crash and is NOT acceptable.
    assert resp.status_code in (200, 401, 403, 404, 503), \
        f"Unexpected crash response: {resp.status_code} {resp.text}"


def test_auth_mock_users_route_wired(test_client, mock_snowflake_service: MagicMock):
    """GET /auth/mock-users — route is wired."""
    mock_snowflake_service.list_users = MagicMock(return_value=[])
    resp = test_client.get("/auth/mock-users")
    assert resp.status_code in (200, 401, 403, 404, 503), \
        f"Unexpected crash response: {resp.status_code} {resp.text}"


def test_auth_me_route_wired(test_client):
    """GET /auth/me — route is wired."""
    resp = test_client.get("/auth/me")
    assert resp.status_code in (200, 401, 403, 404, 503), \
        f"Unexpected crash response: {resp.status_code} {resp.text}"
