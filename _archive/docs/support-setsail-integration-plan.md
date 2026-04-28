# BookManager — Support Ticket & SetSail Integration Plan

> Adds two new data sources to the signals framework: Snowflake support tickets (from Salesforce CASE) and SetSail meeting activity.

---

## Prerequisites

The existing `SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS` does `TRUNCATE TABLE` before inserting core signals. This wipes all rows regardless of source. Before adding any new source, this must change to a partition-safe delete.

---

## Part A: Support Ticket Integration (ready now)

### A1. Change core SP to partition-safe delete

In `SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS`, replace:

```sql
TRUNCATE TABLE TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS;
```

With:

```sql
DELETE FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS WHERE SOURCE = 'core';
```

This is the prerequisite for any new source — without it, new source rows get wiped every hour when the core SP runs.

### A2. Create `BKMNG_SUPPORT_TICKETS` materialization table + SP

**Table schema:**

| Field | Type | Source |
|-------|------|--------|
| CASE_ID | VARCHAR | FIVETRAN.SALESFORCE.CASE.ID |
| CASE_NUMBER | VARCHAR | CASE_NUMBER |
| ACCOUNT_ID | VARCHAR | ACCOUNT_ID (joins to BKMNG_ONT_ACCOUNTS) |
| ACCOUNT_NAME | VARCHAR | BKMNG_ONT_ACCOUNTS |
| STATUS | VARCHAR | STATUS |
| SEVERITY | VARCHAR | SEVERITY_C |
| PRIORITY | VARCHAR | PRIORITY |
| CATEGORY | VARCHAR | CATEGORY_C |
| SUB_CATEGORY | VARCHAR | SUB_CATEGORY_C |
| COMPONENT | VARCHAR | COMPONENT_C |
| SUBJECT | VARCHAR | SUBJECT |
| TYPE | VARCHAR | TYPE |
| IS_ESCALATED | BOOLEAN | IS_ESCALATED |
| SALES_ESCALATED | BOOLEAN | SALES_ESCALATED_C |
| IS_CLOSED | BOOLEAN | IS_CLOSED |
| CREATED_DATE | TIMESTAMP_TZ | CREATED_DATE |
| CLOSED_DATE | TIMESTAMP_TZ | CLOSED_DATE |
| DAYS_OPEN | FLOAT | DAYS_OPEN_C |
| TIME_TO_RESOLUTION_HRS | FLOAT | TIME_TO_RESOLUTION_IN_BUSINESS_HRS_C |
| ESCALATION_STATUS | VARCHAR | ESCALATION_STATUS_C |
| SNOWFLAKE_ACCOUNT | VARCHAR | SNOWFLAKE_ACCOUNT_C |
| SNOWFLAKE_ACCOUNT_ALIAS | VARCHAR | SNOWFLAKE_ACCOUNT_ALIAS_C |
| REFRESHED_AT | TIMESTAMP_NTZ | CURRENT_TIMESTAMP() |

**SP: `SP_REFRESH_BKMNG_SUPPORT_TICKETS()`**

- Reads from `FIVETRAN.SALESFORCE.CASE` joined to `BKMNG_ONT_ACCOUNTS` (scoped to bookmanager activation accounts)
- Filters: `_FIVETRAN_ACTIVE = TRUE`, `TYPE = 'Technical Issue'`, cases from the last 90 days, `ACCOUNT_ID IS NOT NULL`
- Pattern: TRUNCATE → INSERT (this table is standalone, not shared)

**Task: `TASK_REFRESH_BKMNG_SUPPORT_TICKETS`**

- Schedule: `USING CRON 45 * * * * UTC` (hourly at :45)
- Warehouse: SE_XS_WH

### A3. Create `SP_COMPUTE_SUPPORT_SIGNALS()` — signal computation

Reads from `BKMNG_SUPPORT_TICKETS`, applies business rules, writes to `BKMNG_ONT_ACCOUNT_SIGNALS` with `SOURCE='support'`.

Uses `DELETE FROM BKMNG_ONT_ACCOUNT_SIGNALS WHERE SOURCE = 'support'` then INSERT pattern.

