from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class Account(BaseModel):
    account_id: str
    account_name: str
    industry: str
    ace_assigned: str
    engagement_status: str
    status: str
    use_case_count: int
    total_credits_allocated: float
    activation_start_date: date
    region: Optional[str] = None


class PSNote(BaseModel):
    note_id: str
    use_case_id: str
    author: str
    content: str
    created_at: datetime


class UseCase(BaseModel):
    use_case_id: str
    account_id: str
    account_name: str
    use_case_name: str
    description: str
    status: str
    ps_notes: list[PSNote] = []
    ps_notes_summary: Optional[str] = None
    go_live_date: Optional[date] = None
    target_go_live_date: Optional[date] = None
    lead_se: str
    ace_assigned: str
    created_date: date
    last_modified_date: datetime
    stage: str
    complexity: Optional[str] = None


class AccountResource(BaseModel):
    resource_id: str
    account_id: str
    resource_type: str
    title: str
    content: str
    link_type: Optional[str] = None
    created_by: str
    created_at: datetime
