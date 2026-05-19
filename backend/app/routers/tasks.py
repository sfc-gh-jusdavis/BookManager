from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.models.user import CurrentUser
from app.services.snowflake_service import SnowflakeDataService
from app.services import get_data_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


class UserTask(BaseModel):
    task_id: str
    user_email: str
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    column_type: Literal["reach_out", "follow_up", "prepare", "investigate", "admin"]
    priority: Literal["high", "medium", "low"] = "medium"
    source: Optional[str] = None
    source_ref: Optional[str] = None
    status: Literal["open", "done", "dismissed", "snoozed"] = "open"
    due_hint: Optional[str] = None
    user_context: Optional[str] = None
    resolution_note: Optional[str] = None
    snoozed_until: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
    dismissed_at: Optional[str] = None


class TaskCounts(BaseModel):
    total_open: int = 0
    high_priority: int = 0
    reach_out: int = 0
    follow_up: int = 0
    prepare: int = 0
    investigate: int = 0
    admin: int = 0


class CreateTaskRequest(BaseModel):
    title: str
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    column_type: Literal["reach_out", "follow_up", "prepare", "investigate", "admin"] = "follow_up"
    priority: Literal["high", "medium", "low"] = "medium"
    description: Optional[str] = None
    due_hint: Optional[str] = None


class UpdateTaskRequest(BaseModel):
    status: Optional[Literal["open", "done", "dismissed", "snoozed"]] = None
    column_type: Optional[Literal["reach_out", "follow_up", "prepare", "investigate", "admin"]] = None
    priority: Optional[Literal["high", "medium", "low"]] = None
    user_context: Optional[str] = None
    resolution_note: Optional[str] = None
    snooze_preset: Optional[Literal["tomorrow", "3d", "1wk"]] = None


@router.get("", response_model=list[UserTask])
async def list_tasks(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
    status: Optional[str] = Query(default="open"),
    column_type: Optional[str] = Query(default=None),
    account_id: Optional[str] = Query(default=None),
) -> list[UserTask]:
    cur = data._cursor()
    where_parts = ["USER_EMAIL = %s"]
    params: list = [user.email]

    if status:
        where_parts.append("STATUS = %s")
        params.append(status)
    if column_type:
        where_parts.append("COLUMN_TYPE = %s")
        params.append(column_type)
    if account_id:
        where_parts.append("ACCOUNT_ID = %s")
        params.append(account_id)

    where_parts.append(
        "(SNOOZED_UNTIL IS NULL OR SNOOZED_UNTIL <= CURRENT_TIMESTAMP())"
    )

    where_clause = " AND ".join(where_parts)
    cur.execute(
        f"""
        SELECT TASK_ID, USER_EMAIL, ACCOUNT_ID, ACCOUNT_NAME, TITLE, DESCRIPTION,
               COLUMN_TYPE, PRIORITY, SOURCE, SOURCE_REF, STATUS, DUE_HINT,
               USER_CONTEXT, RESOLUTION_NOTE, SNOOZED_UNTIL::VARCHAR AS SNOOZED_UNTIL,
               CREATED_AT::VARCHAR AS CREATED_AT,
               COMPLETED_AT::VARCHAR AS COMPLETED_AT,
               DISMISSED_AT::VARCHAR AS DISMISSED_AT
        FROM BKMNG_USER_TASKS
        WHERE {where_clause}
        ORDER BY
            CASE PRIORITY WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
            CREATED_AT DESC
        LIMIT 500
        """,
        params,
    )
    rows = cur.fetchall()
    return [
        UserTask(
            task_id=r["TASK_ID"],
            user_email=r["USER_EMAIL"],
            account_id=r.get("ACCOUNT_ID"),
            account_name=r.get("ACCOUNT_NAME"),
            title=r["TITLE"],
            description=r.get("DESCRIPTION"),
            column_type=r["COLUMN_TYPE"],
            priority=r.get("PRIORITY", "medium"),
            source=r.get("SOURCE"),
            source_ref=r.get("SOURCE_REF"),
            status=r.get("STATUS", "open"),
            due_hint=r.get("DUE_HINT"),
            user_context=r.get("USER_CONTEXT"),
            resolution_note=r.get("RESOLUTION_NOTE"),
            snoozed_until=r.get("SNOOZED_UNTIL"),
            created_at=r.get("CREATED_AT"),
            completed_at=r.get("COMPLETED_AT"),
            dismissed_at=r.get("DISMISSED_AT"),
        )
        for r in rows
    ]


