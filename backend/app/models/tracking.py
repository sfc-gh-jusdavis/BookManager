from typing import Literal, Optional
from pydantic import BaseModel


class AccountTracking(BaseModel):
    account_id: str
    account_name: Optional[str] = None
    tracking_status: Literal["following", "archived"]
    notes: Optional[str] = None
    updated_at: Optional[str] = None


class SetTrackingRequest(BaseModel):
    status: Literal["following", "archived"]
    notes: Optional[str] = None
