from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.models.user import CurrentUser
from app.services import get_data_service

router = APIRouter(prefix="/user", tags=["user"])

ALERT_CATALOG = [
    {
        "signal_type": "use_case_no_go_live",
        "label": "Use Cases Without Go-Live Dates",
        "description": (
            "Triggers when an active use case (In Pursuit or Implementation) "
            "has no actual go-live date set in Salesforce."
        ),
        "how_generated": (
            "Checked daily during signal refresh. Queries BKMNG_USE_CASES "
            "where GO_LIVE_DATE is null and STATUS is In Pursuit or Implementation. "
            "Scoped to your assigned accounts."
        ),
        "category": "use_case",
        "default_priority": "medium",
    },
    {
        "signal_type": "use_case_no_impl_start",
        "label": "Use Cases Without Implementation Start Dates",
        "description": (
            "Triggers when a use case in Implementation status has no "
            "implementation start date set in Salesforce."
        ),
        "how_generated": (
            "Checked daily during signal refresh. Queries BKMNG_USE_CASES "
            "where IMPLEMENTATION_START_DATE is null and STATUS is Implementation. "
            "Scoped to your assigned accounts."
        ),
        "category": "use_case",
        "default_priority": "medium",
    },
    {
        "signal_type": "use_case_stale_notes",
        "label": "Stale Use Case Notes",
        "description": (
            "Reminds you on Fridays to update PS notes for active use cases "
            "that haven't been updated in the past week."
        ),
        "how_generated": (
            "Runs every Friday during signal refresh. Checks BKMNG_USE_CASE_NOTES "
            "for the most recent NOTE_DATE per use case. Fires if the last note is "
            "older than 7 days or no note exists. Scoped to your assigned accounts "
            "with In Pursuit or Implementation status."
        ),
        "category": "use_case",
        "default_priority": "low",
    },
]


class UserPreferences(BaseModel):
    preferred_name: Optional[str] = None
    greeting_style: Optional[str] = "Hi [Name],"
    closing_style: Optional[str] = "Best, ACE"
    writing_examples: Optional[list[str]] = None


class UpdatePreferencesRequest(BaseModel):
    preferred_name: Optional[str] = None
    greeting_style: Optional[str] = None
    closing_style: Optional[str] = None
    writing_examples: Optional[list[str]] = None


@router.get("/preferences")
async def get_preferences(
    user: CurrentUser = Depends(get_current_user),
    data=Depends(get_data_service),
) -> UserPreferences:
    if not hasattr(data, "_cursor"):
        return UserPreferences()

    cur = data._cursor()
    cur.execute(
        "SELECT PREFERRED_NAME, GREETING_STYLE, CLOSING_STYLE, WRITING_EXAMPLES "
        "FROM TEMP.JUSDAVIS.BKMNG_USER_PREFERENCES WHERE USER_EMAIL = %s",
        (user.email,),
    )
    row = cur.fetchone()
    if not row:
        return UserPreferences()

    examples = None
    raw = row.get("WRITING_EXAMPLES")
    if raw:
        if isinstance(raw, str):
            try:
                examples = json.loads(raw)
            except json.JSONDecodeError:
                examples = None
        elif isinstance(raw, list):
            examples = raw

    return UserPreferences(
        preferred_name=row.get("PREFERRED_NAME"),
        greeting_style=row.get("GREETING_STYLE") or "Hi [Name],",
        closing_style=row.get("CLOSING_STYLE") or "Best, ACE",
        writing_examples=examples,
    )


