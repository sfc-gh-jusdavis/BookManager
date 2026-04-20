# BookManager — Signal Updates Plan

> Comprehensive plan to refine, pause, remove, and add signals in the BookManager signals framework. Covers changes to the core SP (`SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS`), Python providers, and the signal inventory.

---

## Guiding Principles

1. **Pause, don't delete.** Signals marked Inactive + Keep=Yes are paused — their logic stays in the SP (commented or gated by a flag) and in the Python `_TYPE_TO_CATEGORY` map. They can be reactivated later without reimplementation.
2. **One SP per SOURCE.** The core SP owns `SOURCE='core'`. Support ticket signals will move to a dedicated `SP_REFRESH_BKMNG_SUPPORT_SIGNALS` (see `support-setsail-integration-plan.md`). SetSail signals are blocked on data access.
3. **Partition-safe deletes.** The core SP must switch from `TRUNCATE TABLE` to `DELETE WHERE SOURCE = 'core'` before any new source is added. This is prerequisite step zero.

---

## Signal Inventory — Final Decisions

| # | Signal Type | Status | Keep | Priority | Category | Summary of Changes |
|---|------------|--------|------|----------|----------|-------------------|
| 1 | `no_interaction_14d` | **Active** | Yes | high | engagement | Augment with SetSail data (when available). Gong misses unrecorded calls. |
| 2 | `champion_silent` | **Paused** | Yes | high | engagement | Pause until engagement data is richer (SetSail + Gong combined). |
| 3 | `capacity_warning` | **Active** | Yes | high | consumption | Refine: trigger only at milestone thresholds (75%, 90%, 100%, 125%). |
| 4 | `consumption_spike` | **Active** | Yes | high | consumption | Add $50/day revenue floor. Add ramp detection for small accounts. |
| 5 | `open_sev2_ticket` | **Active** | Yes | high | support | Move to support SP. Tier alert priority by severity. |
| 6 | `contract_ending` (high) | **Active** | Yes | high | consumption | No changes. ≤30 days remaining. |
| 7 | `open_sev1_ticket` | **Active** | Yes | high | support | Move to support SP. Tier alert priority by severity. |
| 8 | `competitor_mentioned` | **Paused** | Yes | medium | engagement | Pause. Current data is Gong tracker categories, not actual competitor names. Revisit when source data improves. |
| 9 | `stage_stalled` | **Paused** | Yes | medium | use_case | Pause. Many stalled 68-435+ days are likely abandoned. Revisit with tiered logic. |
| 10 | `consumption_dip` | **Active** | Yes | medium | consumption | Add $50/day revenue floor to filter low-volume noise. |
| 11 | `no_interaction_7d` | **Active** | Yes | medium | engagement | No changes. Does not overlap with 14d signal. |
| 12 | `go_live_approaching` | **Active** | Yes | medium | go_live | No changes. |
| 13 | `contract_ending` (medium) | **Remove** | No | medium | consumption | Delete. Redundant with #6 (high priority version covers the actionable window). |
| 14 | `long_running_ticket` | **Active** | Yes | medium | support | Move to support SP. Define "high DAYS_OPEN" thresholds and classify priority. |
| 15 | `open_tmr` | **Active** | Yes | medium | tmr | TMR alerts for review. New or assigned TMRs surface as alert bubble on the TMR page. |
| 16 | `expansion_signal` | **Active** | Yes | medium | consumption | Narrow scope: alert only on new use case creation + alert when use case assigned to user. |
| 17 | `ticket_volume_spike` | **Active** | Yes | medium | support | Move to support SP. Multiple open tickets = high-touch account indicator. |
| 18 | `new_feature_adoption` | **Active** | Yes | low | engagement | Consolidate to 1 signal per account with summary list of new features. Alert on detection. |
| 19 | `new_stakeholder` | **Remove** | No | low | engagement | Delete. Low value, noisy. |
| 20 | `high_momentum` | **Remove** | No | — | engagement | Delete. Never produced by SP. Remove from Python `_TYPE_TO_CATEGORY` map. |
| 21 | `use_case_no_dates` | **Add (New)** | Yes | low | use_case | Use case in a stage for 7+ days with no Implementation Start Date or Go-Live Date/Forecast set. |

---

## Detailed Changes

### Step 0: Prerequisite — Partition-Safe Delete

**File:** `SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS`

Replace:
```sql
TRUNCATE TABLE TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS;
```
With:
```sql
DELETE FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS WHERE SOURCE = 'core';
```

This is required before any other change — without it, new source partitions get wiped hourly.

---

### Step 1: Pause Signals (Inactive + Keep)

**Signals:** `champion_silent`, `competitor_mentioned`, `stage_stalled`

