# Plan: Meeting Prep Tab Redesign

## Overview

The meeting prep tab needs three improvements:
1. **Context input prominence** — the `additional_context` field (which feeds into the LLM prompt) is currently buried behind the "Add Post-Meeting Notes" button and doesn't exist as an input at all. It needs to be front-and-center.
2. **Less visual noise** — 6 full cards stacked vertically is overwhelming. Sections should be collapsible.
3. **Source/reasoning justification** — the LLM prompt already asks for `source` and `reasoning` on every item. This data exists in the stored JSON but the frontend discards it because it parses everything as plain strings.

---

## Current LLM Output Shape (already in the data)

The LLM in `generate_meeting_prep` in [`backend/app/services/snowflake_service.py`](backend/app/services/snowflake_service.py) asks for:

```json
{
  "last_meeting_recap":  { "text": "...", "source": "Gong call 2025-03-12: QBR", "reasoning": "..." },
  "changes_since_last":  [{ "text": "...", "source": "...", "reasoning": "..." }],
  "open_action_items":   [{ "item": "...", "source": "...", "reasoning": "..." }],
  "suggested_agenda":    [{ "topic": "...", "source": "...", "reasoning": "..." }],
  "questions_to_ask":    [{ "question": "...", "source": "...", "reasoning": "..." }],
  "competitive_context": { "text": "...", "source": "...", "reasoning": "..." }
}
```

**This is stored in `BKMNG_MEETING_PREPS` as JSON strings.** The data is there — it's just being thrown away in the frontend.

### Current parsing bug in [`MeetingPrepView.tsx`](bkmng-next/components/account-detail/MeetingPrepView.tsx)

| Field | Frontend expects | LLM actually returns | Result |
|---|---|---|---|
| `last_meeting_recap` | plain string | `{"text":..., "source":..., "reasoning":...}` | Renders raw JSON as text |
| `changes_since_last` | `string[]` | `[{"text":..., ...}]` | Renders `[object Object]` |
| `suggested_agenda` | `string[]` | `[{"topic":..., ...}]` | Renders `[object Object]` |
| `questions_to_ask` | `string[]` | `[{"question":..., ...}]` | Renders `[object Object]` |
| `competitive_context` | plain string | `{"text":..., "source":..., "reasoning":...}` | Renders raw JSON as text |

---

## New Layout Design

```
┌─────────────────────────────────────────────────────────┐
│  Meeting Prep  ·  Acme Corp            [Copy]  [·· age] │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐    │
│  │  Add context for this meeting...                │    │
│  │  (e.g. deal stage, upcoming renewal, blockers)  │    │
│  │                                             [↵] │    │
│  │                        [Generate Meeting Prep]  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ▸ Last Meeting                                         │
│    "Discussed migration timeline and Cortex pricing..."  │
│    [▼ see justification]                                │
│                                                         │
│  ▸ What's Changed  (3)                                  │
│    • Contract utilization jumped to 89%                 │
│    • New champion: Sarah Chen added as stakeholder      │
│    [▼ see justification for each]                       │
│                                                         │
│  ▸ Open Action Items  (2)                               │
│    ☐ Send POC architecture doc  (Gong 2025-03-12)       │
│    ☑ Intro to migration team                            │
│                                                         │
│  ▸ Suggested Agenda  (4)                                │
│  ▸ Questions to Ask  (3)                                │
│  ▸ Competitive Context                                  │
└─────────────────────────────────────────────────────────┘
```

**Key principles:**
- Context input is the primary CTA — above the AI content
- Sections default to **open for Last Meeting and Open Items** (highest-value, most time-sensitive), **collapsed for Agenda, Questions, Competitive**
- Each item has a "justification" toggle (small chevron) that reveals `source` + `reasoning` in a subdued inset
- Checkboxes on Open Items persist in local state (not saved)

---

## Task 1: Fix backend normalization (`snowflake_service.py`)

No schema change needed. The fix is in `generate_meeting_prep` return value and `get_meeting_prep` — ensure that when fields like `last_meeting_recap` are retrieved from the DB, they are returned as-is (raw JSON string) so the frontend can parse and display the full structured object.

The only issue: `last_meeting_recap` and `competitive_context` are stored as `json.dumps(dict)` but the frontend reads them as plain strings. This is already fine if the frontend parses them correctly — **no backend changes are strictly required.** The backend is already storing the right shape.

