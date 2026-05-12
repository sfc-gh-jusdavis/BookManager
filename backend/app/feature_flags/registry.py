"""Source of truth for feature flag definitions.

This file is read by scripts/sync_feature_flags.py to upsert flags into
TEMP.JUSDAVIS.BKMNG_FEATURE_FLAGS and seed jusdavis-only overrides.

KEEP IN SYNC with bkmng-next/lib/flags.ts. The TS file is the developer-facing
registry; this file is the runtime/sync registry. Any divergence will be
caught by the sync script's parity check.
"""
from __future__ import annotations

from typing import TypedDict, Dict, List


class FlagDef(TypedDict, total=False):
    description: str
    category: str
    default_enabled: bool
    enable_for_users: List[str]
    enable_for_roles: List[str]


JUSDAVIS = ["jusdavis"]


FEATURE_FLAGS: Dict[str, FlagDef] = {
    # Experimental (off by default)
    "ace_chat_v2": {"description": "ACE chat panel with NBA context (RavenChat)", "category": "experimental", "default_enabled": False, "enable_for_users": JUSDAVIS},
    "meeting_prep_v2": {"description": "New meeting prep view layout and AI suggestions", "category": "experimental", "default_enabled": False, "enable_for_users": JUSDAVIS},
    "composite_patterns": {"description": "Composite signal pattern alerts", "category": "experimental", "default_enabled": False, "enable_for_users": JUSDAVIS},
    "nba_panel": {"description": "Next Best Action recommendations panel", "category": "experimental", "default_enabled": False, "enable_for_users": JUSDAVIS},
    "ace_impact_metrics": {"description": "ACE account impact metrics panel on settings page", "category": "experimental", "default_enabled": False, "enable_for_users": JUSDAVIS},

    # Beta
    "security_posture_checklist": {"description": "Security posture checklist tile on account page", "category": "beta", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "ai_assessments_panel": {"description": "AI-powered account assessments tile", "category": "beta", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "timeline_v2": {"description": "Redesigned notes timeline with stats column", "category": "beta", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "forecasts_advanced": {"description": "Advanced FY-quarter forecast tiles", "category": "beta", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "use_case_breakdowns": {"description": "AI-parsed use case breakdowns panel", "category": "beta", "default_enabled": True, "enable_for_users": JUSDAVIS},

    # Admin
    "admin_costs_page": {"description": "Admin cost dashboard at /admin/costs", "category": "admin", "default_enabled": True, "enable_for_users": JUSDAVIS},

    # Core (retroactive coverage)
    "page_dashboard": {"description": "Home dashboard route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_accounts_list": {"description": "Accounts list route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_account_detail": {"description": "Account detail route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_forecasts": {"description": "Forecasts route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_tmrs": {"description": "TMRs route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_team": {"description": "Team route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_team_detail": {"description": "Team detail route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_ace": {"description": "Ask ACE route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_timeline": {"description": "Global timeline route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_alerts": {"description": "Alerts inbox route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_settings": {"description": "Settings route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},

    "panel_meeting_prep": {"description": "MeetingPrepView component", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "panel_notes_timeline": {"description": "NotesTimeline component", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "panel_ai_chat": {"description": "AIChatPanel component", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "panel_use_case_updates": {"description": "UseCaseUpdatesPanel component", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "panel_health_alerts": {"description": "AlertsTile (health)", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "panel_health_engagement": {"description": "EngagementTile (health)", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "panel_health_adoption": {"description": "AdoptionTile (health)", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "panel_health_security": {"description": "SecurityTile (health)", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "panel_ace_chat": {"description": "ACEChat component", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "panel_raven_chat": {"description": "RavenChat component", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "panel_acem_dashboard": {"description": "ACEMDashboard component", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "panel_ace_dashboard": {"description": "ACEDashboard component", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "panel_breakdown_section": {"description": "BreakdownSection (Gantt)", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
}
