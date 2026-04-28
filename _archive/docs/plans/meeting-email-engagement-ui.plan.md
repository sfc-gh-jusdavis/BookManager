---
name: "meeting-email-engagement-ui"
created: "2026-04-08T01:13:07.321Z"
status: pending
---

# Plan: Meeting & Email Engagement UI Refresh

## Overview

Adds meeting/email engagement data across the dashboard, accounts list, account detail, and forecasts pages. Surfaces 5 new signal types, enriched account fields, per-account meeting intelligence (AI takeaways, pain/competitor flags), and email trend data from the new `BKMNG_MEETING_ACTIVITY` + `BKMNG_EMAIL_ACTIVITY` tables.

**Prerequisite:** `plan_2026-04-08_0000.md` must execute first to create all Snowflake objects.

---

## Architecture

```
flowchart TD
  subgraph snowflake [Snowflake]
    MEET[BKMNG_MEETING_ACTIVITY]
    EMAIL[BKMNG_EMAIL_ACTIVITY]
    ACCT["BKMNG_ONT_ACCOUNTS\n+6 cols"]
    SIG["BKMNG_ONT_ACCOUNT_SIGNALS\n+5 signal types"]
  end

  subgraph backend [FastAPI Backend]
    ACCTMODEL["account.py\nAccount + MeetingActivity + EmailActivity"]
    SVC["snowflake_service.py\nlist_meeting_activity + get_email_activity"]
    ROUTER["accounts.py\n/meetings + /email-activity endpoints"]
    CORE["core.py\n5 new signal categories"]
  end

  subgraph frontend [Next.js Frontend]
    HOOKS["useApi.ts\nuseMeetingActivity + useEmailActivity"]
    DASH["ACEDashboard.tsx\nnew signals + meetings filter + upcoming"]
    ACCTSPAGE["accounts/page.tsx\nengagement badges + activity panel"]
    DETAILPAGE["accounts/id/page.tsx\nmeeting card + email widget"]
  end

  MEET --> SVC
  EMAIL --> SVC
  ACCT --> SVC
  SIG --> CORE
  SVC --> ROUTER
  ROUTER --> HOOKS
  CORE --> DASH
  HOOKS --> DASH
  HOOKS --> ACCTSPAGE
  HOOKS --> DETAILPAGE
```

---

## Step 1: Execute infrastructure plan

Run `plan_2026-04-08_0000.md` in sequence:

1. Create `TEMP.JUSDAVIS.BKMNG_MEETING_ACTIVITY` (per-account meeting records: subject, date, is\_upcoming, takeaways, pain/competitor/next-step boolean flags)
2. Create `TEMP.JUSDAVIS.BKMNG_EMAIL_ACTIVITY` (per-account email aggregation: 7d/14d/30d/90d counts, trend, outbound/inbound)
3. Add 5 new signal INSERTs to `SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS`
4. `ALTER TABLE BKMNG_ONT_ACCOUNTS ADD COLUMN` for 6 new fields; update `SP_REFRESH_BKMNG_ONT_ACCOUNTS` SP with LEFT JOINs
5. Execute all SPs manually and resume new tasks; verify row counts

---

## Step 2: Backend — models, service methods, API endpoints

### `backend/app/models/account.py`

Add 6 engagement fields to `Account`:

```
meetings_last_30d: Optional[int] = None
upcoming_meetings_14d: Optional[int] = None
last_meeting_date: Optional[date] = None
emails_last_30d: Optional[int] = None
last_email_date: Optional[date] = None
email_trend: Optional[str] = None
```

Add two new Pydantic models at bottom of file:

```
class MeetingActivity(BaseModel):
    activity_id: str
    account_id: str
    subject: Optional[str] = None
    activity_date: Optional[date] = None
    is_upcoming: bool = False
    owner_name: Optional[str] = None
    participant_names: Optional[str] = None
    takeaways: Optional[str] = None
    is_pain_points: bool = False
    is_next_steps: bool = False
    is_competitor: bool = False

class EmailActivity(BaseModel):
    account_id: str
    emails_last_7d: int = 0
    emails_last_14d: int = 0
    emails_last_30d: int = 0
    emails_last_90d: int = 0
    last_email_date: Optional[date] = None
    emails_outbound_30d: int = 0
    emails_inbound_30d: int = 0
    avg_weekly_email_frequency: Optional[float] = None
    email_trend: Optional[str] = None
```

### `backend/app/services/snowflake_service.py`

**Update `list_accounts` and `get_account` SQL** — select 6 new columns from `BKMNG_ONT_ACCOUNTS`. The new columns are non-aggregated so they join directly. Update GROUP BY from 17 → 23 columns.

**Update `_row_to_account`** to map 6 new fields:

```
meetings_last_30d=int(r["MEETINGS_LAST_30D"]) if r.get("MEETINGS_LAST_30D") is not None else None,
upcoming_meetings_14d=int(r["UPCOMING_MEETINGS_14D"]) if r.get("UPCOMING_MEETINGS_14D") is not None else None,
last_meeting_date=r.get("LAST_MEETING_DATE"),
emails_last_30d=int(r["EMAILS_LAST_30D"]) if r.get("EMAILS_LAST_30D") is not None else None,
last_email_date=r.get("LAST_EMAIL_DATE"),
email_trend=r.get("EMAIL_TREND"),
```

