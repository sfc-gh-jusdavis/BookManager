# Plan: Account Detail Tabs Redesign

## File
All changes are in a single file: [`bkmng-next/app/accounts/[id]/page.tsx`](bkmng-next/app/accounts/[id]/page.tsx)

---

## Current Layout (simplified)

```
Account Header
│
├── Briefing Card  ← always visible, above tabs (lines 717–792)
│
├── [By Use Case] [Timeline] [Meeting Prep] [ACE]  ← tabs (line 569–574)
│
├── Tab Content
│   └── "use-cases" tab → UseCasePane × 2
│
└── Platform Adoption Card  ← always visible, below all tab content (lines 847–904)
```

## Target Layout

```
Account Header
│
├── [Overview] [Platform Adoption] [Timeline] [Meeting Prep] [ACE]
│
└── Tab Content
    ├── "overview" tab → Briefing Card + UseCasePane × 2
    ├── "adoption" tab → Platform Adoption Card
    ├── "timeline" tab → (unchanged)
    ├── "prep" tab → (unchanged)
    └── "assistant" tab → (unchanged)
```

---

## Changes

### 1. Update `TabKey` type (line 415)

```ts
// Before
type TabKey = "use-cases" | "timeline" | "prep" | "assistant";
const VALID_TABS: TabKey[] = ["use-cases", "timeline", "prep", "assistant"];

// After
type TabKey = "overview" | "adoption" | "timeline" | "prep" | "assistant";
const VALID_TABS: TabKey[] = ["overview", "adoption", "timeline", "prep", "assistant"];
```

### 2. Update initial tab default (line 425)

```ts
// Before
: searchParams.get("nba") ? "assistant" : "use-cases";

// After
: searchParams.get("nba") ? "assistant" : "overview";
```

### 3. Update tabs array (lines 569–574)

```ts
// Before
const tabs = [
  { key: "use-cases", label: "By Use Case" },
  { key: "timeline", label: "Timeline" },
  { key: "prep", label: "Meeting Prep" },
  { key: "assistant", label: "ACE" },
];

// After
const tabs = [
  { key: "overview", label: "Overview" },
  { key: "adoption", label: "Platform Adoption" },
  { key: "timeline", label: "Timeline" },
  { key: "prep", label: "Meeting Prep" },
  { key: "assistant", label: "ACE" },
];
```

### 4. Remove the floating Briefing Card above tabs (lines 717–792)

Delete the entire `{/* ── Account Briefing Card ── */}` block. It moves into the Overview tab content below.

### 5. Replace the "use-cases" tab block with "overview" (lines 797–820)

```tsx
// Before: tab === "use-cases"
// After: tab === "overview"
{tab === "overview" && (
  <div className="space-y-4">

    {/* Briefing (moved from above tabs) */}
    {!briefingLoading && briefing && !briefing.error && briefing.situation_summary && (
      <div className="rounded-xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white shadow-sm p-4">
        {/* ...exact same briefing card JSX, unchanged... */}
      </div>
    )}

    {/* Use Cases (unchanged) */}
    {useCases.length === 0 ? (
      <p className="text-sm text-slate-400 py-8 text-center">No use cases found.</p>
    ) : (
      <>
        <UseCasePane title="My Use Cases" ... />
        <UseCasePane title="Other Use Cases on Account" ... />
      </>
    )}
  </div>
)}
```

### 6. Add the "adoption" tab block (new, after the "overview" block)

```tsx
{tab === "adoption" && (
  <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
    {/* ...exact same Platform Adoption card JSX from lines 847–904, unchanged... */}
  </div>
)}
```

### 7. Remove the always-visible Platform Adoption card (lines 847–904)

Delete the `<div className="mt-4 rounded-xl border ... Platform Adoption ...">` block that currently sits below the tab content area. It is now inside the "adoption" tab.

### 8. Fix the `onAddPostMeetingNotes` callback reference (line 831)

```tsx
// Before
setTab("use-cases");

// After
setTab("overview");
```

---

## Summary of moves

| Element | Before | After |
|---|---|---|
| Briefing card | Always visible above tabs | Inside "overview" tab, above use cases |
| Use case panes | "By Use Case" tab | "overview" tab, below briefing |
| Platform Adoption card | Always visible below tab content | "adoption" tab |
| Tab label | "By Use Case" | "Overview" |
| New tab | — | "Platform Adoption" |
