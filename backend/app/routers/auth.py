from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import get_current_user, MOCK_USERS
from app.config import settings
from app.models.user import CurrentUser, UserRole

router = APIRouter(prefix="/auth", tags=["auth"])


class MockUserSummary(BaseModel):
    user_id: str
    email: str
    display_name: str
    role: UserRole
    team_id: str | None = None


class SwitchUserRequest(BaseModel):
    user_id: str


@router.get("/me", response_model=CurrentUser)
async def read_me(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return user


@router.get("/mock-users", response_model=list[MockUserSummary])
async def list_mock_users() -> list[MockUserSummary]:
    if not settings.mock_data:
        raise HTTPException(status_code=404, detail="Not available")
    return [
        MockUserSummary(
            user_id=u.user_id,
            email=u.email,
            display_name=u.display_name,
            role=u.role,
            team_id=u.team_id,
        )
        for u in MOCK_USERS.values()
    ]


@router.post("/switch-user", response_model=CurrentUser)
async def switch_user(body: SwitchUserRequest) -> CurrentUser:
    if not settings.mock_data:
        raise HTTPException(status_code=403, detail="Switch user is only available in mock/dev mode")
    user = MOCK_USERS.get(body.user_id)
    if user is None:
        raise HTTPException(status_code=400, detail=f"Unknown mock user: {body.user_id}")
    return user
