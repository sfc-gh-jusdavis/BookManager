from datetime import date
from typing import Optional
from pydantic import BaseModel


class CreditForecast(BaseModel):
    account_id: str
    forecast_date: date
    predicted_credits_30d: float
    predicted_credits_60d: float
    predicted_credits_90d: float
    confidence_interval_lower: float
    confidence_interval_upper: float
    trend_direction: str
    model_version: str


class UseCaseCompletionPrediction(BaseModel):
    use_case_id: str
    account_id: str
    predicted_go_live_date: date
    confidence_score: float
    risk_factors: list[str]
    predicted_status: str
    days_remaining_estimate: int
    similar_use_case_refs: list[str]
    model_version: str


class TMRSuccessPrediction(BaseModel):
    tmr_id: str
    predicted_success_probability: float
    predicted_completion_date: Optional[date] = None
    risk_level: str
    recommended_actions: list[str]
    comparable_tmr_outcomes: list[str]
    model_version: str


class UseCaseForecast(BaseModel):
    use_case_id: str
    account_id: str
    auto_category: str
    override_category: Optional[str] = None
    override_note: Optional[str] = None
    override_by: Optional[str] = None
    override_at: Optional[str] = None
    pending_approval: bool = False
    quarter: str


class SimilarDeployment(BaseModel):
    deployment_id: str
    use_case_type: str
    industry: str
    account_size: str
    days_to_go_live: int
    credits_consumed: float
    features_used: list[str]
    success_rating: Optional[float] = None
    blockers_encountered: list[str]
    resources_used: float
