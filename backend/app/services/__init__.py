from app.services.snowflake_service import SnowflakeDataService

_service: SnowflakeDataService | None = None


def get_data_service() -> SnowflakeDataService:
    global _service
    if _service is None:
        _service = SnowflakeDataService()
    return _service
