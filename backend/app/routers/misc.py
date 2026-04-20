from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.auth.dependencies import get_current_user, MOCK_USERS
from app.models.gong import GongCall
from app.models.account import AccountResource
from app.models.user import CurrentUser, UserRole
from app.services.snowflake_service import SnowflakeDataService
from app.services import get_data_service

router = APIRouter(tags=["misc"])


def _ace_filter(user: CurrentUser) -> str | None:
    return user.email if user.role == UserRole.ACE else None


@router.get("/gong-calls", response_model=list[GongCall])
async def list_gong_calls(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[GongCall]:
    return data.list_gong_calls(ace_filter=_ace_filter(user))


@router.get("/accounts/{account_id}/gong-calls", response_model=list[GongCall])
async def list_account_gong_calls(
    account_id: str,
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[GongCall]:
    return data.list_gong_calls(account_id=account_id)


@router.get("/accounts/{account_id}/resources", response_model=list[AccountResource])
async def list_account_resources(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[AccountResource]:
    return data.list_account_resources(account_id=account_id, ace_filter=_ace_filter(user))


@router.get("/ace-display-names")
async def get_ace_display_names() -> dict[str, str]:
    return {u.user_id: u.display_name for u in MOCK_USERS.values()}
