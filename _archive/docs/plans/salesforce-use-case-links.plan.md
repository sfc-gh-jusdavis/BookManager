# Plan: Salesforce Use Case Links

## Overview

Add clickable Salesforce links to use case names in two places:
1. The `UseCaseCard` heading on the "By Use Case" tab of the account detail page
2. The use case name label beneath each note on the Timeline tab

SF URL format (from user): `https://snowforce.lightning.force.com/lightning/r/Use_Case__c/{use_case_id}/view`

---

## Task 1 — Add `sfUseCaseUrl` helper to [`lib/utils.ts`](bkmng-next/lib/utils.ts)

Add a single helper to the existing utils file to keep the URL format in one place:

```typescript
const SF_BASE = "https://snowforce.lightning.force.com/lightning/r";

export function sfUseCaseUrl(useCaseId: string): string {
  return `${SF_BASE}/Use_Case__c/${useCaseId}/view`;
}
```

---

## Task 2 — Link use case name in `UseCaseCard` ([`app/accounts/[id]/page.tsx`](bkmng-next/app/accounts/[id]/page.tsx))

`UseCaseCard` at line 200 receives `uc: UseCase` which has both `use_case_id` and `use_case_name`. The name heading at line 208 is currently plain text:

```tsx
// Before
<p className="text-sm font-semibold text-slate-800">{uc.use_case_name}</p>

// After
<a
  href={sfUseCaseUrl(uc.use_case_id)}
  target="_blank"
  rel="noopener noreferrer"
  className="text-sm font-semibold text-slate-800 hover:text-sky-600 hover:underline"
>
  {uc.use_case_name}
</a>
```

Also add the import at the top of the file:
```typescript
import { sfUseCaseUrl } from "@/lib/utils";
```

---

## Task 3 — Link use case name in `NotesTimeline` ([`components/account-detail/NotesTimeline.tsx`](bkmng-next/components/account-detail/NotesTimeline.tsx))

The `use_case_name` label beneath each note at line 94 is currently a plain `<p>`. The `TimelineNote` type already has both `use_case_id` and `use_case_name`. Change it to a link:

```tsx
// Before
{note.use_case_name && (
  <p className="mt-1 text-xs text-slate-400">{note.use_case_name}</p>
)}

// After
{note.use_case_name && (
  <a
    href={sfUseCaseUrl(note.use_case_id)}
    target="_blank"
    rel="noopener noreferrer"
    className="mt-1 block text-xs text-slate-400 hover:text-sky-600 hover:underline"
  >
    {note.use_case_name}
  </a>
)}
```

Also add the import:
```typescript
import { sfUseCaseUrl } from "@/lib/utils";
```

---

## Scope note

The user asked specifically about the account detail page and timeline. The accounts list page (`app/accounts/page.tsx`) and forecasts page also render `use_case_name` but are not in scope for this change.
