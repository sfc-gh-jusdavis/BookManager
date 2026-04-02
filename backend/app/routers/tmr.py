from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.prediction import TMRSuccessPrediction
from app.models.tmr import TMR
from app.models.user import CurrentUser, UserRole
from app.mocks.service import MockDataService
from app.services import get_data_service

router = APIRouter(prefix="/tmrs", tags=["tmr"])


def _ace_filter(user: CurrentUser) -> str | None:
    return user.user_id if user.role == UserRole.ACE else None


@router.get("", response_model=list[TMR])
async def list_tmrs(
    user: CurrentUser = Depends(get_current_user),
    data: MockDataService = Depends(get_data_service),
) -> list[TMR]:
    return data.list_tmrs(_ace_filter(user))


@router.get("/predictions", response_model=list[TMRSuccessPrediction])
async def list_tmr_predictions(
    user: CurrentUser = Depends(get_current_user),
    data: MockDataService = Depends(get_data_service),
) -> list[TMRSuccessPrediction]:
    return data.list_tmr_predictions(_ace_filter(user))
