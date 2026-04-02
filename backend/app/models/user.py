from enum import Enum
from typing import Optional
from pydantic import BaseModel


class UserRole(str, Enum):
    ACE = "ace"
    ACEM = "acem"


class CurrentUser(BaseModel):
    user_id: str
    email: str
    display_name: str
    role: UserRole
    team_id: Optional[str] = None
