from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class NBAItem(BaseModel):
    id: str
    signal_type: str
    account_id: str
    account_name: str
    priority: Literal["high", "medium", "low"]
    text: str
    summary: str
    lane: str = "client"
    category: Optional[str] = None
