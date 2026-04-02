from datetime import datetime
from pydantic import BaseModel


class GongCall(BaseModel):
    call_id: str
    account_id: str
    call_date: datetime
    duration_minutes: int
    summary: str
    topics: list[str]
    action_items: list[str]
    next_steps: list[str]
    participants_internal: list[str]
    participants_external: list[str]
