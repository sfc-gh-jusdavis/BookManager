# Plan: Fix Forecasts + NBA Redesign

## Overview
1. Fix ACE forecasts filter (single-line bug)
2. Add consumption signals to NBA (spike/dip, no-call-in-1-week)
3. Backend `/nba` endpoint with Cortex COMPLETE AI summaries
4. NBA card redesign (icon + AI summary + Raven deep link)
5. Quick-reply chips in RavenChat when opened from NBA

---

## Task 1 — Fix forecasts ACE email filter
**File**: `bkmng-next/app/forecasts/page.tsx` line 64

**Root cause**: `a.ace_assigned === currentUser?.user_id` uses the mock user ID (e.g. `jusdavis-ace`) but `BKMNG_ACCOUNTS.ACE_ASSIGNED` stores the ACE's email (e.g. `redacted@example.com`). `ACEDashboard.tsx` correctly uses `currentUser?.email`.

**Fix**: `currentUser?.user_id` → `currentUser?.email`

---

## Task 2 — Add WoW/MoM to bulk revenue summaries
**File**: `backend/app/services/snowflake_service.py`

The existing `list_account_revenue_summaries` queries `BKMNG_CONTRACT_REVENUE` but does not join `BKMNG_CONSUMPTION_TRENDS`. After fetching contract rows, run a second query:
```sql
SELECT ct.ACCOUNT_ID, ct.PERIOD_TYPE, ct.PCT_CHANGE
FROM BKMNG_CONSUMPTION_TRENDS ct
JOIN BKMNG_ACCOUNTS a ON a.ACCOUNT_ID = ct.ACCOUNT_ID
WHERE ct.IS_COMPLETE_PERIOD = TRUE
  [AND a.ACE_ASSIGNED = %s]
QUALIFY ROW_NUMBER() OVER (PARTITION BY ct.ACCOUNT_ID, ct.PERIOD_TYPE ORDER BY ct.PERIOD_START DESC) = 1
```
Merge WoW/MoM into each `AccountRevenueSummary` in the result dict.

---

## Task 3 — Add useRevenueSummaries hook
**File**: `bkmng-next/hooks/useApi.ts`

```ts
export function useRevenueSummaries() {
  return useQuery({
    queryKey: ["revenue-summaries"],
    queryFn: () => apiFetch<Record<string, AccountRevenueSummary>>("/api/accounts/revenue-summaries"),
    ...DEFAULT_OPTS,
  });
}

type AccountRevenueSummary = {
  account_id: string;
  wow_credits_pct_change: number | null;
  mom_credits_pct_change: number | null;
  pct_consumed: number | null;
};
```

---

## Task 4 — NBA consumption signals + 7-day no-call window
**File**: `bkmng-next/components/dashboard/ACEDashboard.tsx`

1. Import `useRevenueSummaries`, compute consumption signals in `nextActions` useMemo:
   - WoW ≥ +30% → "Consumption spike: {account}" (indigo, medium)
   - WoW ≤ −20% → "Consumption dip: {account}" (rose, medium)
2. Change no-recent-call window from 30 days to 7 days (and bump priority to medium)

---

## Task 5 — Backend /nba endpoint with Cortex COMPLETE
**Files**: `backend/app/routers/nba.py` (new), `backend/app/services/snowflake_service.py`, `backend/app/main.py`

New `GET /nba` endpoint:
1. Fetches accounts, use_cases, TMRs, Gong calls, revenue summaries for the ACE
2. Computes all signals (same logic as frontend, server-side)
3. For each signal, calls:
   ```sql
   SELECT SNOWFLAKE.CORTEX.COMPLETE(
     'snowflake-arctic',
     'You are a sales assistant. Generate a 1-2 sentence action-oriented summary for this signal: {signal_description}. Context: {gong_summary_or_use_case_notes}'
   )
   ```
4. Returns list of `NBAItem`:
   ```python
   class NBAItem(BaseModel):
       id: str
       account_id: str
       account_name: str
       signal_type: str  # "blocker" | "at_risk" | "go_live" | "tmr" | "no_call" | "consumption_spike" | "consumption_dip" | "gong_action"
       text: str
       ai_summary: str
       priority: str  # "high" | "medium" | "low"
```
5. Register in `main.py`

---

## Task 6 — NBA card redesign
**File**: `bkmng-next/components/dashboard/ACEDashboard.tsx`

Replace `<ul>` list with richer cards:
```tsx
<div className="space-y-2">
  {nbaItems.map(item => (
    <div key={item.id} className="rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
      <div className="flex items-start gap-2">
        <SignalIcon type={item.signal_type} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">{item.account_name}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{item.ai_summary}</p>
        </div>
        <PriorityBadge priority={item.priority} />
      </div>
      <div className="mt-2 flex gap-2">
        <Link href={`/accounts/${item.account_id}?tab=assistant&nba=${item.id}`} 
          className="text-[10px] text-sky-600 hover:underline flex items-center gap-1">
          <Sparkles size={10} /> Open with Raven
        </Link>
      </div>
    </div>
  ))}
</div>
```

---

## Task 7 — Quick-reply chips in RavenChat
**Files**: `bkmng-next/components/dashboard/RavenChat.tsx`, `bkmng-next/app/accounts/[id]/page.tsx`

1. `RavenChat` accepts optional `nbaContext?: { id: string; text: string; summary: string }` prop
2. When `nbaContext` is set:
   - Auto-open panel on mount
   - First assistant message includes NBA context summary
   - Show 3 quick-reply chips below intro message:
     - "Why is this recommended?"
     - "Tell me more"
     - "Help me create an email / slides / guide"
3. Account page (`/accounts/[id]`): read `?nba=...` from URL, look up the NBA item from a global store or re-fetch from `/nba`, pass as `nbaContext` to `<RavenChat />`
