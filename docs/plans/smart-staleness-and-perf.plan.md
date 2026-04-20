# Plan: Smart Staleness Alerts + Dropdown Performance Fix

## Overview

Two independent fixes in one session.

---

## Part A — Status-Aware Stale Use-Case Alerts

### Current state
- `SP_CHECK_STALE_USE_CASES` (Snowflake) alerts any use case with `LAST_NOTE_DATE` older than 6 days, regardless of the account's status.
- `UseCaseCard` in `bkmng-next/app/accounts/[id]/page.tsx` mirrors this with a client-side `daysSinceNote >= 6` check.

### Desired behaviour

| Account status | Alert threshold | When to fire |
|---|---|---|
| `active` | 7 days | Fridays only |
| `not started` | 7 days | Fridays only |
| `paused` / `stopped` | 14 days | Any day |
| `complete` | — | Never (suppress & auto-dismiss) |

Status values are stored **lowercase** in `BKMNG_ONT_ACCOUNTS.STATUS` (set by the dropdown: `"active"`, `"not started"`, `"complete"`, `"stopped"`, `"paused"`).

In Snowflake `DAYOFWEEK(CURRENT_DATE()) = 5` = Friday (0=Sun … 6=Sat).

---

### Task 1 — Rework `SP_CHECK_STALE_USE_CASES`

**File:** executed directly via `snowflake_sql_execute` (no local file to edit).

Replace the stored procedure with this logic:

```sql
CREATE OR REPLACE PROCEDURE TEMP.JUSDAVIS.SP_CHECK_STALE_USE_CASES()
RETURNS VARCHAR
LANGUAGE SQL
AS $$
BEGIN
    -- 1. Auto-dismiss existing open alerts for use cases on COMPLETE accounts
    UPDATE TEMP.JUSDAVIS.BKMNG_USER_ALERTS
    SET IS_DISMISSED = TRUE
    WHERE SIGNAL_TYPE = 'stale_use_case'
      AND IS_DISMISSED = FALSE
      AND SIGNAL_ID IN (
          SELECT uc.USE_CASE_ID
          FROM TEMP.JUSDAVIS.BKMNG_USE_CASES uc
          JOIN TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = uc.ACCOUNT_ID
          WHERE LOWER(COALESCE(a.STATUS, 'active')) = 'complete'
      );

    -- 2. Insert new alerts with status-aware threshold + day-of-week gating
    INSERT INTO TEMP.JUSDAVIS.BKMNG_USER_ALERTS (
        ALERT_ID, USER_EMAIL, SIGNAL_ID, SIGNAL_TYPE,
        ACCOUNT_ID, ACCOUNT_NAME, TEXT, PRIORITY, SOURCE,
        IS_READ, IS_DISMISSED, CREATED_AT
    )
    SELECT
        UUID_STRING(),
        uc.LEAD_SE,
        uc.USE_CASE_ID,
        'stale_use_case',
        uc.ACCOUNT_ID,
        uc.ACCOUNT_NAME,
        CASE
            WHEN n.LAST_NOTE_DATE IS NULL
                THEN 'Add PS notes for: ' || uc.USE_CASE_NAME || ' — no notes yet'
            ELSE 'Update PS notes for: ' || uc.USE_CASE_NAME
                || ' — last updated '
                || DATEDIFF('day', n.LAST_NOTE_DATE, CURRENT_DATE())::VARCHAR
                || ' days ago'
        END,
        'medium', 'system', FALSE, FALSE, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_USE_CASES uc
    JOIN TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = uc.ACCOUNT_ID
    LEFT JOIN (
        SELECT USE_CASE_ID, MAX(NOTE_DATE) AS LAST_NOTE_DATE
        FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES
        GROUP BY USE_CASE_ID
    ) n ON n.USE_CASE_ID = uc.USE_CASE_ID
    WHERE uc.LEAD_SE IS NOT NULL
      -- Skip completed/closed use cases
      AND UPPER(COALESCE(uc.STATUS, '')) NOT IN ('COMPLETED', 'CLOSED')
      -- Skip accounts marked complete
      AND LOWER(COALESCE(a.STATUS, 'active')) != 'complete'
      -- Status-aware threshold + day-of-week gating
      AND CASE
            WHEN LOWER(COALESCE(a.STATUS, 'active')) IN ('paused', 'stopped')
                THEN (n.LAST_NOTE_DATE IS NULL
                      OR DATEDIFF('day', n.LAST_NOTE_DATE, CURRENT_DATE()) >= 14)
            ELSE  -- active / not started: only fire on Fridays
                DAYOFWEEK(CURRENT_DATE()) = 5
                AND (n.LAST_NOTE_DATE IS NULL
                     OR DATEDIFF('day', n.LAST_NOTE_DATE, CURRENT_DATE()) >= 7)
          END
      -- Dedup: skip if open undismissed alert already exists
      AND NOT EXISTS (
          SELECT 1 FROM TEMP.JUSDAVIS.BKMNG_USER_ALERTS al
          WHERE al.SIGNAL_ID = uc.USE_CASE_ID
            AND al.SIGNAL_TYPE = 'stale_use_case'
            AND al.IS_DISMISSED = FALSE
      );

    RETURN 'done';
END;
$$
```

