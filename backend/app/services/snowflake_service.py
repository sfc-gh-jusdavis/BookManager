from __future__ import annotations

import html
import json
import logging
import re
from datetime import date, datetime
from typing import Optional

from snowflake.connector import DictCursor

from app.db.connection import get_snowflake_connection
from app.cache import cache_get, cache_set, cache_invalidate_prefix
from app.models.account import Account, UseCase, PSNote, AccountResource, MeetingActivity, EmailActivity, ManualMeeting
from app.models.credit import CreditConsumption, AccountFeatureUsage, AccountRevenueSummary
from app.models.gong import GongCall
from app.models.tmr import TMR
from app.models.prediction import (
    CreditForecast,
    UseCaseCompletionPrediction,
    SimilarDeployment,
    UseCaseForecast,
)

logger = logging.getLogger(__name__)


def _clean_gong_text(raw: str) -> str:
    """Strip HTML tags and normalise whitespace from Gong rich-text fields."""
    text = html.unescape(raw)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _split_gong_bullets(raw: str) -> list[str]:
    """Split a Gong bullet field (delimited by <br>* or newlines) into clean items."""
    text = html.unescape(raw)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    items = []
    for line in text.splitlines():
        line = line.lstrip("*•· \t").strip()
        if line:
            items.append(line)
    return items


def _d(val) -> Optional[date]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    return val.date() if hasattr(val, "date") else None


def _dt(val) -> Optional[datetime]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    return datetime.fromisoformat(str(val))