**Add `list_meeting_activity(account_id: str) -> list[MeetingActivity]`**: Query `BKMNG_MEETING_ACTIVITY WHERE ACCOUNT_ID = %s ORDER BY ACTIVITY_DATE DESC LIMIT 50`.

**Add `get_email_activity(account_id: str) -> EmailActivity | None`**: Query `BKMNG_EMAIL_ACTIVITY WHERE ACCOUNT_ID = %s`, return first row or None.

### `backend/app/routers/accounts.py`

Import `MeetingActivity, EmailActivity` from `app.models.account`. Add two endpoints BEFORE the existing `/{account_id}` route:

```
@router.get("/accounts/{account_id}/meetings", response_model=list[MeetingActivity])
async def list_account_meetings(account_id: str, ...):
    return data.list_meeting_activity(account_id)

@router.get("/accounts/{account_id}/email-activity", response_model=EmailActivity | None)
async def get_account_email_activity(account_id: str, ...):
    return data.get_email_activity(account_id)
```

---

## Step 3: Backend — signal provider metadata

### `backend/app/signals/providers/core.py`

Add 5 entries to `_TYPE_TO_CATEGORY`:

```
"upcoming_meeting":    "engagement",
"no_upcoming_meeting": "engagement",
"meeting_momentum":    "engagement",
"email_silence":       "engagement",
"email_declining":     "engagement",
```

---

## Step 4: Frontend hooks

### `bkmng-next/hooks/useApi.ts`

Add after `useSignalCounts` export:

```
export type MeetingActivity = {
  activity_id: string;
  account_id: string;
  subject: string | null;
  activity_date: string | null;
  is_upcoming: boolean;
  owner_name: string | null;
  participant_names: string | null;
  takeaways: string | null;
  is_pain_points: boolean;
  is_next_steps: boolean;
  is_competitor: boolean;
};

export type EmailActivity = {
  account_id: string;
  emails_last_7d: number;
  emails_last_14d: number;
  emails_last_30d: number;
  emails_last_90d: number;
  last_email_date: string | null;
  emails_outbound_30d: number;
  emails_inbound_30d: number;
  avg_weekly_email_frequency: number | null;
  email_trend: string | null;
};

export function useMeetingActivity(accountId: string) {
  return useQuery<MeetingActivity[]>({
    queryKey: ["meeting-activity", accountId],
    queryFn: () => apiFetch<MeetingActivity[]>(`/api/accounts/${accountId}/meetings`),
    staleTime: 120_000, retry: 1, enabled: !!accountId,
  });
}

export function useEmailActivity(accountId: string) {
  return useQuery<EmailActivity | null>({
    queryKey: ["email-activity", accountId],
    queryFn: async () => {
      try { return await apiFetch<EmailActivity>(`/api/accounts/${accountId}/email-activity`); }
      catch { return null; }
    },
    staleTime: 120_000, retry: 1, enabled: !!accountId,
  });
}
```

---

## Step 5: Dashboard page — ACEDashboard.tsx

### `bkmng-next/components/dashboard/ACEDashboard.tsx`

**5a: Signal labels and icons** — add to `SIGNAL_LABELS`:

```
upcoming_meeting: "Upcoming Meeting",
no_upcoming_meeting: "No Upcoming Meeting",
meeting_momentum: "Meeting Momentum",
email_silence: "Email Silence",
email_declining: "Email Declining",
```

Add to `SIGNAL_CATEGORY`:

```
upcoming_meeting: "engagement",
no_upcoming_meeting: "engagement",
meeting_momentum: "engagement",
email_silence: "engagement",
email_declining: "engagement",
```

Add to `SignalIcon` function (before the default `return`):

```
if (type === "no_upcoming_meeting" || type === "email_silence")
  return <PhoneMissed size={size} className={`${base} text-amber-500`} />;
if (type === "upcoming_meeting" || type === "meeting_momentum")
  return <CalendarCheck2 size={size} className={`${base} text-sky-500`} />;
if (type === "email_declining")
  return <TrendingDown size={size} className={`${base} text-rose-500`} />;
```

**5b: Focus Queue "Meetings" filter** — update `FocusFilter` type, `filterCounts`, and `FILTER_LABELS`:

```
type FocusFilter = "all" | "high" | "support" | "engagement" | "consumption" | "expansion" | "meetings";

// in filterCounts useMemo:
meetings: nbaItems.filter((i) =>
  ["upcoming_meeting","no_upcoming_meeting","meeting_momentum","email_silence","email_declining"]
    .includes(i.signal_type)
).length,

FILTER_LABELS.meetings = "Meetings";
```

**5c: Upcoming card — add "Upcoming Meetings" section**

