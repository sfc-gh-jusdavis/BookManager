from __future__ import annotations

import threading
import time
from typing import Any, Optional

_cache: dict[str, tuple[Any, float]] = {}
_lock = threading.Lock()


def cache_get(key: str) -> Optional[Any]:
    with _lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.monotonic() > expires_at:
            del _cache[key]
            return None
        return value


def cache_set(key: str, value: Any, ttl: int) -> None:
    with _lock:
        _cache[key] = (value, time.monotonic() + ttl)


def cache_delete(key: str) -> None:
    with _lock:
        _cache.pop(key, None)


def cache_invalidate_prefix(prefix: str) -> None:
    with _lock:
        keys = [k for k in _cache if k.startswith(prefix)]
        for k in keys:
            del _cache[k]