**SP change:** Comment out or gate the INSERT blocks for these three signal types inside the core SP. Add a comment marker:
```sql
-- PAUSED: champion_silent — reactivate when SetSail data is available
-- <original INSERT block here>
```

**Python change (`core.py`):** Keep entries in `_TYPE_TO_CATEGORY` map (no removal). These signals simply won't appear because the SP won't produce them.

---

### Step 2: Remove Signals (Delete)

**Signals:** `contract_ending` (medium priority version), `new_stakeholder`, `high_momentum`

**SP change:**
- Delete the `contract_ending` medium-priority INSERT block (the high-priority ≤30 day version stays).
- Delete the `new_stakeholder` INSERT block.
- `high_momentum` has no SP block (never produced) — no SP change needed.

**Python change (`core.py`):**
- Remove `high_momentum`, `new_stakeholder` from `_TYPE_TO_CATEGORY` map.
- Remove `contract_ending` medium-priority case if it has distinct handling (otherwise the remaining high-priority case covers it).

---

### Step 3: Refine `capacity_warning` — Milestone Thresholds

**Current behavior:** Triggers based on continuous overage percentage.

**New behavior:** Only trigger at defined milestones: 75%, 90%, 100%, 125%.

**SP change:** Replace the current capacity_warning INSERT with milestone-bucketed logic:
```sql
-- capacity_warning: milestone-based triggers
INSERT INTO BKMNG_ONT_ACCOUNT_SIGNALS (...)
SELECT
    ...
    CASE
        WHEN overage_pct >= 125 THEN 'high'
        WHEN overage_pct >= 100 THEN 'high'
        WHEN overage_pct >= 90  THEN 'medium'
        WHEN overage_pct >= 75  THEN 'medium'
        ELSE NULL  -- below 75% = no signal
    END AS PRIORITY,
    ...
FROM capacity_calc
WHERE overage_pct >= 75;
```

Include the milestone percentage in `SIGNAL_TEXT` (e.g., "Account at 90% of contract capacity").

---

### Step 4: Refine Consumption Signals — Revenue Floor + Ramp Detection

**Signals affected:** `consumption_spike`, `consumption_dip`

**Problem:** Weekend revenue is ~68% of weekday. Rolling 7-day windows are inherently balanced (always 5+2 days), so the real noise source is low-volume accounts where small absolute changes cause large percentage swings.

**Solution — Two tiers:**

#### Tier 1: Standard accounts (revenue floor)
- **Filter:** Only fire consumption signals when `REV_LAST_WEEK >= 350` (≈$50/day floor).
- Accounts below this floor are too small for percentage-based signals to be meaningful.
- Applies to both `consumption_spike` (WoW ≥ +30%) and `consumption_dip` (WoW ≤ -20%).

#### Tier 2: Ramp detection (small accounts)
- **Filter:** Accounts below the $50/day floor that show sustained ramp:
  - `MOM_CHANGE > 100%` (month-over-month doubling)
  - AND `ACTIVE_DAYS_30D >= 20` (consistent daily usage, not sporadic)
- These accounts get a `consumption_spike` signal with metadata flag `"ramp_detected": true`.
- This captures small-but-growing workloads that indicate ramping adoption.

**SP change:** Modify the `consumption_spike` and `consumption_dip` INSERT blocks:
```sql
-- Tier 1: Standard consumption signals (revenue floor)
INSERT INTO BKMNG_ONT_ACCOUNT_SIGNALS (...)
SELECT ...
FROM BKMNG_A360_CONSUMPTION c
JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = c.ACCOUNT_ID
WHERE c.REV_LAST_WEEK >= 350
  AND c.WOW_CHANGE >= 0.30;  -- or <= -0.20 for dip

-- Tier 2: Ramp detection (below floor, sustained growth)
INSERT INTO BKMNG_ONT_ACCOUNT_SIGNALS (...)
SELECT ...
    'consumption_spike' AS SIGNAL_TYPE,
    'low' AS PRIORITY,
    'Ramping workload: MoM >' || ROUND(c.MOM_CHANGE * 100) || '% with '
        || c.ACTIVE_DAYS_30D || ' active days' AS SIGNAL_TEXT,
    ...
FROM BKMNG_A360_CONSUMPTION c
JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = c.ACCOUNT_ID
WHERE c.REV_LAST_WEEK < 350
  AND c.MOM_CHANGE > 1.0
  AND c.ACTIVE_DAYS_30D >= 20;
```

---

### Step 5: Refine `new_feature_adoption` — Consolidate Per Account

**Current:** Up to 20+ signals per account (one per feature).

**New:** One signal per account with a summary list of new features in `CONTEXT`/`METADATA`.

