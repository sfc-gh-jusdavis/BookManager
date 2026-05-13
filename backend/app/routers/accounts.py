from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.models.account import Account, UseCase, MeetingActivity, EmailActivity, ManualMeeting
from app.models.credit import AccountFeatureUsage, AccountRevenueSummary, CreditConsumption
from app.models.tracking import AccountTracking, SetTrackingRequest
from app.models.user import CurrentUser, UserRole
from app.services.snowflake_service import SnowflakeDataService
from app.services import get_data_service


class AccountContact(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    role_on_account: Optional[str] = None
    is_champion: bool = False
    gong_call_count_90d: int = 0
    last_gong_call_date: Optional[str] = None
    days_since_last_call: Optional[int] = None


class AccountTopic(BaseModel):
    topic: str
    mention_count_90d: int
    last_mentioned_date: Optional[str] = None
    avg_duration_sec: Optional[float] = None


class AccountContextNote(BaseModel):
    context_id: Optional[str] = None
    account_name: Optional[str] = None
    context_type: Optional[str] = None
    content: str
    source: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    is_active: bool = True
    parsed_summary: Optional[str] = None
    sentiment: Optional[str] = None
    people_mentioned: Optional[str] = None
    topics_discussed: Optional[str] = None
    competitors_mentioned: Optional[str] = None
    action_items: Optional[str] = None
    risks_identified: Optional[str] = None
    opportunities_identified: Optional[str] = None
    blockers_mentioned: Optional[str] = None
    parse_status: Optional[str] = None


class AddContextRequest(BaseModel):
    context_type: str = "note"
    content: str
    source: str = "manual"
    use_case_id: Optional[str] = None


router = APIRouter(tags=["accounts"])


def _ace_filter(user: CurrentUser) -> str | None:
    if user.is_admin:
        return None
    return user.email if user.role == UserRole.ACE else None


def _acem_filter(user: CurrentUser) -> str | None:
    if user.is_admin:
        return None
    return user.email if user.role == UserRole.ACEM else None


@router.get("/accounts", response_model=list[Account])
async def list_accounts(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[Account]:
    return data.list_accounts(_ace_filter(user), _acem_filter(user))


@router.post("/accounts/{account_id}/refresh")
async def refresh_account(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    """Manually refresh data for a single account. Pulls fresh use cases (incl. PS notes)
    and Gong calls from Salesforce/Fivetran, then rebuilds ONT row, signals,
    composite patterns, and user alerts for this account."""
    try:
        result = data.manual_refresh_account(account_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Refresh failed: {exc}")
    return {"status": "ok", "account_id": account_id, "result": result}


@router.post("/book/refresh")
async def refresh_book(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    """Manually refresh the full book-level data pipeline end-to-end.
    Runs Salesforce source refreshes (accounts, use cases, Gong calls) then
    rebuilds ONT tables, signals, composite patterns, and user alerts.
    Equivalent to running the scheduled task chain on-demand."""
    try:
        result = data.manual_refresh_book()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Book refresh failed: {exc}")
    return {"status": "ok", "result": result}


class SignalCountEntry(BaseModel):
    high: int = 0
    medium: int = 0
    low: int = 0
    total: int = 0


@router.get("/accounts/signal-counts", response_model=dict[str, SignalCountEntry])
async def list_account_signal_counts(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict[str, SignalCountEntry]:
    return data.list_account_signal_counts(_ace_filter(user), _acem_filter(user))


@router.get("/accounts/revenue-summaries", response_model=dict[str, AccountRevenueSummary])
async def list_account_revenue_summaries(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict[str, AccountRevenueSummary]:
    return data.list_account_revenue_summaries(ace_filter=_ace_filter(user), acem_filter=_acem_filter(user))


@router.get("/accounts/{account_id}", response_model=Account)
async def get_account(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> Account:
    acct = data.get_account(account_id, _ace_filter(user))
    if acct is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return acct


@router.get("/accounts/{account_id}/use-cases", response_model=list[UseCase])
async def get_account_use_cases(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[UseCase]:
    return data.list_use_cases_for_account(account_id, _ace_filter(user), _acem_filter(user))


@router.get("/accounts/{account_id}/credits", response_model=list[CreditConsumption])
async def get_account_credits(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[CreditConsumption]:
    return data.list_credit_consumption_for_account(account_id, _ace_filter(user))


@router.get("/accounts/{account_id}/features", response_model=list[AccountFeatureUsage])
async def get_account_features(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[AccountFeatureUsage]:
    return data.list_feature_usage_for_account(account_id, _ace_filter(user))


@router.get("/use-cases", response_model=list[UseCase])
async def list_use_cases(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[UseCase]:
    return data.list_all_use_cases(_ace_filter(user), _acem_filter(user))


@router.get("/accounts/{account_id}/tracking", response_model=AccountTracking)
async def get_account_tracking(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
):
    result = data.get_account_tracking(account_id, user.email)
    if result is None:
        raise HTTPException(status_code=404, detail="Not tracked")
    return AccountTracking(**result)


@router.put("/accounts/{account_id}/tracking", response_model=AccountTracking)
async def set_account_tracking(
    account_id: str,
    body: SetTrackingRequest,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> AccountTracking:
    acct = data.get_account(account_id)
    account_name = acct.account_name if acct else None
    result = data.set_account_tracking(account_id, user.email, body.status, account_name, body.notes, body.notes_doc_url)
    return AccountTracking(**result)


class UpdateAccountFieldsRequest(BaseModel):
    status: Optional[str] = None
    engagement_status: Optional[str] = None
    no_recording: Optional[bool] = None
    engagement_start_date: Optional[str] = None
    rolloff_date: Optional[str] = None
    primary_ace_email: Optional[str] = None
    coverage_ace_email: Optional[str] = None
    coverage_until: Optional[str] = None


VALID_STATUSES = {"not started", "active", "complete", "stopped", "paused"}
VALID_ENGAGEMENTS = {"Low", "Normal", "High"}


@router.patch("/accounts/{account_id}")
async def update_account_fields(
    account_id: str,
    body: UpdateAccountFieldsRequest,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
):
    if body.status is not None and body.status.lower() not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status: {body.status}")
    if body.engagement_status is not None and body.engagement_status not in VALID_ENGAGEMENTS:
        raise HTTPException(status_code=422, detail=f"Invalid engagement_status: {body.engagement_status}")
    data.update_account_fields(
        account_id,
        body.status,
        body.engagement_status,
        body.no_recording,
        body.engagement_start_date,
        body.rolloff_date,
        body.primary_ace_email,
        body.coverage_ace_email,
        body.coverage_until,
        updated_by=user.email,
    )
    return {"account_id": account_id, "ok": True}


@router.delete("/accounts/{account_id}/tracking", status_code=204)
async def delete_account_tracking(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> Response:
    data.delete_account_tracking(account_id, user.email)
    return Response(status_code=204)


@router.get("/accounts-tracked", response_model=list[dict])
async def list_tracked_accounts(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[dict]:
    return data.list_tracked_accounts(user.email)


@router.get("/accounts/{account_id}/contacts", response_model=list[AccountContact])
async def get_account_contacts(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[AccountContact]:
    if not hasattr(data, "list_contacts_for_account"):
        return []
    rows = data.list_contacts_for_account(account_id)
    return [
        AccountContact(
            name=r.get("NAME"),
            email=r.get("EMAIL"),
            title=r.get("TITLE"),
            department=r.get("DEPARTMENT"),
            role_on_account=r.get("ROLE_ON_ACCOUNT"),
            is_champion=bool(r.get("IS_CHAMPION")),
            gong_call_count_90d=int(r.get("GONG_CALL_COUNT_90D") or 0),
            last_gong_call_date=str(r["LAST_GONG_CALL_DATE"]) if r.get("LAST_GONG_CALL_DATE") else None,
            days_since_last_call=r.get("DAYS_SINCE_LAST_CALL"),
        )
        for r in rows
    ]


@router.get("/accounts/{account_id}/topics", response_model=list[AccountTopic])
async def get_account_topics(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[AccountTopic]:
    if not hasattr(data, "list_topics_for_account"):
        return []
    rows = data.list_topics_for_account(account_id)
    return [
        AccountTopic(
            topic=r.get("TOPIC", ""),
            mention_count_90d=int(r.get("MENTION_COUNT_90D") or 0),
            last_mentioned_date=str(r["LAST_MENTIONED_DATE"]) if r.get("LAST_MENTIONED_DATE") else None,
            avg_duration_sec=r.get("AVG_DURATION_SEC"),
        )
        for r in rows
    ]


@router.get("/accounts/{account_id}/context", response_model=list[AccountContextNote])
async def get_account_context(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[AccountContextNote]:
    if not hasattr(data, "list_account_context"):
        return []
    rows = data.list_account_context(account_id, user.email)
    return [
        AccountContextNote(
            context_id=str(r.get("CONTEXT_ID")) if r.get("CONTEXT_ID") is not None else None,
            account_name=r.get("ACCOUNT_NAME"),
            context_type=r.get("CONTEXT_TYPE"),
            content=r.get("CONTENT", ""),
            source=r.get("SOURCE"),
            created_by=r.get("CREATED_BY"),
            created_at=str(r["CREATED_AT"]) if r.get("CREATED_AT") else None,
            is_active=bool(r.get("IS_ACTIVE", True)),
            parsed_summary=r.get("PARSED_SUMMARY"),
            sentiment=r.get("SENTIMENT"),
            people_mentioned=r.get("PEOPLE_MENTIONED"),
            topics_discussed=r.get("TOPICS_DISCUSSED"),
            competitors_mentioned=r.get("COMPETITORS_MENTIONED"),
            action_items=r.get("ACTION_ITEMS"),
            risks_identified=r.get("RISKS_IDENTIFIED"),
            opportunities_identified=r.get("OPPORTUNITIES_IDENTIFIED"),
            blockers_mentioned=r.get("BLOCKERS_MENTIONED"),
            parse_status=r.get("PARSE_STATUS"),
        )
        for r in rows
    ]


@router.post("/accounts/{account_id}/context", status_code=201)
async def add_account_context(
    account_id: str,
    body: AddContextRequest,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    if not hasattr(data, "add_account_context"):
        raise HTTPException(status_code=501, detail="Not available in mock mode")
    acct = data.get_account(account_id)
    account_name = acct.account_name if acct else None
    return data.add_account_context(
        account_id=account_id,
        account_name=account_name,
        context_type=body.context_type,
        content=body.content,
        source=body.source,
        created_by=user.email,
        use_case_id=body.use_case_id,
    )


@router.get("/situations")
async def list_situations(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[dict]:
    ace_filter = _ace_filter(user)
    acem_filter = _acem_filter(user)
    return data.get_composite_patterns(ace_filter=ace_filter, acem_filter=acem_filter)


@router.get("/accounts/{account_id}/situations")
async def get_account_situations(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[dict]:
    return data.get_composite_patterns(account_id=account_id)


@router.get("/accounts/{account_id}/meeting-prep")
async def get_meeting_prep(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    cached = data.get_meeting_prep(account_id)
    if cached:
        return cached
    acct = data.get_account(account_id)
    account_name = acct.account_name if acct else account_id
    return data.generate_meeting_prep(account_id, account_name, user.email)


class RefreshMeetingPrepRequest(BaseModel):
    additional_context: str = ""


@router.post("/accounts/{account_id}/meeting-prep")
async def refresh_meeting_prep(
    account_id: str,
    body: RefreshMeetingPrepRequest,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    acct = data.get_account(account_id)
    account_name = acct.account_name if acct else account_id
    return data.generate_meeting_prep(account_id, account_name, user.email, body.additional_context)


class SaveMeetingPrepContextRequest(BaseModel):
    content: str
    classification: str = "notes"
    title: Optional[str] = None
    context_date: Optional[str] = None


@router.post("/accounts/{account_id}/meeting-prep/context", status_code=201)
async def save_meeting_prep_context(
    account_id: str,
    body: SaveMeetingPrepContextRequest,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=400, detail="content is empty")
    acct = data.get_account(account_id)
    account_name = acct.account_name if acct else None
    saved = data.add_timeline_context(
        account_id=account_id,
        account_name=account_name,
        classification=body.classification,
        content=body.content,
        title=body.title,
        context_date=body.context_date,
        created_by=user.email,
    )
    data.summarize_timeline_context(
        saved["meeting_id"],
        account_id,
        account_name,
        body.content,
        body.classification,
        user.email,
        auto_title=not (body.title and body.title.strip()),
    )
    return {"meeting_id": saved["meeting_id"], "status": "saved_and_summarized"}


class GeneratePrepEmailRequest(BaseModel):
    recipient_name: str = ""
    meeting_date: str = ""


@router.post("/accounts/{account_id}/meeting-prep/email")
async def generate_prep_email(
    account_id: str,
    body: GeneratePrepEmailRequest,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    return data.generate_prep_email(account_id, user.email, body.recipient_name, body.meeting_date)

@router.get("/accounts/{account_id}/briefing")
async def get_account_briefing(
    account_id: str,
    refresh: bool = False,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    if not refresh:
        existing = data.get_account_briefing(account_id)
        if existing:
            return existing
    acct = data.get_account(account_id)
    account_name = acct.account_name if acct else account_id
    return data.generate_account_briefing(account_id, account_name, user.email)


@router.get("/adoption/recent")
async def get_recent_feature_adoptions(
    days: int = 7,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[dict]:
    ace_filter = user.email if user.role == "ace" else None
    acem_filter = user.email if user.role == "acem" else None
    return data.get_recent_feature_adoptions(ace_filter=ace_filter, acem_filter=acem_filter, days=days)


@router.get("/accounts/{account_id}/timeline")
async def get_account_timeline(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[dict]:
    return data.get_account_timeline(account_id)


# ----------------------------------------------------------------------
# Use Case Updates (weekly Salesforce-paste-ready suggestions)
# ----------------------------------------------------------------------


class UseCaseUpdateEditRequest(BaseModel):
    text: str


@router.get("/accounts/{account_id}/use-case-updates")
async def get_account_use_case_updates(
    account_id: str,
    my_only: bool = True,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    updates = data.get_use_case_updates(account_id, user.email, my_only=my_only)
    return {"updates": updates}


@router.post("/accounts/{account_id}/use-case-updates/refresh")
async def refresh_account_use_case_updates(
    account_id: str,
    my_only: bool = True,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    updates = data.regenerate_use_case_updates(account_id, user.email, my_only=my_only)
    return {"updates": updates}


@router.post("/use-case-updates/{use_case_id}/regenerate")
async def regenerate_use_case_update(
    use_case_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    # Authz scoping: validate the use_case_id refers to a real use case before
    # mutating cached updates. Permission model is currently flat (all 19
    # internal users see all data); when external users are introduced, the
    # service helper get_account_id_for_use_case is the chokepoint to add
    # team-visibility filtering.
    if data.get_account_id_for_use_case(use_case_id) is None:
        raise HTTPException(status_code=404, detail="Use case not found")
    return data.regenerate_one_use_case_update(use_case_id, user.email)


@router.post("/use-case-updates/{use_case_id}")
async def save_use_case_update(
    use_case_id: str,
    body: UseCaseUpdateEditRequest,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    # Same authz scoping as the regenerate endpoint above.
    if data.get_account_id_for_use_case(use_case_id) is None:
        raise HTTPException(status_code=404, detail="Use case not found")
    return data.update_use_case_update_text(use_case_id, body.text, user.email)


@router.get("/accounts/{account_id}/meetings", response_model=list[MeetingActivity])
async def get_account_meetings(
    account_id: str,
    limit: int = 20,
    upcoming_only: bool = False,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[MeetingActivity]:
    return data.list_meetings_for_account(account_id, limit=limit, upcoming_only=upcoming_only)


@router.get("/accounts/{account_id}/upcoming-meetings")
async def get_account_upcoming_meetings(
    account_id: str,
    limit: int = 10,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[dict]:
    return data.list_upcoming_meetings(account_id, limit=limit)


@router.get("/accounts/{account_id}/email-activity", response_model=EmailActivity)
async def get_account_email_activity(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> EmailActivity:
    result = data.get_email_activity_for_account(account_id)
    if result is None:
        raise HTTPException(status_code=404, detail="No email activity found")
    return result


@router.get("/accounts/{account_id}/adoption")
async def get_account_adoption(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    return data.get_account_adoption(account_id=account_id)


@router.get("/accounts/{account_id}/ai-adoption")
async def get_ai_adoption(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    return data.get_ai_adoption(account_id=account_id)


@router.get("/accounts/{account_id}/security-posture")
async def get_security_posture(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    return data.get_security_posture(account_id=account_id)


class SecurityPostureOverrideRequest(BaseModel):
    ace_status: str
    ace_notes: str = ""


@router.post("/accounts/{account_id}/security-posture/{milestone_id}/override")
async def set_security_posture_override(
    account_id: str,
    milestone_id: str,
    body: SecurityPostureOverrideRequest,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    return data.set_security_posture_override(
        account_id=account_id,
        milestone_id=milestone_id,
        ace_status=body.ace_status,
        ace_notes=body.ace_notes,
        updated_by=user.email,
    )


@router.delete("/accounts/{account_id}/security-posture/{milestone_id}/override", status_code=204)
async def delete_security_posture_override(
    account_id: str,
    milestone_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> Response:
    data.delete_security_posture_override(account_id=account_id, milestone_id=milestone_id)
    return Response(status_code=204)


class AddManualMeetingRequest(BaseModel):
    title: str
    meeting_date: str
    attendees: Optional[str] = None


class UpdateMeetingNotesRequest(BaseModel):
    notes: str


class AddTimelineContextRequest(BaseModel):
    classification: str
    content: str
    title: Optional[str] = None
    context_date: Optional[str] = None


@router.get("/accounts/{account_id}/manual-meetings", response_model=list[ManualMeeting])
async def list_manual_meetings(
    account_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[ManualMeeting]:
    return data.list_manual_meetings(account_id)


@router.post("/accounts/{account_id}/manual-meetings", response_model=ManualMeeting, status_code=201)
async def add_manual_meeting(
    account_id: str,
    body: AddManualMeetingRequest,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> ManualMeeting:
    from datetime import datetime as _dt
    acct = data.get_account(account_id)
    account_name = acct.account_name if acct else account_id
    try:
        meeting_date = _dt.fromisoformat(body.meeting_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid meeting_date format (use ISO 8601)")
    return data.add_manual_meeting(
        account_id=account_id,
        account_name=account_name,
        title=body.title,
        meeting_date=meeting_date,
        attendees=body.attendees,
        created_by=user.email,
    )


@router.patch("/accounts/{account_id}/manual-meetings/{meeting_id}", response_model=ManualMeeting)
async def update_meeting_notes(
    account_id: str,
    meeting_id: str,
    body: UpdateMeetingNotesRequest,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> ManualMeeting:
    updated = data.update_manual_meeting_notes(meeting_id, body.notes, user.email)
    if updated is None:
        raise HTTPException(status_code=404, detail="Meeting not found or not authorized")
    background_tasks.add_task(
        data.generate_and_store_meeting_summary,
        meeting_id,
        updated.title,
        body.notes,
    )
    return updated


@router.post("/accounts/{account_id}/timeline-context", status_code=201)
async def add_timeline_context(
    account_id: str,
    body: AddTimelineContextRequest,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    acct = data.get_account(account_id)
    account_name = acct.account_name if acct else None
    result = data.add_timeline_context(
        account_id=account_id,
        account_name=account_name,
        classification=body.classification,
        content=body.content,
        title=body.title,
        context_date=body.context_date,
        created_by=user.email,
    )
    background_tasks.add_task(
        data.summarize_timeline_context,
        result["meeting_id"],
        account_id,
        account_name,
        body.content,
        body.classification,
        user.email,
        auto_title=not (body.title and body.title.strip()),
    )
    return result


@router.delete("/accounts/{account_id}/timeline-context/{entry_id}")
async def delete_timeline_context(
    account_id: str,
    entry_id: str,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict:
    deleted = data.delete_timeline_context(entry_id, user.email)
    if not deleted:
        raise HTTPException(status_code=404, detail="Entry not found or not authorized")
    acct = data.get_account(account_id)
    account_name = acct.account_name if acct else account_id
    background_tasks.add_task(
        data.generate_meeting_prep, account_id, account_name, user.email
    )
    return {"status": "deleted"}