**Initial signal types** (exact thresholds to be defined later):

| Signal Type | Priority | Category | Trigger | ALERT_ELIGIBLE |
|-------------|----------|----------|---------|----------------|
| `open_sev1_ticket` | high | support | Any open Sev-1 case for the account | TRUE |
| `open_sev2_ticket` | high | support | Any open Sev-2 case for the account | TRUE |
| `escalated_ticket` | high | support | Any actively escalated case | TRUE |
| `ticket_volume_spike` | medium | support | Account has notably more open cases than typical | FALSE |
| `long_running_ticket` | medium | support | Open ticket with DAYS_OPEN exceeding threshold | FALSE |

**Signal row format** (matches existing `BKMNG_ONT_ACCOUNT_SIGNALS` schema):

```sql
-- Example: open_sev1_ticket
INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
    (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY,
     SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT,
     SOURCE, CATEGORY, ALERT_ELIGIBLE)
SELECT
    'open_sev1_ticket-' || t.CASE_ID,
    t.ACCOUNT_ID, t.ACCOUNT_NAME, 'open_sev1_ticket', 'high',
    t.ACCOUNT_NAME || ' has open Sev-1 ticket: ' || LEFT(t.SUBJECT, 100),
    'Case: ' || t.CASE_NUMBER || ' | Status: ' || t.STATUS
        || ' | Days open: ' || COALESCE(t.DAYS_OPEN::VARCHAR, 'N/A')
        || ' | Category: ' || COALESCE(t.CATEGORY, 'Unknown')
        || ' | Snowflake account: ' || COALESCE(t.SNOWFLAKE_ACCOUNT_ALIAS, 'Unknown'),
    'case', t.CASE_ID, CURRENT_TIMESTAMP(),
    'support', 'support', TRUE
FROM TEMP.JUSDAVIS.BKMNG_SUPPORT_TICKETS t
WHERE t.SEVERITY ILIKE '%Severity-1%'
  AND t.IS_CLOSED = FALSE;
```

**Task: `TASK_COMPUTE_SUPPORT_SIGNALS`**

- Schedule: `USING CRON 50 * * * * UTC` (hourly at :50, after materialization at :45)
- Warehouse: SE_XS_WH

### A4. Create `SupportProvider` in Python

New file: `backend/app/signals/providers/support.py`

```python
from __future__ import annotations

from app.signals.provider import SignalProvider
from app.signals.models import Signal, SignalScope

_TYPE_TO_CATEGORY: dict[str, str] = {
    "open_sev1_ticket":     "support",
    "open_sev2_ticket":     "support",
    "escalated_ticket":     "support",
    "ticket_volume_spike":  "support",
    "long_running_ticket":  "support",
}


class SupportProvider(SignalProvider):
    name = "support"

    def collect(self, cur, scope: SignalScope) -> list[Signal]:
        where_parts = ["s.SOURCE = 'support'"]
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
                    WHEN 'open_sev1_ticket'    THEN 0
                    WHEN 'escalated_ticket'    THEN 1
                    WHEN 'open_sev2_ticket'    THEN 2
                    WHEN 'long_running_ticket'  THEN 3
                    WHEN 'ticket_volume_spike'  THEN 4
                    ELSE 5 END
            """,
            params,
        )
        results: list[Signal] = []
        for row in cur.fetchall():
            sig_type = row.get("SIGNAL_TYPE", "")
            results.append(
                Signal(
                    id=row.get("SIGNAL_ID", ""),
                    signal_type=sig_type,
                    category=row.get("CATEGORY") or _TYPE_TO_CATEGORY.get(sig_type, "support"),
                    account_id=row.get("ACCOUNT_ID", ""),
                    account_name=row.get("ACCOUNT_NAME", ""),
                    priority=row.get("PRIORITY", "medium"),
                    text=row.get("SIGNAL_TEXT", ""),
                    summary=row.get("CONTEXT", ""),
                    source="support",
                    metadata=row.get("METADATA") or {},
                    alert_eligible=bool(row.get("ALERT_ELIGIBLE", False)),
                    created_at=row.get("CREATED_AT"),
                )
            )
        return results

    def format_for_ai(self, signals: list[Signal]) -> str:
        lines = []
        for s in signals:
            lines.append(
                f"[{s.priority.upper()}/SUPPORT] {s.text}: {s.summary[:200]}"
            )
        return "\n".join(lines)
```

