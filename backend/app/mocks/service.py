"""Mock data service backed by comprehensive fixtures from data.py."""
from __future__ import annotations

from typing import Optional

from app.models.account import Account, UseCase, AccountResource
from app.models.credit import AccountFeatureUsage, CreditConsumption
from app.models.gong import GongCall
from app.models.prediction import (
    CreditForecast,
    SimilarDeployment,
    TMRSuccessPrediction,
    UseCaseCompletionPrediction,
)
from app.models.tmr import TMR
from app.mocks.data import (
    MOCK_ACCOUNTS,
    MOCK_USE_CASES,
    MOCK_TMRS,
    MOCK_CREDIT_CONSUMPTION,
    MOCK_FEATURE_USAGE,
    MOCK_CREDIT_FORECASTS,
    MOCK_USE_CASE_PREDICTIONS,
    MOCK_TMR_PREDICTIONS,
    MOCK_SIMILAR_DEPLOYMENTS,
    MOCK_GONG_CALLS,
    MOCK_ACCOUNT_RESOURCES,
)


class MockDataService:
    """Serves mock data with ACE-scoped filtering."""

    def _account_ids_for_ace(self, ace_filter: Optional[str]) -> Optional[set[str]]:
        if ace_filter is None:
            return None
        return {a.account_id for a in MOCK_ACCOUNTS if a.ace_assigned == ace_filter}

    def list_accounts(self, ace_filter: Optional[str] = None) -> list[Account]:
        if ace_filter is None:
            return list(MOCK_ACCOUNTS)
        return [a for a in MOCK_ACCOUNTS if a.ace_assigned == ace_filter]

    def get_account(self, account_id: str, ace_filter: Optional[str] = None) -> Optional[Account]:
        for a in MOCK_ACCOUNTS:
            if a.account_id == account_id:
                if ace_filter is not None and a.ace_assigned != ace_filter:
                    return None
                return a
        return None

    def list_use_cases_for_account(
        self, account_id: str, ace_filter: Optional[str] = None
    ) -> list[UseCase]:
        allowed = self._account_ids_for_ace(ace_filter)
        if allowed is not None and account_id not in allowed:
            return []
        return [u for u in MOCK_USE_CASES if u.account_id == account_id]

    def list_all_use_cases(self, ace_filter: Optional[str] = None) -> list[UseCase]:
        if ace_filter is None:
            return list(MOCK_USE_CASES)
        return [u for u in MOCK_USE_CASES if u.ace_assigned == ace_filter]

    def list_credit_consumption_for_account(
        self, account_id: str, ace_filter: Optional[str] = None
    ) -> list[CreditConsumption]:
        allowed = self._account_ids_for_ace(ace_filter)
        if allowed is not None and account_id not in allowed:
            return []
        return [c for c in MOCK_CREDIT_CONSUMPTION if c.account_id == account_id]

    def list_feature_usage_for_account(
        self, account_id: str, ace_filter: Optional[str] = None
    ) -> list[AccountFeatureUsage]:
        allowed = self._account_ids_for_ace(ace_filter)
        if allowed is not None and account_id not in allowed:
            return []
        return [f for f in MOCK_FEATURE_USAGE if f.account_id == account_id]

    def list_credit_forecasts(self, ace_filter: Optional[str] = None) -> list[CreditForecast]:
        if ace_filter is None:
            return list(MOCK_CREDIT_FORECASTS)
        allowed = self._account_ids_for_ace(ace_filter)
        return [f for f in MOCK_CREDIT_FORECASTS if f.account_id in (allowed or set())]

    def get_credit_forecast_for_account(
        self, account_id: str, ace_filter: Optional[str] = None
    ) -> Optional[CreditForecast]:
        if self.get_account(account_id, ace_filter) is None:
            return None
        for f in MOCK_CREDIT_FORECASTS:
            if f.account_id == account_id:
                return f
        return None

    def list_use_case_predictions(
        self, ace_filter: Optional[str] = None
    ) -> list[UseCaseCompletionPrediction]:
        if ace_filter is None:
            return list(MOCK_USE_CASE_PREDICTIONS)
        allowed = self._account_ids_for_ace(ace_filter)
        return [p for p in MOCK_USE_CASE_PREDICTIONS if p.account_id in (allowed or set())]

    def list_similar_deployments(
        self, use_case_type: str, ace_filter: Optional[str] = None
    ) -> list[SimilarDeployment]:
        key = use_case_type.lower().replace("-", "_").replace(" ", "_")
        return [
            d for d in MOCK_SIMILAR_DEPLOYMENTS
            if d.use_case_type.lower().replace(" ", "_") == key
        ]

    def list_tmrs(self, ace_filter: Optional[str] = None) -> list[TMR]:
        if ace_filter is None:
            return list(MOCK_TMRS)
        allowed = self._account_ids_for_ace(ace_filter)
        return [t for t in MOCK_TMRS if t.account_id in (allowed or set())]

    def list_tmr_predictions(self, ace_filter: Optional[str] = None) -> list[TMRSuccessPrediction]:
        tmrs = self.list_tmrs(ace_filter)
        tmr_ids = {t.tmr_id for t in tmrs}
        return [p for p in MOCK_TMR_PREDICTIONS if p.tmr_id in tmr_ids]

    def list_gong_calls(
        self, account_id: Optional[str] = None, ace_filter: Optional[str] = None
    ) -> list[GongCall]:
        allowed = self._account_ids_for_ace(ace_filter)
        calls = MOCK_GONG_CALLS
        if account_id is not None:
            calls = [c for c in calls if c.account_id == account_id]
        if allowed is not None:
            calls = [c for c in calls if c.account_id in allowed]
        return list(calls)

    def list_account_resources(
        self, account_id: Optional[str] = None, ace_filter: Optional[str] = None
    ) -> list[AccountResource]:
        allowed = self._account_ids_for_ace(ace_filter)
        resources = MOCK_ACCOUNT_RESOURCES
        if account_id is not None:
            resources = [r for r in resources if r.account_id == account_id]
        if allowed is not None:
            resources = [r for r in resources if r.account_id in allowed]
        return list(resources)
