# Plan: Inline Editable Engagement and Status

## Scope

Two places need inline editing:

1. **Accounts list page** ([`bkmng-next/app/accounts/page.tsx`](bkmng-next/app/accounts/page.tsx)) -- Engagement and Status table columns (lines 536-541)
2. **ACE Dashboard "My Book"** ([`bkmng-next/components/dashboard/ACEDashboard.tsx`](bkmng-next/components/dashboard/ACEDashboard.tsx)) -- compact row showing `StatusDot` + engagement text (lines 738-746)

The backend `PATCH /accounts/{account_id}` endpoint and `useUpdateAccountFields` hook already exist and work. No backend changes needed.

## Current My Book rendering (line 739-745)

```tsx
<Link key={acc.account_id} href={`/accounts/${acc.account_id}`}
  className="flex items-center gap-2 py-1 ...">
  <StatusDot status={acc.status} />                          {/* colored dot */}
  <span className="text-[11px] ...">{acc.account_name}</span>
  <span className="text-[10px] text-slate-400 ...">{acc.engagement_status}</span>
</Link>
```

## Approach

### Shared `InlineSelect` component

Create a small reusable component in a shared location so both pages can import it. It renders the current value via a `renderBadge` prop and opens a dropdown on click.

**File**: [`bkmng-next/components/ui/InlineSelect.tsx`](bkmng-next/components/ui/InlineSelect.tsx) (new file)

```tsx
"use client";
import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";

export function InlineSelect({ value, options, onSelect, renderOption }: {
  value: string;
  options: string[];
  onSelect: (val: string) => void;
  renderOption: (val: string, active: boolean) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Click-outside to close
  // e.stopPropagation() to prevent row expand / link navigation
  // On select: call onSelect(val), close dropdown
}
```

### Accounts list page changes

In [`accounts/page.tsx`](bkmng-next/app/accounts/page.tsx), replace the static cells (lines 536-541):

```tsx
// Before
<td><EngagementCell status={account.engagement_status} /></td>
<td><StatusBadge status={account.status} /></td>

// After -- wrap in InlineSelect, fire useUpdateAccountFields on change
```

Each row needs its own mutation instance. Since `useUpdateAccountFields` is a hook, we will extract each table row into a small `AccountRow` component so hooks can be called per-row.

### ACE Dashboard My Book changes

In [`ACEDashboard.tsx`](bkmng-next/components/dashboard/ACEDashboard.tsx) lines 738-746, replace the static `StatusDot` and engagement text with compact `InlineSelect` dropdowns. The `StatusDot` becomes a clickable status selector; the engagement text becomes a clickable engagement selector. These need to be wrapped in their own component (e.g. `BookRow`) for per-account hook usage, replacing the current `<Link>` wrapper.

The account name will remain a link to the detail page. The selectors will sit alongside it with `e.stopPropagation()` / `e.preventDefault()` to avoid navigating when clicking a selector.

### Optimistic cache updates

Extend `useUpdateAccountFields` in [`useApi.ts`](bkmng-next/hooks/useApi.ts) (lines 273-297) to also optimistically update the `["accounts"]` list cache (used by both the Accounts page and the Dashboard). Currently it only updates `["account", accountId]`.

```tsx
onMutate: async (body) => {
  await qc.cancelQueries({ queryKey: ["accounts"] });
  await qc.cancelQueries({ queryKey: ["account", accountId] });
  const previousList = qc.getQueryData(["accounts"]);
  const previousDetail = qc.getQueryData(["account", accountId]);
  qc.setQueryData(["accounts"], (old: any[]) =>
    old?.map((a: any) => a.account_id === accountId ? { ...a, ...body } : a)
  );
  qc.setQueryData(["account", accountId], (old: any) =>
    old ? { ...old, ...body } : old
  );
  return { previousList, previousDetail };
},
onError: (_err, _body, ctx) => {
  if (ctx?.previousList) qc.setQueryData(["accounts"], ctx.previousList);
  if (ctx?.previousDetail) qc.setQueryData(["account", accountId], ctx.previousDetail);
},
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ["accounts"] });
  qc.invalidateQueries({ queryKey: ["account", accountId] });
},
```

Since both pages use `useAccounts()` (query key `["accounts"]`), a single optimistic update covers both.

## Files Modified

| File | Change |
|------|--------|
| [`bkmng-next/components/ui/InlineSelect.tsx`](bkmng-next/components/ui/InlineSelect.tsx) | **NEW** -- shared inline dropdown selector component |
| [`bkmng-next/app/accounts/page.tsx`](bkmng-next/app/accounts/page.tsx) | Extract `AccountRow` component; replace static Engagement/Status cells with `InlineSelect` |
| [`bkmng-next/components/dashboard/ACEDashboard.tsx`](bkmng-next/components/dashboard/ACEDashboard.tsx) | Extract `BookRow` component; replace static StatusDot + engagement text with `InlineSelect` |
| [`bkmng-next/hooks/useApi.ts`](bkmng-next/hooks/useApi.ts) | Extend `useUpdateAccountFields` optimistic updates to include `["accounts"]` list cache |

No backend changes needed.
