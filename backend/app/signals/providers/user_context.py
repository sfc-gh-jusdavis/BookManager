from __future__ import annotations

import json
import uuid

from app.signals.provider import SignalProvider
from app.signals.models import Signal, SignalScope


class UserContextProvider(SignalProvider):
    name = "user_context"

    def collect(self, cur, scope: SignalScope) -> list[Signal]:
        where_parts = ["v2.IS_ACTIVE = TRUE", "v2.PARSE_STATUS = 'parsed'"]
        params: list = []

        if scope.ace_filter:
            where_parts.append("v2.CREATED_BY = %s")
            params.append(scope.ace_filter)
        elif scope.acem_filter:
            where_parts.append(
                "v2.CREATED_BY IN "
                "(SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s)"
            )
            params.append(scope.acem_filter)

        if scope.account_id:
            where_parts.append("v2.ACCOUNT_ID = %s")
            params.append(scope.account_id)

        where = "WHERE " + " AND ".join(where_parts)

        cur.execute(
            f"""
            SELECT
                v2.CONTEXT_ID, v2.ACCOUNT_ID, v2.ACCOUNT_NAME,
                v2.SENTIMENT, v2.PEOPLE_MENTIONED,
                v2.COMPETITORS_MENTIONED, v2.RISKS_IDENTIFIED,
                v2.BLOCKERS_MENTIONED, v2.OPPORTUNITIES_IDENTIFIED,
                v2.PARSED_SUMMARY, v2.CREATED_AT
            FROM BKMNG_USER_CONTEXT_V2 v2
            {where}
            ORDER BY v2.CREATED_AT DESC
            """,
            params,
        )
        rows = cur.fetchall()
        results: list[Signal] = []

        for row in rows:
            ctx_id = str(row.get("CONTEXT_ID", ""))
            account_id = row.get("ACCOUNT_ID") or ""
            account_name = row.get("ACCOUNT_NAME") or ""
            summary = row.get("PARSED_SUMMARY", "")
            sentiment = (row.get("SENTIMENT") or "").lower()
            created_at = row.get("CREATED_AT")

            def _parse(field) -> list:
                val = row.get(field)
                if not val:
                    return []
                try:
                    return json.loads(val) if isinstance(val, str) else val
                except Exception:
                    return []

            risks = _parse("RISKS_IDENTIFIED")
            blockers = _parse("BLOCKERS_MENTIONED")
            competitors = _parse("COMPETITORS_MENTIONED")
            opportunities = _parse("OPPORTUNITIES_IDENTIFIED")

            if sentiment in ("frustration", "urgent"):
                results.append(
                    Signal(
                        id=f"uc_frustration_{ctx_id}",
                        signal_type="customer_frustration",
                        category="engagement",
                        account_id=account_id,
                        account_name=account_name,
                        priority="high",
                        text=f"Customer frustration detected: {summary}",
                        summary=summary,
                        source="user_context",
                        metadata={"context_id": ctx_id, "sentiment": sentiment},
                        alert_eligible=True,
                        lane="client",
                        created_at=created_at,
                    )
                )

            high_risks = [r for r in risks if isinstance(r, dict) and r.get("severity") == "high"]
            if high_risks:
                risk_text = "; ".join(r.get("risk", "") for r in high_risks)
                results.append(
                    Signal(
                        id=f"uc_risk_{ctx_id}",
                        signal_type="user_reported_risk",
                        category="use_case",
                        account_id=account_id,
                        account_name=account_name,
                        priority="high",
                        text=f"SE-reported risk: {risk_text}",
                        summary=summary,
                        source="user_context",
                        metadata={"context_id": ctx_id, "risks": high_risks},
                        alert_eligible=True,
                        lane="client",
                        created_at=created_at,
                    )
                )

            if competitors:
                comp_list = ", ".join(c if isinstance(c, str) else str(c) for c in competitors)
                results.append(
                    Signal(
                        id=f"uc_competitor_{ctx_id}",
                        signal_type="competitor_mentioned",
                        category="engagement",
                        account_id=account_id,
                        account_name=account_name,
                        priority="medium",
                        text=f"Competitor(s) mentioned: {comp_list}",
                        summary=summary,
                        source="user_context",
                        metadata={"context_id": ctx_id, "competitors": competitors},
                        alert_eligible=False,
                        lane="client",
                        created_at=created_at,
                    )
                )

            if blockers:
                blocker_list = "; ".join(b if isinstance(b, str) else str(b) for b in blockers)
                results.append(
                    Signal(
                        id=f"uc_blocker_{ctx_id}",
                        signal_type="user_reported_blocker",
                        category="use_case",
                        account_id=account_id,
                        account_name=account_name,
                        priority="high",
                        text=f"SE-reported blocker: {blocker_list}",
                        summary=summary,
                        source="user_context",
                        metadata={"context_id": ctx_id, "blockers": blockers},
                        alert_eligible=True,
                        lane="client",
                        created_at=created_at,
                    )
                )

            if opportunities:
                opp_text = "; ".join(
                    o.get("opportunity", str(o)) if isinstance(o, dict) else str(o)
                    for o in opportunities
                )
                results.append(
                    Signal(
                        id=f"uc_opportunity_{ctx_id}",
                        signal_type="user_reported_opportunity",
                        category="engagement",
                        account_id=account_id,
                        account_name=account_name,
                        priority="medium",
                        text=f"SE-reported opportunity: {opp_text}",
                        summary=summary,
                        source="user_context",
                        metadata={"context_id": ctx_id, "opportunities": opportunities},
                        alert_eligible=False,
                        lane="client",
                        created_at=created_at,
                    )
                )

        return results