**SP change:** Replace the per-feature INSERT with an aggregated version:
```sql
INSERT INTO BKMNG_ONT_ACCOUNT_SIGNALS (...)
SELECT
    ...,
    'new_feature_adoption' AS SIGNAL_TYPE,
    'low' AS PRIORITY,
    TRUE AS ALERT_ELIGIBLE,  -- alert on new feature detection
    'New features adopted: ' || LISTAGG(DISTINCT feature_name, ', ')
        WITHIN GROUP (ORDER BY feature_name) AS SIGNAL_TEXT,
    OBJECT_CONSTRUCT('features', ARRAY_AGG(DISTINCT feature_name),
                     'count', COUNT(DISTINCT feature_name)) AS METADATA,
    ...
FROM feature_adoption_source
GROUP BY ACCOUNT_ID;
```

**Alert:** Now alert-eligible (user wants alerts on new feature detection).

---

### Step 6: Refine `expansion_signal` — Narrow Scope

**Current:** Broad net combining new use cases + rising consumption.

**New:** Two focused sub-signals:
1. **New use case created** — alert when a use case is created on an account in the user's book.
2. **Use case assigned to user** — alert when a use case is assigned to the current user.

**SP change:** Replace existing expansion_signal INSERT with:
```sql
-- expansion_signal: new use case on account
INSERT INTO BKMNG_ONT_ACCOUNT_SIGNALS (...)
SELECT ...
FROM BKMNG_ONT_USE_CASES uc
JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = uc.ACCOUNT_ID
WHERE uc.CREATED_DATE >= DATEADD('day', -7, CURRENT_DATE())
  AND uc.STAGE NOT IN ('Closed', 'Cancelled');
```

The "assigned to user" filtering happens at Layer 3 (Python provider), since `SOURCE='core'` signals don't know which user is viewing. The provider can check `uc.ACE_ASSIGNED` against the scope's `ace_filter`.

---

### Step 7: Refine `open_tmr` — Alert Bubble

**Current:** Medium priority, not alert-eligible.

**New:** Keep medium priority. Mark as alert-eligible for new/assigned TMRs so they surface as a bubble on the TMR page.

**SP change:** Set `ALERT_ELIGIBLE = TRUE` for open_tmr signals. Add metadata:
```sql
OBJECT_CONSTRUCT('tmr_status', tmr.STATUS, 'assigned_to', tmr.ASSIGNED_TO) AS METADATA
```

**Frontend:** TMR page reads alert count for `signal_type = 'open_tmr'` to show bubble indicator.

---

### Step 8: Add `use_case_no_dates` (New Signal)

**Description:** Use case has been in a stage for 7+ days with no Implementation Start Date or Go-Live Date/Forecast set.

**SP change:** Add new INSERT block:
```sql
-- use_case_no_dates: missing key dates
INSERT INTO BKMNG_ONT_ACCOUNT_SIGNALS (
    SIGNAL_ID, SIGNAL_TYPE, ACCOUNT_ID, ACCOUNT_NAME,
    PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE,
    SOURCE, CATEGORY, ALERT_ELIGIBLE, METADATA, CREATED_AT
)
SELECT
    UUID_STRING() AS SIGNAL_ID,
    'use_case_no_dates' AS SIGNAL_TYPE,
    uc.ACCOUNT_ID,
    a.ACCOUNT_NAME,
    'low' AS PRIORITY,
    'Use case "' || uc.USE_CASE_NAME || '" missing key dates' AS SIGNAL_TEXT,
    'Stage: ' || uc.STAGE || ' for ' || DATEDIFF('day', uc.STAGE_ENTERED_DATE, CURRENT_DATE())
        || ' days with no implementation start or go-live date set.' AS CONTEXT,
    'use_case' AS ENTITY_TYPE,
    'core' AS SOURCE,
    'use_case' AS CATEGORY,
    FALSE AS ALERT_ELIGIBLE,
    OBJECT_CONSTRUCT(
        'use_case_id', uc.USE_CASE_ID,
        'use_case_name', uc.USE_CASE_NAME,
        'stage', uc.STAGE,
        'days_in_stage', DATEDIFF('day', uc.STAGE_ENTERED_DATE, CURRENT_DATE())
    ) AS METADATA,
    CURRENT_TIMESTAMP() AS CREATED_AT
FROM BKMNG_ONT_USE_CASES uc
JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = uc.ACCOUNT_ID
WHERE uc.STAGE NOT IN ('Closed', 'Cancelled', 'Live')
  AND DATEDIFF('day', uc.STAGE_ENTERED_DATE, CURRENT_DATE()) >= 7
  AND (uc.IMPLEMENTATION_START_DATE IS NULL OR uc.GO_LIVE_DATE IS NULL);
```

