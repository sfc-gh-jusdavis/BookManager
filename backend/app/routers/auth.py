from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.dependencies import get_current_user, _fetch_all_users_from_table
from app.config import settings
from app.models.user import CurrentUser, UserRole

router = APIRouter(prefix="/auth", tags=["auth"])


class MockUserSummary(BaseModel):
    user_id: str
    email: str
    display_name: str
    role: UserRole
    team_id: str | None = None


class AuthMode(BaseModel):
    spcs_mode: bool
    mock_data: bool


@router.get("/me", response_model=CurrentUser)
async def read_me(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return user


@router.get("/mode", response_model=AuthMode)
async def get_mode() -> AuthMode:
    return AuthMode(spcs_mode=settings.spcs_mode, mock_data=settings.mock_data)


@router.get("/mock-users", response_model=list[MockUserSummary])
async def list_mock_users() -> list[MockUserSummary]:
    users = _fetch_all_users_from_table()
    return [
        MockUserSummary(
            user_id=u.user_id,
            email=u.email,
            display_name=u.display_name,
            role=u.role,
            team_id=u.team_id,
        )
        for u in users
    ]


@router.get("/users", response_model=list[MockUserSummary])
async def list_all_users(
    user: CurrentUser = Depends(get_current_user),
) -> list[MockUserSummary]:
    """All known users (ACE + ACEM) for use in pickers (e.g. coverage ACE).
    Always reads from BKMNG_USERS so coverage can target any user."""
    users = _fetch_all_users_from_table()
    return [
        MockUserSummary(
            user_id=u.user_id,
            email=u.email,
            display_name=u.display_name,
            role=u.role,
            team_id=u.team_id,
        )
        for u in users
    ]
