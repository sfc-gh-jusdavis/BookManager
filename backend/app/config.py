import os
from pydantic_settings import BaseSettings
from typing import Optional

_ENV_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")


class Settings(BaseSettings):
    app_env: str = "development"
    mock_data: bool = False

    spcs_mode: bool = False
    admin_users: str = ""
    spcs_default_user_id: str = "ace-jane"
    local_default_user_id: Optional[str] = None

    snowflake_connection_name: Optional[str] = None
    snowflake_account: Optional[str] = None
    snowflake_user: Optional[str] = None
    snowflake_pat: Optional[str] = None
    snowflake_warehouse: Optional[str] = None
    snowflake_database: Optional[str] = None
    snowflake_schema: Optional[str] = None
    snowflake_role: Optional[str] = None

    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = _ENV_FILE
        extra = "ignore"

    @property
    def admin_users_set(self) -> set[str]:
        return {u.strip().upper() for u in self.admin_users.split(",") if u.strip()}


settings = Settings()
