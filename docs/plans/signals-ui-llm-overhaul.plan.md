# Plan: Signals UI + LLM Overhaul (Dashboard tasks removed)

## What was already done
- **Step 0** (partition-safe delete): `TRUNCATE` → `DELETE WHERE SOURCE='core'` — DONE
- `SupportProvider` class, registered in `__init__.py` — DONE
- `SP_COMPUTE_SUPPORT_SIGNALS` + Task — DONE
- **Dashboard command center** — DONE (replaces former "Dashboard: Alerts widget" task from this plan)

---

## Task 1 — Patch core SP: pause, remove, refine, add signals

**Method:** Python connector script (same pattern as prior patches) — retrieve full SP DDL, apply all changes in one patched string, re-execute.

**Script:** `/tmp/patch_core_sp_signals.py`

### 1a. Pause (comment out INSERT blocks)
Signals: `champion_silent`, `competitor_mentioned`, `stage_stalled`
```sql
-- PAUSED: champion_silent
-- INSERT INTO BKMNG_ONT_ACCOUNT_SIGNALS ...
```

### 1b. Remove (delete INSERT blocks entirely)
- `contract_ending` medium-priority version (keep the high-priority ≤30d version)
- `new_stakeholder`
- Support signal INSERTs: `open_sev1_ticket`, `open_sev2_ticket`, `long_running_ticket`, `ticket_volume_spike` — these are now handled by `SP_COMPUTE_SUPPORT_SIGNALS` with `SOURCE='support'`; remove the duplicate blocks from the core SP

### 1c. Refine `capacity_warning` — milestone thresholds
Replace continuous percentage logic with milestone-bucketed:
```sql
WHERE overage_pct >= 75
-- PRIORITY: >=125 → high, >=100 → high, >=90 → medium, >=75 → medium
```

### 1d. Refine consumption signals — revenue floor + ramp detection
- Tier 1: Fire `consumption_spike`/`consumption_dip` only when `REV_LAST_WEEK >= 350` (~$50/day floor)
- Tier 2: Small accounts (`REV_LAST_WEEK < 350`) with `MOM_CHANGE > 100%` AND `ACTIVE_DAYS_30D >= 20` → `consumption_spike`, priority=`low`, metadata `ramp_detected: true`

### 1e. Consolidate `new_feature_adoption` — 1 signal per account
Replace per-feature rows with:
```sql
GROUP BY ACCOUNT_ID
-- SIGNAL_TEXT: 'New features adopted: feature1, feature2'
-- METADATA: {features: [...], count: N}
-- ALERT_ELIGIBLE: TRUE
```

### 1f. Narrow `expansion_signal` — new use case only
Remove the broad consumption-based trigger; keep only: use case `CREATED_DATE >= DATEADD('day', -7, CURRENT_DATE())` and `STAGE NOT IN ('Closed', 'Cancelled')`.

### 1g. Mark `open_tmr` alert-eligible
Add `ALERT_ELIGIBLE = TRUE` and metadata `{tmr_status, assigned_to}`.

### 1h. Add new signal `use_case_no_dates`
```sql
INSERT INTO BKMNG_ONT_ACCOUNT_SIGNALS (...)
SELECT UUID_STRING(), 'use_case_no_dates', uc.ACCOUNT_ID, a.ACCOUNT_NAME,
    'low', 'Use case "' || uc.USE_CASE_NAME || '" missing key dates',
    'Stage: ' || uc.STAGE || ' for ' || DATEDIFF('day', uc.STAGE_ENTERED_DATE, CURRENT_DATE()) || ' days...',
    'use_case', 'core', 'use_case', FALSE,
    OBJECT_CONSTRUCT('use_case_id', uc.USE_CASE_ID, 'stage', uc.STAGE,
                     'days_in_stage', DATEDIFF('day', uc.STAGE_ENTERED_DATE, CURRENT_DATE())),
    CURRENT_TIMESTAMP()
FROM BKMNG_ONT_USE_CASES uc
JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = uc.ACCOUNT_ID
WHERE uc.STAGE NOT IN ('Closed', 'Cancelled', 'Live')
  AND DATEDIFF('day', uc.STAGE_ENTERED_DATE, CURRENT_DATE()) >= 7
  AND (uc.IMPLEMENTATION_START_DATE IS NULL OR uc.GO_LIVE_DATE IS NULL)
```

