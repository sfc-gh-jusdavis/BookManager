from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.auth.dependencies import get_current_user
from app.models.prediction import CreditForecast, SimilarDeployment, UseCaseCompletionPrediction
from app.models.user import CurrentUser, UserRole
from app.mocks.service import MockDataService
from app.services import get_data_service

router = APIRouter(prefix="/forecasts", tags=["forecasts"])


def _ace_filter(user: CurrentUser) -> str | None:
    return user.user_id if user.role == UserRole.ACE else None


@router.get("/credits", response_model=list[CreditForecast])
async def list_credit_forecasts(
    user: CurrentUser = Depends(get_current_user),
    data: MockDataService = Depends(get_data_service),
) -> list[CreditForecast]:
    return data.list_credit_forecasts(_ace_filter(user))


@router.get("/credits/{account_id}", response_model=CreditForecast)
async def get_credit_forecast_for_account(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: MockDataService = Depends(get_data_service),
) -> CreditForecast:
    fc = data.get_credit_forecast_for_account(account_id, _ace_filter(user))
    if fc is None:
        raise HTTPException(status_code=404, detail="Credit forecast not found")
    return fc


@router.get("/use-cases", response_model=list[UseCaseCompletionPrediction])
async def list_use_case_predictions(
    user: CurrentUser = Depends(get_current_user),
    data: MockDataService = Depends(get_data_service),
) -> list[UseCaseCompletionPrediction]:
    return data.list_use_case_predictions(_ace_filter(user))


@router.get("/similar/{use_case_type}", response_model=list[SimilarDeployment])
async def list_similar_deployments(
    use_case_type: str,
    user: CurrentUser = Depends(get_current_user),
    data: MockDataService = Depends(get_data_service),
) -> list[SimilarDeployment]:
    return data.list_similar_deployments(use_case_type, _ace_filter(user))
