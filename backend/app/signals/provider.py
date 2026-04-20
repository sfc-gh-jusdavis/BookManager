from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from app.signals.models import Signal, SignalScope

if TYPE_CHECKING:
    from snowflake.connector import DictCursor


class SignalProvider(ABC):
    name: str

    @abstractmethod
    def collect(self, cur: "DictCursor", scope: SignalScope) -> list[Signal]:
        ...

    def format_for_ai(self, signals: list[Signal]) -> str:
        lines = []
        for s in signals:
            lines.append(f"[{s.priority.upper()}/{s.category}] {s.text}: {s.summary[:150]}")
        return "\n".join(lines)
