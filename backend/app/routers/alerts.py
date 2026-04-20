from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.models.user import CurrentUser
from app.services.snowflake_service import SnowflakeDataService
from app.services import get_data_service

router = APIRouter(prefix="/alerts", tags=["alerts"])


class AlertItem(BaseModel):
    alert_id: str
    user_email: str
    signal_id: Optional[str]
    signal_type: str
    account_id: Optional[str]
    account_name: Optional[str]
    text: Optional[str]
    priority: Literal["high", "medium", "low"] = "medium"
    source: Optional[str]
    is_read: bool
    is_dismissed: bool
    created_at: Optional[str]


class MuteAlertRequest(BaseModel):
    scope: Literal["instance", "type"]
    duration_days: int = 3


@router.get("", response_model=list[AlertItem])
async def get_alerts(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> list[AlertItem]:
    cur = data._cursor()
    cur.execute(
        """
        SELECT ALERT_ID, USER_EMAIL, SIGNAL_ID, SIGNAL_TYPE, ACCOUNT_ID,
               ACCOUNT_NAME, TEXT, PRIORITY, SOURCE, IS_READ, IS_DISMISSED,
               CREATED_AT::VARCHAR AS CREATED_AT
        FROM BKMNG_USER_ALERTS ua
        WHERE ua.USER_EMAIL = %s
          AND ua.IS_DISMISSED = FALSE
          AND NOT EXISTS (
              SELECT 1 FROM BKMNG_ALERT_MUTES m
              WHERE m.USER_EMAIL = ua.USER_EMAIL
                AND m.SIGNAL_ID = ua.SIGNAL_ID
                AND m.MUTED_UNTIL > CURRENT_TIMESTAMP()
          )
          AND NOT EXISTS (
              SELECT 1 FROM BKMNG_ALERT_MUTES m
              WHERE m.USER_EMAIL = ua.USER_EMAIL
                AND m.SIGNAL_TYPE = ua.SIGNAL_TYPE
                AND m.SIGNAL_ID IS NULL
                AND m.MUTED_UNTIL > CURRENT_TIMESTAMP()
          )
        ORDER BY
            CASE PRIORITY WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
            CREATED_AT DESC
        LIMIT 50
        """,
        (user.email,),
    )
    rows = cur.fetchall()
    return [
        AlertItem(
            alert_id=r.get("ALERT_ID", ""),
            user_email=r.get("USER_EMAIL", ""),
            signal_id=r.get("SIGNAL_ID"),
            signal_type=r.get("SIGNAL_TYPE", ""),
            account_id=r.get("ACCOUNT_ID"),
            account_name=r.get("ACCOUNT_NAME"),
            text=r.get("TEXT"),
            priority=r.get("PRIORITY", "medium"),
            source=r.get("SOURCE"),
            is_read=bool(r.get("IS_READ", False)),
            is_dismissed=bool(r.get("IS_DISMISSED", False)),
            created_at=r.get("CREATED_AT"),
        )
        for r in rows
    ]


@router.get("/count")
async def get_alert_count(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict[str, int]:
    cur = data._cursor()
    cur.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM BKMNG_USER_ALERTS ua
        WHERE ua.USER_EMAIL = %s
          AND ua.IS_READ = FALSE
          AND ua.IS_DISMISSED = FALSE
          AND NOT EXISTS (
              SELECT 1 FROM BKMNG_ALERT_MUTES m
              WHERE m.USER_EMAIL = ua.USER_EMAIL
                AND m.SIGNAL_ID = ua.SIGNAL_ID
                AND m.MUTED_UNTIL > CURRENT_TIMESTAMP()
          )
          AND NOT EXISTS (
              SELECT 1 FROM BKMNG_ALERT_MUTES m
              WHERE m.USER_EMAIL = ua.USER_EMAIL
                AND m.SIGNAL_TYPE = ua.SIGNAL_TYPE
                AND m.SIGNAL_ID IS NULL
                AND m.MUTED_UNTIL > CURRENT_TIMESTAMP()
          )
        """,
        (user.email,),
    )
    row = cur.fetchone() or {}
    return {"count": int(row.get("CNT", 0) or 0)}


@router.post("/{alert_id}/read")
async def mark_alert_read(
    alert_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict[str, str]:
    cur = data._cursor()
    cur.execute(
        "UPDATE BKMNG_USER_ALERTS SET IS_READ = TRUE WHERE ALERT_ID = %s AND USER_EMAIL = %s",
        (alert_id, user.email),
    )
    return {"status": "ok"}


@router.post("/{alert_id}/dismiss")
async def dismiss_alert(
    alert_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict[str, str]:
    cur = data._cursor()
    cur.execute(
        "UPDATE BKMNG_USER_ALERTS SET IS_DISMISSED = TRUE WHERE ALERT_ID = %s AND USER_EMAIL = %s",
        (alert_id, user.email),
    )
    return {"status": "ok"}


@router.post("/{alert_id}/mute")
async def mute_alert(
    alert_id: str,
    req: MuteAlertRequest,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict[str, str]:
    cur = data._cursor()
    cur.execute(
        "SELECT SIGNAL_ID, SIGNAL_TYPE FROM BKMNG_USER_ALERTS WHERE ALERT_ID = %s AND USER_EMAIL = %s",
        (alert_id, user.email),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")

    signal_id = row["SIGNAL_ID"] if req.scope == "instance" else None
    signal_type = row["SIGNAL_TYPE"]

    cur.execute(
        """
        INSERT INTO BKMNG_ALERT_MUTES (USER_EMAIL, SIGNAL_ID, SIGNAL_TYPE, MUTED_UNTIL)
        SELECT %s, %s, %s, DATEADD('day', %s, CURRENT_TIMESTAMP())
        WHERE NOT EXISTS (
            SELECT 1 FROM BKMNG_ALERT_MUTES
            WHERE USER_EMAIL = %s
              AND SIGNAL_TYPE = %s
              AND (SIGNAL_ID = %s OR (%s IS NULL AND SIGNAL_ID IS NULL))
              AND MUTED_UNTIL > CURRENT_TIMESTAMP()
        )
        """,
        (user.email, signal_id, signal_type, req.duration_days,
         user.email, signal_type, signal_id, signal_id),
    )
    return {"status": "ok", "scope": req.scope, "duration_days": req.duration_days}


@router.post("/{alert_id}/unmute")
async def unmute_alert(
    alert_id: str,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> dict[str, str]:
    cur = data._cursor()
    cur.execute(
        "SELECT SIGNAL_ID, SIGNAL_TYPE FROM BKMNG_USER_ALERTS WHERE ALERT_ID = %s AND USER_EMAIL = %s",
        (alert_id, user.email),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")

    cur.execute(
        """
        DELETE FROM BKMNG_ALERT_MUTES
        WHERE USER_EMAIL = %s
          AND SIGNAL_TYPE = %s
          AND (SIGNAL_ID = %s OR SIGNAL_ID IS NULL)
        """,
        (user.email, row["SIGNAL_TYPE"], row["SIGNAL_ID"]),
    )
    return {"status": "ok"}
