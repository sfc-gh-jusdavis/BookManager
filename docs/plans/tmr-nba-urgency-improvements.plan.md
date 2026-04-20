# Plan: TMR Status Fix + Stale UC NBA Signal + Urgency Framework

## Overview
Three improvements to the BookManager app:
1. **TMR Status Remap** — "Closed" TMRs show as "Approved" or "Rejected" based on pipeline stage
2. **Stale UC NBA Signal** — Friday alert for use cases with no update since start of business week
3. **Urgency/Impact Grading** — Design framework for scoring alert urgency and NBA impact

---

## Task 1: Investigate STAGE Source for BKMNG_TMRS

**Key finding**: `BKMNG_TMRS` has **no STAGE column**. The `TMR` pydantic model already has `stage: Optional[str] = None` but the underlying table doesn't populate it.

**What we need**: A way to distinguish "Closed at Assigned stage" (approved) from "Closed at Manager Review stage" (rejected).

**Investigation steps**:
- Query the ElementUM/Salesforce source table (if accessible) for a stage/pipeline field
- If source has it: add `STAGE` to `BKMNG_TMRS` refresh INSERT SELECT
- **Fallback heuristic** (if source unavailable): infer from existing columns:
  ```sql
  CASE
    WHEN STATUS = 'Closed' AND START_DATE IS NOT NULL THEN 'Assigned'
    WHEN STATUS = 'Closed' AND START_DATE IS NULL THEN 'Manager Review'
    ELSE NULL
  END AS STAGE
  ```
  Rationale: `START_DATE` is set when a specialist begins work (approved & assigned). If closed without `START_DATE`, it was rejected at review stage before any work started.

---

## Task 2: Add STAGE to list_tmrs() SQL

File: `backend/app/services/snowflake_service.py` (~line 459)

**If source has real STAGE**: Add `t.STAGE` to SELECT, add `stage=row.get("STAGE")` to TMR constructor.

**If using heuristic**: Add inline CASE expression to SELECT:
```sql
CASE
  WHEN t.STATUS = 'Closed' AND t.START_DATE IS NOT NULL THEN 'Assigned'
  WHEN t.STATUS = 'Closed' AND t.START_DATE IS NULL THEN 'Manager Review'
  ELSE NULL
END AS STAGE
```
Then: `stage=row.get("STAGE")` in the TMR constructor.

---

## Task 3: Update StatusBadge in TMR Page

File: `bkmng-next/app/tmrs/page.tsx`

**Add helper**:
```typescript
function getEffectiveStatus(status: string, stage?: string | null): string {
  if (status === "Closed") {
    if (stage === "Assigned") return "Approved";
    if (stage === "Manager Review") return "Rejected";
  }
  return status;
}
```

**Add styles**:
```typescript
"Approved": "bg-emerald-50 text-emerald-700 border-emerald-200",
"Rejected": "bg-red-50 text-red-600 border-red-200",
```

**Update `StatusBadge`**: call `getEffectiveStatus(status, stage)` before rendering.

**Update stats counters**:
```typescript
const approved = tmrs.filter(t => getEffectiveStatus(t.status, t.stage) === "Approved").length;
const rejected = tmrs.filter(t => getEffectiveStatus(t.status, t.stage) === "Rejected").length;
// Replace raw 'closed' count with separate approved + rejected
```

---

## Task 4: Stale Use Case NBA Signal

### Model change — `backend/app/models/nba.py`
Add `"stale_use_case"` to `signal_type` Literal.

### Service change — `backend/app/services/snowflake_service.py`

In `list_nba_items()`, after existing signal loop:

