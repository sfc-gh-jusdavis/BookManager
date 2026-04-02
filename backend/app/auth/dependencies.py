from fastapi import Depends, Header, HTTPException
from typing import Optional
from app.models.user import CurrentUser, UserRole
from app.config import settings

MOCK_USERS = {
    "ace-jane": CurrentUser(
        user_id="ace-jane",
        email="jane.smith@company.com",
        display_name="Jane Smith",
        role=UserRole.ACE,
        team_id="team-west",
    ),
    "ace-carlos": CurrentUser(
        user_id="ace-carlos",
        email="carlos.rodriguez@company.com",
        display_name="Carlos Rodriguez",
        role=UserRole.ACE,
        team_id="team-west",
    ),
    "acem-mark": CurrentUser(
        user_id="acem-mark",
        email="mark.johnson@company.com",
        display_name="Mark Johnson",
        role=UserRole.ACEM,
        team_id="team-west",
    ),
}


async def get_current_user(
    x_mock_user: Optional[str] = Header(None),
) -> CurrentUser:
    if settings.mock_data:
        user_id = x_mock_user or "ace-jane"
        user = MOCK_USERS.get(user_id)
        if not user:
            raise HTTPException(status_code=400, detail=f"Unknown mock user: {user_id}")
        return user

    # Phase 4: JWT validation from Okta SAML
    raise HTTPException(status_code=501, detail="Real auth not yet implemented")