### A5. Register the provider

In `backend/app/signals/__init__.py`:

```python
from app.signals.providers.support import SupportProvider

def _register_all_providers(registry: SignalRegistry) -> None:
    registry.register(CoreProvider())
    registry.register(SupportProvider())
    # Future: registry.register(SetSailProvider())
```

### A6. Update `bookmanager_assistant.yaml`

Add `"support"` to the `source` dimension description for the `account_signals` table, and `"support"` to the `category` dimension allowed values.

---

## Part B: SetSail Meeting Integration (access-dependent)

### B1. Request access to `SALES.ACTIVITY` schema

**This is the blocker.** The production SetSail data lives in:

| Table | Rows | Refresh | Key Fields |
|-------|------|---------|------------|
| `SALES.ACTIVITY.SETSAIL_ACCOUNT_ACTIVITY` | 3.4M | Daily | ACCOUNT_ID, ACTIVITY_DATE, SS_MEETINGS_TOTAL, SS_MEETINGS_HIGH_IMPACT, SS_MEETINGS_LOW_IMPACT, SS_MEETINGS_PARTNER_PRESENT, SS_EMAILS_SENT, SS_EMAILS_RECEIVED, SS_MEETINGS_TOTAL_DURATION, SS_VP_EXTERNAL_INVOLVED, SS_VP_INTERNAL_INVOLVED |
| `SALES.ACTIVITY.SETSAIL_RAW_ACTIVITY` | 20.4M | Daily | Raw individual activities |
| `SALES.ACTIVITY.SETSAIL_USER_ACTIVITY` | 1.9M | Daily | Per-user activity breakdown |

The `SALES.DEV.SETSAIL_MEETING` table (10 rows) is sample data only — not usable.

**Alternative if access is denied:** `TEMP.TTODOROV_APPS.UK_SETSAIL_ACCOUNT_ACTIVITY` has the exact same schema and real data, but is scoped to UK Midmarket accounts only. Could serve as a prototype source.

### B2. Create `BKMNG_SETSAIL_ACTIVITY` materialization table + SP

**Table schema:**

| Field | Type | Source |
|-------|------|--------|
| ACCOUNT_ID | VARCHAR | SETSAIL_ACCOUNT_ACTIVITY.ACCOUNT_ID |
| ACCOUNT_NAME | VARCHAR | BKMNG_ONT_ACCOUNTS |
| ACTIVITY_DATE | DATE | ACTIVITY_DATE |
| MEETINGS_TOTAL | NUMBER | SS_MEETINGS_TOTAL |
| MEETINGS_HIGH_IMPACT | NUMBER | SS_MEETINGS_HIGH_IMPACT |
| MEETINGS_LOW_IMPACT | NUMBER | SS_MEETINGS_LOW_IMPACT |
| MEETINGS_PARTNER_PRESENT | NUMBER | SS_MEETINGS_PARTNER_PRESENT |
| EMAILS_SENT | NUMBER | SS_EMAILS_SENT |
| EMAILS_RECEIVED | NUMBER | SS_EMAILS_RECEIVED |
| MEETINGS_TOTAL_DURATION | NUMBER | SS_MEETINGS_TOTAL_DURATION (minutes) |
| VP_EXTERNAL_INVOLVED | NUMBER | SS_VP_EXTERNAL_INVOLVED |
| VP_INTERNAL_INVOLVED | NUMBER | SS_VP_INTERNAL_INVOLVED |
| REFRESHED_AT | TIMESTAMP_NTZ | CURRENT_TIMESTAMP() |

**SP: `SP_REFRESH_BKMNG_SETSAIL_ACTIVITY()`**