---

## Task 2 — Update `core.py` `_TYPE_TO_CATEGORY` map

**File:** [`backend/app/signals/providers/core.py`](backend/app/signals/providers/core.py)

Final map:
```python
_TYPE_TO_CATEGORY: dict[str, str] = {
    # Active
    "no_interaction_14d": "engagement",
    "no_interaction_7d":  "engagement",
    "new_feature_adoption": "engagement",
    "capacity_warning":   "consumption",
    "consumption_spike":  "consumption",
    "consumption_dip":    "consumption",
    "contract_ending":    "consumption",
    "expansion_signal":   "consumption",
    "go_live_approaching": "go_live",
    "open_tmr":           "tmr",
    "use_case_no_dates":  "use_case",   # NEW
    # Paused (kept for reactivation)
    "champion_silent":    "engagement",
    "competitor_mentioned": "engagement",
    "stage_stalled":      "use_case",
    # Removed: high_momentum, new_stakeholder, contract_ending (medium)
}
```

---

## Task 3 — Switch `list_accounts` to `BKMNG_ONT_ACCOUNTS` + enrich Account model

### SQL change
**File:** [`backend/app/services/snowflake_service.py`](backend/app/services/snowflake_service.py) — `list_accounts` and `get_account` methods (lines ~77–145)

Switch `FROM BKMNG_ACCOUNTS a` → `FROM BKMNG_ONT_ACCOUNTS a`.

Add to SELECT (columns that exist on `BKMNG_ONT_ACCOUNTS`):
```sql
a.SIG_PIPELINE,
a.SIG_AIML,
a.HEALTH_SCORE,
a.MOMENTUM,
a.WOW_PCT_CHANGE
```
Keep the existing `COUNT(uc.USE_CASE_ID)` JOIN against `BKMNG_USE_CASES`.

### Model change
**File:** [`backend/app/models/account.py`](backend/app/models/account.py)

Add to `Account`:
```python
sig_pipeline: Optional[float] = None
sig_aiml: Optional[float] = None
health_score: Optional[float] = None
momentum: Optional[str] = None
wow_pct_change: Optional[float] = None
```

---

## Task 4 — Add `/accounts/signal-counts` bulk endpoint

**File:** [`backend/app/routers/accounts.py`](backend/app/routers/accounts.py)

New route `GET /api/accounts/signal-counts` — returns a dict keyed by account_id:
```python
@router.get("/signal-counts")
def signal_counts(user: CurrentUser = Depends(get_current_user)):
    # SQL: SELECT ACCOUNT_ID,
    #        SUM(CASE WHEN PRIORITY='high' THEN 1 ELSE 0 END) AS high_count,
    #        SUM(CASE WHEN PRIORITY='medium' THEN 1 ELSE 0 END) AS medium_count,
    #        COUNT(*) AS total
    #      FROM BKMNG_ONT_ACCOUNT_SIGNALS s
    #      JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = s.ACCOUNT_ID
    #      WHERE a.ACE_ASSIGNED = %s  (scoped to user's book)
    #      GROUP BY s.ACCOUNT_ID
    # Returns: { "acct-id": { "high": N, "medium": N, "total": N }, ... }
```

Also add `useSignalCounts()` hook in [`bkmng-next/hooks/useApi.ts`](bkmng-next/hooks/useApi.ts).

---

## Task 5 — Accounts page: signal badges + adoption pills in table row

**File:** [`bkmng-next/app/accounts/page.tsx`](bkmng-next/app/accounts/page.tsx)

Fetch signal counts via `useSignalCounts()`. In each account row:
- Show a red dot badge `N` if high-count > 0, amber badge if medium-count > 0 (no high)
- If account has `new_feature_adoption` signal in its count, show a violet "adoption" pill