The task `TASK_CHECK_STALE_USE_CASES` (daily `0 8 * * * UTC`) needs no schedule change — the SP handles the day-of-week guard internally.

---

### Task 2 — Frontend `UseCaseCard` badge

**File:** [`bkmng-next/app/accounts/[id]/page.tsx`](bkmng-next/app/accounts/[id]/page.tsx)

**Step 2a — Propagate `accountStatus` down to `UseCaseCard`**

The page-level `account` object already has a `status` field. Pass it into the card:

```tsx
// Where UseCaseCard is rendered (currently):
useCases.map((uc) => <UseCaseCard key={uc.use_case_id} uc={uc} />)

// Change to:
useCases.map((uc) => (
  <UseCaseCard key={uc.use_case_id} uc={uc} accountStatus={account?.status} />
))
```

**Step 2b — Update `UseCaseCard` signature and threshold logic**

```tsx
function UseCaseCard({ uc, accountStatus }: { uc: UseCase; accountStatus?: string | null }) {
  const days = daysUntil(uc.target_go_live_date);
  const daysSinceNote = uc.last_note_date
    ? Math.floor((Date.now() - new Date(uc.last_note_date).getTime()) / 86_400_000)
    : null;

  const normalStatus = (accountStatus ?? "active").toLowerCase();
  const staleThreshold = ["paused", "stopped"].includes(normalStatus) ? 14 : 7;
  const isStaleNotes =
    normalStatus !== "complete" &&
    (daysSinceNote === null || daysSinceNote >= staleThreshold);
```

No change needed to the badge JSX itself — the existing amber `AlertTriangle` render block is unchanged.

---

## Part B — Dropdown Performance Fix

### Root cause

```
User selects status → PATCH fires
  → UPDATE BKMNG_ONT_ACCOUNTS (~200ms Snowflake)          [write]
  → get_account() re-fetch (~300ms Snowflake)              [unnecessary 2nd query]
  → HTTP response arrives
  → onSuccess fires:
      → invalidateQueries(["account", accountId])           [fine — single account]
      → invalidateQueries(["accounts"])                     [BAD — heavy list re-fetch]
  → "accounts" refetch hits Snowflake (~800ms)
Total perceived delay: ~1.5–2s
```

---

### Task 3 — Remove double Snowflake query in backend PATCH

**File:** [`backend/app/routers/accounts.py`](backend/app/routers/accounts.py)

Currently the endpoint calls `get_account()` after the UPDATE just to return a full `Account` object — but the frontend never uses this value (it discards the return and calls `invalidateQueries` instead).

Change the endpoint to return a lightweight confirmation and drop the second query:

```python
# Before (lines ~193-208):
@router.patch("/accounts/{account_id}", response_model=Account)
async def update_account_fields(...) -> Account:
    ...
    data.update_account_fields(account_id, body.status, body.engagement_status, body.no_recording)
    acct = data.get_account(account_id)   # ← remove this
    if acct is None:                       # ← remove this
        raise HTTPException(...)           # ← remove this
    return acct                            # ← remove this

# After:
@router.patch("/accounts/{account_id}")
async def update_account_fields(...):
    data.update_account_fields(account_id, body.status, body.engagement_status, body.no_recording)
    return {"account_id": account_id, "ok": True}
```

---

### Task 4 — Fix `useUpdateAccountFields` cache strategy

**File:** [`bkmng-next/hooks/useApi.ts`](bkmng-next/hooks/useApi.ts)

The `onSuccess` currently triggers two invalidations. Drop the expensive one and apply an instant optimistic cache update instead:

```typescript
// Before:
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ["account", accountId] });
  qc.invalidateQueries({ queryKey: ["accounts"] });   // ← expensive, remove
},

// After:
onMutate: async (body) => {
  await qc.cancelQueries({ queryKey: ["account", accountId] });
  const previous = qc.getQueryData(["account", accountId]);
  qc.setQueryData(["account", accountId], (old: Account | undefined) =>
    old ? { ...old, ...body } : old
  );
  return { previous };
},
onError: (_err, _body, ctx) => {
  if (ctx?.previous) qc.setQueryData(["account", accountId], ctx.previous);
},
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ["account", accountId] });
  // accounts list will re-sync on next natural navigation (staleTime: 30s)
},
```

This pattern:
1. Instantly updates the status/engagement badge in the UI on click (no wait)
2. Background-validates with a single `get_account` refetch after success
3. Never touches the expensive `["accounts"]` list until the user navigates there

The `Account` type is already imported/available in `useApi.ts` — no extra imports needed.
