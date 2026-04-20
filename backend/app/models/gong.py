from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class GongCall(BaseModel):
    call_id: str
    account_id: str
    title: Optional[str] = None
    call_date: datetime
    duration_minutes: Optional[float] = None
    summary: Optional[str] = None
    key_points: Optional[str] = None
    next_steps: list[str] = []
    outcome: Optional[str] = None
    call_score: Optional[float] = None
    direction: Optional[str] = None
    participants_emails: list[str] = []
    action_items: list[str] = []
    topics: list[str] = []
    recording_url: Optional[str] = None