class SnowflakeDataService:
    def _cursor(self):
        return get_snowflake_connection().cursor(DictCursor)

    # ------------------------------------------------------------------
    # Accounts
    # ------------------------------------------------------------------

    def list_accounts(
        self,
        ace_filter: Optional[str] = None,
        acem_filter: Optional[str] = None,
    ) -> list[Account]:
        cache_key = f"list_accounts:{ace_filter}:{acem_filter}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        cur = self._cursor()
        sql = """
            SELECT
                a.ACCOUNT_ID,
                a.ACCOUNT_NAME,
                a.INDUSTRY,
                a.REGION,
                a.ACE_ASSIGNED,
                a.ENGAGEMENT_STATUS,
                a.STATUS,
                a.ACV,
                a.CONSUMPTION_YTD,
                a.TOTAL_CREDITS_ALLOCATED,
                a.ACTIVATION_START_DATE,
                a.SIG_PIPELINE,
                a.SIG_AIML,
                a.HEALTH_SCORE,
                a.MOMENTUM,
                a.WOW_PCT_CHANGE,
                a.NEW_ADOPTION_30D,
                a.MEETINGS_LAST_30D,
                a.UPCOMING_MEETINGS_5D,
                a.LAST_MEETING_DATE,
                a.EMAILS_LAST_30D,
                a.LAST_EMAIL_DATE,
                a.EMAIL_TREND,
                COALESCE(s.NO_RECORDING, FALSE) AS NO_RECORDING,
                a.LEAD_SE_EMAIL,
                a.AE_EMAIL,
                a.AE_NAME,
                s.ENGAGEMENT_START_DATE,
                s.ROLLOFF_DATE,
                COUNT(uc.USE_CASE_ID) AS USE_CASE_COUNT
            FROM BKMNG_ONT_ACCOUNTS a
            LEFT JOIN BKMNG_USE_CASES uc ON uc.ACCOUNT_ID = a.ACCOUNT_ID
            LEFT JOIN BKMNG_ACCOUNT_SETTINGS s ON s.ACCOUNT_ID = a.ACCOUNT_ID
            {where}
            GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29
            ORDER BY a.ACCOUNT_NAME
        """
        if ace_filter:
            cur.execute(
                sql.format(
                    where="WHERE (a.ACE_ASSIGNED = %s OR (a.COVERAGE_ACE_EMAIL = %s AND (a.COVERAGE_UNTIL IS NULL OR a.COVERAGE_UNTIL >= CURRENT_DATE())))"
                ),
                (ace_filter, ace_filter),
            )
        elif acem_filter:
            cur.execute(
                sql.format(where="WHERE a.ACE_ASSIGNED IN (SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s)"),
                (acem_filter,),
            )
        else:
            cur.execute(sql.format(where=""))
        result = [_row_to_account(r) for r in cur.fetchall()]
        cache_set(cache_key, result, ttl=300)
        return result

    def get_account_name(self, account_id: str) -> Optional[str]:
        cache_key = f"account_name:{account_id}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        cur = self._cursor()
        cur.execute(
            "SELECT ACCOUNT_NAME FROM BKMNG_ONT_ACCOUNTS WHERE ACCOUNT_ID = %s",
            (account_id,),
        )
        row = cur.fetchone()
        name = (row or {}).get("ACCOUNT_NAME") if row else None
        if name:
            cache_set(cache_key, name, ttl=3600)
        return name

    def get_account(self, account_id: str, ace_filter: Optional[str] = None) -> Optional[Account]:
        cache_key = f"account:{account_id}:{ace_filter}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        cur = self._cursor()
        sql = """
            SELECT
                a.ACCOUNT_ID,
                a.ACCOUNT_NAME,
                a.INDUSTRY,
                a.REGION,
                a.ACE_ASSIGNED,
                a.ENGAGEMENT_STATUS,
                a.STATUS,
                a.ACV,
                a.CONSUMPTION_YTD,
                a.TOTAL_CREDITS_ALLOCATED,
                a.ACTIVATION_START_DATE,
                a.SIG_PIPELINE,
                a.SIG_AIML,
                a.HEALTH_SCORE,
                a.MOMENTUM,
                a.WOW_PCT_CHANGE,
                a.NEW_ADOPTION_30D,
                a.MEETINGS_LAST_30D,
                a.UPCOMING_MEETINGS_5D,
                a.LAST_MEETING_DATE,
                a.EMAILS_LAST_30D,
                a.LAST_EMAIL_DATE,
                a.EMAIL_TREND,
                COALESCE(s.NO_RECORDING, FALSE) AS NO_RECORDING,
                a.LEAD_SE_EMAIL,
                a.AE_EMAIL,
                a.AE_NAME,
                s.ENGAGEMENT_START_DATE,
                s.ROLLOFF_DATE,
                s.PRIMARY_ACE_EMAIL,
                s.COVERAGE_ACE_EMAIL,
                s.COVERAGE_UNTIL,
                COUNT(uc.USE_CASE_ID) AS USE_CASE_COUNT
            FROM BKMNG_ONT_ACCOUNTS a
            LEFT JOIN BKMNG_USE_CASES uc ON uc.ACCOUNT_ID = a.ACCOUNT_ID
            LEFT JOIN BKMNG_ACCOUNT_SETTINGS s ON s.ACCOUNT_ID = a.ACCOUNT_ID
            WHERE a.ACCOUNT_ID = %s
            {ace_clause}
            GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32
        """
        if ace_filter:
            cur.execute(
                sql.format(
                    ace_clause="AND (a.ACE_ASSIGNED = %s OR (a.COVERAGE_ACE_EMAIL = %s AND (a.COVERAGE_UNTIL IS NULL OR a.COVERAGE_UNTIL >= CURRENT_DATE())))"
                ),
                (account_id, ace_filter, ace_filter),
            )
        else:
            cur.execute(sql.format(ace_clause=""), (account_id,))
        row = cur.fetchone()
        result = _row_to_account(row) if row else None
        if result is not None:
            # Pull SF team ACEs for this account so the UI can offer a Primary picker
            try:
                cur.execute(
                    """
                    SELECT DISTINCT u.EMAIL AS EMAIL
                    FROM FIVETRAN.SALESFORCE.ACCOUNT_TEAM_MEMBER atm
                    INNER JOIN FIVETRAN.SALESFORCE.USER u
                        ON u.ID = atm.USER_ID AND u._FIVETRAN_DELETED = FALSE
                    WHERE atm.ACCOUNT_ID = %s
                      AND atm.TEAM_MEMBER_ROLE = 'SE - Activation'
                      AND atm.IS_DELETED = FALSE
                    ORDER BY u.EMAIL
                    """,
                    (account_id,),
                )
                result.sf_team_aces = [r["EMAIL"] for r in cur.fetchall() if r.get("EMAIL")]
            except Exception:
                result.sf_team_aces = []
            cache_set(cache_key, result, ttl=180)
        return result

    def list_account_signal_counts(
        self,
        ace_filter: Optional[str] = None,
        acem_filter: Optional[str] = None,
    ) -> dict:
        cache_key = f"signal_counts:{ace_filter}:{acem_filter}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        cur = self._cursor()
        where_parts = ["1=1"]
        params: list = []
        if ace_filter:
            where_parts.append("a.ACE_ASSIGNED = %s")
            params.append(ace_filter)
        elif acem_filter:
            where_parts.append(
                "a.ACE_ASSIGNED IN (SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s)"
            )
            params.append(acem_filter)
        where = "WHERE " + " AND ".join(where_parts)
        cur.execute(
            f"""
            SELECT
                s.ACCOUNT_ID,
                SUM(CASE WHEN s.PRIORITY = 'high'   THEN 1 ELSE 0 END) AS HIGH_COUNT,
                SUM(CASE WHEN s.PRIORITY = 'medium' THEN 1 ELSE 0 END) AS MEDIUM_COUNT,
                SUM(CASE WHEN s.PRIORITY = 'low'    THEN 1 ELSE 0 END) AS LOW_COUNT,
                COUNT(*) AS TOTAL
            FROM BKMNG_ONT_ACCOUNT_SIGNALS s
            JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = s.ACCOUNT_ID
            {where}
            GROUP BY s.ACCOUNT_ID
            """,
            params,
        )
        result: dict = {}
        for row in cur.fetchall():
            result[row["ACCOUNT_ID"]] = {
                "high":   int(row.get("HIGH_COUNT") or 0),
                "medium": int(row.get("MEDIUM_COUNT") or 0),
                "low":    int(row.get("LOW_COUNT") or 0),
                "total":  int(row.get("TOTAL") or 0),
            }
        cache_set(cache_key, result, ttl=300)
        return result

    def list_meetings_for_account(
        self,
        account_id: str,
        limit: int = 20,
        upcoming_only: bool = False,
    ) -> list[MeetingActivity]:
        cur = self._cursor()
        where = "WHERE m.ACCOUNT_ID = %s AND (m.IS_UPCOMING = FALSE OR CONTAINS(UPPER(m.TITLE), UPPER(m.ACCOUNT_NAME)))"
        params: list = [account_id]
        if upcoming_only:
            where += " AND m.IS_UPCOMING = TRUE"
        cur.execute(
            f"""
            SELECT
                m.MEETING_ID AS ACTIVITY_ID, m.ACCOUNT_ID, m.ACCOUNT_NAME, m.ACE_ASSIGNED,
                m.TITLE AS SUBJECT, m.MEETING_START AS ACTIVITY_DATE,
                m.ACE_ASSIGNED AS OWNER_ID, m.PARTICIPANTS AS PARTICIPANT_NAMES,
                m.IS_UPCOMING, m.SUMMARY AS TAKEAWAYS
            FROM BKMNG_UNIFIED_MEETINGS m
            {where}
            ORDER BY m.MEETING_START DESC
            LIMIT {int(limit)}
            """,
            params,
        )
        return [
            MeetingActivity(
                activity_id=r["ACTIVITY_ID"],
                account_id=r["ACCOUNT_ID"],
                account_name=r["ACCOUNT_NAME"],
                ace_assigned=r.get("ACE_ASSIGNED"),
                subject=r.get("SUBJECT"),
                activity_date=_d(r.get("ACTIVITY_DATE")),
                owner_id=r.get("OWNER_ID"),
                participant_names=r.get("PARTICIPANT_NAMES"),
                is_upcoming=bool(r.get("IS_UPCOMING")),
                takeaways=r.get("TAKEAWAYS"),
                is_pain_points=False,
                is_next_steps=False,
                is_competitor=False,
            )
            for r in cur.fetchall()
        ]

    def list_upcoming_meetings(
        self,
        account_id: str,
        limit: int = 10,
    ) -> list[dict]:
        cur = self._cursor()
        cur.execute(
            f"""
            SELECT MEETING_ID, ACCOUNT_ID, ACCOUNT_NAME, TITLE, MEETING_START,
                   MEETING_END, DURATION_MINS, RECORDING_URL, PARTICIPANTS, SOURCE
            FROM BKMNG_UNIFIED_MEETINGS
            WHERE ACCOUNT_ID = %s AND IS_UPCOMING = TRUE
              AND CONTAINS(UPPER(TITLE), UPPER(ACCOUNT_NAME))
            ORDER BY MEETING_START ASC
            LIMIT {int(limit)}
            """,
            (account_id,),
        )
        out: list[dict] = []
        for r in cur.fetchall():
            out.append({
                "meeting_id": r["MEETING_ID"],
                "account_id": r["ACCOUNT_ID"],
                "account_name": r.get("ACCOUNT_NAME"),
                "title": r.get("TITLE"),
                "meeting_start": r["MEETING_START"].isoformat() if r.get("MEETING_START") else None,
                "meeting_end": r["MEETING_END"].isoformat() if r.get("MEETING_END") else None,
                "duration_mins": int(r["DURATION_MINS"]) if r.get("DURATION_MINS") is not None else None,
                "recording_url": r.get("RECORDING_URL"),
                "participants": r.get("PARTICIPANTS"),
                "source": r.get("SOURCE"),
            })
        return out

    def list_all_upcoming_meetings(
        self,
        ace_email: str,
        limit: int = 15,
    ) -> list[dict]:
        cur = self._cursor()
        cur.execute(
            f"""
            WITH ranked AS (
              SELECT m.MEETING_ID, m.ACCOUNT_ID, m.ACCOUNT_NAME, m.TITLE, m.MEETING_START,
                     m.MEETING_END, m.DURATION_MINS, m.RECORDING_URL, m.PARTICIPANTS, m.SOURCE,
                     ROW_NUMBER() OVER (
                       PARTITION BY SPLIT_PART(m.MEETING_ID, ':', 1), m.MEETING_START
                       ORDER BY
                         CASE WHEN CONTAINS(UPPER(m.TITLE), UPPER(m.ACCOUNT_NAME)) THEN 0 ELSE 1 END,
                         m.ACCOUNT_NAME
                     ) AS RN
              FROM BKMNG_UNIFIED_MEETINGS m
              JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = m.ACCOUNT_ID
              WHERE m.IS_UPCOMING = TRUE
                AND (a.ACE_ASSIGNED = %s OR (a.COVERAGE_ACE_EMAIL = %s AND (a.COVERAGE_UNTIL IS NULL OR a.COVERAGE_UNTIL >= CURRENT_DATE())))
            )
            SELECT MEETING_ID, ACCOUNT_ID, ACCOUNT_NAME, TITLE, MEETING_START,
                   MEETING_END, DURATION_MINS, RECORDING_URL, PARTICIPANTS, SOURCE
            FROM ranked WHERE RN = 1
            ORDER BY MEETING_START ASC
            LIMIT {int(limit)}
            """,
            (ace_email, ace_email),
        )
        out: list[dict] = []
        for r in cur.fetchall():
            out.append({
                "meeting_id": r["MEETING_ID"],
                "account_id": r["ACCOUNT_ID"],
                "account_name": r.get("ACCOUNT_NAME"),
                "title": r.get("TITLE"),
                "meeting_start": r["MEETING_START"].isoformat() if r.get("MEETING_START") else None,
                "meeting_end": r["MEETING_END"].isoformat() if r.get("MEETING_END") else None,
                "duration_mins": int(r["DURATION_MINS"]) if r.get("DURATION_MINS") is not None else None,
                "recording_url": r.get("RECORDING_URL"),
                "participants": r.get("PARTICIPANTS"),
                "source": r.get("SOURCE"),
            })
        return out

    def get_email_activity_for_account(self, account_id: str) -> Optional[EmailActivity]:
        cur = self._cursor()
        cur.execute(
            """
            SELECT
                ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
                EMAILS_LAST_7D, EMAILS_LAST_14D, EMAILS_LAST_30D, EMAILS_LAST_90D,
                LAST_EMAIL_DATE, EMAILS_OUTBOUND_30D, EMAILS_INBOUND_30D,
                AVG_WEEKLY_EMAIL_FREQUENCY, EMAIL_TREND
            FROM BKMNG_EMAIL_ACTIVITY
            WHERE ACCOUNT_ID = %s
            """,
            (account_id,),
        )
        r = cur.fetchone()
        if not r:
            return None
        return EmailActivity(
            account_id=r["ACCOUNT_ID"],
            account_name=r["ACCOUNT_NAME"],
            ace_assigned=r.get("ACE_ASSIGNED"),
            emails_last_7d=int(r.get("EMAILS_LAST_7D") or 0),
            emails_last_14d=int(r.get("EMAILS_LAST_14D") or 0),
            emails_last_30d=int(r.get("EMAILS_LAST_30D") or 0),
            emails_last_90d=int(r.get("EMAILS_LAST_90D") or 0),
            last_email_date=_d(r.get("LAST_EMAIL_DATE")),
            emails_outbound_30d=int(r.get("EMAILS_OUTBOUND_30D") or 0),
            emails_inbound_30d=int(r.get("EMAILS_INBOUND_30D") or 0),
            avg_weekly_email_frequency=float(r["AVG_WEEKLY_EMAIL_FREQUENCY"]) if r.get("AVG_WEEKLY_EMAIL_FREQUENCY") is not None else None,
            email_trend=r.get("EMAIL_TREND"),
        )

    def list_account_assessments(
        self,
        ace_filter: Optional[str] = None,
        acem_filter: Optional[str] = None,
    ) -> list:
        from app.routers.assessments import AccountAssessment
        cur = self._cursor()
        where_parts = ["1=1"]
        params: list = []
        if ace_filter:
            where_parts.append("a.ACE_ASSIGNED = %s")
            params.append(ace_filter)
        elif acem_filter:
            where_parts.append(
                "a.ACE_ASSIGNED IN (SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s)"
            )
            params.append(acem_filter)
        where = "WHERE " + " AND ".join(where_parts)
        cur.execute(
            f"""
            SELECT aa.*
            FROM BKMNG_AI_ACCOUNT_ASSESSMENTS aa
            JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = aa.ACCOUNT_ID
            {where}
            ORDER BY aa.AI_PRIORITY_SCORE DESC NULLS LAST
            """,
            params,
        )
        return [
            AccountAssessment(
                account_id=r["ACCOUNT_ID"],
                account_name=r.get("ACCOUNT_NAME"),
                ai_priority_score=float(r["AI_PRIORITY_SCORE"]) if r.get("AI_PRIORITY_SCORE") is not None else None,
                priority_tier=r.get("PRIORITY_TIER"),
                confidence=float(r["CONFIDENCE"]) if r.get("CONFIDENCE") is not None else None,
                rationale=r.get("RATIONALE"),
                recommended_actions=r.get("RECOMMENDED_ACTIONS"),
                key_risks=r.get("KEY_RISKS"),
                key_opportunities=r.get("KEY_OPPORTUNITIES"),
                computed_at=str(r["COMPUTED_AT"]) if r.get("COMPUTED_AT") else None,
            )
            for r in cur.fetchall()
        ]

    def list_use_case_breakdowns(
        self,
        account_id: Optional[str] = None,
        use_case_id: Optional[str] = None,
        ace_filter: Optional[str] = None,
        min_score: float = 5.0,
    ) -> list[dict]:
        cur = self._cursor()
        params: list = []
        where_parts = ["b.SPLITTABILITY_SCORE >= %s"]
        params.append(min_score)
        if account_id:
            where_parts.append("b.ACCOUNT_ID = %s")
            params.append(account_id)
        if use_case_id:
            where_parts.append("b.USE_CASE_ID = %s")
            params.append(use_case_id)
        if ace_filter:
            where_parts.append("a.ACE_ASSIGNED = %s")
            params.append(ace_filter)
        where = "WHERE " + " AND ".join(where_parts)
        cur.execute(
            f"""
            SELECT b.BREAKDOWN_ID, b.USE_CASE_ID, b.ACCOUNT_ID, b.ACCOUNT_NAME,
                   b.PARENT_USE_CASE_NAME, b.SPLITTABILITY_SCORE, b.SPLITTABILITY_REASON,
                   b.SUB_USE_CASE_INDEX, b.SUB_USE_CASE_NAME, b.SUB_WORKLOAD,
                   b.SUB_TECHNICAL_USE_CASE, b.SUB_RATIONALE, b.SUB_ESTIMATED_EFFORT,
                   b.SUB_KEY_ACTIVITIES, b.TOTAL_SUB_USE_CASES, b.OVERALL_RATIONALE,
                   b.CRITERIA_SCORES, b.STATUS, b.COMPUTED_AT::VARCHAR AS COMPUTED_AT
            FROM BKMNG_USE_CASE_BREAKDOWNS b
            JOIN BKMNG_ACCOUNTS a ON a.ACCOUNT_ID = b.ACCOUNT_ID
            {where}
            ORDER BY b.SPLITTABILITY_SCORE DESC, b.PARENT_USE_CASE_NAME, b.SUB_USE_CASE_INDEX
            """,
            params,
        )
        return [dict(r) for r in cur.fetchall()]

    def list_breakdown_summaries(
        self,
        ace_filter: Optional[str] = None,
        acem_filter: Optional[str] = None,
    ) -> list[dict]:
        cur = self._cursor()
        params: list = []
        where_parts = ["b.SPLITTABILITY_SCORE >= 5"]
        if ace_filter:
            where_parts.append("a.ACE_ASSIGNED = %s")
            params.append(ace_filter)
        elif acem_filter:
            where_parts.append("a.ACE_ASSIGNED IN (SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s)")
            params.append(acem_filter)
        where = "WHERE " + " AND ".join(where_parts)
        cur.execute(
            f"""
            SELECT b.USE_CASE_ID, b.ACCOUNT_ID, b.ACCOUNT_NAME,
                   b.PARENT_USE_CASE_NAME, b.SPLITTABILITY_SCORE, b.SPLITTABILITY_REASON,
                   b.TOTAL_SUB_USE_CASES, b.OVERALL_RATIONALE,
                   MAX(b.COMPUTED_AT)::VARCHAR AS COMPUTED_AT
            FROM BKMNG_USE_CASE_BREAKDOWNS b
            JOIN BKMNG_ACCOUNTS a ON a.ACCOUNT_ID = b.ACCOUNT_ID
            {where}
            GROUP BY b.USE_CASE_ID, b.ACCOUNT_ID, b.ACCOUNT_NAME,
                     b.PARENT_USE_CASE_NAME, b.SPLITTABILITY_SCORE, b.SPLITTABILITY_REASON,
                     b.TOTAL_SUB_USE_CASES, b.OVERALL_RATIONALE
            ORDER BY b.SPLITTABILITY_SCORE DESC
            """,
            params,
        )
        return [dict(r) for r in cur.fetchall()]

    def list_use_case_assessments(
        self,
        account_id: Optional[str],
        ace_filter: Optional[str] = None,
    ) -> list:
        from app.routers.assessments import UseCaseAssessment
        cur = self._cursor()
        params: list = []
        where_parts = ["1=1"]
        if account_id:
            where_parts.append("ua.ACCOUNT_ID = %s")
            params.append(account_id)
        if ace_filter:
            where_parts.append("a.ACE_ASSIGNED = %s")
            params.append(ace_filter)
        where = "WHERE " + " AND ".join(where_parts)
        cur.execute(
            f"""
            SELECT ua.*
            FROM BKMNG_AI_USE_CASE_ASSESSMENTS ua
            JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = ua.ACCOUNT_ID
            {where}
            ORDER BY ua.OPPORTUNITY_SCORE DESC NULLS LAST
            """,
            params,
        )
        return [
            UseCaseAssessment(
                use_case_id=r["USE_CASE_ID"],
                account_id=r["ACCOUNT_ID"],
                account_name=r.get("ACCOUNT_NAME"),
                use_case_name=r.get("USE_CASE_NAME"),
                ai_tier=r.get("AI_TIER"),
                confidence=float(r["CONFIDENCE"]) if r.get("CONFIDENCE") is not None else None,
                rationale=r.get("RATIONALE"),
                recommended_actions=r.get("RECOMMENDED_ACTIONS"),
                risk_level=r.get("RISK_LEVEL"),
                opportunity_score=float(r["OPPORTUNITY_SCORE"]) if r.get("OPPORTUNITY_SCORE") is not None else None,
                computed_at=str(r["COMPUTED_AT"]) if r.get("COMPUTED_AT") else None,
            )
            for r in cur.fetchall()
        ]

    # ------------------------------------------------------------------
    # Use Cases
    # ------------------------------------------------------------------

    def list_all_use_cases(
        self,
        ace_filter: Optional[str] = None,
        acem_filter: Optional[str] = None,
    ) -> list[UseCase]:
        cur = self._cursor()
        sql = """
            SELECT uc.*,
                   n.LAST_NOTE_DATE
            FROM BKMNG_USE_CASES uc
            LEFT JOIN (
                SELECT USE_CASE_ID, MAX(NOTE_DATE) AS LAST_NOTE_DATE
                FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES
                GROUP BY USE_CASE_ID
            ) n ON n.USE_CASE_ID = uc.USE_CASE_ID
            {where}
            ORDER BY uc.LAST_MODIFIED_DATE DESC NULLS LAST
        """
        if ace_filter:
            cur.execute(sql.format(where="WHERE (uc.ACE_ASSIGNED = %s OR uc.LEAD_SE = %s)"), (ace_filter, ace_filter))
        elif acem_filter:
            team_subq = "SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s"
            cur.execute(
                sql.format(where=f"WHERE (uc.ACE_ASSIGNED IN ({team_subq}) OR uc.LEAD_SE IN ({team_subq}))"),
                (acem_filter, acem_filter),
            )
        else:
            cur.execute(sql.format(where=""))
        return [_row_to_use_case(r) for r in cur.fetchall()]

    def list_use_cases_for_account(
        self,
        account_id: str,
        ace_filter: Optional[str] = None,
        acem_filter: Optional[str] = None,
    ) -> list[UseCase]:
        cache_key = f"use_cases:{account_id}:{ace_filter}:{acem_filter}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        cur = self._cursor()
        sql = """
            SELECT uc.*,
                   n.LAST_NOTE_DATE
            FROM BKMNG_USE_CASES uc
            LEFT JOIN (
                SELECT USE_CASE_ID, MAX(NOTE_DATE) AS LAST_NOTE_DATE
                FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES
                GROUP BY USE_CASE_ID
            ) n ON n.USE_CASE_ID = uc.USE_CASE_ID
            WHERE uc.ACCOUNT_ID = %s
            {ace_clause}
            ORDER BY uc.LAST_MODIFIED_DATE DESC NULLS LAST
        """
        if ace_filter:
            cur.execute(
                sql.format(ace_clause="AND (uc.ACE_ASSIGNED = %s OR uc.LEAD_SE = %s)"),
                (account_id, ace_filter, ace_filter),
            )
        elif acem_filter:
            team_subq = "SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s"
            cur.execute(
                sql.format(ace_clause=f"AND (uc.ACE_ASSIGNED IN ({team_subq}) OR uc.LEAD_SE IN ({team_subq}))"),
                (account_id, acem_filter, acem_filter),
            )
        else:
            cur.execute(sql.format(ace_clause=""), (account_id,))
        result = [_row_to_use_case(r) for r in cur.fetchall()]
        cache_set(cache_key, result, ttl=300)
        return result

    # ------------------------------------------------------------------
    # Use Case Forecasts (derived from use cases — no override table yet)
    # ------------------------------------------------------------------

    def list_use_case_forecasts(
        self,
        ace_filter: Optional[str] = None,
        acem_filter: Optional[str] = None,
    ) -> list[UseCaseForecast]:
        use_cases = self.list_all_use_cases(ace_filter, acem_filter)
        return [_derive_forecast(uc) for uc in use_cases]

    # ------------------------------------------------------------------
    # Gong calls — sourced from BKMNG_UNIFIED_MEETINGS (past, IS_UPCOMING=FALSE)
    # ------------------------------------------------------------------

    def list_gong_calls(
        self, account_id: Optional[str] = None, ace_filter: Optional[str] = None
    ) -> list[GongCall]:
        cache_key = f"gong_calls:{account_id}:{ace_filter}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        cur = self._cursor()
        filters: list[str] = ["m.IS_UPCOMING = FALSE"]
        params: list = []
        if ace_filter:
            filters.append("m.ACE_ASSIGNED = %s")
            params.append(ace_filter)
        if account_id:
            filters.append("m.ACCOUNT_ID = %s")
            params.append(account_id)
        where = "WHERE " + " AND ".join(filters)
        sql = f"""
            SELECT
                m.MEETING_ID AS CALL_ID, m.ACCOUNT_ID, m.ACCOUNT_NAME, m.TITLE,
                m.MEETING_START AS CALL_DATE, m.DURATION_MINS,
                m.SUMMARY, m.KEY_POINTS, m.NEXT_STEPS, m.TOPICS,
                m.PARTICIPANTS, m.RECORDING_URL
            FROM TEMP.JUSDAVIS.BKMNG_UNIFIED_MEETINGS m
            {where}
            ORDER BY m.MEETING_START DESC
            LIMIT 50
        """
        cur.execute(sql, params)
        results = []
        for row in cur.fetchall():
            if not row.get("ACCOUNT_ID"):
                continue
            topics = [s.strip() for s in (row.get("TOPICS") or "").split(",") if s.strip()]
            next_steps: list[str] = []
            if row.get("NEXT_STEPS"):
                next_steps = _split_gong_bullets(row["NEXT_STEPS"])
            participants = [e.strip() for e in (row.get("PARTICIPANTS") or "").split(",") if e.strip()]
            summary = row.get("SUMMARY")
            if summary:
                summary = _clean_gong_text(summary)
            key_points = row.get("KEY_POINTS")
            if key_points:
                key_points = _clean_gong_text(key_points)
            results.append(GongCall(
                call_id=row["CALL_ID"],
                account_id=row["ACCOUNT_ID"],
                title=row.get("TITLE"),
                call_date=row["CALL_DATE"],
                duration_minutes=row.get("DURATION_MINS"),
                summary=summary,
                key_points=key_points,
                next_steps=next_steps,
                outcome=None,
                call_score=None,
                direction=None,
                participants_emails=participants,
                action_items=next_steps,
                topics=topics,
                recording_url=row.get("RECORDING_URL"),
            ))
        cache_set(cache_key, results, ttl=600)
        return results

    def list_contacts_for_account(self, account_id: str) -> list[dict]:
        cache_key = f"contacts:{account_id}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        cur = self._cursor()
        cur.execute(
            """
            SELECT NAME, EMAIL, TITLE, DEPARTMENT, ROLE_ON_ACCOUNT,
                   IS_CHAMPION, GONG_CALL_COUNT_90D, LAST_GONG_CALL_DATE,
                   DAYS_SINCE_LAST_CALL
            FROM TEMP.JUSDAVIS.BKMNG_ONT_CONTACTS
            WHERE ACCOUNT_ID = %s
            ORDER BY IS_CHAMPION DESC, GONG_CALL_COUNT_90D DESC
            LIMIT 20
            """,
            (account_id,),
        )
        result = [dict(r) for r in cur.fetchall()]
        cache_set(cache_key, result, ttl=1800)
        return result

    def list_topics_for_account(self, account_id: str) -> list[dict]:
        cur = self._cursor()
        cur.execute(
            """
            SELECT TOPIC, MENTION_COUNT_90D, LAST_MENTIONED_DATE, AVG_DURATION_SEC
            FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_TOPICS
            WHERE ACCOUNT_ID = %s
            ORDER BY MENTION_COUNT_90D DESC
            LIMIT 20
            """,
            (account_id,),
        )
        return [dict(r) for r in cur.fetchall()]

    _CONTEXT_PARSE_PROMPT = """You are analyzing text pasted by a Sales Engineer about a customer account.
Extract the following as JSON. Only include fields where you find relevant information. Use null for fields with no data.
Do not fabricate information not present in the text.

{{
  "source_type": "email|meeting_note|slack|observation",
  "summary": "1-2 sentence summary",
  "sentiment": "positive|neutral|concern|frustration|urgent",
  "people_mentioned": [{{"name": "...", "role": "..."}}],
  "topics_discussed": ["topic1", "topic2"],
  "competitors_mentioned": ["name1"],
  "action_items": [{{"item": "...", "owner": "...", "due": "..."}}],
  "risks": [{{"risk": "...", "severity": "high|medium|low"}}],
  "opportunities": [{{"opportunity": "...", "context": "..."}}],
  "blockers": ["blocker1"]
}}

TEXT:
{raw_content}

Respond with ONLY the JSON object. No preamble, no explanation."""

    def _parse_context_with_llm(self, cur, raw_content: str) -> dict:
        prompt = self._CONTEXT_PARSE_PROMPT.format(
            raw_content=raw_content[:8000].replace("'", "\\'")
        )
        try:
            cur.execute(
                "SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-8b', %s) AS RESULT",
                (prompt,),
            )
            row = cur.fetchone()
            result_text = row["RESULT"] if row else ""
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except Exception:
            pass
        return {}

    def add_account_context(
        self,
        account_id: Optional[str],
        account_name: Optional[str],
        context_type: str,
        content: str,
        source: str,
        created_by: str,
        use_case_id: Optional[str] = None,
    ) -> dict:
        cur = self._cursor()
        cur.execute(
            """
            INSERT INTO TEMP.JUSDAVIS.BKMNG_USER_CONTEXT
                (ACCOUNT_ID, ACCOUNT_NAME, CONTEXT_TYPE, CONTENT, SOURCE, CREATED_BY)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (account_id, account_name, context_type, content, source, created_by),
        )
        cur.execute(
            """
            INSERT INTO TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2
                (ACCOUNT_ID, ACCOUNT_NAME, USE_CASE_ID, RAW_CONTENT, SOURCE_TYPE, CREATED_BY, PARSE_STATUS)
            VALUES (%s, %s, %s, %s, %s, %s, 'pending')
            """,
            (account_id, account_name, use_case_id, content, context_type, created_by),
        )
        cur.execute(
            """
            SELECT MAX(CONTEXT_ID) AS CTX_ID
            FROM TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2
            WHERE ACCOUNT_ID = %s AND CREATED_BY = %s AND PARSE_STATUS = 'pending'
            """,
            (account_id, created_by),
        )
        row = cur.fetchone()
        context_id = row["CTX_ID"] if row else None

        parsed = self._parse_context_with_llm(cur, content)
        if parsed and context_id:
            try:
                cur.execute(
                    """
                    UPDATE TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2
                    SET SOURCE_TYPE = %s,
                        PARSED_SUMMARY = %s,
                        SENTIMENT = %s,
                        PEOPLE_MENTIONED = %s,
                        TOPICS_DISCUSSED = %s,
                        COMPETITORS_MENTIONED = %s,
                        ACTION_ITEMS = %s,
                        RISKS_IDENTIFIED = %s,
                        OPPORTUNITIES_IDENTIFIED = %s,
                        BLOCKERS_MENTIONED = %s,
                        PARSE_STATUS = 'parsed'
                    WHERE CONTEXT_ID = %s
                    """,
                    (
                        parsed.get("source_type") or context_type,
                        parsed.get("summary"),
                        parsed.get("sentiment"),
                        json.dumps(parsed.get("people_mentioned")) if parsed.get("people_mentioned") else None,
                        json.dumps(parsed.get("topics_discussed")) if parsed.get("topics_discussed") else None,
                        json.dumps(parsed.get("competitors_mentioned")) if parsed.get("competitors_mentioned") else None,
                        json.dumps(parsed.get("action_items")) if parsed.get("action_items") else None,
                        json.dumps(parsed.get("risks")) if parsed.get("risks") else None,
                        json.dumps(parsed.get("opportunities")) if parsed.get("opportunities") else None,
                        json.dumps(parsed.get("blockers")) if parsed.get("blockers") else None,
                        context_id,
                    ),
                )
            except Exception:
                pass

        return {
            "status": "created",
            "context_id": context_id,
            "parsed": bool(parsed),
            "summary": parsed.get("summary") if parsed else None,
            "sentiment": parsed.get("sentiment") if parsed else None,
        }

    def list_account_context(self, account_id: str, user_email: str) -> list[dict]:
        cache_key = f"account_context:{account_id}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        cur = self._cursor()
        cur.execute(
            """
            SELECT
                v2.CONTEXT_ID,
                v2.ACCOUNT_NAME,
                v2.SOURCE_TYPE AS CONTEXT_TYPE,
                v2.RAW_CONTENT AS CONTENT,
                'manual' AS SOURCE,
                v2.CREATED_BY,
                v2.CREATED_AT,
                v2.IS_ACTIVE,
                v2.PARSED_SUMMARY,
                v2.SENTIMENT,
                v2.PEOPLE_MENTIONED,
                v2.TOPICS_DISCUSSED,
                v2.COMPETITORS_MENTIONED,
                v2.ACTION_ITEMS,
                v2.RISKS_IDENTIFIED,
                v2.OPPORTUNITIES_IDENTIFIED,
                v2.BLOCKERS_MENTIONED,
                v2.PARSE_STATUS
            FROM TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2 v2
            WHERE (v2.ACCOUNT_ID = %s OR v2.ACCOUNT_ID IS NULL)
              AND v2.IS_ACTIVE = TRUE
            ORDER BY v2.CREATED_AT DESC
            LIMIT 50
            """,
            (account_id,),
        )
        result = [dict(r) for r in cur.fetchall()]
        cache_set(cache_key, result, ttl=180)
        return result

    def list_account_resources(
        self, account_id: Optional[str] = None, ace_filter: Optional[str] = None
    ) -> list[AccountResource]:
        return []

    def get_composite_patterns(
        self, account_id: Optional[str] = None, ace_filter: Optional[str] = None, acem_filter: Optional[str] = None
    ) -> list[dict]:
        cache_key = f"patterns:{account_id}:{ace_filter}:{acem_filter}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        cur = self._cursor()
        where_parts = []
        params: list = []
        if account_id:
            where_parts.append("ACCOUNT_ID = %s")
            params.append(account_id)
        if ace_filter:
            where_parts.append("ACE_EMAIL = %s")
            params.append(ace_filter)
        elif acem_filter:
            where_parts.append(
                "ACE_EMAIL IN (SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s)"
            )
            params.append(acem_filter)
        where = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""
        cur.execute(
            f"""
            SELECT PATTERN_ID, ACCOUNT_ID, ACCOUNT_NAME, ACE_EMAIL,
                   PATTERN_NAME, CATEGORY, SEVERITY, DESCRIPTION,
                   RECOMMENDED_ACTION, TALKING_POINTS, COMPONENT_SIGNALS, CREATED_AT
            FROM TEMP.JUSDAVIS.BKMNG_COMPOSITE_PATTERNS
            {where}
            ORDER BY
                CASE SEVERITY WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
                CASE CATEGORY WHEN 'risk' THEN 0 WHEN 'action_needed' THEN 1 ELSE 2 END
            """,
            params,
        )
        result = [{k.lower(): v for k, v in dict(r).items()} for r in cur.fetchall()]
        cache_set(cache_key, result, ttl=300)
        return result

    # ------------------------------------------------------------------
    # Credits — stub until BKMNG_CREDIT_DAILY is created
    # ------------------------------------------------------------------

    def get_account_briefing(self, account_id: str) -> Optional[dict]:
        cache_key = f"briefing:{account_id}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        cur = self._cursor()
        cur.execute(
            """
            SELECT BRIEFING_ID, ACCOUNT_ID, ACCOUNT_NAME, ACE_EMAIL,
                   SITUATION_SUMMARY, TOP_RISK, TOP_OPPORTUNITY,
                   RECOMMENDED_ACTIONS, TALKING_POINTS, KEY_QUESTIONS,
                   CONTEXT_USED, GONG_CALLS_USED, GENERATED_AT, MODEL_USED
            FROM TEMP.JUSDAVIS.BKMNG_ACCOUNT_BRIEFINGS
            WHERE ACCOUNT_ID = %s
            ORDER BY GENERATED_AT DESC
            LIMIT 1
            """,
            (account_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        result = {k.lower(): v for k, v in dict(row).items()}
        cache_set(cache_key, result, ttl=1800)
        return result

    def generate_account_briefing(self, account_id: str, account_name: str, ace_email: str) -> dict:
        cache_invalidate_prefix(f"briefing:{account_id}")
        cache_invalidate_prefix("bkmng_ctx:")
        cur = self._cursor()
        try:
            cur.execute(
                """
                SELECT
                    COALESCE(a.CONTRACT_UTILIZATION_PCT, 0) AS UTIL_PCT,
                    COALESCE(a.WOW_PCT_CHANGE, 0) AS WOW_PCT,
                    COALESCE(a.MOM_PCT_CHANGE, 0) AS MOM_PCT,
                    COALESCE(a.DAYS_SINCE_LAST_INTERACTION, 0) AS DAYS_SINCE,
                    COALESCE(a.IMPL_USE_CASE_COUNT, 0) AS IMPL_COUNT,
                    COALESCE(a.ACTIVE_USE_CASE_COUNT, 0) AS ACTIVE_COUNT,
                    COALESCE(a.INDUSTRY, '?') AS INDUSTRY,
                    COALESCE(a.REGION, '?') AS REGION
                FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
                WHERE a.ACCOUNT_ID = %s
                """,
                (account_id,),
            )
            acct_row = cur.fetchone()
            if not acct_row:
                return {"error": "Account not found"}

            util_pct = acct_row["UTIL_PCT"]
            wow_pct = acct_row["WOW_PCT"]
            mom_pct = acct_row["MOM_PCT"]
            days_since = acct_row["DAYS_SINCE"]
            industry = acct_row["INDUSTRY"]
            region = acct_row["REGION"]
            active_count = acct_row["ACTIVE_COUNT"]
            impl_count = acct_row["IMPL_COUNT"]

            cur.execute(
                """
                SELECT LISTAGG('• ' || SIGNAL_TYPE || ' (' || PRIORITY || '): ' || LEFT(SIGNAL_TEXT, 100), '\n')
                    WITHIN GROUP (ORDER BY CASE PRIORITY WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END)
                AS SIGS
                FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
                WHERE ACCOUNT_ID = %s
                LIMIT 8
                """,
                (account_id,),
            )
            r = cur.fetchone()
            signals_text = r["SIGS"] if r and r["SIGS"] else "None"

            cur.execute(
                """
                SELECT LISTAGG('• ' || PATTERN_NAME || ' (' || SEVERITY || '): ' || LEFT(DESCRIPTION, 150), '\n')
                    WITHIN GROUP (ORDER BY CASE SEVERITY WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END)
                AS PATS
                FROM TEMP.JUSDAVIS.BKMNG_COMPOSITE_PATTERNS
                WHERE ACCOUNT_ID = %s
                LIMIT 5
                """,
                (account_id,),
            )
            r = cur.fetchone()
            patterns_text = r["PATS"] if r and r["PATS"] else "None"

            cur.execute(
                """
                SELECT LISTAGG(
                    TO_CHAR(INTERACTION_DATE::DATE) || ': ' || COALESCE(TITLE, 'Call') || '. ' || COALESCE(LEFT(SUMMARY, 200), ''),
                    '\n') WITHIN GROUP (ORDER BY INTERACTION_DATE DESC)
                AS CALLS,
                COUNT(*) AS N
                FROM TEMP.JUSDAVIS.BKMNG_ONT_INTERACTIONS
                WHERE ACCOUNT_ID = %s
                LIMIT 3
                """,
                (account_id,),
            )
            r = cur.fetchone()
            gong_text = r["CALLS"] if r and r["CALLS"] else "No recent calls"
            gong_count = int(r["N"]) if r else 0

            cur.execute(
                """
                SELECT LISTAGG('• ' || USE_CASE_NAME || ' [' || STAGE || '/' || STATUS || ']', '\n')
                    WITHIN GROUP (ORDER BY STATUS)
                AS UCS
                FROM TEMP.JUSDAVIS.BKMNG_ONT_USE_CASES
                WHERE ACCOUNT_ID = %s
                LIMIT 5
                """,
                (account_id,),
            )
            r = cur.fetchone()
            usecases_text = r["UCS"] if r and r["UCS"] else "None"

            cur.execute(
                """
                SELECT LISTAGG('• ' || TO_CHAR(CREATED_AT::DATE) || ' (' || SOURCE_TYPE || '): ' ||
                    COALESCE(PARSED_SUMMARY, LEFT(RAW_CONTENT, 150)), '\n')
                    WITHIN GROUP (ORDER BY CREATED_AT DESC)
                AS CTX,
                COUNT(*) > 0 AS CTX_USED
                FROM TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2
                WHERE ACCOUNT_ID = %s AND IS_ACTIVE = TRUE
                LIMIT 5
                """,
                (account_id,),
            )
            r = cur.fetchone()
            context_text = r["CTX"] if r and r["CTX"] else "No SE notes"
            context_used = bool(r["CTX_USED"]) if r else False

            prompt = f"""You are an AI assistant for a Snowflake Activation Sales Engineer.
Given the following data about an account, produce a structured briefing.

ACCOUNT: {account_name}
INDUSTRY: {industry} | REGION: {region}
UTILIZATION: {round(util_pct)}% | WoW: {round(wow_pct, 1)}% | MoM: {round(mom_pct, 1)}%
DAYS SINCE LAST INTERACTION: {days_since}
ACTIVE USE CASES: {active_count} | IN IMPLEMENTATION: {impl_count}

ACTIVE SITUATIONS:
{patterns_text}

SIGNALS:
{signals_text}

RECENT GONG CALLS:
{gong_text[:800]}

USE CASES:
{usecases_text}

SE NOTES & CONTEXT:
{context_text[:600]}

Respond with ONLY this JSON:
{{"situation_summary": "2-3 sentences: what is happening at this account right now",
  "top_risk": "the single biggest risk with specific context",
  "top_opportunity": "the single biggest opportunity with specific context",
  "recommended_actions": [{{"action": "specific action", "rationale": "why", "urgency": "now|this_week|this_month"}}],
  "talking_points": ["point for next conversation"],
  "key_questions": ["question the SE should investigate"]}}

Be specific. Reference actual data above. Return only JSON."""

            cur.execute(
                "SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-70b', %s) AS RESULT",
                (prompt,),
            )
            r = cur.fetchone()
            result_text = r["RESULT"] if r else ""

            parsed = {}
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                try:
                    parsed = json.loads(json_match.group())
                except Exception:
                    pass

            cur.execute(
                """
                INSERT INTO TEMP.JUSDAVIS.BKMNG_ACCOUNT_BRIEFINGS
                    (ACCOUNT_ID, ACCOUNT_NAME, ACE_EMAIL, SITUATION_SUMMARY, TOP_RISK,
                     TOP_OPPORTUNITY, RECOMMENDED_ACTIONS, TALKING_POINTS, KEY_QUESTIONS,
                     SIGNALS_USED, CONTEXT_USED, GONG_CALLS_USED, MODEL_USED)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'llama3.1-70b')
                """,
                (
                    account_id, account_name, ace_email,
                    parsed.get("situation_summary"),
                    parsed.get("top_risk"),
                    parsed.get("top_opportunity"),
                    json.dumps(parsed.get("recommended_actions")) if parsed.get("recommended_actions") else None,
                    json.dumps(parsed.get("talking_points")) if parsed.get("talking_points") else None,
                    json.dumps(parsed.get("key_questions")) if parsed.get("key_questions") else None,
                    signals_text[:2000],
                    context_used,
                    gong_count,
                ),
            )
            return {
                "account_id": account_id,
                "account_name": account_name,
                "situation_summary": parsed.get("situation_summary"),
                "top_risk": parsed.get("top_risk"),
                "top_opportunity": parsed.get("top_opportunity"),
                "recommended_actions": parsed.get("recommended_actions"),
                "talking_points": parsed.get("talking_points"),
                "key_questions": parsed.get("key_questions"),
                "generated_at": None,
                "model_used": "llama3.1-70b",
            }
        except Exception as e:
            return {"error": str(e)}

    def _search_knowledge_assistant(self, cur, query: str, limit: int = 3) -> list:
        import json as _json
        if not query or not query.strip():
            return []
        try:
            search_payload = _json.dumps({
                "query": query,
                "columns": ["FILE_NAME", "SEISMIC_LINK"],
                "limit": limit * 3,
            })
            cur.execute(
                "SELECT PARSE_JSON(SNOWFLAKE.CORTEX.SEARCH_PREVIEW('SALES.KNOWLEDGE_ASSISTANT.FILE_SEARCH_SERVICE_PAGENUM_PROD', %s))['results'] AS RESULTS",
                (search_payload,),
            )
            r = cur.fetchone()
            if not r or not r["RESULTS"]:
                return []
            results = r["RESULTS"]
            if isinstance(results, str):
                results = _json.loads(results)
            seen_urls: set = set()
            links = []
            for item in results:
                url = item.get("SEISMIC_LINK") or item.get("FILE_NAME", "")
                title = item.get("FILE_NAME", "")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                is_seismic = "seismic.com" in url
                links.append({
                    "url": url,
                    "title": title.split("/")[-1].replace(".pptx", "").replace(".docx", "").replace(".pdf", "") if not url.startswith("http") else title.split("/")[-1] or title,
                    "source": "seismic" if is_seismic else "docs",
                })
                if len(links) >= limit:
                    break
            return links
        except Exception:
            return []

    def get_meeting_prep(self, account_id: str) -> Optional[dict]:
        cur = self._cursor()
        cur.execute(
            """
            SELECT PREP_ID, ACCOUNT_ID, ACCOUNT_NAME, ACE_EMAIL,
                   LAST_MEETING_RECAP, CHANGES_SINCE_LAST, OPEN_ACTION_ITEMS,
                   SUGGESTED_AGENDA, QUESTIONS_TO_ASK, COMPETITIVE_CONTEXT,
                   ACCOUNT_BRIEFING_SUMMARY, GENERATED_AT, GENERATED_FOR_MEETING_DATE,
                   MEETING_RECAPS, FEATURE_SIGNALS, SUGGESTED_ASSETS, DOC_LINKS
            FROM TEMP.JUSDAVIS.BKMNG_MEETING_PREPS
            WHERE ACCOUNT_ID = %s
            ORDER BY GENERATED_AT DESC
            LIMIT 1
            """,
            (account_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        r = {k.lower(): v for k, v in dict(row).items()}
        if r.get("generated_at"):
            age_hours = (
                __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
                - r["generated_at"].replace(tzinfo=__import__("datetime").timezone.utc)
                if r["generated_at"].tzinfo is None
                else __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
                - r["generated_at"]
            ).total_seconds() / 3600
            if age_hours < 20:
                return r
        return None

    def generate_meeting_prep(self, account_id: str, account_name: str, ace_email: str, additional_context: str = "") -> dict:
        cache_invalidate_prefix(f"briefing:{account_id}")
        cache_invalidate_prefix("bkmng_ctx:")
        cur = self._cursor()
        try:
            cur.execute(
                """
                SELECT
                    COALESCE(a.WOW_PCT_CHANGE, 0) AS WOW_PCT,
                    COALESCE(a.CONTRACT_UTILIZATION_PCT, 0) AS UTIL_PCT,
                    COALESCE(a.DAYS_SINCE_LAST_INTERACTION, 0) AS DAYS_SINCE
                FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
                WHERE a.ACCOUNT_ID = %s
                """,
                (account_id,),
            )
            acct_row = cur.fetchone()
            wow_pct = acct_row["WOW_PCT"] if acct_row else 0
            util_pct = acct_row["UTIL_PCT"] if acct_row else 0

            cur.execute(
                """
                SELECT
                    TO_CHAR(INTERACTION_DATE::DATE) AS CALL_DATE,
                    COALESCE(TITLE, 'Call') AS TITLE,
                    COALESCE(SUMMARY, '') AS SUMMARY,
                    COALESCE(KEY_POINTS, '') AS KEY_POINTS,
                    COALESCE(NEXT_STEPS, '') AS NEXT_STEPS,
                    COALESCE(TOPICS, '') AS TOPICS,
                    COALESCE(RECORDING_URL, '') AS RECORDING_URL
                FROM TEMP.JUSDAVIS.BKMNG_ONT_INTERACTIONS
                WHERE ACCOUNT_ID = %s
                ORDER BY INTERACTION_DATE DESC
                LIMIT 5
                """,
                (account_id,),
            )
            gong_rows = cur.fetchall()
            gong_text = "\n\n".join(
                f"[{r['CALL_DATE']}] {r['TITLE']}\nSummary: {r['SUMMARY'][:400]}\nKey Points: {r['KEY_POINTS'][:300]}\nNext Steps: {r['NEXT_STEPS'][:200]}\nTopics: {r['TOPICS'][:200]}\nGong URL: {r['RECORDING_URL']}"
                for r in gong_rows
            ) or "No recent calls"

            cur.execute(
                """
                SELECT
                    LISTAGG('• ' || PATTERN_NAME || ': ' || LEFT(DESCRIPTION, 150), '\n')
                    WITHIN GROUP (ORDER BY CASE SEVERITY WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END)
                AS PATS
                FROM TEMP.JUSDAVIS.BKMNG_COMPOSITE_PATTERNS
                WHERE ACCOUNT_ID = %s
                LIMIT 5
                """,
                (account_id,),
            )
            r = cur.fetchone()
            patterns_text = r["PATS"] if r and r["PATS"] else "None"

            cur.execute(
                """
                SELECT
                    LISTAGG(COALESCE(PARSED_SUMMARY, LEFT(RAW_CONTENT, 150)), '\n')
                    WITHIN GROUP (ORDER BY CREATED_AT DESC)
                AS CTX
                FROM TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2
                WHERE ACCOUNT_ID = %s AND IS_ACTIVE = TRUE
                LIMIT 3
                """,
                (account_id,),
            )
            r = cur.fetchone()
            context_text = r["CTX"] if r and r["CTX"] else "No SE notes"

            cur.execute(
                """
                SELECT TO_CHAR(MEETING_DATE::DATE) AS ENTRY_DATE,
                       COALESCE(TITLE, 'Untitled') AS TITLE,
                       COALESCE(SOURCE_TYPE, 'notes') AS SOURCE_TYPE,
                       COALESCE(NOTES_SUMMARY, LEFT(NOTES, 300)) AS SUMMARY
                FROM TEMP.JUSDAVIS.BKMNG_MANUAL_MEETINGS
                WHERE ACCOUNT_ID = %s AND NOTES_ADDED = TRUE
                ORDER BY MEETING_DATE DESC
                LIMIT 5
                """,
                (account_id,),
            )
            manual_rows = cur.fetchall()
            manual_context_text = "\n\n".join(
                f"[{r['ENTRY_DATE']}] ({r['SOURCE_TYPE']}) {r['TITLE']}\n{r['SUMMARY']}"
                for r in manual_rows
            ) or "No manually added context"

            cur.execute(
                """
                SELECT USE_CASE_NAME, LEFT(CONTENT, 300) AS CONTENT,
                       AUTHOR_INITIALS, TO_CHAR(NOTE_DATE) AS NOTE_DATE
                FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES
                WHERE ACCOUNT_ID = %s AND CONTENT IS NOT NULL
                ORDER BY NOTE_DATE DESC NULLS LAST
                LIMIT 5
                """,
                (account_id,),
            )
            ps_rows = cur.fetchall()
            ps_notes_text = "\n\n".join(
                f"[{r['NOTE_DATE'] or 'undated'}] {r['USE_CASE_NAME']} ({r['AUTHOR_INITIALS']}): {r['CONTENT']}"
                for r in ps_rows
            ) or "No recent PS notes"

            cur.execute(
                """
                SELECT TOPIC, MENTION_COUNT_90D, TO_CHAR(LAST_MENTIONED_DATE) AS LAST_MENTIONED
                FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_TOPICS
                WHERE ACCOUNT_ID = %s
                  AND TOPIC NOT IN ('Small Talk','Call Setup','Wrap-Up','Next Steps','Building Announcements')
                ORDER BY MENTION_COUNT_90D DESC LIMIT 8
                """,
                (account_id,),
            )
            topic_rows = cur.fetchall()
            topics_text = "\n".join(
                f"• {r['TOPIC']} (mentioned {r['MENTION_COUNT_90D']}x, last: {r['LAST_MENTIONED']})"
                for r in topic_rows
            ) or "No topic data"

            cur.execute(
                """
                SELECT pa.PRODUCT_CATEGORY, pa.FEATURE, TO_CHAR(pa.FIRST_USE_DATE) AS FIRST_USE,
                       COALESCE(pa.TOTAL_REVENUE_90D, 0) AS REV_90D
                FROM TEMP.JUSDAVIS.BKMNG_A360_PRODUCT_ADOPTION pa
                WHERE pa.ACCOUNT_ID = %s AND pa.IS_NEW_30D = TRUE
                ORDER BY pa.FIRST_USE_DATE DESC
                """,
                (account_id,),
            )
            new_feature_rows = cur.fetchall()
            new_features_text = "\n".join(
                f"• {r['FEATURE']} ({r['PRODUCT_CATEGORY']}) — first used {r['FIRST_USE']}, 90d revenue: ${r['REV_90D']:,.0f}"
                for r in new_feature_rows
            ) or "No new features in last 30 days"

            cur.execute(
                """
                SELECT MILESTONE_NAME, TIER, STATUS, PRIORITY, INDUSTRY_PRIORITY,
                       RAW_VALUE::VARCHAR AS RAW_VALUE
                FROM BKMNG_SECURITY_POSTURE
                WHERE ACCOUNT_ID = %s
                  AND STATUS IN ('not_started', 'partial')
                  AND INDUSTRY_PRIORITY = 'required'
                ORDER BY CASE PRIORITY WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
                LIMIT 8
                """,
                (account_id,),
            )
            security_gap_rows = cur.fetchall()
            security_gaps_text = "\n".join(
                f"\u2022 {r['MILESTONE_NAME']} ({r['TIER']}) \u2014 {r['STATUS']}, priority: {r['PRIORITY']}, industry: required"
                for r in security_gap_rows
            ) or "No critical security gaps detected"

            briefing_summary = None
            existing_briefing = self.get_account_briefing(account_id)
            if existing_briefing:
                briefing_summary = existing_briefing.get("situation_summary")

            additional_context_section = f"\nACE ADDITIONAL CONTEXT (provided by the SE — prioritize this):\n{additional_context[:800]}" if additional_context.strip() else ""

            prompt = f"""You are an AI assistant for a Snowflake Activation Sales Engineer preparing for a customer meeting.
