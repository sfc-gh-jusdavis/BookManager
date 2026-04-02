from datetime import date
from typing import Optional
from pydantic import BaseModel


class TMR(BaseModel):
    tmr_id: str
    account_id: str
    account_name: str
    requestor: str
    request_type: str
    status: str
    requested_date: date
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    use_case_id: Optional[str] = None
    priority: str
    outcome: Optional[str] = None