Example row addition (after the existing Status column):
```tsx
{/* Signal badge */}
{signalCounts[account.account_id]?.high > 0 && (
  <span className="inline-flex items-center rounded-full bg-red-50 text-red-600 border border-red-100 px-1.5 text-[9px] font-semibold">
    {signalCounts[account.account_id].high} alert{signalCounts[account.account_id].high !== 1 ? "s" : ""}
  </span>
)}
```

---

## Task 6 — Accounts expanded row: replace Resources with Signals panel

**File:** [`bkmng-next/app/accounts/page.tsx`](bkmng-next/app/accounts/page.tsx) — expanded row section (~line 195)

Replace the "Resources" placeholder block with a Signals panel:
- Fetch signals per account via the existing `useNBA()` hook (filtered client-side by `account_id`) or a new per-account endpoint
- Render up to 5 signals: icon + signal type label + priority badge + text
- "Open with ACE" link per signal (same pattern as Focus Queue in `ACEDashboard.tsx`)
- "View all" link to `/accounts/{id}`

---

## Task 7 — Snowflake AI assessment tables + SP + Task

**Method:** Python connector script `/tmp/create_ai_assessments.py`

### Tables
```sql
CREATE TABLE IF NOT EXISTS BKMNG_AI_USE_CASE_ASSESSMENTS (
    ASSESSMENT_ID    VARCHAR DEFAULT UUID_STRING(),
    USE_CASE_ID      VARCHAR NOT NULL,
    ACCOUNT_ID       VARCHAR NOT NULL,
    TIER             VARCHAR,          -- 'commit', 'most_likely', 'stretch'
    CONFIDENCE_SCORE FLOAT,
    RATIONALE        VARCHAR,
    RISK_FACTORS     VARIANT,          -- ARRAY of strings
    NEXT_ACTIONS     VARIANT,          -- ARRAY of strings
    ASSESSED_AT      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS BKMNG_AI_ACCOUNT_ASSESSMENTS (
    ASSESSMENT_ID          VARCHAR DEFAULT UUID_STRING(),
    ACCOUNT_ID             VARCHAR NOT NULL,
    PRIORITY_SCORE         INTEGER,   -- 1-10
    CONSUMPTION_IMPACT     VARCHAR,   -- 'high', 'medium', 'low'
    PRIORITY_RATIONALE     VARCHAR,
    RECOMMENDED_ACTIONS    VARIANT,   -- ARRAY of strings
    ASSESSED_AT            TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
```

### SP: `SP_COMPUTE_AI_ASSESSMENTS`
Uses `SNOWFLAKE.CORTEX.COMPLETE('llama3.1-70b', prompt_string)` (string prompt format — messages array not supported on this account).

```sql
CREATE OR REPLACE PROCEDURE SP_COMPUTE_AI_ASSESSMENTS()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS $$
BEGIN
  -- Use case assessments
  DELETE FROM BKMNG_AI_USE_CASE_ASSESSMENTS;
  INSERT INTO BKMNG_AI_USE_CASE_ASSESSMENTS (USE_CASE_ID, ACCOUNT_ID, TIER, CONFIDENCE_SCORE, RATIONALE, RISK_FACTORS, NEXT_ACTIONS)
  WITH uc_context AS (
    SELECT uc.USE_CASE_ID, uc.ACCOUNT_ID, uc.USE_CASE_NAME, uc.STAGE, uc.STATUS,
           a.ACCOUNT_NAME, a.HEALTH_SCORE, a.MOMENTUM,
           SNOWFLAKE.CORTEX.COMPLETE('llama3.1-70b',
             'Assess this Snowflake use case. Return JSON only: {"tier":"commit|most_likely|stretch","confidence":0.0-1.0,"rationale":"...","risk_factors":["..."],"next_actions":["..."]}. Use case: ' || uc.USE_CASE_NAME || ', Stage: ' || uc.STAGE || ', Status: ' || uc.STATUS || ', Account health: ' || COALESCE(a.HEALTH_SCORE::VARCHAR, 'unknown') || ', Momentum: ' || COALESCE(a.MOMENTUM, 'unknown')
           ) AS llm_response
    FROM BKMNG_ONT_USE_CASES uc
    JOIN BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = uc.ACCOUNT_ID
    WHERE uc.STAGE NOT IN ('Closed', 'Cancelled')
  )
  SELECT USE_CASE_ID, ACCOUNT_ID,
    TRY_PARSE_JSON(llm_response):tier::VARCHAR,
    TRY_PARSE_JSON(llm_response):confidence::FLOAT,
    TRY_PARSE_JSON(llm_response):rationale::VARCHAR,
    TRY_PARSE_JSON(llm_response):risk_factors,
    TRY_PARSE_JSON(llm_response):next_actions
  FROM uc_context;

  -- Account assessments (similar pattern)
  DELETE FROM BKMNG_AI_ACCOUNT_ASSESSMENTS;
  INSERT INTO BKMNG_AI_ACCOUNT_ASSESSMENTS ...;

  RETURN 'done';
END;
$$
```