For every item you generate, cite the exact data source you used and explain your reasoning so the SE can fact-check.

ACCOUNT: {account_name}
UTILIZATION: {round(util_pct)}% | WoW: {round(wow_pct, 1)}%

ACCOUNT SITUATION:
{briefing_summary or "No briefing available"}

ACTIVE SITUATIONS:
{patterns_text}

RECENT CALLS (last 5, newest first):
{gong_text[:2000]}

GONG TOPICS (most discussed in last 90 days):
{topics_text}

SE NOTES:
{context_text[:500]}

MANUALLY ADDED CONTEXT (emails, transcripts, meeting notes added by the SE):
{manual_context_text[:1500]}

RECENT PS NOTES (use case activity updates):
{ps_notes_text[:1000]}

NEW PRODUCT FEATURES ADOPTED (last 30 days):
{new_features_text[:600]}

SECURITY POSTURE GAPS (industry-required milestones not yet met):
{security_gaps_text}{additional_context_section}

Respond with ONLY this JSON structure:
{{
  "meeting_recaps": [
    {{
      "title": "call title from Gong data",
      "date": "YYYY-MM-DD",
      "summary": "2-3 sentence summary of what was discussed",
      "key_decisions": ["decision 1", "decision 2"],
      "open_items": ["item promised or left open"],
      "gong_url": "recording URL from data or null"
    }}
  ],
  "suggested_topics": [
    {{
      "topic": "specific topic to discuss",
      "justification": "why this matters now — cite the exact data source",
      "evidence_source": "signal|gong|notes|adoption|security",
      "priority": "high|medium",
      "feature_area": "closest Snowflake product feature name from the data"
    }}
  ],
  "feature_signals": [
    {{
      "feature": "exact feature name from NEW PRODUCT FEATURES data",
      "category": "product category",
      "first_use_date": "YYYY-MM-DD",
      "insight": "why this adoption matters for the customer",
      "suggested_action": "specific next step for the SE"
    }}
  ],
  "suggested_assets": [
    {{
      "asset_type": "demo|pdf_guide|notebook|workshop",
      "title": "descriptive title",
      "description": "what this asset would cover and why",
      "related_topic": "which suggested topic this supports"
    }}
  ],
  "open_action_items": [
    {{
      "item": "action item",
      "source": "Gong call date or SE note",
      "owner": "SE|customer|unknown"
    }}
  ]
}}