- Reads from `SALES.ACTIVITY.SETSAIL_ACCOUNT_ACTIVITY` joined to `BKMNG_ONT_ACCOUNTS`
- Filters: last 90 days of daily data
- Pattern: TRUNCATE → INSERT

**Task: `TASK_REFRESH_BKMNG_SETSAIL_ACTIVITY`**

- Schedule: `USING CRON 35 */2 * * * UTC` (every 2 hours at :35)
- Warehouse: SE_XS_WH

### B3. Create `SP_COMPUTE_SETSAIL_SIGNALS()` — signal computation

Reads from `BKMNG_SETSAIL_ACTIVITY`, writes to `BKMNG_ONT_ACCOUNT_SIGNALS` with `SOURCE='setsail'`.

Uses `DELETE FROM BKMNG_ONT_ACCOUNT_SIGNALS WHERE SOURCE = 'setsail'` then INSERT pattern.

**Initial signal types** (exact thresholds to be defined later):

| Signal Type | Priority | Category | Trigger | ALERT_ELIGIBLE |
|-------------|----------|----------|---------|----------------|
| `no_meeting_14d` | medium | engagement | Zero meetings in 14+ days | TRUE |
| `meeting_frequency_drop` | medium | engagement | Meetings in last 14d significantly below account's 90d average | TRUE |
| `high_impact_meeting` | low | engagement | Recent high-impact meeting (positive signal) | FALSE |
| `vp_engagement` | low | engagement | VP-level external participant in recent meetings (positive signal) | FALSE |

**Signal row format example:**

```sql
-- Example: no_meeting_14d
INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
    (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY,
     SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT,
     SOURCE, CATEGORY, ALERT_ELIGIBLE)
WITH account_stats AS (
    SELECT
        ACCOUNT_ID, ACCOUNT_NAME,
        MAX(CASE WHEN MEETINGS_TOTAL > 0 THEN ACTIVITY_DATE END) AS LAST_MEETING_DATE,
        SUM(CASE WHEN ACTIVITY_DATE >= DATEADD('day', -14, CURRENT_DATE()) THEN MEETINGS_TOTAL ELSE 0 END) AS MEETINGS_14D,
        SUM(CASE WHEN ACTIVITY_DATE >= DATEADD('day', -90, CURRENT_DATE()) THEN MEETINGS_TOTAL ELSE 0 END) AS MEETINGS_90D,
        SUM(CASE WHEN ACTIVITY_DATE >= DATEADD('day', -14, CURRENT_DATE()) THEN EMAILS_SENT + EMAILS_RECEIVED ELSE 0 END) AS EMAILS_14D
    FROM TEMP.JUSDAVIS.BKMNG_SETSAIL_ACTIVITY
    GROUP BY ACCOUNT_ID, ACCOUNT_NAME
)
SELECT
    'no_meeting_14d-' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, 'no_meeting_14d', 'medium',
    ACCOUNT_NAME || ' has had no meetings in ' || DATEDIFF('day', LAST_MEETING_DATE, CURRENT_DATE()) || ' days',
    'Last meeting: ' || COALESCE(LAST_MEETING_DATE::VARCHAR, 'never')
        || ' | Meetings (90d): ' || MEETINGS_90D
        || ' | Emails (14d): ' || EMAILS_14D,
    'account', ACCOUNT_ID, CURRENT_TIMESTAMP(),
    'setsail', 'engagement', TRUE
FROM account_stats
WHERE MEETINGS_14D = 0
  AND LAST_MEETING_DATE IS NOT NULL;  -- only alert for accounts that had meetings before
```

**Task: `TASK_COMPUTE_SETSAIL_SIGNALS`**

- Schedule: `USING CRON 40 */2 * * * UTC` (every 2 hours at :40, after materialization at :35)
- Warehouse: SE_XS_WH

### B4. Create `SetSailProvider` in Python

New file: `backend/app/signals/providers/setsail.py`

Same pattern as `SupportProvider`, with:
- `name = "setsail"`
- `collect()` reads `WHERE SOURCE='setsail'`
- `format_for_ai()` override to include meeting counts and last meeting date

### B5. Register the provider

