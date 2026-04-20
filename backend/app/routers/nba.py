from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.nba import NBAItem
from app.models.user import CurrentUser, UserRole
from app.services.snowflake_service import SnowflakeDataService
from app.services import get_data_service

router = APIRouter(tags=["nba"])


def _ace_filter(user: CurrentUser) -> str | None:
    return user.email if user.role == UserRole.ACE else None


def _acem_filter(user: CurrentUser) -> str | None:
    return user.email if user.role == UserRole.ACEM else None


@router.get("/nba", response_model=list[NBAItem])
async def get_nba(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[NBAItem]:
    return data.list_nba_items(_ace_filter(user), _acem_filter(user))
