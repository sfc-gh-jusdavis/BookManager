from abc import ABC, abstractmethod
from typing import Optional
from app.models.account import Account, UseCase
from app.models.tmr import TMR
from app.models.credit import CreditConsumption, AccountFeatureUsage
from app.models.prediction import (
    CreditForecast, UseCaseCompletionPrediction, TMRSuccessPrediction, SimilarDeployment
)


class DataService(ABC):
    @abstractmethod
    def get_accounts(self, ace_filter: Optional[str] = None) -> list[Account]:
        ...

    @abstractmethod
    def get_account(self, account_id: str) -> Optional[Account]:
        ...

    @abstractmethod
    def get_use_cases(self, account_id: Optional[str] = None, ace_filter: Optional[str] = None) -> list[UseCase]:
        ...

    @abstractmethod
    def get_tmrs(self, account_id: Optional[str] = None, ace_filter: Optional[str] = None) -> list[TMR]:
        ...

    @abstractmethod
    def get_credit_consumption(self, account_id: str) -> list[CreditConsumption]:
        ...

    @abstractmethod
    def get_feature_usage(self, account_id: str) -> list[AccountFeatureUsage]:
        ...

    @abstractmethod
    def get_credit_forecasts(self, account_id: Optional[str] = None, ace_filter: Optional[str] = None) -> list[CreditForecast]:
        ...

    @abstractmethod
    def get_use_case_predictions(self, account_id: Optional[str] = None, ace_filter: Optional[str] = None) -> list[UseCaseCompletionPrediction]:
        ...

    @abstractmethod
    def get_tmr_predictions(self, ace_filter: Optional[str] = None) -> list[TMRSuccessPrediction]:
        ...

    @abstractmethod
    def get_similar_deployments(self, use_case_type: str) -> list[SimilarDeployment]:
        ...
