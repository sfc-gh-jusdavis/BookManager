from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.models.user import CurrentUser
from app.services.snowflake_service import SnowflakeDataService
from app.services import get_data_service

router = APIRouter(prefix="/assessments", tags=["assessments"])


class UseCaseAssessment(BaseModel):
    use_case_id: str
    account_id: str
    account_name: Optional[str] = None
    use_case_name: Optional[str] = None
    ai_tier: Optional[Literal["high", "medium", "low"]] = None
    confidence: Optional[float] = None
    rationale: Optional[str] = None
    recommended_actions: Optional[str] = None
    risk_level: Optional[Literal["high", "medium", "low"]] = None
    opportunity_score: Optional[float] = None
    computed_at: Optional[str] = None


class AccountAssessment(BaseModel):
    account_id: str
    account_name: Optional[str] = None
    ai_priority_score: Optional[float] = None
    priority_tier: Optional[Literal["critical", "high", "medium", "low"]] = None
    confidence: Optional[float] = None
    rationale: Optional[str] = None
    recommended_actions: Optional[str] = None
    key_risks: Optional[str] = None
    key_opportunities: Optional[str] = None
    computed_at: Optional[str] = None


class UseCaseBreakdownItem(BaseModel):
    breakdown_id: Optional[str] = None
    use_case_id: str
    account_id: str
    account_name: Optional[str] = None
    parent_use_case_name: Optional[str] = None
    splittability_score: Optional[float] = None
    splittability_reason: Optional[str] = None
    sub_use_case_index: Optional[int] = None
    sub_use_case_name: Optional[str] = None
    sub_workload: Optional[str] = None
    sub_technical_use_case: Optional[str] = None
    sub_rationale: Optional[str] = None
    sub_estimated_effort: Optional[str] = None
    sub_key_activities: Optional[str] = None
    total_sub_use_cases: Optional[int] = None
    overall_rationale: Optional[str] = None
    criteria_scores: Optional[str] = None
    status: Optional[str] = None
    computed_at: Optional[str] = None


class BreakdownSummary(BaseModel):
    use_case_id: str
    account_id: str
    account_name: Optional[str] = None
    parent_use_case_name: Optional[str] = None
    splittability_score: Optional[float] = None
    splittability_reason: Optional[str] = None
    total_sub_use_cases: Optional[int] = None
    overall_rationale: Optional[str] = None
    computed_at: Optional[str] = None


@router.get("/accounts", response_model=list[AccountAssessment])
async def list_account_assessments(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[AccountAssessment]:
    return data.list_account_assessments(_ace_filter(user), _acem_filter(user))


@router.get("/use-cases", response_model=list[UseCaseAssessment])
async def list_all_use_case_assessments(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[UseCaseAssessment]:
    return data.list_use_case_assessments(None, _ace_filter(user))


@router.get("/use-cases/{account_id}", response_model=list[UseCaseAssessment])
async def list_use_case_assessments(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[UseCaseAssessment]:
    return data.list_use_case_assessments(account_id, _ace_filter(user))


@router.get("/breakdowns", response_model=list[BreakdownSummary])
async def list_all_breakdown_summaries(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[BreakdownSummary]:
    rows = data.list_breakdown_summaries(_ace_filter(user), _acem_filter(user))
    return [BreakdownSummary(**{k.lower(): v for k, v in r.items()}) for r in rows]


@router.get("/breakdowns/{account_id}", response_model=list[UseCaseBreakdownItem])
async def list_account_breakdowns(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[UseCaseBreakdownItem]:
    rows = data.list_use_case_breakdowns(account_id=account_id, ace_filter=_ace_filter(user))
    return [UseCaseBreakdownItem(**{k.lower(): v for k, v in r.items()}) for r in rows]


@router.get("/breakdowns/{account_id}/{use_case_id}", response_model=list[UseCaseBreakdownItem])
async def list_use_case_breakdowns(
    account_id: str,
    use_case_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[UseCaseBreakdownItem]:
    rows = data.list_use_case_breakdowns(account_id=account_id, use_case_id=use_case_id, ace_filter=_ace_filter(user))
    return [UseCaseBreakdownItem(**{k.lower(): v for k, v in r.items()}) for r in rows]


def _ace_filter(user: CurrentUser) -> str | None:
    from app.models.user import UserRole
    if user.is_admin:
        return None
    return user.email if user.role == UserRole.ACE else None


def _acem_filter(user: CurrentUser) -> str | None:
    from app.models.user import UserRole
    if user.is_admin:
        return None
    return user.email if user.role == UserRole.ACEM else None
