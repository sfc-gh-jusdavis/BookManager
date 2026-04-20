from fastapi import Header, HTTPException
from typing import Optional
from app.models.user import CurrentUser, UserRole
from app.config import settings

MOCK_USERS: dict[str, CurrentUser] = {
    "jusdavis":     CurrentUser(user_id="jusdavis",     email="redacted@example.com",            display_name="Justin Davis",       role=UserRole.ACE),
    "ufitolo":      CurrentUser(user_id="ufitolo",      email="redacted@example.com",          display_name="Ufi Olakpe",         role=UserRole.ACEM),
    "gilee":        CurrentUser(user_id="gilee",        email="redacted@example.com",         display_name="Gilbert Lee",        role=UserRole.ACEM),
    "dbaccus":      CurrentUser(user_id="dbaccus",      email="redacted@example.com",       display_name="Daunte Baccus",      role=UserRole.ACEM, is_admin=True),
    "aardestani":   CurrentUser(user_id="aardestani",   email="redacted@example.com",       display_name="Ali Ardestani",      role=UserRole.ACE),
    "aflors":       CurrentUser(user_id="aflors",       email="redacted@example.com",       display_name="Allison Flors",      role=UserRole.ACE),
    "awickman":     CurrentUser(user_id="awickman",     email="redacted@example.com",        display_name="Andy Wickman",       role=UserRole.ACE),
    "cfriend":      CurrentUser(user_id="cfriend",      email="redacted@example.com",         display_name="Cody Friend",        role=UserRole.ACE),
    "dhkim":        CurrentUser(user_id="dhkim",        email="redacted@example.com",         display_name="David H. Kim",       role=UserRole.ACE),
    "edelatorre":   CurrentUser(user_id="edelatorre",   email="redacted@example.com",      display_name="Emma Delatorre",     role=UserRole.ACE),
    "jkirshenbaum": CurrentUser(user_id="jkirshenbaum", email="redacted@example.com",     display_name="Joe Kirshenbaum",    role=UserRole.ACE),
    "jfarinacci":   CurrentUser(user_id="jfarinacci",   email="redacted@example.com",     display_name="Jorge Farinacci",    role=UserRole.ACE),
    "mkeeter":      CurrentUser(user_id="mkeeter",      email="redacted@example.com",          display_name="Max Keeter",         role=UserRole.ACE),
    "mvandersteen": CurrentUser(user_id="mvandersteen", email="redacted@example.com",   display_name="Micah Vandersteen",  role=UserRole.ACE),
    "nessner":      CurrentUser(user_id="nessner",      email="redacted@example.com",         display_name="Nick Essner",        role=UserRole.ACE),
    "pcanciari":    CurrentUser(user_id="pcanciari",    email="redacted@example.com",      display_name="Paolo Canciari",     role=UserRole.ACE),
    "ppatel":       CurrentUser(user_id="ppatel",       email="redacted@example.com",        display_name="Paragi Patel",       role=UserRole.ACE),
    "pmonteiro":    CurrentUser(user_id="pmonteiro",    email="redacted@example.com",      display_name="Paulo Monteiro",     role=UserRole.ACE),
    "sbwilliams":   CurrentUser(user_id="sbwilliams",   email="redacted@example.com",   display_name="Steven B. Williams", role=UserRole.ACE),
}


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
    except Exception:
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
    except Exception:
        return []


async def get_current_user(
    sf_context_current_user: Optional[str] = Header(None, alias="Sf-Context-Current-User"),
    x_mock_user: Optional[str] = Header(None),
) -> CurrentUser:
    if settings.spcs_mode:
        selected = x_mock_user or (sf_context_current_user or "").strip()
        user = _fetch_user_from_table(selected)
        if user:
            return user
        default = _fetch_user_from_table(settings.spcs_default_user_id)
        if default:
            return default
        return CurrentUser(
            user_id="anonymous",
            email="redacted@example.com",
            display_name="Demo User",
            role=UserRole.ACE,
            is_admin=False,
        )

    user_id = x_mock_user or "jusdavis"
    user = MOCK_USERS.get(user_id) or MOCK_USERS["jusdavis"]
    admin_ids = settings.admin_users_set
    is_admin = user_id.upper() in admin_ids if admin_ids else False
    if is_admin and not user.is_admin:
        return user.model_copy(update={"is_admin": True})
    return user
