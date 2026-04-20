from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


@dataclass
class SignalScope:
    user_email: str
    ace_filter: Optional[str] = None
    acem_filter: Optional[str] = None
    account_id: Optional[str] = None


class Signal(BaseModel):
    id: str
    signal_type: str
    category: str
    account_id: str
    account_name: str
    priority: Literal["high", "medium", "low"]
    text: str
    summary: str
    source: str
    metadata: dict = field(default_factory=dict)
    alert_eligible: bool = False
    created_at: Optional[datetime] = None

    class Config:
        arbitrary_types_allowed = True
