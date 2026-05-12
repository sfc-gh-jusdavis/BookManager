from datetime import date
from typing import Optional
from pydantic import BaseModel


class TMR(BaseModel):
    tmr_id: str
    account_id: str
    account_name: str
    use_case_id: Optional[str] = None
    status: str
    stage: Optional[str] = None
    activity_requested: Optional[str] = None
    engagement_type: Optional[str] = None
    requestor: Optional[str] = None
    requestor_email: Optional[str] = None
    request_reason: Optional[str] = None
    specialist_comments: Optional[str] = None
    specialist_engagement_status: Optional[str] = None
    resolution: Optional[str] = None
    rejection_reason: Optional[str] = None
    manager_approver: Optional[str] = None
    manager_approver_email: Optional[str] = None
    requested_date: Optional[date] = None
    start_date: Optional[date] = None
    close_date: Optional[date] = None
    assigned_resource_id: Optional[str] = None
    assigned_resource_email: Optional[str] = None
    assigned_resource_name: Optional[str] = None
    secondary_member_id: Optional[str] = None
    secondary_member_email: Optional[str] = None
    secondary_member_name: Optional[str] = None
