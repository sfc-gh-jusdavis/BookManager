# Plan: Add Timeline Tab, AI Assistant Tab, and Ad-Hoc Notes

## All changes are in `bkmng-next/` (Next.js, port 3001)
The old `frontend/` (Vite) is read-only reference material. Nothing is written there.

## Task 1 — `NotesTimeline` component ✅ Done
**File**: `bkmng-next/components/account-detail/NotesTimeline.tsx`

Groups all PS notes from all use cases chronologically by date. Shows use case name + stage badge + note content with timeline connector. Uses `"use client"` directive.

## Task 2 — `AIChatPanel` component ✅ Done
**File**: `bkmng-next/components/account-detail/AIChatPanel.tsx`

Chat interface with suggested prompts. Mock response logic for risks/blockers, progress summary, next actions, and email drafts. Uses `"use client"` directive, no react-router dependency.

## Task 3 — Update `AccountDetailPage`
**File**: `bkmng-next/app/accounts/[id]/page.tsx`

Changes:
- Extend `TabKey` type: add `"timeline"` and `"assistant"` 
- Add two new tab buttons to the nav strip
- Extend local `UseCase` type with `ps_notes_summary`, `description`, `lead_se`, `ace_assigned`, `target_go_live_date`
- Render `<NotesTimeline useCases={useCases} />` for timeline tab
- Render `<AIChatPanel account={account} useCases={useCases} gongCalls={gongCalls} />` for assistant tab
- Add inline "Add note / link" form to Resources tab (local React state, no backend persistence)