RULES:
- Include recaps for up to 3 most recent meetings from the RECENT CALLS data
- Generate 3-5 suggested topics, prioritized by urgency
- If there are SECURITY POSTURE GAPS, include at least one suggested topic about the most critical security gap with evidence_source "security"
- For feature_signals, use ONLY features listed in NEW PRODUCT FEATURES data
- Suggest 2-4 assets (demos, guides, notebooks, workshops) based on topics and adoption
- For feature_area in suggested_topics, use the closest matching feature name from the data provided
- Be specific and practical. Return only JSON."""

            cur.execute(
                "SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-70b', %s) AS RESULT",
                (prompt,),
            )
            r = cur.fetchone()
            result_text = r["RESULT"] if r else ""

            parsed = {}
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                try:
                    parsed = json.loads(json_match.group())
                except Exception:
                    pass

            _ka_cache: dict = {}

            def _get_ka_links(query: str) -> list:
                if not query:
                    return []
                if query not in _ka_cache:
                    _ka_cache[query] = self._search_knowledge_assistant(cur, query, limit=2)
                return _ka_cache[query]

            for topic in parsed.get("suggested_topics", []):
                feature_area = topic.get("feature_area", "") or topic.get("topic", "")
                topic["doc_links"] = _get_ka_links(feature_area)

            for signal in parsed.get("feature_signals", []):
                signal["doc_links"] = _get_ka_links(signal.get("feature", ""))

            import datetime as _dt
            generated_at = _dt.datetime.now(_dt.timezone.utc)

            cur.execute(
                """
                DELETE FROM TEMP.JUSDAVIS.BKMNG_MEETING_PREPS
                WHERE ACCOUNT_ID = %s AND ACE_EMAIL = %s
                """,
                (account_id, ace_email),
            )

            recap_raw = parsed.get("last_meeting_recap")
            recap_stored = json.dumps(recap_raw) if isinstance(recap_raw, dict) else recap_raw
            comp_raw = parsed.get("competitive_context")
            comp_stored = json.dumps(comp_raw) if isinstance(comp_raw, dict) else comp_raw
            changes_stored = json.dumps(parsed.get("changes_since_last")) if parsed.get("changes_since_last") else None
            actions_stored = json.dumps(parsed.get("open_action_items")) if parsed.get("open_action_items") else None
            agenda_stored = json.dumps(parsed.get("suggested_topics")) if parsed.get("suggested_topics") else None
            questions_stored = json.dumps(parsed.get("questions_to_ask")) if parsed.get("questions_to_ask") else None

            meeting_recaps_stored = json.dumps(parsed.get("meeting_recaps")) if parsed.get("meeting_recaps") else None
            feature_signals_stored = json.dumps(parsed.get("feature_signals")) if parsed.get("feature_signals") else None
            suggested_assets_stored = json.dumps(parsed.get("suggested_assets")) if parsed.get("suggested_assets") else None
            doc_links_stored = json.dumps({"topic_links": {t.get("topic", ""): t.get("doc_links", []) for t in parsed.get("suggested_topics", [])}, "feature_links": {s.get("feature", ""): s.get("doc_links", []) for s in parsed.get("feature_signals", [])}})

            cur.execute(
                """
                INSERT INTO TEMP.JUSDAVIS.BKMNG_MEETING_PREPS
                    (ACCOUNT_ID, ACCOUNT_NAME, ACE_EMAIL, LAST_MEETING_RECAP,
                     CHANGES_SINCE_LAST, OPEN_ACTION_ITEMS, SUGGESTED_AGENDA,
                     QUESTIONS_TO_ASK, COMPETITIVE_CONTEXT, ACCOUNT_BRIEFING_SUMMARY,
                     GENERATED_AT, MEETING_RECAPS, FEATURE_SIGNALS, SUGGESTED_ASSETS, DOC_LINKS)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    account_id, account_name, ace_email,
                    recap_stored,
                    changes_stored,
                    actions_stored,
                    agenda_stored,
                    questions_stored,
                    comp_stored,
                    briefing_summary[:1000] if briefing_summary else None,
                    generated_at,
                    meeting_recaps_stored,
                    feature_signals_stored,
                    suggested_assets_stored,
                    doc_links_stored,
                ),
            )
            return {
                "account_id": account_id,
                "account_name": account_name,
                "last_meeting_recap": recap_stored,
                "changes_since_last": changes_stored,
                "open_action_items": actions_stored,
                "suggested_agenda": agenda_stored,
                "questions_to_ask": questions_stored,
                "competitive_context": comp_stored,
                "account_briefing_summary": briefing_summary,
                "generated_at": generated_at.isoformat(),
                "meeting_recaps": meeting_recaps_stored,
                "feature_signals": feature_signals_stored,
                "suggested_assets": suggested_assets_stored,
                "doc_links": doc_links_stored,
            }
        except Exception as e:
            return {"error": str(e)}

    def generate_prep_email(self, account_id: str, ace_email: str, recipient_name: str = "", meeting_date: str = "") -> dict:
        cur = self._cursor()
        try:
            cached = self.get_meeting_prep(account_id)
            if not cached:
                return {"error": "No meeting prep found. Generate meeting prep first."}

            suggested_topics = []
            if cached.get("MEETING_RECAPS") or cached.get("meeting_recaps"):
                raw = cached.get("MEETING_RECAPS") or cached.get("meeting_recaps")
                if isinstance(raw, str):
                    try:
                        suggested_topics = json.loads(raw)  # noqa: F841 (reserved for future use)
                    except Exception:
                        pass

            topics_for_email = []
            raw_agenda = cached.get("SUGGESTED_AGENDA") or cached.get("suggested_agenda")
            if raw_agenda:
                if isinstance(raw_agenda, str):
                    try:
                        topics_for_email = json.loads(raw_agenda)
                    except Exception:
                        pass
                elif isinstance(raw_agenda, list):
                    topics_for_email = raw_agenda

            feature_signals = []
            raw_fs = cached.get("FEATURE_SIGNALS") or cached.get("feature_signals")
            if raw_fs:
                if isinstance(raw_fs, str):
                    try:
                        feature_signals = json.loads(raw_fs)
                    except Exception:
                        pass

            cur.execute(
                """
                SELECT PREFERRED_NAME, GREETING_STYLE, CLOSING_STYLE, WRITING_EXAMPLES
                FROM TEMP.JUSDAVIS.BKMNG_USER_PREFERENCES
                WHERE EMAIL = %s
                """,
                (ace_email,),
            )
            pref_row = cur.fetchone()
            preferred_name = pref_row["PREFERRED_NAME"] if pref_row and pref_row.get("PREFERRED_NAME") else ""
            greeting_style = pref_row["GREETING_STYLE"] if pref_row and pref_row.get("GREETING_STYLE") else "casual"
            closing_style = pref_row["CLOSING_STYLE"] if pref_row and pref_row.get("CLOSING_STYLE") else "Best"
            writing_examples = pref_row["WRITING_EXAMPLES"] if pref_row and pref_row.get("WRITING_EXAMPLES") else ""

            account_name = cached.get("ACCOUNT_NAME") or cached.get("account_name") or account_id

            topics_text = "\n".join(
                f"- {t.get('topic', t.get('text', ''))}" for t in (topics_for_email[:5] if topics_for_email else [])
            ) or "General check-in"

            features_text = "\n".join(
                f"- {f.get('feature', '')}: {f.get('insight', '')}" for f in (feature_signals[:3] if feature_signals else [])
            )

            prompt = f"""Write a brief pre-meeting email from a Snowflake Sales Engineer to a customer contact.

ACCOUNT: {account_name}
RECIPIENT: {recipient_name or "the customer"}
MEETING DATE: {meeting_date or "upcoming"}
SENDER NAME: {preferred_name or "your Snowflake SE"}

SUGGESTED TOPICS FOR THE MEETING:
{topics_text}

{"NEW FEATURE ADOPTION SIGNALS:" + chr(10) + features_text if features_text else ""}

EMAIL STYLE:
- Greeting style: {greeting_style}
- Closing: {closing_style}
{"- Match this writing tone: " + writing_examples[:300] if writing_examples else ""}

RULES:
- Keep it 150-200 words
- Structure: greeting, brief intro mentioning what you'd like to cover, 3-4 bullet points of topics, mention any new feature adoption as "I noticed you recently started using X", close with invitation to add topics
- Be warm but professional
- Do NOT include placeholder text like [Your Name] — use the sender name provided

Respond with ONLY this JSON:
{{"subject": "Pre-meeting agenda: ...", "body": "the full email text"}}"""

            cur.execute(
                "SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-70b', %s) AS RESULT",
                (prompt,),
            )
            r = cur.fetchone()
            result_text = r["RESULT"] if r else ""

            parsed = {}
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                try:
                    parsed = json.loads(json_match.group())
                except Exception:
                    parsed = {"subject": f"Pre-meeting agenda: {account_name}", "body": result_text}

            cur.execute(
                """
                UPDATE TEMP.JUSDAVIS.BKMNG_MEETING_PREPS
                SET PRE_MEETING_EMAIL = %s
                WHERE ACCOUNT_ID = %s AND ACE_EMAIL = %s
                """,
                (json.dumps(parsed), account_id, ace_email),
            )

            return parsed
        except Exception as e:
            return {"error": str(e)}

    def list_credit_consumption_for_account(
        self, account_id: str, ace_filter: Optional[str] = None
    ) -> list[CreditConsumption]:
        return []

    def list_feature_usage_for_account(
        self, account_id: str, ace_filter: Optional[str] = None
    ) -> list[AccountFeatureUsage]:
        return []

    def list_account_revenue_summaries(
        self,
        ace_filter: Optional[str] = None,
        acem_filter: Optional[str] = None,
    ) -> dict[str, AccountRevenueSummary]:
        cur = self._cursor()
        sql = """
            SELECT
                c.ACCOUNT_ID,
                c.NET_ACV,
                c.NET_TCV,
                c.NET_TCV AS contract_capacity,
                c.REV_90D AS total_consumed_revenue,
                c.REV_180D AS total_consumed_credits,
                GREATEST(0, COALESCE(c.NET_TCV, 0) - COALESCE(c.REV_180D, 0)) AS capacity_remaining,
                CASE WHEN c.NET_ACV > 0 THEN ROUND(c.REV_90D * (365.0/90) / c.NET_ACV * 100, 1) ELSE NULL END AS pct_consumed,
                c.PREDICTED_OVERAGE_DATE,
                c.CONTRACT_START_DATE,
                c.CONTRACT_END_DATE,
                cn.WOW_PCT_CHANGE,
                cn.MOM_PCT_CHANGE
            FROM BKMNG_A360_CONTRACT c
            LEFT JOIN BKMNG_A360_CONSUMPTION cn ON cn.ACCOUNT_ID = c.ACCOUNT_ID
            {join}
            {where}
        """
        if ace_filter:
            cur.execute(
                sql.format(
                    join="INNER JOIN BKMNG_ACCOUNTS a ON a.ACCOUNT_ID = c.ACCOUNT_ID",
                    where="WHERE a.ACE_ASSIGNED = %s AND c.NET_ACV IS NOT NULL",
                ),
                (ace_filter,),
            )
        elif acem_filter:
            cur.execute(
                sql.format(
                    join="INNER JOIN BKMNG_ACCOUNTS a ON a.ACCOUNT_ID = c.ACCOUNT_ID",
                    where="WHERE a.ACE_ASSIGNED IN (SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s) AND c.NET_ACV IS NOT NULL",
                ),
                (acem_filter,),
            )
        else:
            cur.execute(sql.format(join="", where="WHERE c.NET_ACV IS NOT NULL"))
        result: dict[str, AccountRevenueSummary] = {}
        for row in cur.fetchall():
            aid = row["ACCOUNT_ID"]
            result[aid] = AccountRevenueSummary(
                account_id=aid,
                net_acv=float(row["NET_ACV"]) if row.get("NET_ACV") is not None else None,
                net_tcv=float(row["NET_TCV"]) if row.get("NET_TCV") is not None else None,
                contract_capacity=float(row["CONTRACT_CAPACITY"]) if row.get("CONTRACT_CAPACITY") is not None else None,
                total_consumed_revenue=float(row["TOTAL_CONSUMED_REVENUE"]) if row.get("TOTAL_CONSUMED_REVENUE") is not None else None,
                capacity_remaining=float(row["CAPACITY_REMAINING"]) if row.get("CAPACITY_REMAINING") is not None else None,
                total_consumed_credits=float(row["TOTAL_CONSUMED_CREDITS"]) if row.get("TOTAL_CONSUMED_CREDITS") is not None else None,
                pct_consumed=float(row["PCT_CONSUMED"]) if row.get("PCT_CONSUMED") is not None else None,
                predicted_overage_date=_d(row.get("PREDICTED_OVERAGE_DATE")),
                last_actual_date=None,
                contract_start_date=_d(row.get("CONTRACT_START_DATE")),
                contract_end_date=_d(row.get("CONTRACT_END_DATE")),
                wow_credits_pct_change=float(row["WOW_PCT_CHANGE"]) if row.get("WOW_PCT_CHANGE") is not None else None,
                mom_credits_pct_change=float(row["MOM_PCT_CHANGE"]) if row.get("MOM_PCT_CHANGE") is not None else None,
            )
        return result

    def get_account_revenue_summary(
        self, account_id: str, ace_filter: Optional[str] = None
    ) -> Optional[AccountRevenueSummary]:
        cur = self._cursor()
        cur.execute(
            """
            SELECT
                c.ACCOUNT_ID,
                c.NET_ACV,
                c.NET_TCV,
                c.NET_TCV AS contract_capacity,
                c.REV_90D AS total_consumed_revenue,
                c.REV_180D AS total_consumed_credits,
                GREATEST(0, COALESCE(c.NET_TCV, 0) - COALESCE(c.REV_180D, 0)) AS capacity_remaining,
                CASE WHEN c.NET_ACV > 0 THEN ROUND(c.REV_90D * (365.0/90) / c.NET_ACV * 100, 1) ELSE NULL END AS pct_consumed,
                c.PREDICTED_OVERAGE_DATE,
                c.CONTRACT_START_DATE,
                c.CONTRACT_END_DATE,
                cn.WOW_PCT_CHANGE,
                cn.MOM_PCT_CHANGE
            FROM BKMNG_A360_CONTRACT c
            LEFT JOIN BKMNG_A360_CONSUMPTION cn ON cn.ACCOUNT_ID = c.ACCOUNT_ID
            WHERE c.ACCOUNT_ID = %s
            """,
            (account_id,),
        )
        row = cur.fetchone()
        if not row or row.get("CONTRACT_CAPACITY") is None:
            return None
        return AccountRevenueSummary(
            account_id=account_id,
            net_acv=float(row["NET_ACV"]) if row.get("NET_ACV") is not None else None,
            net_tcv=float(row["NET_TCV"]) if row.get("NET_TCV") is not None else None,
            contract_capacity=float(row["CONTRACT_CAPACITY"]) if row.get("CONTRACT_CAPACITY") is not None else None,
            total_consumed_revenue=float(row["TOTAL_CONSUMED_REVENUE"]) if row.get("TOTAL_CONSUMED_REVENUE") is not None else None,
            capacity_remaining=float(row["CAPACITY_REMAINING"]) if row.get("CAPACITY_REMAINING") is not None else None,
            total_consumed_credits=float(row["TOTAL_CONSUMED_CREDITS"]) if row.get("TOTAL_CONSUMED_CREDITS") is not None else None,
            pct_consumed=float(row["PCT_CONSUMED"]) if row.get("PCT_CONSUMED") is not None else None,
            predicted_overage_date=_d(row.get("PREDICTED_OVERAGE_DATE")),
            last_actual_date=None,
            contract_start_date=_d(row.get("CONTRACT_START_DATE")),
            contract_end_date=_d(row.get("CONTRACT_END_DATE")),
            wow_credits_pct_change=float(row["WOW_PCT_CHANGE"]) if row.get("WOW_PCT_CHANGE") is not None else None,
            mom_credits_pct_change=float(row["MOM_PCT_CHANGE"]) if row.get("MOM_PCT_CHANGE") is not None else None,
        )

    # ------------------------------------------------------------------
    # TMRs — from materialized BKMNG_TMRS table
    # ------------------------------------------------------------------

    def list_tmrs(self, ace_filter: Optional[str] = None, acem_filter: Optional[str] = None) -> list[TMR]:
        cur = self._cursor()
        filters: list[str] = []
        params: list = []
        if ace_filter:
            filters.append(
                "(t.ASSIGNED_RESOURCE_EMAIL = %s OR t.SECONDARY_MEMBER_EMAIL = %s)"
            )
            params.extend([ace_filter, ace_filter])
        if acem_filter:
            filters.append(
                "t.ACCOUNT_ID IN (SELECT ba.ACCOUNT_ID FROM TEMP.JUSDAVIS.BKMNG_ACCOUNTS ba"
                " JOIN TEMP.JUSDAVIS.BKMNG_ACEM_TEAM team ON team.ACE_EMAIL = ba.ACE_ASSIGNED"
                " WHERE team.ACEM_EMAIL = %s)"
            )
            params.append(acem_filter)
        where = ("WHERE " + " AND ".join(filters)) if filters else ""
        sql = f"""
            SELECT
                t.TMR_ID, t.ACCOUNT_ID, t.ACCOUNT_NAME, t.STATUS,
                t.ACTIVITY_REQUESTED, t.ENGAGEMENT_TYPE,
                t.REQUESTOR, t.REQUESTOR_EMAIL, t.REQUESTED_DATE,
                t.ASSIGNED_RESOURCE_ID, t.ASSIGNED_RESOURCE_EMAIL, t.ASSIGNED_RESOURCE_NAME,
                t.SECONDARY_MEMBER_ID, t.SECONDARY_MEMBER_EMAIL, t.SECONDARY_MEMBER_NAME,
                t.SPECIALIST_COMMENTS, t.REQUEST_REASON,
                t.MANAGER_APPROVER_ID, t.MANAGER_APPROVER_EMAIL,
                t.CLOSE_DATE, t.START_DATE
            FROM TEMP.JUSDAVIS.BKMNG_TMRS t
            {where}
            ORDER BY t.REQUESTED_DATE DESC
        """
        cur.execute(sql, params)
        results = []
        for row in cur.fetchall():
            results.append(TMR(
                tmr_id=row["TMR_ID"],
                account_id=row["ACCOUNT_ID"] or "",
                account_name=row["ACCOUNT_NAME"] or "",
                status=row.get("STATUS") or "Unknown",
                activity_requested=row.get("ACTIVITY_REQUESTED"),
                engagement_type=row.get("ENGAGEMENT_TYPE"),
                requestor=row.get("REQUESTOR"),
                requestor_email=row.get("REQUESTOR_EMAIL"),
                request_reason=row.get("REQUEST_REASON"),
                specialist_comments=row.get("SPECIALIST_COMMENTS"),
                manager_approver=row.get("MANAGER_APPROVER_ID"),
                manager_approver_email=row.get("MANAGER_APPROVER_EMAIL"),
                requested_date=row.get("REQUESTED_DATE"),
                start_date=row.get("START_DATE"),
                close_date=row.get("CLOSE_DATE"),
                assigned_resource_id=row.get("ASSIGNED_RESOURCE_ID"),
                assigned_resource_email=row.get("ASSIGNED_RESOURCE_EMAIL"),
                assigned_resource_name=row.get("ASSIGNED_RESOURCE_NAME"),
                secondary_member_id=row.get("SECONDARY_MEMBER_ID"),
                secondary_member_email=row.get("SECONDARY_MEMBER_EMAIL"),
                secondary_member_name=row.get("SECONDARY_MEMBER_NAME"),
            ))
        return results

    # ------------------------------------------------------------------
    # ML predictions — stub (Phase 3+)
    # ------------------------------------------------------------------

    def list_credit_forecasts(self, ace_filter: Optional[str] = None) -> list[CreditForecast]:
        return []

    def get_credit_forecast_for_account(
        self, account_id: str, ace_filter: Optional[str] = None
    ) -> Optional[CreditForecast]:
        return None

    def list_use_case_predictions(
        self, ace_filter: Optional[str] = None
    ) -> list[UseCaseCompletionPrediction]:
        return []

    def list_similar_deployments(
        self, use_case_type: str, ace_filter: Optional[str] = None
    ) -> list[SimilarDeployment]:
        return []

    def list_tmr_predictions(self, ace_filter: Optional[str] = None) -> list:
        return []

    def get_account_tracking(self, account_id: str, user_email: str) -> Optional[dict]:
        cur = self._cursor()
        cur.execute(
            "SELECT * FROM BKMNG_USER_ACCOUNT_TRACKING WHERE ACCOUNT_ID = %s AND USER_EMAIL = %s",
            (account_id, user_email),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "account_id": row["ACCOUNT_ID"],
            "account_name": row.get("ACCOUNT_NAME"),
            "tracking_status": row["TRACKING_STATUS"],
            "notes": row.get("NOTES"),
            "notes_doc_url": row.get("NOTES_DOC_URL"),
            "updated_at": str(row["UPDATED_AT"]) if row.get("UPDATED_AT") else None,
        }

    def set_account_tracking(
        self,
        account_id: str,
        user_email: str,
        status: str,
        account_name: Optional[str] = None,
        notes: Optional[str] = None,
        notes_doc_url: Optional[str] = None,
    ) -> dict:
        cur = self._cursor()
        cur.execute(
            """
            MERGE INTO BKMNG_USER_ACCOUNT_TRACKING t
            USING (SELECT %s AS ACCOUNT_ID, %s AS USER_EMAIL) s
            ON t.ACCOUNT_ID = s.ACCOUNT_ID AND t.USER_EMAIL = s.USER_EMAIL
            WHEN MATCHED THEN UPDATE SET
                TRACKING_STATUS = %s,
                ACCOUNT_NAME = COALESCE(%s, t.ACCOUNT_NAME),
                NOTES = %s,
                NOTES_DOC_URL = %s,
                UPDATED_AT = CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN INSERT
                (USER_EMAIL, ACCOUNT_ID, ACCOUNT_NAME, TRACKING_STATUS, NOTES, NOTES_DOC_URL, CREATED_AT, UPDATED_AT)
            VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
            """,
            (account_id, user_email, status, account_name, notes, notes_doc_url,
             user_email, account_id, account_name, status, notes, notes_doc_url),
        )
        return {
            "account_id": account_id,
            "account_name": account_name,
            "tracking_status": status,
            "notes": notes,
            "notes_doc_url": notes_doc_url,
            "updated_at": None,
        }

    def delete_account_tracking(self, account_id: str, user_email: str) -> None:
        cur = self._cursor()
        cur.execute(
            "DELETE FROM BKMNG_USER_ACCOUNT_TRACKING WHERE ACCOUNT_ID = %s AND USER_EMAIL = %s",
            (account_id, user_email),
        )

    def update_account_fields(
        self,
        account_id: str,
        status: Optional[str] = None,
        engagement_status: Optional[str] = None,
        no_recording: Optional[bool] = None,
        engagement_start_date: Optional[str] = None,
        rolloff_date: Optional[str] = None,
        primary_ace_email: Optional[str] = None,
        coverage_ace_email: Optional[str] = None,
        coverage_until: Optional[str] = None,
        updated_by: Optional[str] = None,
    ) -> None:
        cache_invalidate_prefix(f"account:{account_id}")
        cache_invalidate_prefix("list_accounts:")
        cache_invalidate_prefix("bkmng_ctx:")
        cur = self._cursor()
        settings_fields = []
        if status is not None:
            settings_fields.append(("STATUS", status if status != "" else None))
        if engagement_status is not None:
            settings_fields.append(("ENGAGEMENT_STATUS", engagement_status if engagement_status != "" else None))
        if no_recording is not None:
            settings_fields.append(("NO_RECORDING", no_recording))
        if engagement_start_date is not None:
            settings_fields.append(("ENGAGEMENT_START_DATE", engagement_start_date if engagement_start_date != "" else None))
        if rolloff_date is not None:
            settings_fields.append(("ROLLOFF_DATE", rolloff_date if rolloff_date != "" else None))
        if primary_ace_email is not None:
            settings_fields.append(("PRIMARY_ACE_EMAIL", primary_ace_email if primary_ace_email != "" else None))
        if coverage_ace_email is not None:
            settings_fields.append(("COVERAGE_ACE_EMAIL", coverage_ace_email if coverage_ace_email != "" else None))
        if coverage_until is not None:
            settings_fields.append(("COVERAGE_UNTIL", coverage_until if coverage_until != "" else None))
        if settings_fields:
            set_clauses = ", ".join(f"t.{col} = s.{col}" for col, _ in settings_fields)
            src_cols = ", ".join(f"%s AS {col}" for col, _ in settings_fields)
            ins_cols = "ACCOUNT_ID, UPDATED_AT, UPDATED_BY, " + ", ".join(col for col, _ in settings_fields)
            ins_vals = "s.ACCOUNT_ID, s.UPDATED_AT, s.UPDATED_BY, " + ", ".join(f"s.{col}" for col, _ in settings_fields)
            params = [v for _, v in settings_fields]
            cur.execute(
                f"""
                MERGE INTO TEMP.JUSDAVIS.BKMNG_ACCOUNT_SETTINGS t
                USING (SELECT %s AS ACCOUNT_ID, CURRENT_TIMESTAMP() AS UPDATED_AT, %s AS UPDATED_BY, {src_cols}) s
                ON t.ACCOUNT_ID = s.ACCOUNT_ID
                WHEN MATCHED THEN UPDATE SET {set_clauses}, t.UPDATED_AT = s.UPDATED_AT, t.UPDATED_BY = s.UPDATED_BY
                WHEN NOT MATCHED THEN INSERT ({ins_cols})
                    VALUES ({ins_vals})
                """,
                ([account_id, updated_by] + params),
            )
        # Project STATUS / ENGAGEMENT_STATUS / coverage / primary into BKMNG_ONT_ACCOUNTS
        # so readers (which hit ONT) see the change immediately. The scheduled refresh
        # (SP_REFRESH_BKMNG_ONT_ACCOUNTS) rebuilds this projection from settings.
        ont_parts = []
        ont_params = []
        if status is not None:
            ont_parts.append("STATUS = %s")
            ont_params.append(status if status != "" else None)
        if engagement_status is not None:
            ont_parts.append("ENGAGEMENT_STATUS = %s")
            ont_params.append(engagement_status if engagement_status != "" else None)
        if primary_ace_email is not None:
            ont_parts.append("PRIMARY_ACE_EMAIL = %s")
            ont_params.append(primary_ace_email if primary_ace_email != "" else None)
        if coverage_ace_email is not None:
            ont_parts.append("COVERAGE_ACE_EMAIL = %s")
            ont_params.append(coverage_ace_email if coverage_ace_email != "" else None)
        if coverage_until is not None:
            ont_parts.append("COVERAGE_UNTIL = %s")
            ont_params.append(coverage_until if coverage_until != "" else None)
        if ont_parts:
            ont_params.append(account_id)
            cur.execute(
                f"UPDATE TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS SET {', '.join(ont_parts)} WHERE ACCOUNT_ID = %s",
                ont_params,
            )
        # If primary ACE was changed and the new primary is in the SF team for this account,
        # immediately reflect the change in BKMNG_ACCOUNTS.ACE_ASSIGNED so scope filters work
        # without waiting for the scheduled task. Falls back to the alphabetical pick when
        # primary is cleared or invalid.
        if primary_ace_email is not None:
            cur.execute(
                """
                SELECT u.EMAIL
                FROM FIVETRAN.SALESFORCE.ACCOUNT_TEAM_MEMBER atm
                INNER JOIN FIVETRAN.SALESFORCE.USER u
                    ON u.ID = atm.USER_ID AND u._FIVETRAN_DELETED = FALSE
                WHERE atm.ACCOUNT_ID = %s
                  AND atm.TEAM_MEMBER_ROLE = 'SE - Activation'
                  AND atm.IS_DELETED = FALSE
                QUALIFY ROW_NUMBER() OVER (
                    ORDER BY CASE WHEN LOWER(u.EMAIL) = LOWER(%s) THEN 0 ELSE 1 END,
                             u.EMAIL
                ) = 1
                """,
                [account_id, primary_ace_email or ""],
            )
            picked = cur.fetchone()
            picked_email = picked["EMAIL"] if picked and picked.get("EMAIL") else None
            if picked_email:
                cur.execute(
                    "UPDATE TEMP.JUSDAVIS.BKMNG_ACCOUNTS SET ACE_ASSIGNED = %s WHERE ACCOUNT_ID = %s",
                    [picked_email, account_id],
                )
                cur.execute(
                    "UPDATE TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS SET ACE_ASSIGNED = %s WHERE ACCOUNT_ID = %s",
                    [picked_email, account_id],
                )

    def manual_refresh_account(self, account_id: str) -> str:
        """Trigger SP_MANUAL_REFRESH_FOR_ACCOUNT to pull fresh data from
        Salesforce/Fivetran for a single account and rebuild its derived data
        (ONT row, signals, composite patterns, user alerts)."""
        cur = self._cursor()
        cur.execute(
            "CALL TEMP.JUSDAVIS.SP_MANUAL_REFRESH_FOR_ACCOUNT(%s)", [account_id]
        )
        row = cur.fetchone()
        return row[0] if row else "OK"

    def manual_refresh_book(self) -> str:
        """Trigger SP_MANUAL_REFRESH_FOR_BOOK to run the full refresh pipeline
        end-to-end (Salesforce tasks + ONT rebuild + signals + patterns + alerts)."""
        cur = self._cursor()
        cur.execute("CALL TEMP.JUSDAVIS.SP_MANUAL_REFRESH_FOR_BOOK()")
        row = cur.fetchone()
        return row[0] if row else "OK"

    def list_manual_meetings(self, account_id: str) -> list[ManualMeeting]:
        cur = self._cursor()
        cur.execute(
            """
            SELECT MEETING_ID, ACCOUNT_ID, ACCOUNT_NAME, TITLE, MEETING_DATE,
                   ATTENDEES, NOTES, NOTES_SUMMARY, NOTES_ADDED, CREATED_BY, CREATED_AT, UPDATED_AT
            FROM TEMP.JUSDAVIS.BKMNG_MANUAL_MEETINGS
            WHERE ACCOUNT_ID = %s
            ORDER BY MEETING_DATE DESC
            """,
            (account_id,),
        )
        return [
            ManualMeeting(
                meeting_id=r["MEETING_ID"],
                account_id=r["ACCOUNT_ID"],
                account_name=r.get("ACCOUNT_NAME"),
                title=r["TITLE"],
                meeting_date=r["MEETING_DATE"],
                attendees=r.get("ATTENDEES"),
                notes=r.get("NOTES"),
                notes_summary=r.get("NOTES_SUMMARY"),
                notes_added=bool(r.get("NOTES_ADDED")),
                created_by=r["CREATED_BY"],
                created_at=r["CREATED_AT"],
                updated_at=r["UPDATED_AT"],
            )
            for r in cur.fetchall()
        ]

    def add_manual_meeting(
        self,
        account_id: str,
        account_name: str,
        title: str,
        meeting_date: datetime,
        attendees: Optional[str],
        created_by: str,
    ) -> ManualMeeting:
        cache_invalidate_prefix("bkmng_ctx:")
        import uuid as _uuid
        meeting_id = str(_uuid.uuid4())
        cur = self._cursor()
        cur.execute(
            """
            INSERT INTO TEMP.JUSDAVIS.BKMNG_MANUAL_MEETINGS
                (MEETING_ID, ACCOUNT_ID, ACCOUNT_NAME, TITLE, MEETING_DATE, ATTENDEES, NOTES_ADDED, CREATED_BY)
            VALUES (%s, %s, %s, %s, %s, %s, FALSE, %s)
            """,
            (meeting_id, account_id, account_name, title, meeting_date, attendees, created_by),
        )
        return ManualMeeting(
            meeting_id=meeting_id,
            account_id=account_id,
            account_name=account_name,
            title=title,
            meeting_date=meeting_date,
            attendees=attendees,
            notes=None,
            notes_added=False,
            created_by=created_by,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

    def update_manual_meeting_notes(
        self,
        meeting_id: str,
        notes: str,
        user_email: str,
    ) -> Optional[ManualMeeting]:
        cache_invalidate_prefix("bkmng_ctx:")
        cur = self._cursor()
        cur.execute(
            """
            UPDATE TEMP.JUSDAVIS.BKMNG_MANUAL_MEETINGS
            SET NOTES = %s, NOTES_ADDED = TRUE, UPDATED_AT = CURRENT_TIMESTAMP()
            WHERE MEETING_ID = %s AND CREATED_BY = %s
            """,
            (notes, meeting_id, user_email),
        )
        if cur.rowcount == 0:
            return None
        meetings = self.list_manual_meetings_by_id(meeting_id)
        return meetings[0] if meetings else None

    def list_manual_meetings_by_id(self, meeting_id: str) -> list[ManualMeeting]:
        cur = self._cursor()
        cur.execute(
            """
            SELECT MEETING_ID, ACCOUNT_ID, ACCOUNT_NAME, TITLE, MEETING_DATE,
                   ATTENDEES, NOTES, NOTES_SUMMARY, NOTES_ADDED, CREATED_BY, CREATED_AT, UPDATED_AT
            FROM TEMP.JUSDAVIS.BKMNG_MANUAL_MEETINGS
            WHERE MEETING_ID = %s
            """,
            (meeting_id,),
        )
        return [
            ManualMeeting(
                meeting_id=r["MEETING_ID"],
                account_id=r["ACCOUNT_ID"],
                account_name=r.get("ACCOUNT_NAME"),
                title=r["TITLE"],
                meeting_date=r["MEETING_DATE"],
                attendees=r.get("ATTENDEES"),
                notes=r.get("NOTES"),
                notes_summary=r.get("NOTES_SUMMARY"),
                notes_added=bool(r.get("NOTES_ADDED")),
                created_by=r["CREATED_BY"],
                created_at=r["CREATED_AT"],
                updated_at=r["UPDATED_AT"],
            )
            for r in cur.fetchall()
        ]

    def set_meeting_notes_summary(self, meeting_id: str, summary: str) -> None:
        cur = self._cursor()
        cur.execute(
            "UPDATE TEMP.JUSDAVIS.BKMNG_MANUAL_MEETINGS SET NOTES_SUMMARY = %s WHERE MEETING_ID = %s",
            (summary, meeting_id),
        )

    def generate_and_store_meeting_summary(self, meeting_id: str, title: str, notes: str) -> None:
        prompt = (
            f"You are a sales engineer assistant. Write a short summary (2-4 sentences, no bullet points) "
            f"of the following meeting notes. Cover what was discussed, any key decisions, and next steps. "
            f"Be concise and professional. Do not use headers or lists.\n\n"
            f"Meeting: {title}\n\nNotes:\n{notes[:3000]}"
        )
        cur = self._cursor()
        try:
            cur.execute(
                "SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-8b', %s) AS SUMMARY",
                (prompt,),
            )
            row = cur.fetchone()
            summary = (row.get("SUMMARY") or "").strip() if row else ""
            if summary:
                self.set_meeting_notes_summary(meeting_id, summary[:4000])
        except Exception as e:
            logger.error("Meeting summary failed for %s: %s", meeting_id, e)

    def add_timeline_context(
        self,
        account_id: str,
        account_name: Optional[str],
        classification: str,
        content: str,
        title: Optional[str],
        context_date: Optional[str],
        created_by: str,
    ) -> dict:
        cache_invalidate_prefix(f"timeline:{account_id}")
        cache_invalidate_prefix(f"account_context:{account_id}")
        cache_invalidate_prefix("bkmng_ctx:")
        import uuid as _uuid
        from datetime import date as _date
        meeting_id = str(_uuid.uuid4())
        label_map = {
            "meeting_notes": "Meeting Notes",
            "transcript": "Transcript",
            "email": "Email",
            "notes": "Notes",
            "other": "Other",
        }
        if not title or not title.strip():
            d = context_date or _date.today().isoformat()
            title = f"{label_map.get(classification, 'Notes')} — {d}"
        effective_date = context_date or _date.today().isoformat()
        cur = self._cursor()
        cur.execute(
            """
            INSERT INTO TEMP.JUSDAVIS.BKMNG_MANUAL_MEETINGS
                (MEETING_ID, ACCOUNT_ID, ACCOUNT_NAME, TITLE, MEETING_DATE,
                 NOTES, NOTES_ADDED, CREATED_BY, SOURCE_TYPE, CREATED_AT)
            VALUES (%s, %s, %s, %s, %s, %s, TRUE, %s, %s, CURRENT_TIMESTAMP())
            """,
            (meeting_id, account_id, account_name, title.strip(),
             effective_date, content, created_by, classification),
        )
        return {"meeting_id": meeting_id, "status": "created"}

    def summarize_timeline_context(
        self,
        meeting_id: str,
        account_id: str,
        account_name: Optional[str],
        content: str,
        classification: str,
        created_by: str,
        auto_title: bool = True,
    ) -> None:
        cache_invalidate_prefix("bkmng_ctx:")
        type_labels = {
            "meeting_notes": "meeting notes",
            "transcript": "meeting transcript",
            "email": "email correspondence",
            "notes": "observations/notes",
            "other": "general context",
        }
        type_label = type_labels.get(classification, "notes")
        prompt = (
            f"You are a sales engineer assistant. Analyze the following {type_label} and respond with ONLY valid JSON:\n"
            f'{{"title": "a concise subject line (under 10 words) that captures the main topic",\n'
            f' "summary": "a 2-4 sentence summary capturing key points, decisions, and action items. '
            f'Be professional and concise. No bullet points, headers, or lists."}}\n\n'
            f"Content:\n{content[:6000]}"
        )
        cur = self._cursor()
        summary = ""
        extracted_title = ""
        try:
            cur.execute(
                "SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-8b', %s) AS SUMMARY",
                (prompt,),
            )
            row = cur.fetchone()
            raw = (row.get("SUMMARY") or "").strip() if row else ""
            try:
                json_match = re.search(r'\{.*\}', raw, re.DOTALL)
                parsed_resp = json.loads(json_match.group()) if json_match else {}
                summary = parsed_resp.get("summary", raw)
                extracted_title = parsed_resp.get("title", "")
            except Exception:
                summary = raw
                extracted_title = ""
            if summary:
                self.set_meeting_notes_summary(meeting_id, summary[:4000])
            if auto_title and extracted_title:
                cur.execute(
                    "UPDATE TEMP.JUSDAVIS.BKMNG_MANUAL_MEETINGS SET TITLE = %s WHERE MEETING_ID = %s",
                    (extracted_title.strip()[:200], meeting_id),
                )
        except Exception as e:
            logger.error("Timeline context summary failed for %s: %s", meeting_id, e)

        v2_source_map = {
            "meeting_notes": "meeting_note",
            "transcript": "meeting_note",
            "email": "email",
            "notes": "note",
            "other": "note",
        }
        v2_source = v2_source_map.get(classification, "note")
        try:
            cur.execute(
                """
                INSERT INTO TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2
                    (ACCOUNT_ID, ACCOUNT_NAME, RAW_CONTENT, SOURCE_TYPE,
                     PARSED_SUMMARY, CREATED_BY, IS_ACTIVE, PARSE_STATUS)
                VALUES (%s, %s, %s, %s, %s, %s, TRUE, 'pending')
                """,
                (account_id, account_name, content, v2_source,
                 summary[:500] if summary else None, created_by),
            )
            cur.execute(
                """
                SELECT MAX(CONTEXT_ID) AS CTX_ID
                FROM TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2
                WHERE ACCOUNT_ID = %s AND CREATED_BY = %s AND PARSE_STATUS = 'pending'
                """,
                (account_id, created_by),
            )
            row = cur.fetchone()
            context_id = row["CTX_ID"] if row else None

            if context_id:
                parsed = self._parse_context_with_llm(cur, content)
                if parsed:
                    cur.execute(
                        """
                        UPDATE TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2
                        SET PARSED_SUMMARY = COALESCE(%s, PARSED_SUMMARY),
                            SENTIMENT = %s,
                            PEOPLE_MENTIONED = %s,
                            TOPICS_DISCUSSED = %s,
                            COMPETITORS_MENTIONED = %s,
                            ACTION_ITEMS = %s,
                            RISKS_IDENTIFIED = %s,
                            OPPORTUNITIES_IDENTIFIED = %s,
                            BLOCKERS_MENTIONED = %s,
                            PARSE_STATUS = 'parsed'
                        WHERE CONTEXT_ID = %s
                        """,
                        (
                            parsed.get("summary"),
                            parsed.get("sentiment"),
                            json.dumps(parsed.get("people_mentioned")) if parsed.get("people_mentioned") else None,
                            json.dumps(parsed.get("topics_discussed")) if parsed.get("topics_discussed") else None,
                            json.dumps(parsed.get("competitors_mentioned")) if parsed.get("competitors_mentioned") else None,
                            json.dumps(parsed.get("action_items")) if parsed.get("action_items") else None,
                            json.dumps(parsed.get("risks")) if parsed.get("risks") else None,
                            json.dumps(parsed.get("opportunities")) if parsed.get("opportunities") else None,
                            json.dumps(parsed.get("blockers")) if parsed.get("blockers") else None,
                            context_id,
                        ),
                    )
                else:
                    cur.execute(
                        "UPDATE TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2 SET PARSE_STATUS = 'parsed' WHERE CONTEXT_ID = %s",
                        (context_id,),
                    )
        except Exception as e:
            logger.error("Timeline context V2 sync failed for %s: %s", meeting_id, e)

        try:
            self.generate_meeting_prep(
                account_id, account_name or account_id, created_by
            )
            logger.info("Background meeting prep regen completed for account %s", account_id)
        except Exception as e:
            logger.error("Background meeting prep regen failed for %s: %s", account_id, e)

    def delete_timeline_context(self, entry_id: str, user_email: str) -> bool:
        cur = self._cursor()
        cur.execute(
            "SELECT ACCOUNT_ID, NOTES FROM TEMP.JUSDAVIS.BKMNG_MANUAL_MEETINGS WHERE MEETING_ID = %s AND CREATED_BY = %s",
            (entry_id, user_email),
        )
        row = cur.fetchone()
        if not row:
            return False
        account_id = row.get("ACCOUNT_ID")
        raw_content = row.get("NOTES")
        cur.execute(
            "DELETE FROM TEMP.JUSDAVIS.BKMNG_MANUAL_MEETINGS WHERE MEETING_ID = %s AND CREATED_BY = %s",
            (entry_id, user_email),
        )
        if cur.rowcount == 0:
            return False
        if raw_content and account_id:
            cache_invalidate_prefix(f"timeline:{account_id}")
            cache_invalidate_prefix(f"account_context:{account_id}")
            cache_invalidate_prefix("bkmng_ctx:")
            try:
                cur.execute(
                    """
                    UPDATE TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2
                    SET IS_ACTIVE = FALSE
                    WHERE ACCOUNT_ID = %s
                    AND CREATED_BY = %s
                    AND LEFT(RAW_CONTENT, 200) = LEFT(%s, 200)
                    AND IS_ACTIVE = TRUE
                    """,
                    (account_id, user_email, raw_content),
                )
            except Exception:
                pass
        return True

    def get_account_contacts(self, account_id: str) -> list[dict]:
        cur = self._cursor()
        cur.execute(
            """
            SELECT
                f.value::STRING AS EMAIL,
                COUNT(*) AS INTERACTION_COUNT,
                MAX(i.INTERACTION_DATE)::DATE AS LAST_SEEN
            FROM TEMP.JUSDAVIS.BKMNG_ONT_INTERACTIONS i,
                 LATERAL FLATTEN(INPUT => SPLIT(i.PARTICIPANT_EMAILS, ', ')) f
            WHERE i.ACCOUNT_ID = %s
              AND TRIM(f.value::STRING) NOT LIKE 'redacted@example.com'
              AND TRIM(f.value::STRING) LIKE '%%@%%'
            GROUP BY 1
            ORDER BY INTERACTION_COUNT DESC, LAST_SEEN DESC
            LIMIT 10
            """,
            (account_id,),
        )
        return [
            {
                "email": row["EMAIL"].strip(),
                "interaction_count": row["INTERACTION_COUNT"],
                "last_seen": str(row["LAST_SEEN"]) if row["LAST_SEEN"] else None,
            }
            for row in cur.fetchall()
        ]

    def list_tracked_accounts(self, user_email: str) -> list[dict]:
        cur = self._cursor()
        cur.execute(
            """
            SELECT
                t.ACCOUNT_ID, t.TRACKING_STATUS, t.NOTES, t.UPDATED_AT,
                COALESCE(a.ACCOUNT_NAME, t.ACCOUNT_NAME) AS ACCOUNT_NAME,
                a.INDUSTRY, a.REGION, a.ACE_ASSIGNED,
                a.ENGAGEMENT_STATUS, a.STATUS, a.ACV, a.CONSUMPTION_YTD,
                a.TOTAL_CREDITS_ALLOCATED, a.ACTIVATION_START_DATE
            FROM BKMNG_USER_ACCOUNT_TRACKING t
            LEFT JOIN BKMNG_ACCOUNTS a ON a.ACCOUNT_ID = t.ACCOUNT_ID
            WHERE t.USER_EMAIL = %s
            ORDER BY t.UPDATED_AT DESC
            """,
            (user_email,),
        )
        results = []
        for row in cur.fetchall():
            acc_dict = {
                "account_id": row["ACCOUNT_ID"],
                "account_name": row["ACCOUNT_NAME"] or "",
                "industry": row.get("INDUSTRY"),
                "region": row.get("REGION"),
                "ace_assigned": row.get("ACE_ASSIGNED") or "",
                "engagement_status": row.get("ENGAGEMENT_STATUS") or "Normal",
                "status": row.get("STATUS") or "Active",
                "use_case_count": 0,
                "total_credits_allocated": float(row["TOTAL_CREDITS_ALLOCATED"]) if row.get("TOTAL_CREDITS_ALLOCATED") else None,
                "activation_start_date": _d(row.get("ACTIVATION_START_DATE")),
                "acv": float(row["ACV"]) if row.get("ACV") else None,
                "consumption_ytd": float(row["CONSUMPTION_YTD"]) if row.get("CONSUMPTION_YTD") else None,
                "tracking_status": row["TRACKING_STATUS"],
                "tracking_notes": row.get("NOTES"),
                "tracking_updated_at": str(row["UPDATED_AT"]) if row.get("UPDATED_AT") else None,
            }
            results.append(acc_dict)
        return results

    def get_bookmanager_context(
        self,
        user_email: str,
        ace_filter: Optional[str] = None,
        acem_filter: Optional[str] = None,
        account_id: Optional[str] = None,
    ) -> str:
        cache_key = f"bkmng_ctx:{user_email}:{account_id or ''}:{ace_filter or ''}:{acem_filter or ''}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        cur = self._cursor()

        scope_where = ""
        scope_params: list = []
        if ace_filter:
            scope_where = "WHERE a.ACE_ASSIGNED = %s"
            scope_params = [ace_filter]
        elif acem_filter:
            scope_where = "WHERE a.ACE_ASSIGNED IN (SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s)"
            scope_params = [acem_filter]

        cur.execute(
            f"""
            SELECT COUNT(*) AS total,
                   COUNT_IF(MOMENTUM = 'accelerating') AS accelerating,
                   COUNT_IF(MOMENTUM = 'steady') AS steady,
                   COUNT_IF(MOMENTUM = 'decelerating') AS decelerating,
                   COUNT_IF(MOMENTUM = 'stalled') AS stalled
            FROM BKMNG_ONT_ACCOUNTS a {scope_where}
            """,
            scope_params,
        )
        ar = cur.fetchone() or {}
        total_accts = ar.get("TOTAL", 0) or 0
        accel = ar.get("ACCELERATING", 0) or 0
        steady = ar.get("STEADY", 0) or 0
        decel = ar.get("DECELERATING", 0) or 0
        stalled = ar.get("STALLED", 0) or 0

        cur.execute(
            f"""
            SELECT COUNT_IF(ADOPTION_SIGNAL_COUNT > 0) AS with_data,
                   ROUND(AVG(CASE WHEN ADOPTION_SIGNAL_COUNT > 0 THEN ADOPTION_SIGNAL_COUNT END), 1) AS avg_categories,
                   SUM(SIG_PIPELINE) AS pipeline_cnt,
                   SUM(SIG_AIML) AS aiml_cnt,
                   SUM(SIG_SPCS) AS spcs_cnt
            FROM BKMNG_ONT_ACCOUNTS a {scope_where}
            """,
            scope_params,
        )
        adopt_r = cur.fetchone() or {}
        adopt_with_data = adopt_r.get("WITH_DATA", 0) or 0
        adopt_avg = adopt_r.get("AVG_CATEGORIES", 0) or 0
        adopt_pipeline = adopt_r.get("PIPELINE_CNT", 0) or 0
        adopt_aiml = adopt_r.get("AIML_CNT", 0) or 0
        adopt_spcs = adopt_r.get("SPCS_CNT", 0) or 0

        contract_scope_where = scope_where.replace("a.ACE_ASSIGNED", "ba.ACE_ASSIGNED")
        cur.execute(
            f"""
            SELECT COUNT(*) AS with_contract,
                   COUNT_IF(c.DAYS_UNTIL_CONTRACT_END <= 120 AND c.DAYS_UNTIL_CONTRACT_END > 0) AS expiring_120d,
                   COUNT_IF(c.DAYS_UNTIL_CONTRACT_END <= 60 AND c.DAYS_UNTIL_CONTRACT_END > 0) AS expiring_60d,
                   COUNT_IF(c.PREDICTED_OVERAGE_DATE IS NOT NULL) AS at_overage_risk,
                   ROUND(SUM(c.NET_ACV)/1000000, 1) AS total_acv_m
            FROM TEMP.JUSDAVIS.BKMNG_A360_CONTRACT c
            JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS ba ON ba.ACCOUNT_ID = c.ACCOUNT_ID
            {contract_scope_where}
            """,
            scope_params,
        )
        cr = cur.fetchone() or {}
        contract_with = cr.get("WITH_CONTRACT", 0) or 0
        contract_expiring_120d = cr.get("EXPIRING_120D", 0) or 0
        contract_expiring_60d = cr.get("EXPIRING_60D", 0) or 0
        contract_overage_risk = cr.get("AT_OVERAGE_RISK", 0) or 0
        total_acv_m = cr.get("TOTAL_ACV_M") or 0

        cur.execute(
            f"""
            SELECT COUNT(*) AS total_ucs,
                   COUNT_IF(uc.STATUS = 'Implementation') AS in_impl,
                   COUNT_IF(uc.STATUS = 'In Pursuit') AS in_pursuit,
                   COUNT_IF(COALESCE(uc.GO_LIVE_DATE, uc.TARGET_GO_LIVE_DATE)
                            BETWEEN CURRENT_DATE() AND DATEADD('day', 30, CURRENT_DATE())) AS upcoming_gl_30d
            FROM BKMNG_ONT_USE_CASES uc
            JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = uc.ACCOUNT_ID
            {scope_where}
            """,
            scope_params,
        )
        ur = cur.fetchone() or {}
        total_ucs = ur.get("TOTAL_UCS", 0) or 0
        in_impl = ur.get("IN_IMPL", 0) or 0
        in_pursuit = ur.get("IN_PURSUIT", 0) or 0
        upcoming_gl = ur.get("UPCOMING_GL_30D", 0) or 0

        from app.signals import get_registry
        from app.signals.models import SignalScope as SigScope
        _sig_scope = SigScope(
            user_email=user_email,
            ace_filter=ace_filter,
            acem_filter=acem_filter,
            account_id=account_id,
        )
        signal_section = get_registry().get_ai_context(cur, _sig_scope, limit=6)

        note_params: list = [user_email]
        note_where = "WHERE (uc.CREATED_BY = %s OR uc.CREATED_BY IS NULL) AND uc.IS_ACTIVE = TRUE AND uc.PARSE_STATUS != 'error'"
        if account_id:
            note_where += " AND (uc.ACCOUNT_ID = %s OR uc.ACCOUNT_ID IS NULL)"
            note_params.append(account_id)

        cur.execute(
            f"""
            SELECT uc.ACCOUNT_NAME, uc.SOURCE_TYPE, uc.RAW_CONTENT,
                   uc.PARSED_SUMMARY, uc.TOPICS_DISCUSSED, uc.ACTION_ITEMS,
                   uc.CREATED_AT::DATE AS note_date
            FROM BKMNG_USER_CONTEXT_V2 uc
            {note_where}
            ORDER BY uc.CREATED_AT DESC
            LIMIT 10
            """,
            note_params,
        )
        notes = cur.fetchall()
        notes_section = ""
        if notes:
            note_lines = []
            for r in notes:
                summary = r.get("PARSED_SUMMARY") or str(r.get("RAW_CONTENT", ""))
                topics = r.get("TOPICS_DISCUSSED") or ""
                actions = r.get("ACTION_ITEMS") or ""
                line = f"  - [{r.get('NOTE_DATE')}, {r.get('SOURCE_TYPE', 'manual')}] {str(summary)[:300]}"
                if topics:
                    line += f" | Topics: {str(topics)[:100]}"
                if actions:
                    line += f" | Actions: {str(actions)[:100]}"
                note_lines.append(line)
            notes_section = "\nACCOUNT NOTES & CONTEXT:\n" + "\n".join(note_lines) + "\n"

        account_section = ""
        if account_id:
            cur.execute(
                """
                SELECT ACCOUNT_NAME, INDUSTRY, REGION, ENGAGEMENT_STATUS, STATUS,
                       HEALTH_SCORE, MOMENTUM, CONTRACT_UTILIZATION_PCT,
                       TOTAL_CONSUMED_CREDITS, CONTRACT_CAPACITY, CAPACITY_REMAINING,
                       PREDICTED_OVERAGE_DATE, WOW_PCT_CHANGE, MOM_PCT_CHANGE,
                       TOTAL_GONG_CALLS_90D, LAST_EXTERNAL_INTERACTION_DATE,
                       DAYS_SINCE_LAST_INTERACTION, ACTIVE_USE_CASE_COUNT,
                       IMPL_USE_CASE_COUNT, AVG_MEDDPICC_SCORE, ACV
                FROM BKMNG_ONT_ACCOUNTS
                WHERE ACCOUNT_ID = %s
                """,
                (account_id,),
            )
            row = cur.fetchone()
            if row:
                util = row.get("CONTRACT_UTILIZATION_PCT")
                util_str = f"{util:.0f}% utilized" if util is not None else "no contract data"
                wow = row.get("WOW_PCT_CHANGE")
                wow_str = f"WoW: {wow:+.1f}%  " if wow is not None else ""
                mom = row.get("MOM_PCT_CHANGE")
                mom_str = f"MoM: {mom:+.1f}%  " if mom is not None else ""
                overage = row.get("PREDICTED_OVERAGE_DATE")
                overage_str = f"Overage predicted: {overage}" if overage else ""

                account_section = (
                    f"\n--- CURRENT ACCOUNT: {row['ACCOUNT_NAME']} ---\n"
                    f"Industry: {row.get('INDUSTRY') or 'N/A'}  |  Region: {row.get('REGION') or 'N/A'}  "
                    f"|  Momentum: {row.get('MOMENTUM') or 'N/A'}  |  Health: {row.get('HEALTH_SCORE') or 'N/A'}/100\n"
                    f"CONTRACT & CONSUMPTION:\n"
                    f"  Credits: {row.get('TOTAL_CONSUMED_CREDITS') or 'N/A'} / "
                    f"{row.get('CONTRACT_CAPACITY') or 'N/A'} ({util_str})\n"
                    f"  {wow_str}{mom_str}{overage_str}\n"
                )

                cur.execute(
                    """
                    SELECT NAME, TITLE, ROLE_ON_ACCOUNT, IS_CHAMPION,
                           LAST_GONG_CALL_DATE, DAYS_SINCE_LAST_CALL, GONG_CALL_COUNT_90D
                    FROM BKMNG_ONT_CONTACTS
                    WHERE ACCOUNT_ID = %s AND IS_CHAMPION = TRUE
                    ORDER BY GONG_CALL_COUNT_90D DESC,
                             COALESCE(DAYS_SINCE_LAST_CALL, 9999) ASC
                    LIMIT 4
                    """,
                    (account_id,),
                )
                contacts = cur.fetchall()
                if contacts:
                    account_section += "KEY CONTACTS:\n"
                    for c in contacts:
                        last_str = (
                            f"last call: {c.get('LAST_GONG_CALL_DATE') or 'never'} "
                            f"({c.get('DAYS_SINCE_LAST_CALL') or 'N/A'}d ago)"
                        )
                        account_section += (
                            f"  - {c.get('NAME')} ({c.get('TITLE') or 'N/A'}, "
                            f"{c.get('ROLE_ON_ACCOUNT') or 'champion'}) — "
                            f"{last_str}, {c.get('GONG_CALL_COUNT_90D', 0)} calls in 90d\n"
                        )

                cur.execute(
                    """
                    SELECT TOPIC, MENTION_COUNT_90D
                    FROM BKMNG_ONT_ACCOUNT_TOPICS
                    WHERE ACCOUNT_ID = %s
                    ORDER BY MENTION_COUNT_90D DESC
                    LIMIT 6
                    """,
                    (account_id,),
                )
                topics = cur.fetchall()
                if topics:
                    topic_strs = [f"{t.get('TOPIC')} ({t.get('MENTION_COUNT_90D')}x)" for t in topics]
                    account_section += f"RECENT TOPICS: {', '.join(topic_strs)}\n"

                cur.execute(
                    """
                    SELECT COMPETITOR_NAME, MENTION_COUNT_90D, LAST_MENTIONED_DATE
                    FROM BKMNG_ONT_ACCOUNT_COMPETITORS
                    WHERE ACCOUNT_ID = %s
                      AND LOWER(COMPETITOR_NAME) NOT LIKE '%smart%'
                      AND LOWER(COMPETITOR_NAME) NOT LIKE '%meddp%'
                    ORDER BY MENTION_COUNT_90D DESC
                    LIMIT 4
                    """,
                    (account_id,),
                )
                comps = cur.fetchall()
                if comps:
                    comp_strs = [
                        f"{c.get('COMPETITOR_NAME')} ({c.get('MENTION_COUNT_90D')}x, last {c.get('LAST_MENTIONED_DATE')})"
                        for c in comps
                    ]
                    account_section += f"COMPETITORS MENTIONED: {', '.join(comp_strs)}\n"

                cur.execute(
                    """
                    SELECT INTERACTION_DATE::DATE AS idate, TITLE,
                           LEFT(SUMMARY, 150) AS summary_excerpt, TOPICS
                    FROM BKMNG_ONT_INTERACTIONS
                    WHERE ACCOUNT_ID = %s
                    ORDER BY INTERACTION_DATE DESC
                    LIMIT 3
                    """,
                    (account_id,),
                )
                interactions = cur.fetchall()
                if interactions:
                    account_section += "LAST 3 INTERACTIONS:\n"
                    for itx in interactions:
                        topics_str = (
                            f" Topics: {itx.get('TOPICS')}" if itx.get("TOPICS") else ""
                        )
                        account_section += (
                            f"  - {itx.get('IDATE')}: \"{itx.get('TITLE') or 'untitled'}\""
                            f"{topics_str}\n"
                            f"    {itx.get('SUMMARY_EXCERPT') or 'No summary'}\n"
                        )

                cur.execute(
                    """
                    SELECT PRIORITY, SIGNAL_TEXT, LEFT(CONTEXT, 100) AS CONTEXT
                    FROM BKMNG_ONT_ACCOUNT_SIGNALS
                    WHERE ACCOUNT_ID = %s
                    ORDER BY CASE PRIORITY WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
                    LIMIT 4
                    """,
                    (account_id,),
                )
                acct_signals = cur.fetchall()
                if acct_signals:
                    account_section += "ACTIVE SIGNALS:\n"
                    for s in acct_signals:
                        account_section += f"  - [{(s.get('PRIORITY') or 'medium').upper()}] {s.get('SIGNAL_TEXT', '')}\n"

                cur.execute(
                    """
                    SELECT ADOPTION_SIGNAL_COUNT AS SIGNAL_COUNT,
                           SIG_PIPELINE, SIG_TRANSFORMS, SIG_BI, SIG_COST,
                           SIG_COLLAB, SIG_OBS, SIG_AIML, SIG_SPCS
                    FROM BKMNG_ONT_ACCOUNTS
                    WHERE ACCOUNT_ID = %s
                    """,
                    (account_id,),
                )
                adoption = cur.fetchone()
                if adoption and adoption.get("SIGNAL_COUNT"):
                    sig_count = adoption.get("SIGNAL_COUNT", 0) or 0
                    active_cats = [
                        cat for cat, col in [
                            ("Pipeline", "SIG_PIPELINE"), ("Transforms", "SIG_TRANSFORMS"),
                            ("Analytics", "SIG_BI"), ("Cost", "SIG_COST"),
                            ("Collab", "SIG_COLLAB"), ("Observability", "SIG_OBS"),
                            ("AI/ML", "SIG_AIML"), ("Transactions", "SIG_SPCS"),
                        ] if adoption.get(col)
                    ]
                    account_section += f"PLATFORM ADOPTION ({sig_count}/8 categories):\n"
                    account_section += f"  Active: {', '.join(active_cats) or 'none'}\n"
                    cur.execute(
                        """
                        SELECT FEATURE AS FEATURE_NAME, PRODUCT_CATEGORY AS CATEGORY, FIRST_USE_DATE
                        FROM BKMNG_A360_PRODUCT_ADOPTION
                        WHERE ACCOUNT_ID = %s AND IS_NEW_30D = TRUE
                        ORDER BY FIRST_USE_DATE DESC
                        """,
                        (account_id,),
                    )
                    new_features = cur.fetchall()
                    if new_features:
                        account_section += "  Recent feature adoptions (30d):\n"
                        for f in new_features:
                            account_section += f"  - {f.get('FEATURE_NAME')} [{f.get('CATEGORY')}] first used: {f.get('FIRST_USE_DATE')}\n"

                cur.execute(
                    """
                    SELECT USE_CASE_NAME, STATUS, STAGE, MEDDPICC_OVERALL_SCORE,
                           STAGE_VELOCITY, COALESCE(GO_LIVE_DATE, TARGET_GO_LIVE_DATE) AS gl_date,
                           DAYS_IN_CURRENT_STAGE, PRIMARY_CONTACT_NAME, LEAD_SE
                    FROM BKMNG_ONT_USE_CASES
                    WHERE ACCOUNT_ID = %s
                      AND STATUS IN ('In Pursuit', 'Implementation')
                    ORDER BY LAST_MODIFIED_DATE DESC
                    LIMIT 8
                    """,
                    (account_id,),
                )
                ucs = cur.fetchall()
                if ucs:
                    account_section += f"USE CASES ({len(ucs)} active):\n"
                    for u in ucs:
                        score = (
                            f" MEDDPICC:{u.get('MEDDPICC_OVERALL_SCORE'):.0f}"
                            if u.get("MEDDPICC_OVERALL_SCORE") is not None
                            else ""
                        )
                        gl = f" GL:{u.get('GL_DATE')}" if u.get("GL_DATE") else ""
                        vel = f" ({u.get('STAGE_VELOCITY') or 'normal'})"
                        contact = (
                            f" Champion:{u.get('PRIMARY_CONTACT_NAME')}"
                            if u.get("PRIMARY_CONTACT_NAME")
                            else ""
                        )
                        account_section += (
                            f"  - {u.get('USE_CASE_NAME')} "
                            f"[{u.get('STATUS')}/{u.get('STAGE')}]{score}{gl}{vel}{contact}\n"
                        )

                # Contract spend + short-window revenue
                try:
                    cur.execute(
                        """
                        SELECT CONTRACT_SPEND, REV_30D, NET_ACV,
                               CONTRACT_START_DATE, CONTRACT_END_DATE,
                               DAYS_UNTIL_CONTRACT_END
                        FROM BKMNG_A360_CONTRACT
                        WHERE ACCOUNT_ID = %s
                        LIMIT 1
                        """,
                        (account_id,),
                    )
                    cr2 = cur.fetchone()
                    if cr2:
                        spend = cr2.get("CONTRACT_SPEND")
                        rev30 = cr2.get("REV_30D")
                        acv = cr2.get("NET_ACV")
                        d_end = cr2.get("DAYS_UNTIL_CONTRACT_END")
                        pieces = []
                        if spend is not None:
                            pieces.append(f"Contract spend to-date: ${float(spend):,.0f}")
                        if acv is not None:
                            pieces.append(f"NET ACV: ${float(acv):,.0f}")
                        if rev30 is not None:
                            pieces.append(f"Rev 30d: ${float(rev30):,.0f}")
                        if d_end is not None:
                            pieces.append(f"Days to renewal: {d_end}")
                        if pieces:
                            account_section += "CONTRACT SPEND: " + " | ".join(pieces) + "\n"
                except Exception:
                    pass

                # Latest AI account assessment
                try:
                    cur.execute(
                        """
                        SELECT AI_TIER, PRIORITY_TIER, RISK_LEVEL, RATIONALE,
                               RECOMMENDED_ACTIONS, COMPUTED_AT::DATE AS computed_date
                        FROM BKMNG_AI_ACCOUNT_ASSESSMENTS
                        WHERE ACCOUNT_ID = %s
                        ORDER BY COMPUTED_AT DESC LIMIT 1
                        """,
                        (account_id,),
                    )
                    aa = cur.fetchone()
                    if aa:
                        account_section += (
                            f"AI ASSESSMENT ({aa.get('COMPUTED_DATE')}): "
                            f"Tier={aa.get('AI_TIER') or 'N/A'}  Priority={aa.get('PRIORITY_TIER') or 'N/A'}  "
                            f"Risk={aa.get('RISK_LEVEL') or 'N/A'}\n"
                        )
                        if aa.get('RATIONALE'):
                            account_section += f"  Rationale: {str(aa.get('RATIONALE'))[:400]}\n"
                        if aa.get('RECOMMENDED_ACTIONS'):
                            account_section += f"  Actions: {str(aa.get('RECOMMENDED_ACTIONS'))[:400]}\n"
                except Exception:
                    pass

                # Top composite patterns for this account (fresh only)
                try:
                    cur.execute(
                        """
                        SELECT PATTERN_NAME, CATEGORY, SEVERITY, DESCRIPTION, RECOMMENDED_ACTION
                        FROM BKMNG_COMPOSITE_PATTERNS
                        WHERE ACCOUNT_ID = %s
                        ORDER BY CASE SEVERITY WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
                        LIMIT 3
                        """,
                        (account_id,),
                    )
                    patterns = cur.fetchall()
                    if patterns:
                        account_section += "COMPOSITE PATTERNS:\n"
                        for p in patterns:
                            account_section += (
                                f"  - [{(p.get('SEVERITY') or 'medium').upper()}] "
                                f"{p.get('PATTERN_NAME')} ({p.get('CATEGORY')}): "
                                f"{str(p.get('DESCRIPTION') or '')[:200]}\n"
                            )
                            if p.get('RECOMMENDED_ACTION'):
                                account_section += f"    Action: {str(p.get('RECOMMENDED_ACTION'))[:200]}\n"
                except Exception:
                    pass

                # Active (non-muted) alerts for this user on this account
                try:
                    cur.execute(
                        """
                        SELECT a.SIGNAL_TYPE, a.PRIORITY, a.SIGNAL_TEXT, a.ALERT_DATE::DATE AS adate
                        FROM BKMNG_USER_ALERTS a
                        LEFT JOIN BKMNG_ALERT_MUTES m
                          ON m.USER_EMAIL = a.USER_EMAIL
                         AND (m.SIGNAL_ID = a.SIGNAL_ID OR (m.SIGNAL_TYPE = a.SIGNAL_TYPE AND m.SIGNAL_ID IS NULL))
                         AND m.MUTED_UNTIL > CURRENT_TIMESTAMP()
                        WHERE a.ACCOUNT_ID = %s AND a.USER_EMAIL = %s
                          AND m.MUTE_ID IS NULL
                        ORDER BY CASE a.PRIORITY WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                                 a.ALERT_DATE DESC
                        LIMIT 5
                        """,
                        (account_id, user_email),
                    )
                    alerts = cur.fetchall()
                    if alerts:
                        account_section += "ACTIVE ALERTS:\n"
                        for al in alerts:
                            account_section += (
                                f"  - [{(al.get('PRIORITY') or 'medium').upper()}] "
                                f"{al.get('SIGNAL_TYPE')} ({al.get('ADATE')}): "
                                f"{str(al.get('SIGNAL_TEXT') or '')[:200]}\n"
                            )
                except Exception:
                    pass

                # Upcoming meetings (14 days)
                try:
                    cur.execute(
                        """
                        SELECT MEETING_DATE::DATE AS mdate, TITLE, ATTENDEES
                        FROM BKMNG_MEETING_ACTIVITY
                        WHERE ACCOUNT_ID = %s
                          AND MEETING_DATE >= CURRENT_DATE()
                          AND MEETING_DATE <= DATEADD('day', 14, CURRENT_DATE())
                        ORDER BY MEETING_DATE ASC
                        LIMIT 5
                        """,
                        (account_id,),
                    )
                    upcoming = cur.fetchall()
                    if upcoming:
                        account_section += "UPCOMING MEETINGS (14d):\n"
                        for um in upcoming:
                            att = str(um.get('ATTENDEES') or '')[:120]
                            account_section += (
                                f"  - {um.get('MDATE')}: \"{um.get('TITLE') or 'untitled'}\""
                                f"{(' | ' + att) if att else ''}\n"
                            )
                except Exception:
                    pass

                # Latest briefing (<=24h)
                try:
                    cur.execute(
                        """
                        SELECT SITUATION_SUMMARY, TOP_RISK, TOP_OPPORTUNITY,
                               RECOMMENDED_ACTIONS, GENERATED_AT
                        FROM BKMNG_ACCOUNT_BRIEFINGS
                        WHERE ACCOUNT_ID = %s
                          AND GENERATED_AT >= DATEADD('hour', -24, CURRENT_TIMESTAMP())
                        ORDER BY GENERATED_AT DESC LIMIT 1
                        """,
                        (account_id,),
                    )
                    br = cur.fetchone()
                    if br:
                        account_section += "LATEST BRIEFING (fresh):\n"
                        if br.get('SITUATION_SUMMARY'):
                            account_section += f"  Situation: {str(br.get('SITUATION_SUMMARY'))[:400]}\n"
                        if br.get('TOP_RISK'):
                            account_section += f"  Top risk: {str(br.get('TOP_RISK'))[:300]}\n"
                        if br.get('TOP_OPPORTUNITY'):
                            account_section += f"  Top opportunity: {str(br.get('TOP_OPPORTUNITY'))[:300]}\n"
                        if br.get('RECOMMENDED_ACTIONS'):
                            account_section += f"  Actions: {str(br.get('RECOMMENDED_ACTIONS'))[:400]}\n"
                except Exception:
                    pass

                # Latest meeting prep (<=24h)
                try:
                    cur.execute(
                        """
                        SELECT SUGGESTED_AGENDA, OPEN_ACTION_ITEMS, QUESTIONS_TO_ASK, GENERATED_AT
                        FROM BKMNG_MEETING_PREPS
                        WHERE ACCOUNT_ID = %s
                          AND GENERATED_AT >= DATEADD('hour', -24, CURRENT_TIMESTAMP())
                        ORDER BY GENERATED_AT DESC LIMIT 1
                        """,
                        (account_id,),
                    )
                    mp = cur.fetchone()
                    if mp:
                        account_section += "LATEST MEETING PREP (fresh):\n"
                        if mp.get('SUGGESTED_AGENDA'):
                            account_section += f"  Agenda: {str(mp.get('SUGGESTED_AGENDA'))[:400]}\n"
                        if mp.get('OPEN_ACTION_ITEMS'):
                            account_section += f"  Open actions: {str(mp.get('OPEN_ACTION_ITEMS'))[:300]}\n"
                        if mp.get('QUESTIONS_TO_ASK'):
                            account_section += f"  Questions: {str(mp.get('QUESTIONS_TO_ASK'))[:300]}\n"
                except Exception:
                    pass

        adopt_section = (
            f"PLATFORM ADOPTION ({adopt_with_data} accounts with signal data):\n"
            f"  Avg categories: {adopt_avg:.1f}/8  "
            f"Pipeline: {adopt_pipeline}  AI/ML: {adopt_aiml}  SPCS: {adopt_spcs}\n\n"
        ) if adopt_with_data > 0 else ""

        contract_section = (
            f"CONTRACT HEALTH ({contract_with} accounts with A360 data):\n"
            f"  Total ACV: ${total_acv_m:.1f}M  "
            f"Expiring 120d: {contract_expiring_120d}  Expiring 60d: {contract_expiring_60d}  "
            f"Overage risk: {contract_overage_risk}\n\n"
        ) if contract_with > 0 else ""

        breakdown_section = ""
        bd_params: list = []
        bd_where = "WHERE b.SPLITTABILITY_SCORE >= 6"
        if ace_filter:
            bd_where += " AND a.ACE_ASSIGNED = %s"
            bd_params = [ace_filter]
        elif acem_filter:
            bd_where += " AND a.ACE_ASSIGNED IN (SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s)"
            bd_params = [acem_filter]
        if account_id:
            bd_where += " AND b.ACCOUNT_ID = %s"
            bd_params.append(account_id)
        cur.execute(
            f"""
            SELECT b.PARENT_USE_CASE_NAME, b.ACCOUNT_NAME, b.SPLITTABILITY_SCORE,
                   b.TOTAL_SUB_USE_CASES
            FROM BKMNG_USE_CASE_BREAKDOWNS b
            JOIN BKMNG_ACCOUNTS a ON a.ACCOUNT_ID = b.ACCOUNT_ID
            {bd_where}
            GROUP BY b.PARENT_USE_CASE_NAME, b.ACCOUNT_NAME, b.SPLITTABILITY_SCORE,
                     b.TOTAL_SUB_USE_CASES
            ORDER BY b.SPLITTABILITY_SCORE DESC
            LIMIT 8
            """,
            bd_params,
        )
        bd_rows = cur.fetchall()
        if bd_rows:
            bd_lines = [
                f"  - {r.get('PARENT_USE_CASE_NAME')} ({r.get('ACCOUNT_NAME')}) "
                f"score:{r.get('SPLITTABILITY_SCORE')}, {r.get('TOTAL_SUB_USE_CASES')} sub-UCs"
                for r in bd_rows
            ]
            breakdown_section = (
                f"USE CASE SPLIT OPPORTUNITIES ({len(bd_rows)} high-score):\n"
                + "\n".join(bd_lines) + "\n"
                + "  Criteria: multi_workload, multi_technical_uc, notes_complexity, multiple_go_lives, distinct_stakeholders, name_signals\n"
                + "  Ask me to explain any breakdown or the evaluation criteria.\n\n"
            )

        context = (
            f"You are ACE, the AI assistant for BookManager (Snowflake field engineering tracker).\n"
            f"USER: {user_email}\n"
            f"SCOPE: SE-Activation accounts only. Do not invent or discuss accounts not listed below.\n\n"
            f"--- BOOK OF BUSINESS ---\n"
            f"Accounts: {total_accts}  Accelerating:{accel} Steady:{steady} Decelerating:{decel} Stalled:{stalled}\n"
            f"Use Cases: {total_ucs} ({in_impl} impl, {in_pursuit} pursuit) | Go-Lives 30d: {upcoming_gl}\n\n"
            f"{adopt_section}"
            f"{contract_section}"
            f"{breakdown_section}"
            f"{signal_section}"
            f"{account_section}"
            f"{notes_section}"
        )
        context = context.strip()
        if len(context) > 14000:
            context = context[:14000] + "\n[Context truncated]\n"
        cache_set(cache_key, context, ttl=300)
        return context

    def call_cortex_analyst(
        self,
        question: str,
        ace_filter: Optional[str] = None,
        account_id: Optional[str] = None,
    ) -> dict:
        import httpx
        from app.config import settings

        account_str = settings.snowflake_account or ""
        pat = settings.snowflake_pat or ""
        url = f"https://{account_str}.snowflakecomputing.com/api/v2/cortex/analyst/message"
        headers = {
            "Authorization": f"Bearer {pat}",
            "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
            "Content-Type": "application/json",
        }

        scoped_question = question
        if account_id:
            scoped_question = f"[Filter by account_id = '{account_id}'] {question}"
        elif ace_filter:
            scoped_question = f"[Filter by ace_assigned = '{ace_filter}'] {question}"

        payload = {
            "messages": [{"role": "user", "content": scoped_question}],
            "semantic_model_file": "@TEMP.JUSDAVIS.BKMNG_STAGE/bookmanager_assistant.yaml",
        }

        try:
            resp = httpx.post(url, headers=headers, json=payload, timeout=5)
            resp.raise_for_status()
            result = resp.json()
            sql = None
            analyst_text = ""
            for item in result.get("message", {}).get("content", []):
                if item.get("type") == "sql":
                    sql = item.get("statement", "")
                elif item.get("type") == "text":
                    analyst_text = item.get("text", "")
            if sql:
                cur = self._cursor()
                cur.execute(sql)
                rows = cur.fetchmany(30)
                data = [dict(row) for row in rows]
                return {"sql": sql, "data": data, "analyst_text": analyst_text}
        except Exception:
            pass

        return self._cortex_complete_text_to_sql(question, ace_filter, account_id)

    def _cortex_complete_text_to_sql(
        self,
        question: str,
        ace_filter: Optional[str] = None,
        account_id: Optional[str] = None,
    ) -> dict:
        schema = (
            "Tables in TEMP.JUSDAVIS:\n"
            "- BKMNG_ONT_ACCOUNTS: ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED, "
            "MOMENTUM(accelerating/steady/decelerating/stalled), HEALTH_SCORE(0-100), "
            "CONTRACT_UTILIZATION_PCT, WOW_PCT_CHANGE, MOM_PCT_CHANGE, "
            "DAYS_SINCE_LAST_INTERACTION, ACTIVE_USE_CASE_COUNT, IMPL_USE_CASE_COUNT, "
            "AVG_MEDDPICC_SCORE, ACV, CONTRACT_CAPACITY, TOTAL_CONSUMED_CREDITS, CAPACITY_REMAINING\n"
            "- BKMNG_ONT_ACCOUNT_SIGNALS: SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, "
            "SIGNAL_TYPE, PRIORITY(high/medium/low), SIGNAL_TEXT, CONTEXT, ENTITY_TYPE\n"
            "- BKMNG_ONT_USE_CASES: USE_CASE_ID, ACCOUNT_ID, USE_CASE_NAME, STATUS, STAGE, "
            "STAGE_VELOCITY(slow/normal/fast), MEDDPICC_OVERALL_SCORE, DAYS_IN_CURRENT_STAGE, "
            "GO_LIVE_DATE, TARGET_GO_LIVE_DATE, LEAD_SE, ACE_ASSIGNED, PRIMARY_CONTACT_NAME\n"
            "- BKMNG_ONT_INTERACTIONS: INTERACTION_ID, ACCOUNT_ID, ACCOUNT_NAME, TITLE, "
            "INTERACTION_DATE, DURATION_SEC, SUMMARY, TOPICS, CALL_SCORE\n"
            "- BKMNG_ONT_CONTACTS: CONTACT_ID, ACCOUNT_ID, NAME, EMAIL, TITLE, "
            "IS_CHAMPION, LAST_GONG_CALL_DATE, DAYS_SINCE_LAST_CALL, GONG_CALL_COUNT_90D\n"
            "- BKMNG_ONT_ACCOUNT_TOPICS: ACCOUNT_ID, ACCOUNT_NAME, TOPIC, MENTION_COUNT_90D, LAST_MENTIONED_DATE\n"
            "- BKMNG_ONT_OPPORTUNITIES: OPP_ID, ACCOUNT_ID, OPP_NAME, STAGE, AMOUNT, CLOSE_DATE\n"
            "- BKMNG_A360_PRODUCT_ADOPTION: ACCOUNT_ID, ACCOUNT_NAME, PRODUCT_CATEGORY, USE_CASE, FEATURE, "
            "FIRST_USE_DATE, LAST_USE_DATE, TOTAL_REVENUE_90D, DAYS_SINCE_FIRST_USE, IS_NEW_30D, IS_ACTIVE_30D\n"
            "- BKMNG_A360_CONTRACT: ACCOUNT_ID, ACCOUNT_NAME, NET_ACV, NET_TCV, CONTRACT_START_DATE, "
            "CONTRACT_END_DATE, DAYS_UNTIL_CONTRACT_END, PREDICTED_OVERAGE_DATE, REV_30D, REV_90D, REV_180D\n"
            "- BKMNG_A360_CONSUMPTION: ACCOUNT_ID, WOW_PCT_CHANGE, MOM_PCT_CHANGE, REV_90D, ACTIVE_DAYS_30D\n"
        )
        scope_clause = ""
        if account_id:
            scope_clause = f"Must include WHERE ACCOUNT_ID = '{account_id}' in the query.\n"
        elif ace_filter:
            scope_clause = f"Must include WHERE ACE_ASSIGNED = '{ace_filter}' in the query.\n"

        prompt = (
            f"You are a Snowflake SQL expert. Generate a single valid Snowflake SQL SELECT statement.\n"
            f"Return ONLY the SQL — no explanation, no markdown, no code fences.\n"
            f"Select 3-5 of the most relevant columns for the question. Prefer ACCOUNT_NAME over ACCOUNT_ID.\n\n"
            f"Schema:\n{schema}\n"
            f"{scope_clause}"
            f"Question: {question}\n"
            f"SQL:"
        )
        cur = self._cursor()
        cur.execute(
            "SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-70b', %s) AS response",
            (prompt,),
        )
        row = cur.fetchone()
        sql_raw = ((row or {}).get("RESPONSE") or "").strip()
        if "```sql" in sql_raw:
            sql_raw = sql_raw.split("```sql")[1].split("```")[0].strip()
        elif "```" in sql_raw:
            sql_raw = sql_raw.split("```")[1].split("```")[0].strip()
        if not sql_raw.upper().strip().startswith("SELECT"):
            return {"sql": None, "data": [], "analyst_text": ""}
        try:
            cur2 = self._cursor()
            cur2.execute(sql_raw + " LIMIT 30")
            rows = cur2.fetchall()
            data = [dict(row) for row in rows]
            return {"sql": sql_raw, "data": data, "analyst_text": ""}
        except Exception:
            return {"sql": None, "data": [], "analyst_text": ""}

    def get_consumption_projection(
        self,
        ace_filter: Optional[str] = None,
        acem_filter: Optional[str] = None,
    ) -> dict:
        today = date.today()

        fy_start_year = today.year if today.month >= 2 else today.year - 1
        fy_label = f"FY{fy_start_year + 1}"
        fy_start = date(fy_start_year, 2, 1)
        fy_end = date(fy_start_year + 1, 1, 31)

        quarter_defs = [
            {"key": "Q1", "label": "Q1 (Feb–Apr)", "months": [(fy_start_year, 2), (fy_start_year, 3), (fy_start_year, 4)], "start": str(date(fy_start_year, 2, 1)), "end": str(date(fy_start_year, 4, 30))},
            {"key": "Q2", "label": "Q2 (May–Jul)", "months": [(fy_start_year, 5), (fy_start_year, 6), (fy_start_year, 7)], "start": str(date(fy_start_year, 5, 1)), "end": str(date(fy_start_year, 7, 31))},
            {"key": "Q3", "label": "Q3 (Aug–Oct)", "months": [(fy_start_year, 8), (fy_start_year, 9), (fy_start_year, 10)], "start": str(date(fy_start_year, 8, 1)), "end": str(date(fy_start_year, 10, 31))},
            {"key": "Q4", "label": "Q4 (Nov–Jan)", "months": [(fy_start_year, 11), (fy_start_year, 12), (fy_start_year + 1, 1)], "start": str(date(fy_start_year, 11, 1)), "end": str(date(fy_start_year + 1, 1, 31))},
        ]
        current_q = next((q["key"] for q in quarter_defs if q["start"] <= str(today) <= q["end"]), "Q1")
        for qd in quarter_defs:
            qd["is_current"] = qd["key"] == current_q

        run_rate_start = date(fy_start_year - 1, 11, 1)
        cur = self._cursor()

        if ace_filter:
            cur.execute(
                """
                SELECT a.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
                    DATE_TRUNC('month', a.GENERAL_DATE) AS PERIOD_START,
                    MONTH(DATE_TRUNC('month', a.GENERAL_DATE)) AS MO,
                    YEAR(DATE_TRUNC('month', a.GENERAL_DATE)) AS YR,
                    SUM(a.REVENUE) AS PERIOD_CREDITS,
                    (LAST_DAY(DATE_TRUNC('month', a.GENERAL_DATE)) < CURRENT_DATE()) AS IS_COMPLETE_PERIOD
                FROM SALES.RAVEN.A360_DAILY_ACCOUNT_PRODUCT_CATEGORY_REVENUE a
                INNER JOIN BKMNG_ACCOUNTS ba ON ba.ACCOUNT_ID = a.SALESFORCE_ACCOUNT_ID
                WHERE a.GENERAL_DATE >= %s
                  AND ba.ACE_ASSIGNED = %s
                GROUP BY a.SALESFORCE_ACCOUNT_ID, DATE_TRUNC('month', a.GENERAL_DATE)
                ORDER BY a.SALESFORCE_ACCOUNT_ID, PERIOD_START
                """,
                (str(run_rate_start), ace_filter),
            )
        elif acem_filter:
            cur.execute(
                """
                SELECT a.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
                    DATE_TRUNC('month', a.GENERAL_DATE) AS PERIOD_START,
                    MONTH(DATE_TRUNC('month', a.GENERAL_DATE)) AS MO,
                    YEAR(DATE_TRUNC('month', a.GENERAL_DATE)) AS YR,
                    SUM(a.REVENUE) AS PERIOD_CREDITS,
                    (LAST_DAY(DATE_TRUNC('month', a.GENERAL_DATE)) < CURRENT_DATE()) AS IS_COMPLETE_PERIOD
                FROM SALES.RAVEN.A360_DAILY_ACCOUNT_PRODUCT_CATEGORY_REVENUE a
                INNER JOIN BKMNG_ACCOUNTS ba ON ba.ACCOUNT_ID = a.SALESFORCE_ACCOUNT_ID
                WHERE a.GENERAL_DATE >= %s
                  AND ba.ACE_ASSIGNED IN (SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s)
                GROUP BY a.SALESFORCE_ACCOUNT_ID, DATE_TRUNC('month', a.GENERAL_DATE)
                ORDER BY a.SALESFORCE_ACCOUNT_ID, PERIOD_START
                """,
                (str(run_rate_start), acem_filter),
            )
        else:
            cur.execute(
                """
                SELECT a.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
                    DATE_TRUNC('month', a.GENERAL_DATE) AS PERIOD_START,
                    MONTH(DATE_TRUNC('month', a.GENERAL_DATE)) AS MO,
                    YEAR(DATE_TRUNC('month', a.GENERAL_DATE)) AS YR,
                    SUM(a.REVENUE) AS PERIOD_CREDITS,
                    (LAST_DAY(DATE_TRUNC('month', a.GENERAL_DATE)) < CURRENT_DATE()) AS IS_COMPLETE_PERIOD
                FROM SALES.RAVEN.A360_DAILY_ACCOUNT_PRODUCT_CATEGORY_REVENUE a
                INNER JOIN BKMNG_ACCOUNTS ba ON ba.ACCOUNT_ID = a.SALESFORCE_ACCOUNT_ID
                WHERE a.GENERAL_DATE >= %s
                GROUP BY a.SALESFORCE_ACCOUNT_ID, DATE_TRUNC('month', a.GENERAL_DATE)
                ORDER BY a.SALESFORCE_ACCOUNT_ID, PERIOD_START
                """,
                (str(run_rate_start),),
            )

        raw_monthly: dict[str, list[dict]] = {}
        for row in cur.fetchall():
            aid = row["ACCOUNT_ID"]
            raw_monthly.setdefault(aid, []).append({
                "period_start": row["PERIOD_START"],
                "mo": int(row["MO"]),
                "yr": int(row["YR"]),
                "credits": float(row["PERIOD_CREDITS"]) if row["PERIOD_CREDITS"] is not None else 0.0,
                "complete": bool(row["IS_COMPLETE_PERIOD"]),
            })

        rev_cur = self._cursor()
        rev_cur.execute("SELECT ACCOUNT_ID, ACCOUNT_NAME FROM BKMNG_ACCOUNTS")
        name_map = {r["ACCOUNT_ID"]: r["ACCOUNT_NAME"] for r in rev_cur.fetchall()}

        rev2 = self._cursor()
        rev2.execute("SELECT ACCOUNT_ID, NET_ACV, NET_TCV, NET_TCV AS CONTRACT_CAPACITY, GREATEST(0, COALESCE(NET_TCV,0)-COALESCE(REV_180D,0)) AS CAPACITY_REMAINING, REV_180D AS TOTAL_CONSUMED_CREDITS FROM BKMNG_A360_CONTRACT")
        contract_map = {r["ACCOUNT_ID"]: r for r in rev2.fetchall()}

        accounts_out = []
        for aid, months in raw_monthly.items():
            complete_months = [m for m in months if m["complete"]]
            complete_months_sorted = sorted(complete_months, key=lambda m: m["period_start"], reverse=True)

            run_rate = (
                sum(m["credits"] for m in complete_months_sorted[:3]) / len(complete_months_sorted[:3])
                if complete_months_sorted else 0.0
            )

            actuals: dict[tuple[int, int], float] = {}
            for m in complete_months:
                actuals[(m["yr"], m["mo"])] = m["credits"]

            quarters_out = {}
            for qd in quarter_defs:
                act = 0.0
                proj = 0.0
                n_actual = 0
                for (yr, mo) in qd["months"]:
                    month_start = date(yr, mo, 1)
                    if month_start < fy_start:
                        continue
                    if (yr, mo) in actuals:
                        act += actuals[(yr, mo)]
                        n_actual += 1
                    else:
                        proj += run_rate
                quarters_out[qd["key"]] = {
                    "actual": round(act, 2),
                    "projected": round(proj, 2),
                    "total": round(act + proj, 2),
                    "complete_months": n_actual,
                    "is_complete": n_actual == 3,
                }

            fy_actual = sum(q["actual"] for q in quarters_out.values())
            fy_projected = sum(q["projected"] for q in quarters_out.values())
            fy_total = fy_actual + fy_projected

            cr = contract_map.get(aid)
            capacity = float(cr["CONTRACT_CAPACITY"]) if cr and cr.get("CONTRACT_CAPACITY") else None
            net_acv = float(cr["NET_ACV"]) if cr and cr.get("NET_ACV") is not None else None
            net_tcv = float(cr["NET_TCV"]) if cr and cr.get("NET_TCV") is not None else None
            cap_remaining = float(cr["CAPACITY_REMAINING"]) if cr and cr.get("CAPACITY_REMAINING") else None
            consumed = float(cr["TOTAL_CONSUMED_CREDITS"]) if cr and cr.get("TOTAL_CONSUMED_CREDITS") else None
            pct_proj = round(fy_total / capacity * 100, 1) if capacity and capacity > 0 else None

            accounts_out.append({
                "account_id": aid,
                "account_name": name_map.get(aid, aid),
                "net_acv": net_acv,
                "net_tcv": net_tcv,
                "contract_capacity": capacity,
                "capacity_remaining": cap_remaining,
                "total_consumed_credits": consumed,
                "monthly_run_rate": round(run_rate, 2),
                "quarters": quarters_out,
                "fy_actual": round(fy_actual, 2),
                "fy_projected": round(fy_projected, 2),
                "fy_total": round(fy_total, 2),
                "pct_capacity_projected": pct_proj,
            })

        accounts_out.sort(key=lambda a: (a["account_name"] or ""))

        return {
            "fy_label": fy_label,
            "fy_start": str(fy_start),
            "fy_end": str(fy_end),
            "as_of": str(today),
            "quarters": [{k: v for k, v in qd.items() if k != "months"} for qd in quarter_defs],
            "accounts": accounts_out,
        }

    def list_nba_items(self, ace_filter: Optional[str] = None, acem_filter: Optional[str] = None) -> dict:
        cache_key = f"nba:{ace_filter}:{acem_filter}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        from app.signals import get_registry
        from app.signals.models import SignalScope
        scope = SignalScope(user_email="", ace_filter=ace_filter, acem_filter=acem_filter)
        client_items, admin_items = get_registry().get_nba_items(
            self._cursor(), scope, cap_client=10, cap_admin=8
        )
        result = {"client": client_items, "admin": admin_items}
        cache_set(cache_key, result, ttl=300)
        return result


    def get_recent_feature_adoptions(self, ace_filter: Optional[str] = None, acem_filter: Optional[str] = None, days: int = 7) -> list[dict]:
        cur = self._cursor()
        where_clauses = [f"pa.DAYS_SINCE_FIRST_USE <= {int(days)}", "pa.IS_NEW_30D = TRUE"]
        params: list = []
        if ace_filter:
            where_clauses.append("oa.ACE_ASSIGNED = %s")
            params.append(ace_filter)
        elif acem_filter:
            where_clauses.append("oa.ACE_ASSIGNED IN (SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s)")
            params.append(acem_filter)
        where = "WHERE " + " AND ".join(where_clauses)
        cur.execute(
            f"""
            SELECT pa.ACCOUNT_ID, pa.ACCOUNT_NAME,
                   pa.FEATURE AS FEATURE_NAME, pa.FEATURE AS FEATURE_RAW,
                   pa.USE_CASE AS FEATURE_SOURCE, pa.PRODUCT_CATEGORY AS CATEGORY,
                   pa.FIRST_USE_DATE::VARCHAR AS FIRST_USE_DATE,
                   pa.DAYS_SINCE_FIRST_USE, pa.IS_NEW_30D, FALSE AS IS_NEW_90D
            FROM BKMNG_A360_PRODUCT_ADOPTION pa
            JOIN BKMNG_ONT_ACCOUNTS oa ON oa.ACCOUNT_ID = pa.ACCOUNT_ID
            {where}
            ORDER BY pa.DAYS_SINCE_FIRST_USE ASC, pa.ACCOUNT_NAME, pa.FEATURE
            """,
            params,
        )
        rows = cur.fetchall()
        return [
            {
                "account_id": r.get("ACCOUNT_ID", ""),
                "account_name": r.get("ACCOUNT_NAME", ""),
                "feature_name": r.get("FEATURE_NAME", ""),
                "feature_raw": r.get("FEATURE_RAW", ""),
                "feature_source": r.get("FEATURE_SOURCE", ""),
                "category": r.get("CATEGORY", ""),
                "first_use_date": r.get("FIRST_USE_DATE"),
                "days_since_first_use": int(r.get("DAYS_SINCE_FIRST_USE") or 0),
                "is_new_30d": bool(r.get("IS_NEW_30D")),
                "is_new_90d": bool(r.get("IS_NEW_90D")),
            }
            for r in rows
        ]

    # ------------------------------------------------------------------
    # Use Case Updates (weekly SF-paste-ready suggestions)
    # ------------------------------------------------------------------

    def _week_monday(self) -> str:
        from datetime import date as _date, timedelta as _td
        today = _date.today()
        return (today - _td(days=today.weekday())).isoformat()

    def _fetch_uc_update_row(self, use_case_id: str) -> Optional[dict]:
        cur = self._cursor()
        cur.execute(
            """
            SELECT UPDATE_ID, USE_CASE_ID, ACCOUNT_ID, USE_CASE_NAME, STAGE, ACE_EMAIL,
                   WEEK_OF, UPDATE_TEXT, STATUS, BASIS_SUMMARY,
                   SOURCE_COUNT_NOTES, SOURCE_COUNT_GONG, SOURCE_COUNT_TIMELINE,
                   IS_EDITED, GENERATED_AT, LAST_MODIFIED_AT, LAST_MODIFIED_BY
            FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_UPDATES
            WHERE USE_CASE_ID = %s
            ORDER BY GENERATED_AT DESC
            LIMIT 1
            """,
            (use_case_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        r = dict(row)
        return {
            "use_case_id": r.get("USE_CASE_ID"),
            "account_id": r.get("ACCOUNT_ID"),
            "use_case_name": r.get("USE_CASE_NAME"),
            "stage": r.get("STAGE"),
            "ace_email": r.get("ACE_EMAIL"),
            "week_of": r["WEEK_OF"].isoformat() if r.get("WEEK_OF") else None,
            "update_text": r.get("UPDATE_TEXT") or "",
            "status": r.get("STATUS") or "suggested",
            "basis_summary": r.get("BASIS_SUMMARY") or "",
            "source_count_notes": int(r.get("SOURCE_COUNT_NOTES") or 0),
            "source_count_gong": int(r.get("SOURCE_COUNT_GONG") or 0),
            "source_count_timeline": int(r.get("SOURCE_COUNT_TIMELINE") or 0),
            "is_edited": bool(r.get("IS_EDITED")),
            "generated_at": r["GENERATED_AT"].isoformat() if r.get("GENERATED_AT") else None,
            "last_modified_at": r["LAST_MODIFIED_AT"].isoformat() if r.get("LAST_MODIFIED_AT") else None,
            "last_modified_by": r.get("LAST_MODIFIED_BY"),
        }

    def _generate_one_use_case_update(
        self,
        use_case_id: str,
        account_id: str,
        use_case_name: str,
        stage: str,
        ace_email: str,
    ) -> dict:
        """Build prompt, call Cortex, and DELETE+INSERT a fresh row for this use case."""
        cur = self._cursor()

        # 1) Latest PS notes for this use case
        cur.execute(
            """
            SELECT TO_CHAR(NOTE_DATE) AS NOTE_DATE,
                   COALESCE(AUTHOR_INITIALS, 'SE') AS AUTHOR_INITIALS,
                   LEFT(CONTENT, 600) AS CONTENT
            FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES
            WHERE USE_CASE_ID = %s AND CONTENT IS NOT NULL
            ORDER BY NOTE_DATE DESC NULLS LAST
            LIMIT 5
            """,
            (use_case_id,),
        )
        note_rows = cur.fetchall()
        ps_notes_text = "\n".join(
            f"[{(r.get('NOTE_DATE') or 'undated')}] ({r.get('AUTHOR_INITIALS')}) {r.get('CONTENT')}"
            for r in note_rows
        ) or "None"

        # 2) Recent Gong calls for the account (last 21 days)
        cur.execute(
            """
            SELECT TO_CHAR(INTERACTION_DATE::DATE) AS CALL_DATE,
                   COALESCE(TITLE, 'Call') AS TITLE,
                   LEFT(COALESCE(SUMMARY, ''), 400) AS SUMMARY,
                   LEFT(COALESCE(KEY_POINTS, ''), 300) AS KEY_POINTS,
                   LEFT(COALESCE(NEXT_STEPS, ''), 200) AS NEXT_STEPS
            FROM TEMP.JUSDAVIS.BKMNG_ONT_INTERACTIONS
            WHERE ACCOUNT_ID = %s
              AND INTERACTION_DATE >= DATEADD(day, -21, CURRENT_DATE())
            ORDER BY INTERACTION_DATE DESC
            LIMIT 5
            """,
            (account_id,),
        )
        gong_rows = cur.fetchall()
        gong_text = "\n\n".join(
            f"[{r['CALL_DATE']}] {r['TITLE']}\nSummary: {r['SUMMARY']}\nKey Points: {r['KEY_POINTS']}\nNext Steps: {r['NEXT_STEPS']}"
            for r in gong_rows
        ) or "None"

        # 3) Manual timeline entries (last 14d)
        cur.execute(
            """
            SELECT TO_CHAR(MEETING_DATE::DATE) AS ENTRY_DATE,
                   COALESCE(TITLE, 'Note') AS TITLE,
                   COALESCE(SOURCE_TYPE, 'notes') AS SOURCE_TYPE,
                   LEFT(COALESCE(NOTES_SUMMARY, NOTES, ''), 600) AS BODY
            FROM TEMP.JUSDAVIS.BKMNG_MANUAL_MEETINGS
            WHERE ACCOUNT_ID = %s
              AND NOTES_ADDED = TRUE
              AND MEETING_DATE >= DATEADD(day, -14, CURRENT_DATE())
            ORDER BY MEETING_DATE DESC
            LIMIT 5
            """,
            (account_id,),
        )
        tl_rows = cur.fetchall()
        timeline_text = "\n\n".join(
            f"[{r['ENTRY_DATE']}] ({r['SOURCE_TYPE']}) {r['TITLE']}: {r['BODY']}"
            for r in tl_rows
        ) or "None"

        n_notes = len(note_rows)
        n_gong = len(gong_rows)
        n_tl = len(tl_rows)

        week_of = self._week_monday()
        basis = (
            f"Notes: {n_notes} recent | Gong (21d): {n_gong} | Timeline (14d): {n_tl}"
        )

        # No fresh signal in last 7 days for this UC: produce a "no update" status
        # We approximate freshness using counts: if all sources empty in last window -> no_update.
        if n_notes == 0 and n_gong == 0 and n_tl == 0:
            update_text = "No update — no new meetings, calls, or notes this week."
            status = "no_update"
        else:
            prompt = (
                "You are a Snowflake Sales Engineer writing a weekly use case status update for Salesforce. "
                "Write 1-3 short sentences in past tense, professional tone, no bullets or headers, "
                "matching this style: \"Met with the team to validate Phase 2 scope. Decided to start "
                "POC by month-end with Fivetran ingestion.\" Focus on what happened, decisions made, "
                "and next steps if mentioned. If material is thin, output one short sentence. "
                "Do NOT add quotes, preamble, labels, or commentary. Output only the update text.\n\n"
                f"Use Case: {use_case_name}\n"
                f"Stage: {stage}\n\n"
                f"Recent PS notes:\n{ps_notes_text}\n\n"
                f"Recent Gong calls / meetings:\n{gong_text}\n\n"
                f"Recent timeline entries (last 14 days):\n{timeline_text}\n"
            )
            try:
                cur.execute(
                    "SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-8b', %s) AS UPDATE_TEXT",
                    (prompt[:14000],),
                )
                row = cur.fetchone()
                raw = (row.get("UPDATE_TEXT") or "").strip() if row else ""
            except Exception as e:
                logger.error("Cortex use-case-update gen failed for %s: %s", use_case_id, e)
                raw = ""

            # Strip wrapping quotes / common preambles
            cleaned = raw.strip()
            for prefix in ("Update:", "Summary:", "Status:"):
                if cleaned.lower().startswith(prefix.lower()):
                    cleaned = cleaned[len(prefix):].strip()
            if cleaned.startswith('"') and cleaned.endswith('"'):
                cleaned = cleaned[1:-1].strip()
            if not cleaned:
                cleaned = "No update — generation failed; click Regenerate to retry."
            update_text = cleaned[:2000]
            status = "suggested"

        # DELETE + INSERT (one row per UC)
        cur.execute(
            "DELETE FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_UPDATES WHERE USE_CASE_ID = %s",
            (use_case_id,),
        )
        cur.execute(
            """
            INSERT INTO TEMP.JUSDAVIS.BKMNG_USE_CASE_UPDATES
                (USE_CASE_ID, ACCOUNT_ID, USE_CASE_NAME, STAGE, ACE_EMAIL,
                 WEEK_OF, UPDATE_TEXT, STATUS, BASIS_SUMMARY,
                 SOURCE_COUNT_NOTES, SOURCE_COUNT_GONG, SOURCE_COUNT_TIMELINE,
                 IS_EDITED, GENERATED_AT, LAST_MODIFIED_AT, LAST_MODIFIED_BY)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE,
                    CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), %s)
            """,
            (
                use_case_id, account_id, use_case_name, stage, ace_email,
                week_of, update_text, status, basis,
                n_notes, n_gong, n_tl, ace_email,
            ),
        )
        return self._fetch_uc_update_row(use_case_id) or {}

    def _list_active_use_cases_for_user(
        self, account_id: str, ace_email: str, my_only: bool = True
    ) -> list[dict]:
        """Lightweight UC list for update generation. Excludes lost/archived stages."""
        cur = self._cursor()
        sql = """
            SELECT USE_CASE_ID, ACCOUNT_ID,
                   COALESCE(USE_CASE_NAME, 'Untitled') AS USE_CASE_NAME,
                   COALESCE(STAGE, 'Unknown') AS STAGE,
                   COALESCE(LEAD_SE, '') AS LEAD_SE,
                   COALESCE(ACE_ASSIGNED, '') AS ACE_ASSIGNED
            FROM TEMP.JUSDAVIS.BKMNG_USE_CASES
            WHERE ACCOUNT_ID = %s
              AND COALESCE(STAGE, '') NOT ILIKE '%%Lost%%'
              AND COALESCE(STAGE, '') NOT ILIKE '%%Closed%%'
        """
        params: tuple = (account_id,)
        if my_only:
            sql += " AND (LEAD_SE = %s OR ACE_ASSIGNED = %s)"
            params = (account_id, ace_email, ace_email)
        sql += " ORDER BY USE_CASE_NAME"
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]

    def get_use_case_updates(
        self, account_id: str, ace_email: str, my_only: bool = True
    ) -> list[dict]:
        """Return cached suggestions for this account's user-owned active use cases.
        Lazily generates when no cached row exists for a UC."""
        ucs = self._list_active_use_cases_for_user(account_id, ace_email, my_only=my_only)
        if not ucs and my_only:
            # Fall back to all active UCs if user owns none on this account
            ucs = self._list_active_use_cases_for_user(account_id, ace_email, my_only=False)
        results: list[dict] = []
        for uc in ucs:
            existing = self._fetch_uc_update_row(uc["USE_CASE_ID"])
            if existing:
                # Refresh display name/stage if changed in source
                results.append(existing)
            else:
                generated = self._generate_one_use_case_update(
                    uc["USE_CASE_ID"], uc["ACCOUNT_ID"],
                    uc["USE_CASE_NAME"], uc["STAGE"], ace_email,
                )
                if generated:
                    results.append(generated)
        return results

    def regenerate_use_case_updates(
        self, account_id: str, ace_email: str, my_only: bool = True
    ) -> list[dict]:
        ucs = self._list_active_use_cases_for_user(account_id, ace_email, my_only=my_only)
        if not ucs and my_only:
            ucs = self._list_active_use_cases_for_user(account_id, ace_email, my_only=False)
        results: list[dict] = []
        for uc in ucs:
            results.append(self._generate_one_use_case_update(
                uc["USE_CASE_ID"], uc["ACCOUNT_ID"],
                uc["USE_CASE_NAME"], uc["STAGE"], ace_email,
            ))
        return results

    def regenerate_one_use_case_update(self, use_case_id: str, ace_email: str) -> dict:
        cur = self._cursor()
        cur.execute(
            """
            SELECT USE_CASE_ID, ACCOUNT_ID,
                   COALESCE(USE_CASE_NAME, 'Untitled') AS USE_CASE_NAME,
                   COALESCE(STAGE, 'Unknown') AS STAGE
            FROM TEMP.JUSDAVIS.BKMNG_USE_CASES
            WHERE USE_CASE_ID = %s
            """,
            (use_case_id,),
        )
        row = cur.fetchone()
        if not row:
            return {}
        return self._generate_one_use_case_update(
            row["USE_CASE_ID"], row["ACCOUNT_ID"],
            row["USE_CASE_NAME"], row["STAGE"], ace_email,
        )

    def update_use_case_update_text(
        self, use_case_id: str, new_text: str, ace_email: str
    ) -> dict:
        cur = self._cursor()
        cur.execute(
            """
            UPDATE TEMP.JUSDAVIS.BKMNG_USE_CASE_UPDATES
            SET UPDATE_TEXT = %s,
                STATUS = 'edited',
                IS_EDITED = TRUE,
                LAST_MODIFIED_AT = CURRENT_TIMESTAMP(),
                LAST_MODIFIED_BY = %s
            WHERE USE_CASE_ID = %s
            """,
            (new_text[:2000], ace_email, use_case_id),
        )
        return self._fetch_uc_update_row(use_case_id) or {}

    def get_account_timeline(self, account_id: str) -> list[dict]:
        cache_key = f"timeline:{account_id}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        cur = self._cursor()
        cur.execute(
            """
            SELECT NOTE_ID, USE_CASE_ID, USE_CASE_NAME, NOTE_DATE,
                   AUTHOR_INITIALS, CONTENT, NULL AS SOURCE_TYPE, FALSE AS IS_DELETABLE
            FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES
            WHERE ACCOUNT_ID = %s AND NOTE_DATE IS NOT NULL AND CONTENT IS NOT NULL
            UNION ALL
            SELECT
                MEETING_ID                                                      AS NOTE_ID,
                MEETING_ID                                                      AS USE_CASE_ID,
                CONCAT(
                    CASE COALESCE(SOURCE_TYPE, 'meeting')
                        WHEN 'meeting_notes' THEN '[Meeting Notes] '
                        WHEN 'transcript' THEN '[Transcript] '
                        WHEN 'email' THEN '[Email] '
                        WHEN 'notes' THEN '[Notes] '
                        WHEN 'other' THEN '[Other] '
                        ELSE '[Meeting] '
                    END, TITLE
                )                                                               AS USE_CASE_NAME,
                CAST(MEETING_DATE AS DATE)                                      AS NOTE_DATE,
                UPPER(LEFT(CREATED_BY, 4))                                      AS AUTHOR_INITIALS,
                CASE
                    WHEN NOTES_ADDED = TRUE THEN
                        COALESCE(
                            NOTES_SUMMARY,
                            CONCAT(
                                COALESCE(TITLE, 'Meeting'),
                                CASE WHEN ATTENDEES IS NOT NULL THEN CONCAT(' — ', ATTENDEES) ELSE '' END,
                                CHAR(10), CHAR(10), LEFT(NOTES, 2000)
                            )
                        )
                    ELSE
                        CONCAT(
                            COALESCE(TITLE, 'Meeting'),
                            CASE WHEN ATTENDEES IS NOT NULL THEN CONCAT(' — Attendees: ', ATTENDEES) ELSE '' END,
                            CHAR(10), 'Notes not yet added.'
                        )
                END                                                             AS CONTENT,
                COALESCE(SOURCE_TYPE, 'meeting')                                AS SOURCE_TYPE,
                TRUE                                                            AS IS_DELETABLE
            FROM TEMP.JUSDAVIS.BKMNG_MANUAL_MEETINGS
            WHERE ACCOUNT_ID = %s
            ORDER BY NOTE_DATE DESC, 1 DESC
            """,
            (account_id, account_id),
        )
        rows = cur.fetchall()
        result = [
            {
                "note_id": r["NOTE_ID"],
                "use_case_id": r["USE_CASE_ID"],
                "use_case_name": r.get("USE_CASE_NAME") or "",
                "author_id": r.get("AUTHOR_INITIALS") or "SE",
                "content": r.get("CONTENT") or "",
                "created_at": str(datetime.combine(r["NOTE_DATE"], datetime.min.time())) if r.get("NOTE_DATE") else "",
                "source_type": r.get("SOURCE_TYPE"),
                "is_deletable": bool(r.get("IS_DELETABLE")),
            }
            for r in rows
            if r.get("CONTENT")
        ]
        cache_set(cache_key, result, ttl=180)
        return result

    def get_account_adoption(self, account_id: str) -> dict:
        cache_key = f"adoption:{account_id}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        cur = self._cursor()
        cur.execute(
            """
            SELECT
                ACCOUNT_ID, ACCOUNT_NAME,
                MAX(CASE WHEN PRODUCT_CATEGORY = 'Data Engineering' AND USE_CASE = 'Ingestion' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_PIPELINE,
                MAX(CASE WHEN PRODUCT_CATEGORY = 'Data Engineering' AND USE_CASE = 'Transformation' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_TRANSFORMS,
                MAX(CASE WHEN PRODUCT_CATEGORY = 'Analytics' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_BI,
                MAX(CASE WHEN PRODUCT_CATEGORY = 'Platform' AND USE_CASE = 'Cost Governance' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_COST,
                MAX(CASE WHEN PRODUCT_CATEGORY = 'Applications & Collaboration' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_COLLAB,
                MAX(CASE WHEN PRODUCT_CATEGORY = 'Platform' AND USE_CASE = 'Observability' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_OBS,
                MAX(CASE WHEN PRODUCT_CATEGORY = 'AI/ML' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_AIML,
                MAX(CASE WHEN PRODUCT_CATEGORY = 'Transactions' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_SPCS,
                COUNT(DISTINCT CASE WHEN IS_ACTIVE_30D THEN PRODUCT_CATEGORY END) AS SIGNAL_COUNT
            FROM BKMNG_A360_PRODUCT_ADOPTION
            WHERE ACCOUNT_ID = %s
            GROUP BY ACCOUNT_ID, ACCOUNT_NAME
            """,
            (account_id,),
        )
        sig_row = cur.fetchone()
        cur.execute(
            """
            SELECT FEATURE AS FEATURE_NAME, FEATURE AS FEATURE_RAW,
                   USE_CASE AS FEATURE_SOURCE, PRODUCT_CATEGORY AS CATEGORY,
                   FIRST_USE_DATE::VARCHAR AS FIRST_USE_DATE,
                   DAYS_SINCE_FIRST_USE, IS_NEW_30D, FALSE AS IS_NEW_90D
            FROM BKMNG_A360_PRODUCT_ADOPTION
            WHERE ACCOUNT_ID = %s
            ORDER BY FIRST_USE_DATE ASC
            """,
            (account_id,),
        )
        feature_rows = cur.fetchall()
        signals = None
        if sig_row:
            signals = {
                "account_id": sig_row.get("ACCOUNT_ID", ""),
                "account_name": sig_row.get("ACCOUNT_NAME", ""),
                "sig_pipeline": int(sig_row.get("SIG_PIPELINE") or 0),
                "sig_transforms": int(sig_row.get("SIG_TRANSFORMS") or 0),
                "sig_bi": int(sig_row.get("SIG_BI") or 0),
                "sig_cost": int(sig_row.get("SIG_COST") or 0),
                "sig_collab": int(sig_row.get("SIG_COLLAB") or 0),
                "sig_obs": int(sig_row.get("SIG_OBS") or 0),
                "sig_aiml": int(sig_row.get("SIG_AIML") or 0),
                "sig_spcs": int(sig_row.get("SIG_SPCS") or 0),
                "signal_count": int(sig_row.get("SIGNAL_COUNT") or 0),
                "adoption_profile": "",
                "missing_categories": "",
                "total_billed_credits_90d": 0.0,
            }
        features = [
            {
                "feature_name": r.get("FEATURE_NAME", ""),
                "feature_raw": r.get("FEATURE_RAW", ""),
                "feature_source": r.get("FEATURE_SOURCE", ""),
                "category": r.get("CATEGORY", ""),
                "first_use_date": r.get("FIRST_USE_DATE"),
                "days_since_first_use": int(r.get("DAYS_SINCE_FIRST_USE") or 0),
                "is_new_30d": bool(r.get("IS_NEW_30D")),
                "is_new_90d": bool(r.get("IS_NEW_90D")),
            }
            for r in feature_rows
        ]
        result = {"signals": signals, "features": features}
        cache_set(cache_key, result, ttl=600)
        return result


    def get_ai_adoption(self, account_id: str) -> dict:
        cache_key = f"ai_adoption:{account_id}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        cur = self._cursor()

        # Per-surface L28D summary for Cortex Code (CLI/Desktop/Snowsight)
        cur.execute(
            """
            WITH per_user AS (
                SELECT
                    LOWER(ORIGIN) AS ORIGIN,
                    USER_NAME,
                    COUNT(DISTINCT DATE_AT) AS DAYS,
                    SUM(REQUEST_COUNT) AS PROMPTS,
                    SUM(DISTINCT_SESSIONS) AS SESSIONS,
                    MAX(DATE_AT) AS LAST_ACTIVE
                FROM SALES.RAVEN.A360_COCO_USAGE_USER_DAILY_VIEW
                WHERE SALESFORCE_ACCOUNT_ID = %s
                  AND DATE_AT >= DATEADD(day, -28, CURRENT_DATE())
                GROUP BY 1, 2
            )
            SELECT
                ORIGIN,
                COUNT(*) AS USERS_28D,
                COALESCE(SUM(PROMPTS), 0) AS REQUESTS_28D,
                COALESCE(SUM(SESSIONS), 0) AS SESSIONS_28D,
                MAX(LAST_ACTIVE)::VARCHAR AS LAST_ACTIVE,
                ROUND(AVG(DAYS), 1) AS AVG_DAYS_PER_USER,
                ROUND(AVG(PROMPTS), 0) AS AVG_PROMPTS_PER_USER
            FROM per_user
            GROUP BY 1
            """,
            (account_id,),
        )
        coco_rows = {(r.get("ORIGIN") or "").lower(): r for r in cur.fetchall()}

        # SI L28D summary
        cur.execute(
            """
            WITH per_user AS (
                SELECT
                    USER_ID,
                    COUNT(DISTINCT DS) AS DAYS,
                    SUM(NUM_REQUESTS) AS PROMPTS,
                    SUM(NUM_TRACES) AS SESSIONS,
                    MAX(DS) AS LAST_ACTIVE
                FROM SALES.RAVEN.A360_SI_USER_DAY_FACT_VIEW
                WHERE SALESFORCE_ACCOUNT_ID = %s
                  AND DS >= DATEADD(day, -28, CURRENT_DATE())
                GROUP BY 1
            )
            SELECT
                COUNT(*) AS USERS_28D,
                COALESCE(SUM(PROMPTS), 0) AS REQUESTS_28D,
                COALESCE(SUM(SESSIONS), 0) AS SESSIONS_28D,
                MAX(LAST_ACTIVE)::VARCHAR AS LAST_ACTIVE,
                ROUND(AVG(DAYS), 1) AS AVG_DAYS_PER_USER,
                ROUND(AVG(PROMPTS), 0) AS AVG_PROMPTS_PER_USER
            FROM per_user
            """,
            (account_id,),
        )
        si_row = cur.fetchone() or {}

        def _coco(origin: str) -> dict:
            r = coco_rows.get(origin) or {}
            return {
                "users_28d": int(r.get("USERS_28D") or 0),
                "requests_28d": int(r.get("REQUESTS_28D") or 0),
                "sessions_28d": int(r.get("SESSIONS_28D") or 0),
                "last_active": r.get("LAST_ACTIVE"),
                "avg_days_per_user": float(r.get("AVG_DAYS_PER_USER") or 0),
                "avg_prompts_per_user": int(r.get("AVG_PROMPTS_PER_USER") or 0),
            }

        surfaces = {
            "cli": _coco("cli"),
            "desktop": _coco("desktop"),
            "snowsight": _coco("ui"),
            "si": {
                "users_28d": int(si_row.get("USERS_28D") or 0),
                "requests_28d": int(si_row.get("REQUESTS_28D") or 0),
                "sessions_28d": int(si_row.get("SESSIONS_28D") or 0),
                "last_active": si_row.get("LAST_ACTIVE"),
                "avg_days_per_user": float(si_row.get("AVG_DAYS_PER_USER") or 0),
                "avg_prompts_per_user": int(si_row.get("AVG_PROMPTS_PER_USER") or 0),
            },
        }

        # Headline totals = sum of distinct users per surface (different ID spaces, so this is "user records")
        total_users_28d = sum(s["users_28d"] for s in surfaces.values())
        total_requests_28d = sum(s["requests_28d"] for s in surfaces.values())

        # Weekly trend across CoCo surfaces (8 weeks)
        cur.execute(
            """
            SELECT
                DATE_TRUNC('week', DATE_AT)::DATE::VARCHAR AS WEEK_START,
                LOWER(ORIGIN) AS ORIGIN,
                COUNT(DISTINCT USER_NAME) AS USERS,
                COALESCE(SUM(REQUEST_COUNT), 0) AS REQUESTS
            FROM SALES.RAVEN.A360_COCO_USAGE_USER_DAILY_VIEW
            WHERE SALESFORCE_ACCOUNT_ID = %s
              AND DATE_AT >= DATEADD(day, -56, CURRENT_DATE())
            GROUP BY 1, 2
            """,
            (account_id,),
        )
        coco_weekly = cur.fetchall()

        # Weekly trend for SI
        cur.execute(
            """
            SELECT
                DATE_TRUNC('week', DS)::DATE::VARCHAR AS WEEK_START,
                COUNT(DISTINCT USER_ID) AS USERS,
                COALESCE(SUM(NUM_REQUESTS), 0) AS REQUESTS
            FROM SALES.RAVEN.A360_SI_USER_DAY_FACT_VIEW
            WHERE SALESFORCE_ACCOUNT_ID = %s
              AND DS >= DATEADD(day, -56, CURRENT_DATE())
            GROUP BY 1
            """,
            (account_id,),
        )
        si_weekly = cur.fetchall()

        weeks: dict[str, dict] = {}

        def _ensure(week: str) -> dict:
            if week not in weeks:
                weeks[week] = {
                    "week_start": week,
                    "cli_users": 0, "desktop_users": 0, "snowsight_users": 0, "si_users": 0,
                    "cli_requests": 0, "desktop_requests": 0, "snowsight_requests": 0, "si_requests": 0,
                }
            return weeks[week]

        _ORIGIN_TO_KEY = {"cli": "cli", "desktop": "desktop", "ui": "snowsight"}
        for r in coco_weekly:
            wk = r.get("WEEK_START")
            origin = (r.get("ORIGIN") or "").lower()
            key = _ORIGIN_TO_KEY.get(origin)
            if not wk or not key:
                continue
            row = _ensure(wk)
            row[f"{key}_users"] = int(r.get("USERS") or 0)
            row[f"{key}_requests"] = int(r.get("REQUESTS") or 0)

        for r in si_weekly:
            wk = r.get("WEEK_START")
            if not wk:
                continue
            row = _ensure(wk)
            row["si_users"] = int(r.get("USERS") or 0)
            row["si_requests"] = int(r.get("REQUESTS") or 0)

        weekly_trend = sorted(weeks.values(), key=lambda x: x["week_start"])

        result = {
            "surfaces": surfaces,
            "total_users_28d": total_users_28d,
            "total_requests_28d": total_requests_28d,
            "weekly_trend": weekly_trend,
        }
        cache_set(cache_key, result, ttl=600)
        return result

    def get_security_posture(self, account_id: str) -> dict:
        cur = self._cursor()
        cur.execute(
            """
            SELECT MILESTONE_ID, MILESTONE_NAME, TIER, STATUS, PRIORITY,
                   RAW_VALUE, SECONDARY_SIGNALS, INDUSTRY, SERVICE_LEVEL,
                   INDUSTRY_PRIORITY, LLM_SUMMARY, LAST_CHECKED, ACCOUNT_NAME
            FROM BKMNG_SECURITY_POSTURE
            WHERE ACCOUNT_ID = %s
            ORDER BY
                CASE TIER
                    WHEN 'identity_access' THEN 0
                    WHEN 'network_data_protection' THEN 1
                    WHEN 'rbac_governance' THEN 2
                    ELSE 3 END,
                CASE PRIORITY
                    WHEN 'critical' THEN 0
                    WHEN 'high' THEN 1
                    WHEN 'medium' THEN 2
                    ELSE 3 END
            """,
            (account_id,),
        )
        rows = cur.fetchall()
        if not rows:
            return {"account_id": account_id, "tiers": [], "overall_score": 0, "total_milestones": 16, "applicable_milestones": 0}

        cur.execute(
            "SELECT MILESTONE_ID, ACE_STATUS, ACE_NOTES, UPDATED_BY, UPDATED_AT::VARCHAR AS UPDATED_AT FROM BKMNG_SECURITY_POSTURE_OVERRIDES WHERE ACCOUNT_ID = %s",
            (account_id,),
        )
        overrides = {r["MILESTONE_ID"]: r for r in cur.fetchall()}

        import json as _json
        tier_map: dict = {}
        applicable = 0
        met = 0
        industry = ""
        service_level = ""
        account_name = ""
        last_checked = None

        for row in rows:
            tid = row["TIER"]
            if tid not in tier_map:
                tier_names = {
                    "identity_access": "Identity & Access Foundations",
                    "network_data_protection": "Network & Data Protection",
                    "rbac_governance": "RBAC & Governance",
                }
                tier_map[tid] = {"tier_id": tid, "tier_name": tier_names.get(tid, tid), "milestones": []}

            mid = row["MILESTONE_ID"]
            status = row["STATUS"]
            if status != "not_applicable":
                applicable += 1
                if status == "complete":
                    met += 1

            raw_val = row["RAW_VALUE"]
            if isinstance(raw_val, str):
                try:
                    raw_val = _json.loads(raw_val)
                except Exception:
                    pass

            override = overrides.get(mid)
            ace_override = None
            if override:
                ace_override = {
                    "status": override["ACE_STATUS"],
                    "notes": override["ACE_NOTES"],
                    "updated_by": override["UPDATED_BY"],
                    "updated_at": override["UPDATED_AT"],
                }

            tier_map[tid]["milestones"].append({
                "id": mid,
                "name": row["MILESTONE_NAME"],
                "status": status,
                "priority": row["PRIORITY"],
                "industry_required": row["INDUSTRY_PRIORITY"] == "required",
                "industry_priority": row["INDUSTRY_PRIORITY"],
                "raw_value": raw_val,
                "llm_summary": row["LLM_SUMMARY"],
                "ace_override": ace_override,
            })

            if not industry:
                industry = row["INDUSTRY"] or ""
            if not service_level:
                service_level = row["SERVICE_LEVEL"] or ""
            if not account_name:
                account_name = row["ACCOUNT_NAME"] or ""
            if not last_checked and row["LAST_CHECKED"]:
                last_checked = str(row["LAST_CHECKED"])

        tier_order = ["identity_access", "network_data_protection", "rbac_governance"]
        tiers = [tier_map[t] for t in tier_order if t in tier_map]

        return {
            "account_id": account_id,
            "account_name": account_name,
            "industry": industry,
            "service_level": service_level,
            "overall_score": met,
            "total_milestones": 16,
            "applicable_milestones": applicable,
            "last_checked": last_checked,
            "tiers": tiers,
        }

    def set_security_posture_override(self, account_id: str, milestone_id: str, ace_status: str, ace_notes: str, updated_by: str) -> dict:
        cur = self._cursor()
        cur.execute(
            """
            MERGE INTO BKMNG_SECURITY_POSTURE_OVERRIDES t
            USING (SELECT %s AS ACCOUNT_ID, %s AS MILESTONE_ID) s
              ON t.ACCOUNT_ID = s.ACCOUNT_ID AND t.MILESTONE_ID = s.MILESTONE_ID
            WHEN MATCHED THEN UPDATE SET ACE_STATUS = %s, ACE_NOTES = %s, UPDATED_BY = %s, UPDATED_AT = CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN INSERT (ACCOUNT_ID, MILESTONE_ID, ACE_STATUS, ACE_NOTES, UPDATED_BY, UPDATED_AT)
              VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP())
            """,
            (account_id, milestone_id, ace_status, ace_notes, updated_by,
             account_id, milestone_id, ace_status, ace_notes, updated_by),
        )
        return {"account_id": account_id, "milestone_id": milestone_id, "ace_status": ace_status, "ace_notes": ace_notes}

    def delete_security_posture_override(self, account_id: str, milestone_id: str) -> None:
        cur = self._cursor()
        cur.execute(
            "DELETE FROM BKMNG_SECURITY_POSTURE_OVERRIDES WHERE ACCOUNT_ID = %s AND MILESTONE_ID = %s",
            (account_id, milestone_id),
        )


# ------------------------------------------------------------------
# Row → model helpers
# ------------------------------------------------------------------

def _row_to_account(r: dict) -> Account:
    return Account(
        account_id=r["ACCOUNT_ID"],
        account_name=r["ACCOUNT_NAME"],
        industry=r.get("INDUSTRY"),
        region=r.get("REGION"),
        ace_assigned=r.get("ACE_ASSIGNED") or "",
        engagement_status=r.get("ENGAGEMENT_STATUS") or "Normal",
        status=r.get("STATUS") or "Active",
        use_case_count=int(r.get("USE_CASE_COUNT") or 0),
        total_credits_allocated=float(r["TOTAL_CREDITS_ALLOCATED"]) if r.get("TOTAL_CREDITS_ALLOCATED") else None,
        activation_start_date=_d(r.get("ACTIVATION_START_DATE")),
        acv=float(r["ACV"]) if r.get("ACV") else None,
        consumption_ytd=float(r["CONSUMPTION_YTD"]) if r.get("CONSUMPTION_YTD") else None,
        sig_pipeline=float(r["SIG_PIPELINE"]) if r.get("SIG_PIPELINE") is not None else None,
        sig_aiml=float(r["SIG_AIML"]) if r.get("SIG_AIML") is not None else None,
        health_score=float(r["HEALTH_SCORE"]) if r.get("HEALTH_SCORE") is not None else None,
        momentum=r.get("MOMENTUM"),
        wow_pct_change=float(r["WOW_PCT_CHANGE"]) if r.get("WOW_PCT_CHANGE") is not None else None,
        new_adoption_30d=r.get("NEW_ADOPTION_30D"),
        meetings_last_30d=int(r.get("MEETINGS_LAST_30D") or 0),
        upcoming_meetings_5d=int(r.get("UPCOMING_MEETINGS_5D") or 0),
        last_meeting_date=_d(r.get("LAST_MEETING_DATE")),
        emails_last_30d=int(r.get("EMAILS_LAST_30D") or 0),
        last_email_date=_d(r.get("LAST_EMAIL_DATE")),
        email_trend=r.get("EMAIL_TREND"),
        no_recording=bool(r.get("NO_RECORDING") or False),
        lead_se_email=r.get("LEAD_SE_EMAIL"),
        ae_email=r.get("AE_EMAIL"),
        ae_name=r.get("AE_NAME"),
        engagement_start_date=_d(r.get("ENGAGEMENT_START_DATE")),
        rolloff_date=_d(r.get("ROLLOFF_DATE")),
        primary_ace_email=r.get("PRIMARY_ACE_EMAIL"),
        coverage_ace_email=r.get("COVERAGE_ACE_EMAIL"),
        coverage_until=_d(r.get("COVERAGE_UNTIL")),
    )


def _row_to_use_case(r: dict) -> UseCase:
    notes_text = r.get("NOTES")
    ps_notes: list[PSNote] = []
    if notes_text:
        ps_notes = [PSNote(
            note_id=r["USE_CASE_ID"] + "_note",
            use_case_id=r["USE_CASE_ID"],
            author_id="SE Team",
            content=notes_text,
            created_at=_dt(r.get("LAST_MODIFIED_DATE")) or datetime.utcnow(),
        )]
    return UseCase(
        use_case_id=r["USE_CASE_ID"],
        account_id=r["ACCOUNT_ID"],
        account_name=r.get("ACCOUNT_NAME") or "",
        use_case_name=r.get("USE_CASE_NAME") or "",
        description=r.get("DESCRIPTION") or "",
        status=r.get("STATUS") or "Unknown",
        ps_notes=ps_notes,
        ps_notes_summary=r.get("PS_NOTES_SUMMARY"),
        go_live_date=_d(r.get("GO_LIVE_DATE")),
        target_go_live_date=_d(r.get("TARGET_GO_LIVE_DATE")),
        lead_se=r.get("LEAD_SE") or "",
        ace_assigned=r.get("ACE_ASSIGNED") or "",
        created_date=_d(r.get("CREATED_DATE")),
        last_modified_date=_dt(r.get("LAST_MODIFIED_DATE")),
        last_note_date=_dt(r.get("LAST_NOTE_DATE")),
        stage=r.get("STAGE") or "Unknown",
        complexity=r.get("COMPLEXITY"),
        notes=r.get("NOTES"),
        meddpicc_overall_score=float(r["MEDDPICC_OVERALL_SCORE"]) if r.get("MEDDPICC_OVERALL_SCORE") else None,
        meddpicc_metrics_score=float(r["MEDDPICC_METRICS_SCORE"]) if r.get("MEDDPICC_METRICS_SCORE") else None,
        meddpicc_metrics=r.get("MEDDPICC_METRICS"),
        meddpicc_economic_buyer_score=float(r["MEDDPICC_ECONOMIC_BUYER_SCORE"]) if r.get("MEDDPICC_ECONOMIC_BUYER_SCORE") else None,
        meddpicc_economic_buyer=r.get("MEDDPICC_ECONOMIC_BUYER"),
        meddpicc_decision_criteria_score=float(r["MEDDPICC_DECISION_CRITERIA_SCORE"]) if r.get("MEDDPICC_DECISION_CRITERIA_SCORE") else None,
        meddpicc_decision_criteria=r.get("MEDDPICC_DECISION_CRITERIA"),
        meddpicc_decision_process_score=float(r["MEDDPICC_DECISION_PROCESS_SCORE"]) if r.get("MEDDPICC_DECISION_PROCESS_SCORE") else None,
        meddpicc_decision_process=r.get("MEDDPICC_DECISION_PROCESS"),
        meddpicc_identify_pain_score=float(r["MEDDPICC_IDENTIFY_PAIN_SCORE"]) if r.get("MEDDPICC_IDENTIFY_PAIN_SCORE") else None,
        meddpicc_identify_pain=r.get("MEDDPICC_IDENTIFY_PAIN"),
        meddpicc_champion_score=float(r["MEDDPICC_CHAMPION_SCORE"]) if r.get("MEDDPICC_CHAMPION_SCORE") else None,
        meddpicc_champion=r.get("MEDDPICC_CHAMPION"),
        implementation_start_date=_d(r.get("IMPLEMENTATION_START_DATE")),
        meddpicc_competitor_score=float(r["MEDDPICC_COMPETITOR_SCORE"]) if r.get("MEDDPICC_COMPETITOR_SCORE") else None,
        meddpicc_competitors=r.get("MEDDPICC_COMPETITORS"),
    )


def _derive_forecast(uc: UseCase) -> UseCaseForecast:
    status_lower = (uc.status or "").lower()
    stage_lower = (uc.stage or "").lower()

    if status_lower == "blocked" or "blocked" in stage_lower:
        auto_cat = "Stretch"
    elif any(s in stage_lower for s in ("go-live", "deployed", "won", "implementation")):
        auto_cat = "Commit"
    elif any(s in stage_lower for s in ("pursuit", "technical", "5 -", "6 -")):
        auto_cat = "Most Likely"
    else:
        auto_cat = "Stretch"

    d = uc.go_live_date or uc.target_go_live_date
    if d:
        m = d.month if isinstance(d, date) else int(str(d).split("-")[1])
        y = d.year if isinstance(d, date) else int(str(d).split("-")[0])
        q = (m - 1) // 3 + 1
        quarter = f"Q{q}-{y}"
    else:
        quarter = "Q2-2026"

    return UseCaseForecast(
        use_case_id=uc.use_case_id,
        account_id=uc.account_id,
        auto_category=auto_cat,
        override_category=None,
        override_note=None,
        override_by=None,
        override_at=None,
        pending_approval=False,
        quarter=quarter,
    )