Add `upcomingMeetingSignals` derived from `nbaItems` filtered to `signal_type === "upcoming_meeting"`. In the Upcoming card, add a third section after contract endings:

```
{upcomingMeetingSignals.length > 0 && (
  <div>
    <SectionLabel>Upcoming Meetings</SectionLabel>
    <div className="space-y-1.5">
      {upcomingMeetingSignals.slice(0, 4).map((item) => (
        <Link key={item.id} href={`/accounts/${item.account_id}`}
          className="flex items-center gap-2 hover:bg-slate-50 -mx-1 px-1 rounded py-0.5 transition-colors">
          <CalendarCheck2 size={11} className="text-sky-500 shrink-0" />
          <p className="text-[11px] text-slate-700 truncate flex-1">{item.account_name}</p>
          <ChevronRight size={10} className="text-slate-300 shrink-0" />
        </Link>
      ))}
    </div>
  </div>
)}
```

---

## Step 6: Accounts page — engagement badges + Activity panel

### `bkmng-next/app/accounts/page.tsx`

**6a: Update local `Account` type** — add 6 engagement fields:

```
meetings_last_30d?: number;
upcoming_meetings_14d?: number;
last_meeting_date?: string | null;
emails_last_30d?: number;
last_email_date?: string | null;
email_trend?: string | null;
```

**6b: Table row chips** — add under the existing signal/adoption badges, in the account name cell:

```
{account.upcoming_meetings_14d != null && account.upcoming_meetings_14d > 0 && (
  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
    <CalendarCheck2 size={9} />{account.upcoming_meetings_14d} mtg
  </span>
)}
{account.email_trend === "declining" && (
  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
    <TrendingDown size={9} />email↓
  </span>
)}
```

**6c: ExpandedRow — 4-column layout** — change `grid-cols-3` to `grid-cols-4` and add an "Activity" column after Signals:

```
<div>
  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Activity</p>
  <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
    {(account.meetings_last_30d != null || account.emails_last_30d != null) ? (
      <>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <CalendarCheck2 size={11} className="text-sky-400" />Meetings (30d)
          </span>
          <span className="text-xs font-semibold text-slate-700">{account.meetings_last_30d ?? "—"}</span>
        </div>
        {/* upcoming_meetings_14d, last_meeting_date, emails_last_30d, email_trend rows */}
        ...
      </>
    ) : (
      <p className="text-xs text-slate-400">No activity data.</p>
    )}
  </div>
</div>
```

The `ExpandedRow` prop signature stays the same — `account` already carries the 6 new fields from the enriched Account type.

Import `CalendarCheck2, TrendingDown` from `lucide-react`.

---

## Step 7: Account detail page — meeting card + email widget

### `bkmng-next/app/accounts/[id]/page.tsx`

**7a: Add hooks** — in component body:

```
import { ..., useMeetingActivity, useEmailActivity } from "@/hooks/useApi";
import type { ..., MeetingActivity, EmailActivity } from "@/hooks/useApi";

const { data: meetings = [] } = useMeetingActivity(accountId) as { data: MeetingActivity[] };
const { data: emailActivity } = useEmailActivity(accountId) as { data: EmailActivity | null | undefined };
```

**7b: Extend `AccountData` type** — add 6 engagement fields matching the backend model.

**7c: `MeetingActivityCard` component** — shows upcoming meetings + recent meetings with AI takeaway accordions and `is_pain_points` / `is_competitor` / `is_next_steps` flag chips. Positioned in the right sidebar before "Recent Gong Calls". Collapses to nothing if `meetings.length === 0`.

Structure:

- "Upcoming" subsection — `CalendarCheck2` icon + subject + formatted date
- "Recent" subsection — accordion with takeaways text + inline flag badges (`pain`, `competitor`, `next steps`)

**7d: `EmailActivityWidget` component** — compact sidebar card showing:

- Emails last 7d / 30d
- Email trend chip (emerald = increasing, rose = declining, slate = stable)
- Last email date
- Outbound vs inbound split (last 30d)

Positioned in sidebar after `MeetingActivityCard`.

**7e: Sidebar injection** — in the `div.sticky.top-6.space-y-4` add both widgets:

```
<MeetingActivityCard meetings={meetings} />
<EmailActivityWidget emailActivity={emailActivity} />
<CreditUsageSidebar rev={revenueSummary ?? null} />
```



---

## Verification Checklist

- `GET /api/accounts` returns `meetings_last_30d`, `email_trend` etc. in response
- `GET /api/accounts/{id}/meetings` returns meeting list with `is_upcoming`, `is_pain_points` etc.
- `GET /api/accounts/{id}/email-activity` returns email aggregates
- Dashboard Focus Queue shows `no_upcoming_meeting` / `email_silence` signals with correct icons
- Dashboard "Meetings" filter pill appears when those signals exist
- Accounts table shows blue "2 mtg" chip and rose "email↓" chip correctly
- Accounts expanded row shows 4-column layout with Activity column
- Account detail sidebar shows `MeetingActivityCard` with upcoming + recent meetings
- Account detail sidebar shows `EmailActivityWidget` with trend chip