```python
# stale_use_case — Friday only: flag UCs with no update since start of business week
if today.weekday() == 4:  # Friday = 4
    last_monday = today - timedelta(days=today.weekday())  # = today - 4 days
    for uc in use_cases:
        # ACE-scoped: only flag UCs assigned to requesting ACE
        if ace_filter and uc.assigned_ace_id != ace_filter:
            continue
        if not uc.last_modified_date:
            continue
        if uc.last_modified_date.date() >= last_monday:
            continue  # updated this week, skip
        days_stale = (today - uc.last_modified_date.date()).days
        acc = account_map.get(uc.account_id)
        items.append(NBAItem(
            id=f"stale-uc-{uc.use_case_id}",
            signal_type="stale_use_case",
            account_id=uc.account_id,
            account_name=acc.account_name if acc else uc.account_id,
            priority="medium",
            text=f"No update to '{uc.use_case_name}' in {days_stale} days.",
            summary=f"Use case has not been updated since {uc.last_modified_date.strftime('%b %d')}. Review status and add notes.",
        ))
```

**Notes**:
- `today.weekday() == 4` is the Friday gate
- `last_monday = today - timedelta(days=4)` when called on a Friday
- Exclude UCs already caught by `stalled_implementation` (>30d) OR let both fire since the windows serve different purposes (stale_use_case = this week's check-in; stalled_implementation = long-term neglect)

---

## Task 5: Urgency/Impact Grading Framework (Design Note)

> **Planning concern**: We need to design and implement urgency scoring for alerts and NBA signals beyond the current coarse `priority: high | medium | low`.

### Proposed NBAItem additions:
```python
class NBAItem(BaseModel):
    ...
    priority: Literal["high", "medium", "low"]
    urgency_score: int = 50          # 0–100 composite score; drives sort order
    impact: Literal["critical", "high", "medium", "low"] = "medium"  # business impact
    expires_at: Optional[date] = None  # when signal becomes stale/irrelevant
```

### Urgency Score Ranges (draft):
| Signal Type | Base Score | Modifiers |
|---|---|---|
| `go_live_overdue` | 95 | +0 (already critical) |
| `go_live` (≤7d) | 90 | — |
| `go_live_at_risk` | 75 | +10 if ARR > $500k |
| `blocker` | 85 | — |
| `at_risk` | 70 | +10 if ARR > $500k |
| `open_tmr` (>14d) | 65 | — |
| `stalled_implementation` | 60 | — |
| `no_call` (>14d) | 55 | — |
| `stale_use_case` (new) | 50 | +10 if ARR > $500k |
| `consumption_dip` | 45–70 | based on % change |
| `consumption_spike` | 40–65 | based on % change |

### Impact dimension (ARR-driven):
- `critical`: ARR > $1M or strategic account flag
- `high`: ARR $250k–$1M
- `medium`: ARR $50k–$250k
- `low`: ARR < $50k

### Alert urgency (future):
- Alerts (separate from NBAs) would get an `urgency_level: Literal["P0","P1","P2","P3"]`
- Grading: P0 = action needed today, P1 = this week, P2 = this sprint, P3 = awareness only
- Friday `stale_use_case` = P1 by default (act this week)

**This task is design-first**: implement `urgency_score` and `impact` fields after spec review.

---

## Task 6: Wire stale_use_case to NBA UI

File: `bkmng-next/components/nba/` (whichever component renders signal cards)

- Add display label: `"stale_use_case"` → `"Stale Use Case"`
- Color: amber/yellow (warning, not critical)
- Action CTA: "Update use case notes"
- Test by temporarily removing the `weekday() == 4` gate to verify signal fires in dev

---

## File Checklist
| File | Change |
|---|---|
| `backend/app/models/nba.py` | Add `"stale_use_case"` to signal_type |
| `backend/app/models/tmr.py` | Already has `stage: Optional[str]` — no change |
| `backend/app/services/snowflake_service.py` | Add STAGE to list_tmrs SQL; add stale_use_case signal block |
| `bkmng-next/app/tmrs/page.tsx` | Add getEffectiveStatus helper, update StatusBadge + stats |
| `bkmng-next/components/nba/` (TBD) | Add stale_use_case rendering |
