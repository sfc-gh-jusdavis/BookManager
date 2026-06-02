import os

import snowflake.connector
from app.config import settings

_connection = None

# SPCS injects an OAuth token here when the service runs on Snowflake SPCS.
# Re-read on every new connection because the platform rotates it periodically.
_SPCS_TOKEN_FILE = "/snowflake/session/token"


def _create_connection():
    connection_name = settings.snowflake_connection_name
    if connection_name:
        overrides = {}
        if settings.snowflake_database:
            overrides["database"] = settings.snowflake_database
        if settings.snowflake_schema:
            overrides["schema"] = settings.snowflake_schema
        if settings.snowflake_warehouse:
            overrides["warehouse"] = settings.snowflake_warehouse
        if settings.snowflake_role:
            overrides["role"] = settings.snowflake_role
        return snowflake.connector.connect(connection_name=connection_name, **overrides)

    # SPCS on Snowhouse: use the platform-injected OAuth token (no PAT required).
    if os.path.exists(_SPCS_TOKEN_FILE):
        with open(_SPCS_TOKEN_FILE) as f:
            token = f.read().strip()
        return snowflake.connector.connect(
            host=os.environ.get("SNOWFLAKE_HOST", ""),
            account=settings.snowflake_account,
            authenticator="oauth",
            token=token,
            warehouse=settings.snowflake_warehouse,
            database=settings.snowflake_database,
            schema=settings.snowflake_schema,
            role=settings.snowflake_role,
        )

    if not settings.snowflake_pat:
        raise RuntimeError(
            "Set SNOWFLAKE_CONNECTION_NAME (local dev), deploy to SPCS, "
            "or set SNOWFLAKE_PAT in .env"
        )

    return snowflake.connector.connect(
        account=settings.snowflake_account,
        user=settings.snowflake_user,
        password=settings.snowflake_pat,
        warehouse=settings.snowflake_warehouse,
        database=settings.snowflake_database,
        schema=settings.snowflake_schema,
        role=settings.snowflake_role,
    )


def get_snowflake_connection():
    global _connection
    if _connection is None or _connection.is_closed():
        _connection = _create_connection()
    return _connection
