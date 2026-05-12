import logging
from fastapi import Header, HTTPException
from typing import Optional
from app.models.user import CurrentUser, UserRole
from app.config import settings

logger = logging.getLogger(__name__)


def _fetch_user_from_table(username: str) -> Optional[CurrentUser]:
    try:
        from app.db.connection import get_snowflake_connection
        from snowflake.connector import DictCursor
        conn = get_snowflake_connection()
        cur = conn.cursor(DictCursor)
        cur.execute(
            "SELECT * FROM TEMP.JUSDAVIS.BKMNG_USERS WHERE LOWER(snowflake_username) = %s",
            (username.lower(),),
        )
        row = cur.fetchone()
        if not row:
            return None
        return CurrentUser(
            user_id=row["SNOWFLAKE_USERNAME"],
            email=row["EMAIL"],
            display_name=row["DISPLAY_NAME"],
            role=UserRole.ACEM if row["ROLE"] == "acem" else UserRole.ACE,
            is_admin=bool(row["IS_ADMIN"]),
        )
    except Exception as e:
        logger.warning("Failed to fetch user '%s' from BKMNG_USERS: %s", username, e)
        return None


def _fetch_all_users_from_table() -> list[CurrentUser]:
    try:
        from app.db.connection import get_snowflake_connection
        from snowflake.connector import DictCursor
        conn = get_snowflake_connection()
        cur = conn.cursor(DictCursor)
        cur.execute("SELECT * FROM TEMP.JUSDAVIS.BKMNG_USERS ORDER BY display_name")
        rows = cur.fetchall()
        return [
            CurrentUser(
                user_id=r["SNOWFLAKE_USERNAME"],
                email=r["EMAIL"],
                display_name=r["DISPLAY_NAME"],
                role=UserRole.ACEM if r["ROLE"] == "acem" else UserRole.ACE,
                is_admin=bool(r["IS_ADMIN"]),
            )
            for r in rows
        ]
    except Exception as e:
        logger.warning("Failed to fetch all users from BKMNG_USERS: %s", e)
        return []


def _maybe_promote_admin(user: CurrentUser, user_id: str) -> CurrentUser:
    admin_ids = settings.admin_users_set
    if admin_ids and user_id.upper() in admin_ids and not user.is_admin:
        return user.model_copy(update={"is_admin": True})
    return user


async def get_current_user(
    sf_context_current_user: Optional[str] = Header(None, alias="Sf-Context-Current-User"),
    x_mock_user: Optional[str] = Header(None),
) -> CurrentUser:
    if settings.spcs_mode:
        selected = x_mock_user or (sf_context_current_user or "").strip()
        default_id = settings.spcs_default_user_id
    else:
        selected = x_mock_user or settings.local_default_user_id
        default_id = settings.local_default_user_id

    for candidate in (selected, default_id):
        if not candidate:
            continue
        user = _fetch_user_from_table(candidate)
        if user:
            return _maybe_promote_admin(user, candidate)

    logger.error(
        "Auth failed: '%s' / default '%s' not in BKMNG_USERS",
        selected, default_id,
    )
    raise HTTPException(status_code=503, detail="Auth unavailable: BKMNG_USERS not reachable")
