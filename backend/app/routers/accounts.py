from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.auth.dependencies import get_current_user
from app.models.account import Account, UseCase
from app.models.credit import AccountFeatureUsage, CreditConsumption
from app.models.user import CurrentUser, UserRole
from app.mocks.service import MockDataService
from app.services import get_data_service

router = APIRouter(tags=["accounts"])


def _ace_filter(user: CurrentUser) -> str | None:
    return user.user_id if user.role == UserRole.ACE else None


@router.get("/accounts", response_model=list[Account])
async def list_accounts(
    user: CurrentUser = Depends(get_current_user),
    data: MockDataService = Depends(get_data_service),
) -> list[Account]:
    return data.list_accounts(_ace_filter(user))


@router.get("/accounts/{account_id}", response_model=Account)
async def get_account(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: MockDataService = Depends(get_data_service),
) -> Account:
    acct = data.get_account(account_id, _ace_filter(user))
    if acct is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return acct


@router.get("/accounts/{account_id}/use-cases", response_model=list[UseCase])
async def get_account_use_cases(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: MockDataService = Depends(get_data_service),
) -> list[UseCase]:
    return data.list_use_cases_for_account(account_id, _ace_filter(user))


@router.get("/accounts/{account_id}/credits", response_model=list[CreditConsumption])
async def get_account_credits(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: MockDataService = Depends(get_data_service),
) -> list[CreditConsumption]:
    return data.list_credit_consumption_for_account(account_id, _ace_filter(user))


@router.get("/accounts/{account_id}/features", response_model=list[AccountFeatureUsage])
async def get_account_features(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: MockDataService = Depends(get_data_service),
) -> list[AccountFeatureUsage]:
    return data.list_feature_usage_for_account(account_id, _ace_filter(user))


@router.get("/use-cases", response_model=list[UseCase])
async def list_use_cases(
    user: CurrentUser = Depends(get_current_user),
    data: MockDataService = Depends(get_data_service),
) -> list[UseCase]:
    return data.list_all_use_cases(_ace_filter(user))
