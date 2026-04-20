from __future__ import annotations

from app.signals.provider import SignalProvider
from app.signals.models import Signal, SignalScope

_TYPE_TO_CATEGORY: dict[str, str] = {
    # Active
    "no_interaction_14d":   "engagement",
    "no_interaction_7d":    "engagement",
    "new_feature_adoption": "engagement",
    "consumption_spike":    "consumption",
    "consumption_dip":      "consumption",
    "capacity_warning":     "consumption",
    "contract_ending":      "consumption",
    "expansion_signal":     "consumption",
    "blocker":              "use_case",
    "at_risk":              "use_case",
    "use_case_no_go_live":  "use_case",
    "use_case_no_impl_start": "use_case",
    "use_case_stale_notes": "use_case",
    "go_live_approaching":  "go_live",
    "open_tmr":             "tmr",
    # Engagement (meeting/email)
    "upcoming_meeting":     "engagement",
    "no_upcoming_meeting":  "engagement",
    "meeting_momentum":     "engagement",
    "email_silence":        "engagement",
    "email_declining":      "engagement",
    # Paused (kept for reactivation)
    "champion_silent":      "engagement",
    "competitor_mentioned": "engagement",
    "stage_stalled":        "use_case",
    # Removed: high_momentum, new_stakeholder, contract_ending (medium)
    # User context signals (SOURCE='user_context')
    "customer_frustration":   "engagement",
    "user_reported_risk":     "use_case",
    "user_reported_blocker":  "use_case",
    "user_reported_opportunity": "engagement",
}


class CoreProvider(SignalProvider):
    name = "core"

    def collect(self, cur, scope: SignalScope) -> list[Signal]:
        where_parts = ["s.SOURCE = 'core'"]
        params: list = []

        if scope.ace_filter:
            where_parts.append("a.ACE_ASSIGNED = %s")
            params.append(scope.ace_filter)
        elif scope.acem_filter:
            where_parts.append(
                "a.ACE_ASSIGNED IN "
                "(SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s)"
            )
            params.append(scope.acem_filter)

        if scope.account_id:
            where_parts.append("s.ACCOUNT_ID = %s")
            params.append(scope.account_id)

        where = "WHERE " + " AND ".join(where_parts)

        cur.execute(
            f"""
            SELECT s.SIGNAL_ID, s.SIGNAL_TYPE, s.ACCOUNT_ID, s.ACCOUNT_NAME,
                   s.PRIORITY, s.SIGNAL_TEXT, s.CONTEXT, s.ENTITY_TYPE,
                   s.CREATED_AT, s.SOURCE,
                   COALESCE(s.CATEGORY, NULL) AS CATEGORY,
                   COALESCE(s.ALERT_ELIGIBLE, FALSE) AS ALERT_ELIGIBLE,
                   s.METADATA
            FROM BKMNG_ONT_ACCOUNT_SIGNALS s
            JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = s.ACCOUNT_ID
            {where}
            ORDER BY
                CASE s.PRIORITY WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                CASE s.SIGNAL_TYPE
                    WHEN 'no_interaction_14d' THEN 0
                    WHEN 'consumption_spike'  THEN 1
                    WHEN 'champion_silent'    THEN 2
                    WHEN 'capacity_warning'   THEN 3
                    WHEN 'blocker'            THEN 4
                    ELSE 5 END
            """,
            params,
        )
        results: list[Signal] = []
        for row in cur.fetchall():
            sig_type = row.get("SIGNAL_TYPE", "")
            results.append(
                Signal(
                    id=row.get("SIGNAL_ID", ""),
                    signal_type=sig_type,
                    category=row.get("CATEGORY") or _TYPE_TO_CATEGORY.get(sig_type, "other"),
                    account_id=row.get("ACCOUNT_ID", ""),
                    account_name=row.get("ACCOUNT_NAME", ""),
                    priority=row.get("PRIORITY", "medium"),
                    text=row.get("SIGNAL_TEXT", ""),
                    summary=row.get("CONTEXT", ""),
                    source="core",
                    metadata=row.get("METADATA") or {},
                    alert_eligible=bool(row.get("ALERT_ELIGIBLE", False)),
                    created_at=row.get("CREATED_AT"),
                )
            )
        return results
