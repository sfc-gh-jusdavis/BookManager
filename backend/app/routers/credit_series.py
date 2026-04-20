from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.credit import AccountRevenueSummary
from app.models.user import CurrentUser
from app.services import get_data_service

router = APIRouter(tags=["credit-series"])


@router.get("/accounts/{account_id}/revenue-summary", response_model=AccountRevenueSummary)
async def get_account_revenue_summary(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> AccountRevenueSummary:
    svc = get_data_service()
    result = svc.get_account_revenue_summary(account_id, ace_filter=user.email)
    if result is None:
        return AccountRevenueSummary(account_id=account_id)
    return result
