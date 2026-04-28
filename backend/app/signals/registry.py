from __future__ import annotations

from app.signals.models import Signal, SignalScope
from app.signals.provider import SignalProvider


class SignalRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, SignalProvider] = {}

    def register(self, provider: SignalProvider) -> None:
        self._providers[provider.name] = provider

    def collect_all(self, cur, scope: SignalScope) -> list[Signal]:
        all_signals: list[Signal] = []
        for provider in self._providers.values():
            all_signals.extend(provider.collect(cur, scope))

        seen: set[tuple] = set()
        deduped: list[Signal] = []
        for s in all_signals:
            key = (s.signal_type, s.account_id)
            if key not in seen:
                seen.add(key)
                deduped.append(s)

        rank = {"high": 0, "medium": 1, "low": 2}
        deduped.sort(key=lambda s: rank.get(s.priority, 2))
        return deduped

    def get_nba_items(self, cur, scope: SignalScope, cap: int = 8, cap_client: int = 10, cap_admin: int = 8):
        from app.models.nba import NBAItem
        signals = self.collect_all(cur, scope)

        client_signals = [s for s in signals if s.lane == "client"][:cap_client]
        admin_signals  = [s for s in signals if s.lane == "admin"][:cap_admin]

        def _to_nba(sigs: list[Signal]) -> list[NBAItem]:
            return [
                NBAItem(
                    id=s.id,
                    signal_type=s.signal_type,
                    account_id=s.account_id,
                    account_name=s.account_name,
                    priority=s.priority,
                    text=s.text,
                    summary=s.summary,
                    lane=s.lane,
                    category=s.category,
                )
                for s in sigs
            ]

        return _to_nba(client_signals), _to_nba(admin_signals)

    def get_ai_context(self, cur, scope: SignalScope, limit: int = 6) -> str:
        signals = self.collect_all(cur, scope)[:limit]
        if not signals:
            return ""

        by_source: dict[str, list[Signal]] = {}
        for s in signals:
            by_source.setdefault(s.source, []).append(s)

        sections: list[str] = []
        for source_name, source_signals in by_source.items():
            provider = self._providers.get(source_name)
            if provider:
                sections.append(provider.format_for_ai(source_signals))
            else:
                for s in source_signals:
                    sections.append(f"[{s.priority.upper()}] {s.text}")

        return "TOP SIGNALS:\n" + "\n".join(sections) + "\n"

    def get_alert_eligible(self, cur, scope: SignalScope) -> list[Signal]:
        return [s for s in self.collect_all(cur, scope) if s.alert_eligible]
