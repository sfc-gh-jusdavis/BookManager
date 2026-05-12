from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class Account(BaseModel):
    account_id: str
    account_name: str
    industry: Optional[str] = None
    ace_assigned: str
    collaborators: list[str] = []
    engagement_status: str = "Normal"
    status: str = "Active"
    use_case_count: int = 0
    total_credits_allocated: Optional[float] = None
    activation_start_date: Optional[date] = None
    region: Optional[str] = None
    acv: Optional[float] = None
    consumption_ytd: Optional[float] = None
    sig_pipeline: Optional[float] = None
    sig_aiml: Optional[float] = None
    health_score: Optional[float] = None
    momentum: Optional[str] = None
    wow_pct_change: Optional[float] = None
    new_adoption_30d: Optional[str] = None
    meetings_last_30d: int = 0
    upcoming_meetings_5d: int = 0
    last_meeting_date: Optional[date] = None
    emails_last_30d: int = 0
    last_email_date: Optional[date] = None
    email_trend: Optional[str] = None
    no_recording: bool = False
    lead_se_email: Optional[str] = None
    ae_email: Optional[str] = None
    ae_name: Optional[str] = None
    engagement_start_date: Optional[date] = None
    rolloff_date: Optional[date] = None
    primary_ace_email: Optional[str] = None
    coverage_ace_email: Optional[str] = None
    coverage_until: Optional[date] = None
    sf_team_aces: list[str] = []


class ManualMeeting(BaseModel):
    meeting_id: str
    account_id: str
    account_name: Optional[str] = None
    title: str
    meeting_date: datetime
    attendees: Optional[str] = None
    notes: Optional[str] = None
    notes_summary: Optional[str] = None
    notes_added: bool = False
    created_by: str
    created_at: datetime
    updated_at: datetime


class MeetingActivity(BaseModel):
    activity_id: str
    account_id: str
    account_name: str
    ace_assigned: Optional[str] = None
    subject: Optional[str] = None
    activity_date: Optional[date] = None
    owner_id: Optional[str] = None
    participant_names: Optional[str] = None
    is_upcoming: bool = False
    takeaways: Optional[str] = None
    is_pain_points: bool = False
    is_next_steps: bool = False
    is_competitor: bool = False


class EmailActivity(BaseModel):
    account_id: str
    account_name: str
    ace_assigned: Optional[str] = None
    emails_last_7d: int = 0
    emails_last_14d: int = 0
    emails_last_30d: int = 0
    emails_last_90d: int = 0
    last_email_date: Optional[date] = None
    emails_outbound_30d: int = 0
    emails_inbound_30d: int = 0
    avg_weekly_email_frequency: Optional[float] = None
    email_trend: Optional[str] = None


class PSNote(BaseModel):
    note_id: str
    use_case_id: str
    use_case_name: str = ""
    author_id: str
    content: str
    created_at: datetime


class UseCase(BaseModel):
    use_case_id: str
    account_id: str
    account_name: str
    use_case_name: str
    description: Optional[str] = None
    status: str
    ps_notes: list[PSNote] = []
    ps_notes_summary: Optional[str] = None
    go_live_date: Optional[date] = None
    target_go_live_date: Optional[date] = None
    lead_se: str
    ace_assigned: str
    created_date: Optional[date] = None
    last_modified_date: Optional[datetime] = None
    last_note_date: Optional[datetime] = None
    stage: str
    complexity: Optional[str] = None
    notes: Optional[str] = None
    meddpicc_overall_score: Optional[float] = None
    meddpicc_metrics_score: Optional[float] = None
    meddpicc_metrics: Optional[str] = None
    meddpicc_economic_buyer_score: Optional[float] = None
    meddpicc_economic_buyer: Optional[str] = None
    meddpicc_decision_criteria_score: Optional[float] = None
    meddpicc_decision_criteria: Optional[str] = None
    meddpicc_decision_process_score: Optional[float] = None
    meddpicc_decision_process: Optional[str] = None
    meddpicc_identify_pain_score: Optional[float] = None
    meddpicc_identify_pain: Optional[str] = None
    meddpicc_champion_score: Optional[float] = None
    meddpicc_champion: Optional[str] = None
    implementation_start_date: Optional[date] = None
    meddpicc_competitor_score: Optional[float] = None
    meddpicc_competitors: Optional[str] = None


class AccountResource(BaseModel):
    resource_id: str
    account_id: str
    resource_type: str
    title: str
    content: str
    link_type: Optional[str] = None
    created_by: str
    created_at: datetime