However, we should ensure `additional_context` is passed through the POST correctly — it already is, at [`accounts.py:360`](backend/app/routers/accounts.py#L360):
```python
return data.generate_meeting_prep(account_id, account_name, user.email, body.additional_context)
```

---

## Task 2 + 3: Redesign `MeetingPrepView.tsx`

**New type definitions** in [`hooks/useApi.ts`](bkmng-next/hooks/useApi.ts) — update `MeetingPrep` type:

```ts
interface RichItem {
  text?: string;
  topic?: string;
  item?: string;
  question?: string;
  source?: string;
  reasoning?: string;
}

interface MeetingPrep {
  last_meeting_recap: string | null;   // JSON: {"text","source","reasoning"}
  changes_since_last: string | null;   // JSON: [{text,source,reasoning}]
  open_action_items: string | null;    // JSON: [{item,source,reasoning}]
  suggested_agenda: string | null;     // JSON: [{topic,source,reasoning}]
  questions_to_ask: string | null;     // JSON: [{question,source,reasoning}]
  competitive_context: string | null;  // JSON: {"text","source","reasoning"}
  generated_at: string | null;
  error?: string;
}
```

**New parsing helpers:**
```ts
function parseRichField<T>(field: string | null): T | null {
  if (!field) return null;
  try { return typeof field === 'string' ? JSON.parse(field) : field; }
  catch { return null; }
}
```

**New `PrepSection` component** (inline in the file):
```tsx
function PrepSection({ title, defaultOpen, children, count }: {...}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          {title}{count !== undefined ? ` (${count})` : ''}
        </span>
        <ChevronDown size={14} className={open ? 'rotate-180 transition' : 'transition'} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
```

**New `JustificationToggle` component** for per-item source/reasoning:
```tsx
function JustificationToggle({ source, reasoning }: { source?: string; reasoning?: string }) {
  const [open, setOpen] = useState(false);
  if (!source && !reasoning) return null;
  return (
    <div className="mt-1 ml-4">
      <button onClick={() => setOpen(o => !o)}
        className="text-[10px] text-slate-400 hover:text-slate-600">
        {open ? '▲ hide justification' : '▼ why this?'}
      </button>
      {open && (
        <div className="mt-1 text-[11px] text-slate-500 bg-slate-50 rounded p-2 space-y-0.5">
          {source && <p><span className="font-medium">Source:</span> {source}</p>}
          {reasoning && <p><span className="font-medium">Why:</span> {reasoning}</p>}
        </div>
      )}
    </div>
  );
}
```

---

## Task 4: Context Input Panel

The `MeetingPrepView` takes an `onAddPostMeetingNotes` prop but currently doesn't have a context input. The new panel replaces that pattern:

```tsx
const [context, setContext] = useState('');
const [generating, setGenerating] = useState(false);

// POST to /accounts/{id}/meeting-prep with { additional_context: context }
const handleGenerate = async () => {
  setGenerating(true);
  await fetch(`/api/accounts/${accountId}/meeting-prep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Mock-User': ... },
    body: JSON.stringify({ additional_context: context })
  });
  // invalidate the query to reload
  queryClient.invalidateQueries(['meeting-prep', accountId]);
  setGenerating(false);
};
```

The textarea should have a placeholder like:
> "Add context for this prep... e.g. 'renewal call next week, they're evaluating Databricks'"

---

## Files to Change

| File | Change |
|---|---|
| [`bkmng-next/components/account-detail/MeetingPrepView.tsx`](bkmng-next/components/account-detail/MeetingPrepView.tsx) | Full redesign — context panel, collapsible sections, rich object parsing, justification toggles |
| [`bkmng-next/hooks/useApi.ts`](bkmng-next/hooks/useApi.ts) | Update `MeetingPrep` type to reflect rich object fields; add mutation hook for POST |

No backend changes required — the LLM prompt already returns `source` + `reasoning` on every item and they're stored in the DB.

---

## Answers to Your Questions

**Is source/reasoning data already in the LLM output?** Yes. The prompt explicitly asks for `source` and `reasoning` on every field. It's stored in `BKMNG_MEETING_PREPS` as JSON strings. It's just being parsed as plain strings in the frontend.

**Is the LLM output standardized as JSON?** Yes — the prompt ends with `Return only JSON` and there's a `re.search(r'\{.*\}', ...)` extraction step. The schema is consistent across regenerations. The only risk is LLM hallucination of the structure, which the existing `try/except` around `json.loads` already handles gracefully.
