from __future__ import annotations

import re

from app.signals.provider import SignalProvider
from app.signals.models import Signal, SignalScope


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


class CompositePatternProvider(SignalProvider):
    name = "composite"

    def collect(self, cur, scope: SignalScope) -> list[Signal]:
        where_parts: list[str] = []
        params: list = []

        if scope.ace_filter:
            where_parts.append("p.ACE_EMAIL = %s")
            params.append(scope.ace_filter)
        elif scope.acem_filter:
            where_parts.append(
                "p.ACE_EMAIL IN "
                "(SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s)"
            )
            params.append(scope.acem_filter)

        if scope.account_id:
            where_parts.append("p.ACCOUNT_ID = %s")
            params.append(scope.account_id)

        where = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

        cur.execute(
            f"""
            SELECT p.PATTERN_ID, p.ACCOUNT_ID, p.ACCOUNT_NAME, p.ACE_EMAIL,
                   p.PATTERN_NAME, p.CATEGORY, p.SEVERITY,
                   p.DESCRIPTION, p.RECOMMENDED_ACTION, p.CREATED_AT
            FROM BKMNG_COMPOSITE_PATTERNS p
            {where}
            ORDER BY
                CASE p.SEVERITY WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
                CASE p.CATEGORY WHEN 'risk' THEN 0 WHEN 'opportunity' THEN 1 ELSE 2 END
            """,
            params,
        )

        results: list[Signal] = []
        for row in cur.fetchall():
            severity = (row.get("SEVERITY") or "medium").lower()
            category = (row.get("CATEGORY") or "risk").lower()
            pattern_name = row.get("PATTERN_NAME") or ""
            description = row.get("DESCRIPTION") or ""
            recommended_action = row.get("RECOMMENDED_ACTION") or ""

            priority = "high" if severity in ("critical", "high") else "medium"
            lane = "admin" if category == "action_needed" else "client"

            results.append(
                Signal(
                    id=str(row.get("PATTERN_ID", "")),
                    signal_type="composite_" + _slugify(pattern_name),
                    category=category,
                    account_id=row.get("ACCOUNT_ID", ""),
                    account_name=row.get("ACCOUNT_NAME", ""),
                    priority=priority,
                    text=pattern_name + ": " + description[:200],
                    summary=recommended_action[:300],
                    source="composite",
                    metadata={"pattern_name": pattern_name, "severity": severity},
                    alert_eligible=severity in ("critical", "high"),
                    created_at=row.get("CREATED_AT"),
                    lane=lane,
                )
            )
        return results
