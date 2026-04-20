from __future__ import annotations

from app.signals.provider import SignalProvider
from app.signals.models import Signal, SignalScope


class SupportProvider(SignalProvider):
    name = "support"

    def collect(self, cur, scope: SignalScope) -> list[Signal]:
        where_parts = ["s.SOURCE = 'support'"]
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
                   COALESCE(s.CATEGORY, 'support') AS CATEGORY,
                   COALESCE(s.ALERT_ELIGIBLE, FALSE) AS ALERT_ELIGIBLE,
                   s.METADATA
            FROM BKMNG_ONT_ACCOUNT_SIGNALS s
            JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = s.ACCOUNT_ID
            {where}
            ORDER BY
                CASE s.PRIORITY WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                CASE s.SIGNAL_TYPE
                    WHEN 'open_sev1_ticket'     THEN 0
                    WHEN 'escalated_ticket'     THEN 1
                    WHEN 'open_sev2_ticket'     THEN 2
                    WHEN 'long_running_ticket'  THEN 3
                    WHEN 'ticket_volume_spike'  THEN 4
                    ELSE 5 END
            """,
            params,
        )
        results: list[Signal] = []
        for row in cur.fetchall():
            results.append(
                Signal(
                    id=row.get("SIGNAL_ID", ""),
                    signal_type=row.get("SIGNAL_TYPE", ""),
                    category="support",
                    account_id=row.get("ACCOUNT_ID", ""),
                    account_name=row.get("ACCOUNT_NAME", ""),
                    priority=row.get("PRIORITY", "medium"),
                    text=row.get("SIGNAL_TEXT", ""),
                    summary=row.get("CONTEXT", ""),
                    source="support",
                    metadata=row.get("METADATA") or {},
                    alert_eligible=bool(row.get("ALERT_ELIGIBLE", False)),
                    created_at=row.get("CREATED_AT"),
                )
            )
        return results