@router.get("/counts", response_model=TaskCounts)
async def get_task_counts(
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> TaskCounts:
    cur = data._cursor()
    cur.execute(
        """
        SELECT
            COUNT(*) AS TOTAL_OPEN,
            SUM(CASE WHEN PRIORITY = 'high' THEN 1 ELSE 0 END) AS HIGH_PRIORITY,
            SUM(CASE WHEN COLUMN_TYPE = 'reach_out' THEN 1 ELSE 0 END) AS REACH_OUT,
            SUM(CASE WHEN COLUMN_TYPE = 'follow_up' THEN 1 ELSE 0 END) AS FOLLOW_UP,
            SUM(CASE WHEN COLUMN_TYPE = 'prepare' THEN 1 ELSE 0 END) AS PREPARE,
            SUM(CASE WHEN COLUMN_TYPE = 'investigate' THEN 1 ELSE 0 END) AS INVESTIGATE,
            SUM(CASE WHEN COLUMN_TYPE = 'admin' THEN 1 ELSE 0 END) AS ADMIN
        FROM BKMNG_USER_TASKS
        WHERE USER_EMAIL = %s
          AND STATUS = 'open'
          AND (SNOOZED_UNTIL IS NULL OR SNOOZED_UNTIL <= CURRENT_TIMESTAMP())
        """,
        (user.email,),
    )
    r = cur.fetchone()
    if not r:
        return TaskCounts()
    return TaskCounts(
        total_open=r.get("TOTAL_OPEN", 0) or 0,
        high_priority=r.get("HIGH_PRIORITY", 0) or 0,
        reach_out=r.get("REACH_OUT", 0) or 0,
        follow_up=r.get("FOLLOW_UP", 0) or 0,
        prepare=r.get("PREPARE", 0) or 0,
        investigate=r.get("INVESTIGATE", 0) or 0,
        admin=r.get("ADMIN", 0) or 0,
    )


@router.post("", response_model=UserTask, status_code=201)
async def create_task(
    body: CreateTaskRequest,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> UserTask:
    cur = data._cursor()
    cur.execute(
        """
        INSERT INTO BKMNG_USER_TASKS
            (USER_EMAIL, ACCOUNT_ID, ACCOUNT_NAME, TITLE, DESCRIPTION, COLUMN_TYPE, PRIORITY, DUE_HINT, SOURCE)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'manual')
        """,
        (
            user.email,
            body.account_id,
            body.account_name,
            body.title,
            body.description,
            body.column_type,
            body.priority,
            body.due_hint,
        ),
    )
    cur.execute(
        """
        SELECT TASK_ID, USER_EMAIL, ACCOUNT_ID, ACCOUNT_NAME, TITLE, DESCRIPTION,
               COLUMN_TYPE, PRIORITY, SOURCE, SOURCE_REF, STATUS, DUE_HINT,
               USER_CONTEXT, RESOLUTION_NOTE, SNOOZED_UNTIL::VARCHAR AS SNOOZED_UNTIL,
               CREATED_AT::VARCHAR AS CREATED_AT,
               COMPLETED_AT::VARCHAR AS COMPLETED_AT,
               DISMISSED_AT::VARCHAR AS DISMISSED_AT
        FROM BKMNG_USER_TASKS
        WHERE USER_EMAIL = %s AND TITLE = %s AND SOURCE = 'manual'
        ORDER BY CREATED_AT DESC
        LIMIT 1
        """,
        (user.email, body.title),
    )
    r = cur.fetchone()
    if not r:
        raise HTTPException(status_code=500, detail="Failed to create task")
    return UserTask(
        task_id=r["TASK_ID"],
        user_email=r["USER_EMAIL"],
        account_id=r.get("ACCOUNT_ID"),
        account_name=r.get("ACCOUNT_NAME"),
        title=r["TITLE"],
        description=r.get("DESCRIPTION"),
        column_type=r["COLUMN_TYPE"],
        priority=r.get("PRIORITY", "medium"),
        source=r.get("SOURCE"),
        source_ref=r.get("SOURCE_REF"),
        status=r.get("STATUS", "open"),
        due_hint=r.get("DUE_HINT"),
        user_context=r.get("USER_CONTEXT"),
        resolution_note=r.get("RESOLUTION_NOTE"),
        snoozed_until=r.get("SNOOZED_UNTIL"),
        created_at=r.get("CREATED_AT"),
        completed_at=r.get("COMPLETED_AT"),
        dismissed_at=r.get("DISMISSED_AT"),
    )


class MuteSignalRequest(BaseModel):
    reason: str


@router.post("/{task_id}/mute", status_code=204)
async def mute_signal_for_task(
    task_id: str,
    body: MuteSignalRequest,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> None:
    cur = data._cursor()
    cur.execute(
        """
        SELECT ACCOUNT_ID, SOURCE
        FROM BKMNG_USER_TASKS
        WHERE TASK_ID = %s AND USER_EMAIL = %s
        """,
        (task_id, user.email),
    )
    r = cur.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Task not found")

    account_id = r.get("ACCOUNT_ID")
    source = r.get("SOURCE") or ""
    if not account_id or not source.startswith("signal:"):
        raise HTTPException(status_code=400, detail="Task is not signal-derived or has no account")

    signal_type = source.removeprefix("signal:")

    cur.execute(
        """
        INSERT INTO BKMNG_SIGNAL_MUTES (USER_EMAIL, ACCOUNT_ID, SIGNAL_TYPE, REASON)
        SELECT %s, %s, %s, %s
        WHERE NOT EXISTS (
            SELECT 1 FROM BKMNG_SIGNAL_MUTES
            WHERE USER_EMAIL = %s AND ACCOUNT_ID = %s AND SIGNAL_TYPE = %s
        )
        """,
        (user.email, account_id, signal_type, body.reason, user.email, account_id, signal_type),
    )

    cur.execute(
        """
        UPDATE BKMNG_USER_TASKS
        SET STATUS = 'dismissed', DISMISSED_AT = CURRENT_TIMESTAMP()
        WHERE TASK_ID = %s AND USER_EMAIL = %s
        """,
        (task_id, user.email),
    )
    return None


@router.patch("/{task_id}", response_model=UserTask)
async def update_task(
    task_id: str,
    body: UpdateTaskRequest,
    user: CurrentUser = Depends(get_current_user),
    data: SnowflakeDataService = Depends(get_data_service),
) -> UserTask:
    cur = data._cursor()

    set_parts: list[str] = []
    params: list = []

    if body.status:
        set_parts.append("STATUS = %s")
        params.append(body.status)
        if body.status == "done":
            set_parts.append("COMPLETED_AT = CURRENT_TIMESTAMP()")
        elif body.status == "dismissed":
            set_parts.append("DISMISSED_AT = CURRENT_TIMESTAMP()")

    if body.column_type:
        set_parts.append("COLUMN_TYPE = %s")
        params.append(body.column_type)

    if body.priority:
        set_parts.append("PRIORITY = %s")
        params.append(body.priority)

    if body.user_context is not None:
        set_parts.append("USER_CONTEXT = %s")
        params.append(body.user_context)

    if body.resolution_note is not None:
        set_parts.append("RESOLUTION_NOTE = %s")
        params.append(body.resolution_note)

    if body.snooze_preset:
        set_parts.append("STATUS = 'snoozed'")
        snooze_map = {"tomorrow": 1, "3d": 3, "1wk": 7}
        days = snooze_map.get(body.snooze_preset, 3)
        set_parts.append(f"SNOOZED_UNTIL = DATEADD('day', {days}, CURRENT_TIMESTAMP())")

    if not set_parts:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.extend([task_id, user.email])
    cur.execute(
        f"""
        UPDATE BKMNG_USER_TASKS
        SET {', '.join(set_parts)}
        WHERE TASK_ID = %s AND USER_EMAIL = %s
        """,
        params,
    )

    cur.execute(
        """
        SELECT TASK_ID, USER_EMAIL, ACCOUNT_ID, ACCOUNT_NAME, TITLE, DESCRIPTION,
               COLUMN_TYPE, PRIORITY, SOURCE, SOURCE_REF, STATUS, DUE_HINT,
               USER_CONTEXT, RESOLUTION_NOTE, SNOOZED_UNTIL::VARCHAR AS SNOOZED_UNTIL,
               CREATED_AT::VARCHAR AS CREATED_AT,
               COMPLETED_AT::VARCHAR AS COMPLETED_AT,
               DISMISSED_AT::VARCHAR AS DISMISSED_AT
        FROM BKMNG_USER_TASKS
        WHERE TASK_ID = %s
        """,
        (task_id,),
    )
    r = cur.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Task not found")
    return UserTask(
        task_id=r["TASK_ID"],
        user_email=r["USER_EMAIL"],
        account_id=r.get("ACCOUNT_ID"),
        account_name=r.get("ACCOUNT_NAME"),
        title=r["TITLE"],
        description=r.get("DESCRIPTION"),
        column_type=r["COLUMN_TYPE"],
        priority=r.get("PRIORITY", "medium"),
        source=r.get("SOURCE"),
        source_ref=r.get("SOURCE_REF"),
        status=r.get("STATUS", "open"),
        due_hint=r.get("DUE_HINT"),
        user_context=r.get("USER_CONTEXT"),
        resolution_note=r.get("RESOLUTION_NOTE"),
        snoozed_until=r.get("SNOOZED_UNTIL"),
        created_at=r.get("CREATED_AT"),
        completed_at=r.get("COMPLETED_AT"),
        dismissed_at=r.get("DISMISSED_AT"),
    )
