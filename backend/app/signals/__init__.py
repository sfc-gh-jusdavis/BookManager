from __future__ import annotations

from app.signals.registry import SignalRegistry
from app.signals.providers.core import CoreProvider
from app.signals.providers.support import SupportProvider
from app.signals.providers.user_context import UserContextProvider

_registry: SignalRegistry | None = None


def get_registry() -> SignalRegistry:
    global _registry
    if _registry is None:
        _registry = SignalRegistry()
        _register_all_providers(_registry)
    return _registry


def _register_all_providers(registry: SignalRegistry) -> None:
    registry.register(CoreProvider())
    registry.register(SupportProvider())
    registry.register(UserContextProvider())
    # Future: registry.register(SetSailProvider())
    # Future: registry.register(GongProvider())
