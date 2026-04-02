from app.mocks.service import MockDataService


def get_data_service() -> MockDataService:
    return MockDataService()
