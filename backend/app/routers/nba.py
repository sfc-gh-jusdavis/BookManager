from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.models.nba import NBAItem
from app.models.user import CurrentUser, UserRole
from app.services.snowflake_service import SnowflakeDataService
from app.services import get_data_service

router = APIRouter(tags=["nba"])


def _ace_filter(user: CurrentUser) -> Optional[str]:
    return user.email if user.role == UserRole.ACE else None


def _acem_filter(user: CurrentUser) -> Optional[str]:
    return user.email if user.role == UserRole.ACEM else None


class NBAResponse(BaseModel):
    client: List[NBAItem]
    admin: List[NBAItem]


@router.get("/nba", response_model=NBAResponse)
async def get_nba(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> NBAResponse:
    result = data.list_nba_items(_ace_filter(user), _acem_filter(user))
    return NBAResponse(client=result["client"], admin=result["admin"])
