from __future__ import annotations

from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.config import settings
from app.models.user import CurrentUser

router = APIRouter(prefix="/admin", tags=["admin"])


class DailyCreditRow(BaseModel):
    date: str
    credits: float


class ServiceSummary(BaseModel):
    service_name: str
    credits_30d: float
    credits_7d: float
    status: str


class CostOverview(BaseModel):
    credits_today: float
    credits_7d: float
    credits_30d: float
    daily_series: list[DailyCreditRow]
    services: list[ServiceSummary]
    projected_monthly: float
    budget_credits: float | None


def _require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _mock_daily_series(days: int = 30) -> list[DailyCreditRow]:
    import hashlib
    today = date.today()
    rows: list[DailyCreditRow] = []
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        seed = int(hashlib.md5(d.isoformat().encode()).hexdigest()[:8], 16)
        credits = 2.5 + (seed % 1000) / 400.0
        rows.append(DailyCreditRow(date=d.isoformat(), credits=round(credits, 3)))
    return rows


@router.get("/costs", response_model=CostOverview)
async def get_cost_overview(
    _user: CurrentUser = Depends(_require_admin),
) -> CostOverview:
    if not settings.spcs_mode:
        daily = _mock_daily_series(30)
        credits_30d = round(sum(r.credits for r in daily), 2)
        credits_7d = round(sum(r.credits for r in daily[-7:]), 2)
        credits_today = daily[-1].credits if daily else 0.0
        projected = round((credits_30d / 30) * 30, 2)
        return CostOverview(
            credits_today=credits_today,
            credits_7d=credits_7d,
            credits_30d=credits_30d,
            daily_series=daily,
            services=[
                ServiceSummary(service_name="BKMNG_SERVICE", credits_30d=credits_30d, credits_7d=credits_7d, status="RUNNING"),
            ],
            projected_monthly=projected,
            budget_credits=None,
        )

    try:
        import snowflake.connector
        conn = snowflake.connector.connect(
            account=settings.snowflake_account,
            user=settings.snowflake_user,
            password=settings.snowflake_password,
            warehouse=settings.snowflake_warehouse,
            database="SNOWFLAKE",
            schema="ACCOUNT_USAGE",
            role=settings.snowflake_role,
        )
        cur = conn.cursor()
        cur.execute("""
            SELECT
                DATE_TRUNC('day', START_TIME)::DATE AS day,
                SUM(CREDITS_USED) AS credits
            FROM SNOWFLAKE.ACCOUNT_USAGE.SNOWPARK_CONTAINER_SERVICES_HISTORY
            WHERE SERVICE_NAME ILIKE '%BKMNG%'
              AND START_TIME >= DATEADD('day', -30, CURRENT_TIMESTAMP())
            GROUP BY 1
            ORDER BY 1
        """)
        rows = cur.fetchall()
        daily = [DailyCreditRow(date=str(r[0]), credits=float(r[1])) for r in rows]
        cur.execute("""
            SELECT SUM(CREDITS_USED)
            FROM SNOWFLAKE.ACCOUNT_USAGE.METERING_DAILY_HISTORY
            WHERE SERVICE_TYPE = 'SNOWPARK_CONTAINER_SERVICES'
              AND USAGE_DATE >= DATEADD('day', -30, CURRENT_DATE())
        """)
        total_row = cur.fetchone()
        credits_30d = float(total_row[0] or 0)
        cur.close()
        conn.close()
        credits_7d = round(sum(r.credits for r in daily[-7:]), 2)
        credits_today = daily[-1].credits if daily else 0.0
        return CostOverview(
            credits_today=credits_today,
            credits_7d=credits_7d,
            credits_30d=credits_30d,
            daily_series=daily,
            services=[ServiceSummary(service_name="BKMNG_SERVICE", credits_30d=credits_30d, credits_7d=credits_7d, status="RUNNING")],
            projected_monthly=round((credits_30d / 30) * 30, 2),
            budget_credits=None,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Failed to query Snowflake usage: {exc}") from exc