In `backend/app/signals/__init__.py`:

```python
registry.register(SetSailProvider())
```

### B6. Update `bookmanager_assistant.yaml`

Add `"setsail"` to source dimension description.

---

## Data Source Summary

| Source | Table | Rows | Access | Join Key |
|--------|-------|------|--------|----------|
| `FIVETRAN.SALESFORCE.CASE` | Support tickets | 353K+ (2025+) | **Have access** | ACCOUNT_ID → BKMNG_ONT_ACCOUNTS.ACCOUNT_ID |
| `SALES.ACTIVITY.SETSAIL_ACCOUNT_ACTIVITY` | Daily meeting/email activity per account | 3.4M | **Need access** | ACCOUNT_ID → BKMNG_ONT_ACCOUNTS.ACCOUNT_ID |
| `SNOWSCIENCE.PRODUCT.SALESFORCE_ACC_FEATURE_SUPPORT_TICKETS` | Pre-aggregated 90d support rollups | ~500 | Have access | SALESFORCE_ACCOUNT_ID |

---

## Task Scheduling Summary

| Task | Schedule | Depends On |
|------|----------|------------|
| `TASK_REFRESH_BKMNG_SUPPORT_TICKETS` | Hourly at :45 | — |
| `TASK_COMPUTE_SUPPORT_SIGNALS` | Hourly at :50 | Runs after :45 materialization |
| `TASK_REFRESH_BKMNG_SETSAIL_ACTIVITY` | Every 2h at :35 | — |
| `TASK_COMPUTE_SETSAIL_SIGNALS` | Every 2h at :40 | Runs after :35 materialization |
| `TASK_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS` | Hourly at :00 (existing) | — |
| `TASK_REFRESH_BKMNG_USER_ALERTS` | After signals (existing child task) | All signal SPs |

---

## Verification Plan

1. **After A1**: Run `SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS()` manually, confirm all ~2K core signals still exist with `SOURCE = 'core'`
2. **After A3**: Run `SP_COMPUTE_SUPPORT_SIGNALS()` manually, then:
   ```sql
   SELECT SOURCE, SIGNAL_TYPE, COUNT(*)
   FROM BKMNG_ONT_ACCOUNT_SIGNALS
   GROUP BY 1, 2
   ORDER BY 1, 3 DESC;
   ```
   Confirm both `core` and `support` rows coexist.
3. **After A5**: Call `GET /nba` and `GET /alerts` — confirm support signals appear alongside core signals
4. **After B3**: Same as step 2 but verify `setsail` source rows
5. **End-to-end**: `GET /alerts/count` returns a count that includes support and setsail alert-eligible signals

---

## File Impact Summary

### New Files

```
backend/app/signals/providers/support.py    — SupportProvider
backend/app/signals/providers/setsail.py    — SetSailProvider (after access granted)
```

### Modified Files

```
backend/app/signals/__init__.py             — Register new providers
bookmanager_assistant.yaml                  — Add source/category dimension values
```

### New Snowflake Objects

```
TEMP.JUSDAVIS.BKMNG_SUPPORT_TICKETS        — Support ticket materialization table
SP_REFRESH_BKMNG_SUPPORT_TICKETS()          — Materialization SP
TASK_REFRESH_BKMNG_SUPPORT_TICKETS          — Hourly at :45

SP_COMPUTE_SUPPORT_SIGNALS()                — Signal computation SP
TASK_COMPUTE_SUPPORT_SIGNALS                — Hourly at :50

TEMP.JUSDAVIS.BKMNG_SETSAIL_ACTIVITY       — SetSail materialization table (after access)
SP_REFRESH_BKMNG_SETSAIL_ACTIVITY()         — Materialization SP
TASK_REFRESH_BKMNG_SETSAIL_ACTIVITY         — Every 2h at :35

SP_COMPUTE_SETSAIL_SIGNALS()                — Signal computation SP
TASK_COMPUTE_SETSAIL_SIGNALS                — Every 2h at :40
```

### Modified Snowflake Objects

```
SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS       — TRUNCATE → DELETE WHERE SOURCE='core'
```
