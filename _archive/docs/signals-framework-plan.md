# BookManager Signals Framework — Design Plan

## Overview

A pluggable framework for adding new data sources as signals for AI context and user alerts in the BookManager platform. Designed around three layers: Data Collection, Computation, and Serving.

---

## Architecture: Three Layers

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 3: SERVING  (Python — FastAPI)                            │
│                                                                  │
│  Reads from BKMNG_ONT_ACCOUNT_SIGNALS + BKMNG_USER_ALERTS       │
│  Filters by user/role scope                                      │
│  Formats signals into AI context text blocks                     │
│  Serves NBA items (GET /nba), alerts (GET /alerts)               │
│  Provides backward-compatible NBAItem mapping                    │
│                                                                  │
│  Framework: SignalRegistry + SignalProvider per source            │
│  WHERE: backend/app/signals/                                     │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 2: COMPUTATION  (Snowflake SPs)                           │
│                                                                  │
│  Joins materialized data, applies business rules/thresholds      │
│  Optionally calls Cortex AI for enrichment/scoring               │
│  Writes computed Signal rows into BKMNG_ONT_ACCOUNT_SIGNALS      │
│  Each SP owns its SOURCE partition (DELETE+INSERT pattern)        │
│  Alert SP copies ALERT_ELIGIBLE signals → BKMNG_USER_ALERTS      │
│                                                                  │
│  Current: SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS (SOURCE='core')  │
│  New sources: one SP per source, same output table               │
│  WHERE: Snowflake stored procedures + Tasks                      │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 1: DATA COLLECTION  (Snowflake SPs + Tasks)               │
│                                                                  │
│  Materializes raw data from external sources into BKMNG_* tables │
│  Salesforce → BKMNG_ONT_ACCOUNTS, BKMNG_ONT_USE_CASES           │
│  Gong → BKMNG_ONT_INTERACTIONS                                   │
│  A360 → BKMNG_A360_CONTRACT, BKMNG_A360_CONSUMPTION             │
│  New sources: BKMNG_SLACK_*, BKMNG_JIRA_*, etc.                  │
│                                                                  │
│  Already exists and works well — no architectural change needed   │
│  WHERE: BKMNG_* tables in TEMP.JUSDAVIS                          │
└──────────────────────────────────────────────────────────────────┘
```

### Design Principle

**Snowflake is the compute engine.** The Python framework is a thin orchestration and delivery layer, not a compute-on-request engine. Providers declare *what to read and where*, not *how to compute from raw data*. Heavy computation stays in Snowflake SPs running on scheduled Tasks.

### How It Fits the Ontology / Semantic Model

`bookmanager_assistant.yaml` already defines `account_signals` as a table pointing at `BKMNG_ONT_ACCOUNT_SIGNALS`. New data sources don't create new tables — they write rows into the same table with a `SOURCE` discriminator. This means:
- The semantic model doesn't need to change when you add a source
- Cortex Analyst queries work across all sources automatically
- Existing VQRs (`top_signals_by_priority`, etc.) include new signals without modification
- Adding `SOURCE` as a dimension enables questions like "show me all Gong-derived signals"

---

## Implementation Steps

### Step 1: Extend `BKMNG_ONT_ACCOUNT_SIGNALS` Schema

Add columns to the existing table:

```sql
ALTER TABLE BKMNG_ONT_ACCOUNT_SIGNALS
  ADD COLUMN IF NOT EXISTS SOURCE VARCHAR DEFAULT 'core';
ALTER TABLE BKMNG_ONT_ACCOUNT_SIGNALS
  ADD COLUMN IF NOT EXISTS CATEGORY VARCHAR;
  -- Values: engagement, consumption, go_live, use_case, tmr, team
ALTER TABLE BKMNG_ONT_ACCOUNT_SIGNALS
  ADD COLUMN IF NOT EXISTS METADATA VARIANT;
ALTER TABLE BKMNG_ONT_ACCOUNT_SIGNALS
  ADD COLUMN IF NOT EXISTS ALERT_ELIGIBLE BOOLEAN DEFAULT FALSE;
