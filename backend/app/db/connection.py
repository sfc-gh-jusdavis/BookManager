import snowflake.connector
from app.config import settings

_connection = None


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

    if not settings.snowflake_pat:
        raise RuntimeError(
            "Set SNOWFLAKE_CONNECTION_NAME (local dev) or SNOWFLAKE_PAT (production) in .env"
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