**Python change (`core.py`):** Add to `_TYPE_TO_CATEGORY`:
```python
"use_case_no_dates": "use_case",
```

---

### Step 9: Move Support Signals to Dedicated SP

**Signals:** `open_sev1_ticket`, `open_sev2_ticket`, `long_running_ticket`, `ticket_volume_spike`

These four signals currently live inside the core SP but query `FIVETRAN.SALESFORCE.CASE` directly. They should be extracted into a dedicated `SP_REFRESH_BKMNG_SUPPORT_SIGNALS` with `SOURCE = 'support'`.

See `support-setsail-integration-plan.md` for the full spec. Key refinements from this plan:

**Tiered alert classification by severity:**
| Ticket Severity | Signal Priority | Alert Eligible |
|----------------|----------------|----------------|
| Sev-1 | high | Yes |
| Sev-2 | high | Yes |
| Sev-3 | medium | No |
| Sev-4 | low | No |

**`long_running_ticket` thresholds:**
| DAYS_OPEN | Priority |
|-----------|----------|
| ≥ 30 days | high |
| ≥ 14 days | medium |
| ≥ 7 days | low |

**`ticket_volume_spike`:** Multiple open tickets (≥3) on one account = high-touch indicator, medium priority, alert-eligible.

**Python:** Create `SupportProvider` in `backend/app/signals/providers/support.py` reading `WHERE SOURCE = 'support'`. Register in `__init__.py`.

---

### Step 10: Refine `no_interaction_14d` — SetSail Augmentation (Blocked)

**Current:** Only checks Gong calls via `BKMNG_ONT_INTERACTIONS`.

**Future:** Also check SetSail meeting data. Gong cannot record all calls — SetSail captures meetings that Gong misses.

**Blocker:** SetSail production data is in `SALES.ACTIVITY.SETSAIL_ACCOUNT_ACTIVITY` (no access). `SALES.DEV.SETSAIL_*` has only 10 sample rows.

**When unblocked:**
1. Materialize SetSail data into `BKMNG_SETSAIL_MEETINGS` (Layer 1)
2. Modify the `no_interaction_14d` and `no_interaction_7d` logic to check BOTH Gong interactions AND SetSail meetings before firing
3. An account with a SetSail meeting in the window should NOT get a no-interaction signal even if Gong shows no calls

---

## Implementation Order

1. **Step 0** — Partition-safe delete (prerequisite, do first)
2. **Step 2** — Remove deleted signals (clean up SP)
3. **Step 1** — Pause signals (comment out blocks)
4. **Steps 3-8** — Refinements and new signal (can be done in any order)
5. **Step 9** — Extract support signals to dedicated SP + provider
6. **Step 10** — SetSail augmentation (when data access is granted)

---

## Python Changes Summary

### `backend/app/signals/providers/core.py`

**`_TYPE_TO_CATEGORY` map — final state:**
```python
_TYPE_TO_CATEGORY: dict[str, str] = {
    # Active
    "no_interaction_14d":   "engagement",
    "no_interaction_7d":    "engagement",
    "capacity_warning":     "consumption",
    "consumption_spike":    "consumption",
    "consumption_dip":      "consumption",
    "contract_ending":      "consumption",
    "expansion_signal":     "consumption",
    "new_feature_adoption": "engagement",
    "go_live_approaching":  "go_live",
    "open_tmr":             "tmr",
    "use_case_no_dates":    "use_case",
    # Paused (kept for reactivation)
    "champion_silent":      "engagement",
    "competitor_mentioned":  "engagement",
    "stage_stalled":        "use_case",
    # Removed: high_momentum, new_stakeholder, contract_ending (medium)
}
```

### `backend/app/signals/providers/support.py` (new file)

```python
class SupportProvider(SignalProvider):
    name = "support"
    # Reads WHERE SOURCE = 'support' from BKMNG_ONT_ACCOUNT_SIGNALS
```

### `backend/app/signals/__init__.py`

```python
def _register_all_providers(registry: SignalRegistry) -> None:
    registry.register(CoreProvider())
    registry.register(SupportProvider())
```

---

## Metrics After Implementation

| Metric | Before | Expected After |
|--------|--------|---------------|
| Total signals | 2,059 | ~800-1,000 (pausing 3 high-volume signals, consolidating feature adoption, adding revenue floor) |
| Distinct signal types | 17 active | 14 active + 1 new = 15 active, 3 paused |
| Alert-eligible signals | 402 | ~350 (removing medium contract_ending, adding open_tmr + new_feature_adoption alerts) |
| Support signals source | Inline in core SP | Dedicated `support` SP + provider |
| Noise reduction | — | Revenue floor eliminates ~40% of consumption signals on low-volume accounts |