```

Update the existing SP (`SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS`) to:
- Set `SOURCE = 'core'` on all rows it writes
- Populate `CATEGORY` based on signal type mapping
- Set `ALERT_ELIGIBLE` based on priority (high = TRUE, medium/low = FALSE initially)

Update `bookmanager_assistant.yaml` → `account_signals` table:
- Add `source` dimension: "Which system generated this signal (core, gong, tmr, etc.)"
- Add `category` dimension: "Signal family (engagement, consumption, go_live, use_case, tmr, team)"
- Optionally add VQR: "Show me signals from [source]"

### Step 2: Create `BKMNG_USER_ALERTS` Table

```sql
CREATE TABLE IF NOT EXISTS TEMP.JUSDAVIS.BKMNG_USER_ALERTS (
    ALERT_ID        VARCHAR DEFAULT UUID_STRING(),
    USER_EMAIL      VARCHAR NOT NULL,
    SIGNAL_ID       VARCHAR,
    SIGNAL_TYPE     VARCHAR NOT NULL,
    ACCOUNT_ID      VARCHAR,
    ACCOUNT_NAME    VARCHAR,
    TEXT            VARCHAR,
    PRIORITY        VARCHAR DEFAULT 'medium',
    SOURCE          VARCHAR,
    IS_READ         BOOLEAN DEFAULT FALSE,
    IS_DISMISSED    BOOLEAN DEFAULT FALSE,
    CREATED_AT      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
```

Create `SP_REFRESH_BKMNG_USER_ALERTS` — runs as child Task after signal refresh:
- For each ACE (from `BKMNG_ONT_ACCOUNTS.ACE_ASSIGNED`), inserts `ALERT_ELIGIBLE = TRUE` signals that aren't already in the alerts table
- Deduplicates by `(SIGNAL_ID, USER_EMAIL)`
- Schedule: hourly, after signal SP completes

### Step 3: Create `backend/app/signals/` Package

```
backend/app/signals/
├── __init__.py              # register_all_providers(), get_registry() singleton
├── models.py                # Signal, SignalScope
├── provider.py              # SignalProvider ABC
├── registry.py              # SignalRegistry
└── providers/
    ├── __init__.py
    └── core.py              # CoreProvider: reads SOURCE='core'
```

#### `models.py` — Shared Data Types

```python
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel


@dataclass
class SignalScope:
    """Who is asking and for what — passed through all operations."""
    user_email: str
    ace_filter: str | None = None
    acem_filter: str | None = None
    account_id: str | None = None


class Signal(BaseModel):
    id: str
    signal_type: str              # open string — no closed Literal
    category: str                 # engagement | consumption | go_live | use_case | tmr | team
    account_id: str
    account_name: str
    priority: Literal["high", "medium", "low"]
    text: str                     # short action text for NBA card
    summary: str                  # context paragraph for AI / detail view
    source: str                   # provider name, matches SOURCE column
    metadata: dict = {}           # extensible JSON payload
    alert_eligible: bool = False
    created_at: datetime | None = None
```

#### `provider.py` — Signal Provider ABC

```python
from abc import ABC, abstractmethod
from snowflake.connector import DictCursor
from app.signals.models import Signal, SignalScope


class SignalProvider(ABC):
    """
    A provider reads pre-computed signals from a specific source.
    
    Heavy computation belongs in Snowflake SPs (Layer 2).
    The collect() method reads results — it should NOT do expensive joins or aggregations.
    """
    name: str  # must match SOURCE column value in BKMNG_ONT_ACCOUNT_SIGNALS

    @abstractmethod
    def collect(self, cur: DictCursor, scope: SignalScope) -> list[Signal]:
        """Read pre-computed signals for the given scope."""
        ...

    def format_for_ai(self, signals: list[Signal]) -> str:
        """Format this provider's signals for AI system prompt injection.
        Override for source-specific formatting (e.g. include Gong call links, Jira URLs)."""
        lines = []
        for s in signals:
            lines.append(f"[{s.priority.upper()}/{s.category}] {s.text}: {s.summary[:150]}")
        return "\n".join(lines)
```

#### `registry.py` — Signal Registry / Orchestrator

```python
from app.signals.models import Signal, SignalScope
from app.signals.provider import SignalProvider
from app.models.nba import NBAItem


class SignalRegistry:
    _providers: dict[str, SignalProvider]

    def __init__(self):
        self._providers = {}

    def register(self, provider: SignalProvider) -> None:
        self._providers[provider.name] = provider

    def collect_all(self, cur, scope: SignalScope) -> list[Signal]:
        """Collect from all registered providers, dedupe, sort by priority."""
        all_signals: list[Signal] = []
        for provider in self._providers.values():
            all_signals.extend(provider.collect(cur, scope))

        # Deduplicate by (signal_type, account_id)
        seen = set()
        deduped = []
        for s in all_signals:
            key = (s.signal_type, s.account_id)
            if key not in seen:
                seen.add(key)
                deduped.append(s)

        # Sort by priority
        rank = {"high": 0, "medium": 1, "low": 2}
        deduped.sort(key=lambda s: rank.get(s.priority, 2))
        return deduped

    def get_nba_items(self, cur, scope: SignalScope, cap: int = 8) -> list[NBAItem]:
        """Backward-compatible: returns NBAItems for GET /nba."""
        signals = self.collect_all(cur, scope)[:cap]
        return [
            NBAItem(
                id=s.id,
                signal_type=s.signal_type,
                account_id=s.account_id,
                account_name=s.account_name,
                priority=s.priority,
                text=s.text,
                summary=s.summary,
            )
            for s in signals
        ]

    def get_ai_context(self, cur, scope: SignalScope, limit: int = 6) -> str:
        """Formatted text block for system prompt injection."""
        signals = self.collect_all(cur, scope)[:limit]
        if not signals:
            return ""

        # Group by provider for formatted output
        by_source: dict[str, list[Signal]] = {}
        for s in signals:
            by_source.setdefault(s.source, []).append(s)

        sections = []
        for source_name, source_signals in by_source.items():
            provider = self._providers.get(source_name)
            if provider:
                sections.append(provider.format_for_ai(source_signals))
            else:
                # Fallback formatting
                for s in source_signals:
                    sections.append(f"[{s.priority.upper()}] {s.text}")

        return "TOP SIGNALS:\n" + "\n".join(sections) + "\n"

    def get_alert_eligible(self, cur, scope: SignalScope) -> list[Signal]:
        """Signals marked for push alerts."""
        return [s for s in self.collect_all(cur, scope) if s.alert_eligible]
```

#### `providers/core.py` — Core Provider (wraps existing SP output)

```python
from app.signals.provider import SignalProvider
from app.signals.models import Signal, SignalScope


# Map signal_type → category for existing core signals
_TYPE_TO_CATEGORY = {
    "no_interaction_14d": "engagement",
    "no_interaction_7d": "engagement",
    "champion_silent": "engagement",
    "no_call": "engagement",
    "gong_action": "engagement",
    "consumption_spike": "consumption",
    "consumption_dip": "consumption",
    "capacity_warning": "consumption",
    "predicted_overage": "consumption",
    "go_live_approaching": "go_live",
    "go_live_overdue": "go_live",
    "go_live_at_risk": "go_live",
    "blocker": "use_case",
    "at_risk": "use_case",
    "stage_stalled": "use_case",
    "stalled_implementation": "use_case",
    "meddpicc_weak": "use_case",
    "open_tmr": "tmr",
    "tmr_new_assigned": "tmr",
    "tmr_pending_review": "tmr",
    "new_feature_adoption": "engagement",
    "expansion_signal": "consumption",
    "new_stakeholder": "engagement",
    "high_momentum": "engagement",
    "competitor_mentioned": "engagement",
}


class CoreProvider(SignalProvider):
    name = "core"

    def collect(self, cur, scope: SignalScope) -> list[Signal]:
        where_parts = ["s.SOURCE = 'core'"]
        params: list = []

        if scope.ace_filter:
            where_parts.append("a.ACE_ASSIGNED = %s")
            params.append(scope.ace_filter)
        elif scope.acem_filter:
            where_parts.append(
                "a.ACE_ASSIGNED IN "
                "(SELECT ACE_EMAIL FROM BKMNG_ACEM_TEAM WHERE ACEM_EMAIL = %s)"
            )
            params.append(scope.acem_filter)

        if scope.account_id:
            where_parts.append("s.ACCOUNT_ID = %s")
            params.append(scope.account_id)

        where = "WHERE " + " AND ".join(where_parts)

        cur.execute(
            f"""
            SELECT s.SIGNAL_ID, s.SIGNAL_TYPE, s.ACCOUNT_ID, s.ACCOUNT_NAME,
                   s.PRIORITY, s.SIGNAL_TEXT, s.CONTEXT, s.ENTITY_TYPE,
                   s.CREATED_AT, s.SOURCE,
                   COALESCE(s.CATEGORY, NULL) AS CATEGORY,
                   COALESCE(s.ALERT_ELIGIBLE, FALSE) AS ALERT_ELIGIBLE,
                   s.METADATA
            FROM BKMNG_ONT_ACCOUNT_SIGNALS s
            JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = s.ACCOUNT_ID
            {where}
            ORDER BY
                CASE s.PRIORITY WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                CASE s.SIGNAL_TYPE
                    WHEN 'no_interaction_14d' THEN 0
                    WHEN 'consumption_spike'  THEN 1
                    WHEN 'champion_silent'    THEN 2
                    WHEN 'capacity_warning'   THEN 3
                    WHEN 'blocker'            THEN 4
                    ELSE 5 END
            """,
            params,
        )
        results = []
        for row in cur.fetchall():
            sig_type = row.get("SIGNAL_TYPE", "")
            results.append(Signal(
                id=row.get("SIGNAL_ID", ""),
                signal_type=sig_type,
                category=row.get("CATEGORY") or _TYPE_TO_CATEGORY.get(sig_type, "other"),
                account_id=row.get("ACCOUNT_ID", ""),
                account_name=row.get("ACCOUNT_NAME", ""),
                priority=row.get("PRIORITY", "medium"),
                text=row.get("SIGNAL_TEXT", ""),
                summary=row.get("CONTEXT", ""),
                source="core",
                metadata=row.get("METADATA") or {},
                alert_eligible=bool(row.get("ALERT_ELIGIBLE", False)),
                created_at=row.get("CREATED_AT"),
            ))
        return results
```

#### `__init__.py` — Registration

```python
from app.signals.registry import SignalRegistry
from app.signals.providers.core import CoreProvider

_registry: SignalRegistry | None = None


def get_registry() -> SignalRegistry:
    global _registry
    if _registry is None:
        _registry = SignalRegistry()
        register_all_providers(_registry)
    return _registry


def register_all_providers(registry: SignalRegistry) -> None:
    registry.register(CoreProvider())
    # Future: registry.register(GongProvider())
    # Future: registry.register(JiraProvider())
```

### Step 4: Integrate into Existing Code

#### `models/nba.py` — Open up signal_type

Change `signal_type: Literal[...]` to `signal_type: str` so new signal types don't require model changes.

#### `snowflake_service.py` — Delegate to registry

**`list_nba_items()`** (~lines 1325-1367):
```python
def list_nba_items(self, ace_filter=None, acem_filter=None) -> list[NBAItem]:
    from app.signals import get_registry
    from app.signals.models import SignalScope
    scope = SignalScope(user_email="", ace_filter=ace_filter, acem_filter=acem_filter)
    cap = 10 if acem_filter else 8
    return get_registry().get_nba_items(self._cursor(), scope, cap=cap)
```

**`get_bookmanager_context()`** (~lines 740-765, hardcoded signals query):
Replace the signal query block with:
```python
from app.signals import get_registry
from app.signals.models import SignalScope
scope = SignalScope(user_email=user_email, ace_filter=ace_filter, acem_filter=acem_filter, account_id=account_id)
signal_section = get_registry().get_ai_context(cur, scope, limit=6)
```

**Delete `_list_nba_items_legacy()`** (~lines 1369-1751): ~380 lines of dead code.

#### `main.py`

```python
from app.routers import accounts, auth, forecasts, tmr, misc, credit_series, admin, agent, nba, alerts
# ...
app.include_router(alerts.router)
```

### Step 5: Alert Router (`backend/app/routers/alerts.py`)

```python
router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("", response_model=list[AlertItem])
async def get_alerts(user=Depends(get_current_user), data=Depends(get_data_service)):
    """Unread, undismissed alerts for the current user."""
    ...

@router.get("/count")
async def get_alert_count(user=Depends(get_current_user), data=Depends(get_data_service)):
    """Lightweight unread count for nav badge."""
    ...

@router.post("/{alert_id}/read")
async def mark_alert_read(alert_id: str, user=Depends(get_current_user), data=Depends(get_data_service)):
    ...

@router.post("/{alert_id}/dismiss")
async def dismiss_alert(alert_id: str, user=Depends(get_current_user), data=Depends(get_data_service)):
    ...
```

### Step 6: Frontend

- Add `useAlerts()`, `useAlertCount()`, `useMarkAlertRead()`, `useDismissAlert()` hooks in `hooks/useApi.ts`
- Add alert bell icon with unread count badge in `AppLayout.tsx` nav bar
- NBA widget already handles unknown signal types via `?? <Zap>` fallback icon — no change needed

---

## Adding a New Data Source: Full Walkthrough

Example: **Jira ticket activity** as a signal source.

| Layer | What | Where |
|-------|------|-------|
| **L1 Data** | `SP_REFRESH_BKMNG_JIRA_TICKETS` materializes Jira data → `BKMNG_JIRA_TICKETS` table | Snowflake SP + Task (daily) |
| **L2 Compute** | `SP_COMPUTE_JIRA_SIGNALS` reads `BKMNG_JIRA_TICKETS`, applies rules ("ticket open > 7d, no update"), writes to `BKMNG_ONT_ACCOUNT_SIGNALS` with `SOURCE='jira'`, `ALERT_ELIGIBLE=TRUE` | Snowflake SP + Task (hourly) |
| **L3 Serve** | `providers/jira.py`: `JiraProvider` reads `WHERE SOURCE='jira'`, overrides `format_for_ai()` to include ticket URLs | Python, ~30 lines |
| **Register** | `registry.register(JiraProvider())` in `signals/__init__.py` | 1 line |
| **Semantic model** | No change — `account_signals` table already covers all sources | None |

**Zero changes to:** existing providers, NBAItem model, routers, frontend, AI context builder.

---

## Signal → Data Dependency Map (Updated)

| Alert | Data Source (L1) | Compute SP (L2) | Provider (L3) |
|-------|-----------------|-----------------|---------------|
| `no_interaction_14d` | BKMNG_ONT_INTERACTIONS | SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS | CoreProvider |
| `consumption_spike/dip` | BKMNG_A360_CONSUMPTION | SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS | CoreProvider |
| `capacity_warning` | BKMNG_A360_CONTRACT | SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS | CoreProvider |
| `champion_silent` | BKMNG_ONT_CONTACTS | SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS | CoreProvider |
| `blocker` | BKMNG_ONT_USE_CASES | SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS | CoreProvider |
| `go_live_*` | BKMNG_ONT_USE_CASES | SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS | CoreProvider |
| `open_tmr` | BKMNG_TMRS | SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS | CoreProvider |
| _future: gong_action_ | BKMNG_GONG_CALLS (new) | SP_COMPUTE_GONG_SIGNALS (new) | GongProvider (new) |
| _future: jira_stale_ | BKMNG_JIRA_TICKETS (new) | SP_COMPUTE_JIRA_SIGNALS (new) | JiraProvider (new) |

---

## Verification Plan

1. **Backward compat**: `GET /nba` returns identical JSON before/after refactor
2. **AI context**: `get_bookmanager_context()` — signal section text should be equivalent
3. **Cortex Analyst**: "What are my top signals?" works unchanged via existing VQR
4. **Cortex Analyst**: "Show me signals from [source]" works after adding SOURCE dimension
5. **Alert E2E**: After SP runs, `GET /alerts/count` > 0, `POST /alerts/{id}/dismiss` works
6. **New provider test**: Register dummy provider, verify signals appear in NBA + AI context + alerts

---

## File Impact Summary

### New Files
```
backend/app/signals/__init__.py
backend/app/signals/models.py
backend/app/signals/provider.py
backend/app/signals/registry.py
backend/app/signals/providers/__init__.py
backend/app/signals/providers/core.py
backend/app/routers/alerts.py
```

### Modified Files
```
backend/app/models/nba.py           — signal_type: Literal → str
backend/app/services/snowflake_service.py  — delegate to registry, delete legacy
backend/app/main.py                 — mount alerts router
bookmanager_assistant.yaml          — add SOURCE + CATEGORY dimensions
hooks/useApi.ts                     — add alert hooks
components/layout/AppLayout.tsx     — add alert bell
```

### Snowflake Objects
```
ALTER TABLE BKMNG_ONT_ACCOUNT_SIGNALS  — add SOURCE, CATEGORY, METADATA, ALERT_ELIGIBLE
CREATE TABLE BKMNG_USER_ALERTS         — new alert persistence
SP_REFRESH_BKMNG_USER_ALERTS          — new alert computation SP
TASK_REFRESH_BKMNG_USER_ALERTS        — new alert Task (hourly, after signals)
UPDATE SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS — set SOURCE='core', populate CATEGORY
```
