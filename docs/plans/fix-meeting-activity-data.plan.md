# Plan: Fix Meeting Activity Data

## Diagnosis

### Root cause — empty table

```
BKMNG_MEETING_ACTIVITY  →  0 rows  (LAST_REFRESH = NULL)
```

`TASK_REFRESH_BKMNG_MEETING_ACTIVITY` was created on 2026-04-08, suspended immediately (`last_suspended_reason: USER_SUSPENDED`), and the SP never ran. The source table `SALES.RAVEN.ALL_ENGAGEMENTS_PREPED_VIEW` has **4,001 matching meetings** for accounts in `BKMNG_ACCOUNTS` in the past-90d / future-21d window.

### Cascading effect

`SP_REFRESH_BKMNG_ONT_ACCOUNTS` contains a `meeting_agg` CTE:

```sql
meeting_agg AS (
  SELECT ACCOUNT_ID,
    COUNT(CASE WHEN IS_UPCOMING = FALSE AND ACTIVITY_DATE >= DATEADD('day', -30, CURRENT_DATE()) THEN 1 END) AS MEETINGS_LAST_30D,
    COUNT(CASE WHEN IS_UPCOMING = TRUE  AND ACTIVITY_DATE <= DATEADD('day',  5, CURRENT_DATE()) THEN 1 END) AS UPCOMING_MEETINGS_5D,
    MAX(CASE WHEN IS_UPCOMING = FALSE THEN ACTIVITY_DATE END) AS LAST_MEETING_DATE
  FROM TEMP.JUSDAVIS.BKMNG_MEETING_ACTIVITY
  GROUP BY ACCOUNT_ID
)
```

Because the source table is empty, every account gets `MEETINGS_LAST_30D = 0` and `UPCOMING_MEETINGS_5D = 0`.

### What the user sees

| Display | Source | Value |
|---|---|---|
| "Meetings (30d)" in sidebar | `account.meetings_last_30d` from `BKMNG_ONT_ACCOUNTS` | 0 for all 508 accounts |
| "Upcoming (14d)" in sidebar | `upcomingMeetingsList.length` filtered from `useMeetingActivity` | 0 (empty array) |
| Meeting list items in timeline | `useMeetingActivity(accountId, false)` | empty |

### Secondary bug — frontend date parsing

In [`bkmng-next/app/accounts/[id]/page.tsx`](bkmng-next/app/accounts/[id]/page.tsx) line ~511:

```ts
// Current — WRONG for US timezones
const upcomingMeetingsList = useMemo(() => {
  return meetings.filter((m) =>
    m.is_upcoming || (m.activity_date != null && new Date(m.activity_date) > now)
  );
}, [meetings]);
```

`activity_date` arrives as `"2026-04-10"` (a Python `date` serialized as ISO string). JavaScript's `new Date("2026-04-10")` interprets this as **UTC midnight** — in Pacific time (UTC-7) that is April 9 at 5pm, meaning any meeting scheduled for today will evaluate as `< now` and drop off the upcoming list from midday onwards. `is_upcoming` (from the snapshot boolean) partially compensates, but not when the daily SP hasn't run yet.

---

## Fixes

### Task 1 — Populate the table now

```sql
CALL TEMP.JUSDAVIS.SP_REFRESH_BKMNG_MEETING_ACTIVITY()
```

The SP uses `EXECUTE AS CALLER` to access `SALES.RAVEN`, so running it via `snowflake_sql_execute` is sufficient. Expected result: ~4,001 rows inserted.

### Task 2 — Resume the daily task

```sql
ALTER TASK TEMP.JUSDAVIS.TASK_REFRESH_BKMNG_MEETING_ACTIVITY RESUME
```

This restores the `USING CRON 0 3 * * * UTC` schedule.

### Task 3 — Recompute BKMNG_ONT_ACCOUNTS

```sql
CALL TEMP.JUSDAVIS.SP_REFRESH_BKMNG_ONT_ACCOUNTS()
```

This rebuilds `BKMNG_ONT_ACCOUNTS` (CREATE OR REPLACE) so all 508 accounts get correct `MEETINGS_LAST_30D`, `UPCOMING_MEETINGS_5D`, and `LAST_MEETING_DATE` values.

### Task 4 — Fix frontend date parsing

**File:** [`bkmng-next/app/accounts/[id]/page.tsx`](bkmng-next/app/accounts/[id]/page.tsx) ~line 511

```ts
// Before
new Date(m.activity_date) > now

// After — forces local midnight, not UTC midnight
new Date(m.activity_date + "T00:00:00") > now
```

Apply the same fix anywhere else `activity_date` is compared to a Date object (line ~516 for the past-meetings filter).
