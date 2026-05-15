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
    # Experimental (off by default) - in-flight WIP placeholders
    "ace_impact_metrics": {"description": "ACE account impact metrics panel on settings page", "category": "experimental", "default_enabled": False, "enable_for_users": JUSDAVIS},
    "ace_chat_floating": {"description": "Floating Ask ACE chat widget on all pages", "category": "experimental", "default_enabled": False},
    "ace_chat_panel": {"description": "ACE assistant tab on account detail page", "category": "experimental", "default_enabled": False},

    "dashboard_admin_tasks": {"description": "Admin tasks section on home dashboard", "category": "experimental", "default_enabled": False},

    # Admin
    "admin_costs_page": {"description": "Admin cost dashboard at /admin/costs", "category": "admin", "default_enabled": True, "enable_for_users": JUSDAVIS},

    # Core - page-level route gates (each verified to have an active call site)
    "page_dashboard": {"description": "Home dashboard route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_accounts_list": {"description": "Accounts list route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_account_detail": {"description": "Account detail route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_forecasts": {"description": "Forecasts route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_tmrs": {"description": "TMRs route", "category": "core", "default_enabled": False},
    "page_team": {"description": "Team route", "category": "core", "default_enabled": False},
    "page_team_detail": {"description": "Team detail route", "category": "core", "default_enabled": False},
    "page_ace": {"description": "Ask ACE route", "category": "core", "default_enabled": False},
    "page_timeline": {"description": "Global timeline route", "category": "core", "default_enabled": False},
    "page_alerts": {"description": "Alerts inbox route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},
    "page_settings": {"description": "Settings route", "category": "core", "default_enabled": True, "enable_for_users": JUSDAVIS},

    # Beta
    "security_posture_checklist": {"description": "Security posture checklist tile on account page", "category": "beta", "default_enabled": True, "enable_for_users": JUSDAVIS},
}
