from datetime import date
from typing import Optional
from pydantic import BaseModel


class CreditConsumption(BaseModel):
    account_id: str
    measurement_date: date
    credits_used: float
    credits_allocated: float
    warehouse_name: Optional[str] = None
    compute_credits: float
    storage_credits: float
    cloud_services_credits: float
    daily_trend: float
    monthly_trend: float


class AccountFeatureUsage(BaseModel):
    account_id: str
    feature_name: str
    usage_count: int
    first_used: Optional[date] = None
    last_used: Optional[date] = None
    measurement_period: str


class AccountRevenueSummary(BaseModel):
    account_id: str
    net_acv: Optional[float] = None
    net_tcv: Optional[float] = None
    contract_capacity: Optional[float] = None
    total_consumed_revenue: Optional[float] = None
    capacity_remaining: Optional[float] = None
    total_consumed_credits: Optional[float] = None
    pct_consumed: Optional[float] = None
    predicted_overage_date: Optional[date] = None
    last_actual_date: Optional[date] = None
    contract_start_date: Optional[date] = None
    contract_end_date: Optional[date] = None
    wow_credits_pct_change: Optional[float] = None
    mom_credits_pct_change: Optional[float] = None