### Task
```sql
CREATE OR REPLACE TASK TASK_COMPUTE_AI_ASSESSMENTS
  WAREHOUSE = SE_XS_WH
  SCHEDULE = 'USING CRON 0 6 * * * UTC'
AS CALL SP_COMPUTE_AI_ASSESSMENTS();

ALTER TASK TASK_COMPUTE_AI_ASSESSMENTS RESUME;
```

---

## Task 8 — Backend AI assessment endpoints + models

### New Pydantic models
**File:** [`backend/app/models/account.py`](backend/app/models/account.py)
```python
class UseCaseAssessment(BaseModel):
    use_case_id: str
    account_id: str
    tier: Optional[str] = None
    confidence_score: Optional[float] = None
    rationale: Optional[str] = None
    risk_factors: list[str] = []
    next_actions: list[str] = []
    assessed_at: Optional[datetime] = None

class AccountAssessment(BaseModel):
    account_id: str
    priority_score: Optional[int] = None
    consumption_impact: Optional[str] = None
    priority_rationale: Optional[str] = None
    recommended_actions: list[str] = []
    assessed_at: Optional[datetime] = None
```

### New routes
**File:** new [`backend/app/routers/assessments.py`](backend/app/routers/assessments.py)
```python
GET /api/assessments/accounts                   # all account assessments for user's book
GET /api/assessments/use-cases/{account_id}     # use case assessments for one account
```

Register router in `main.py`.

Add service methods in `snowflake_service.py`:
```python
def list_account_assessments(self, ace_filter=None) -> list[AccountAssessment]: ...
def list_use_case_assessments(self, account_id: str) -> list[UseCaseAssessment]: ...
```

Add hooks in `useApi.ts`:
```ts
useAccountAssessments() → GET /api/assessments/accounts
useUseCaseAssessments(accountId) → GET /api/assessments/use-cases/{accountId}
```

---

## Task 9 — Forecasts AI tier badges + Accounts expanded AI summary

### 9a. Forecasts page AI tier badges
**File:** [`bkmng-next/app/forecasts/page.tsx`](bkmng-next/app/forecasts/page.tsx)

Fetch `useUseCaseAssessments(accountId)` per expanded account row. In each use case row, beside the existing `CatBadge`, add:
- An AI tier badge (e.g. `AI: most_likely`) styled differently from the manual `CatBadge`
- A confidence indicator (colored dot: green ≥0.7, amber ≥0.5, red <0.5)
- Collapsible rationale (toggle to show the rationale + risk factors)

### 9b. Accounts expanded row AI priority summary
**File:** [`bkmng-next/app/accounts/page.tsx`](bkmng-next/app/accounts/page.tsx)

In the expanded row (alongside the new Signals panel from Task 6), add an "AI Assessment" section:
- Priority score (1–10) shown as a numeric badge
- 1-2 sentence `priority_rationale`
- `recommended_actions` as a compact bullet list
- `assessed_at` timestamp ("assessed Xh ago")

---

## Implementation Order

1 → 2 (SP first, Python map follows)
→ 3 (enrich Account model/query, no frontend blockers)
→ 4 (endpoint, prerequisite for Task 5)
→ 5 → 6 (frontend accounts updates)
→ 7 (Snowflake AI infra, no frontend blocker)
→ 8 (backend endpoints, prerequisite for Task 9)
→ 9 (frontend AI layer)