@router.put("/preferences")
async def update_preferences(
    req: UpdatePreferencesRequest,
    user: CurrentUser = Depends(get_current_user),
    data=Depends(get_data_service),
) -> dict[str, str]:
    if not hasattr(data, "_cursor"):
        return {"status": "not available"}

    examples_json = json.dumps(req.writing_examples) if req.writing_examples else None

    cur = data._cursor()
    cur.execute(
        """
        MERGE INTO TEMP.JUSDAVIS.BKMNG_USER_PREFERENCES t
        USING (SELECT %s AS email) s ON t.USER_EMAIL = s.email
        WHEN MATCHED THEN UPDATE SET
            PREFERRED_NAME = %s,
            GREETING_STYLE = %s,
            CLOSING_STYLE = %s,
            WRITING_EXAMPLES = PARSE_JSON(%s),
            UPDATED_AT = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (
            USER_EMAIL, PREFERRED_NAME, GREETING_STYLE, CLOSING_STYLE, WRITING_EXAMPLES
        ) VALUES (%s, %s, %s, %s, PARSE_JSON(%s))
        """,
        (
            user.email,
            req.preferred_name,
            req.greeting_style or "Hi [Name],",
            req.closing_style or "Best, ACE",
            examples_json,
            user.email,
            req.preferred_name,
            req.greeting_style or "Hi [Name],",
            req.closing_style or "Best, ACE",
            examples_json,
        ),
    )

    return {"status": "ok"}


class AlertPreferenceItem(BaseModel):
    signal_type: str
    label: str
    description: str
    how_generated: str
    category: str
    default_priority: str
    priority: str
    enabled: bool


class UpdateAlertPreferenceRequest(BaseModel):
    signal_type: str
    enabled: bool
    priority_override: Optional[str] = None


@router.get("/alert-preferences", response_model=list[AlertPreferenceItem])
async def get_alert_preferences(
    user: CurrentUser = Depends(get_current_user),
    data=Depends(get_data_service),
) -> list[AlertPreferenceItem]:
    overrides: dict[str, dict[str, object]] = {}
    if hasattr(data, "_cursor"):
        cur = data._cursor()
        cur.execute(
            "SELECT SIGNAL_TYPE, ENABLED, PRIORITY_OVERRIDE "
            "FROM TEMP.JUSDAVIS.BKMNG_USER_ALERT_PREFERENCES "
            "WHERE USER_EMAIL = %s",
            (user.email,),
        )
        for r in cur.fetchall():
            overrides[r["SIGNAL_TYPE"]] = {
                "enabled": r.get("ENABLED", True),
                "priority_override": r.get("PRIORITY_OVERRIDE"),
            }

    result = []
    for item in ALERT_CATALOG:
        user_pref = overrides.get(item["signal_type"], {})
        enabled = user_pref.get("enabled", True)
        if enabled is None:
            enabled = True
        priority_override = user_pref.get("priority_override")
        effective_priority = priority_override if priority_override else item["default_priority"]

        result.append(AlertPreferenceItem(
            signal_type=item["signal_type"],
            label=item["label"],
            description=item["description"],
            how_generated=item["how_generated"],
            category=item["category"],
            default_priority=item["default_priority"],
            priority=effective_priority,
            enabled=bool(enabled),
        ))
    return result


@router.put("/alert-preferences")
async def update_alert_preference(
    req: UpdateAlertPreferenceRequest,
    user: CurrentUser = Depends(get_current_user),
    data=Depends(get_data_service),
) -> dict[str, str]:
    if not hasattr(data, "_cursor"):
        return {"status": "not available"}

    cur = data._cursor()
    cur.execute(
        """
        MERGE INTO TEMP.JUSDAVIS.BKMNG_USER_ALERT_PREFERENCES t
        USING (SELECT %s AS email, %s AS sig_type) s
            ON t.USER_EMAIL = s.email AND t.SIGNAL_TYPE = s.sig_type
        WHEN MATCHED THEN UPDATE SET
            ENABLED = %s,
            PRIORITY_OVERRIDE = %s,
            UPDATED_AT = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (USER_EMAIL, SIGNAL_TYPE, ENABLED, PRIORITY_OVERRIDE)
            VALUES (%s, %s, %s, %s)
        """,
        (user.email, req.signal_type, req.enabled, req.priority_override,
         user.email, req.signal_type, req.enabled, req.priority_override),
    )
    return {"status": "ok"}
