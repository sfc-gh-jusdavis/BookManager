---
name: "proactive-insights"
created: "2026-04-08T17:50:01.129Z"
status: pending
---

# Plan: Proactive Insights Architecture

Based on `docs/proactive-insights-plan.md`.

## Closed-Loop Architecture

```
flowchart TD
    subgraph SE_Input [SE Input]
        Paste["Paste email / notes\nAdd Context"]
        PrepBtn["Prep for Meeting button"]
        PostMeeting["Add Post-Meeting Notes"]
    end

    subgraph Ingestion [Phase 1 - Context Ingestion]
        ContextAPI["POST /accounts/{id}/context"]
        ContextV2["BKMNG_USER_CONTEXT_V2\n(LLM-parsed structured fields)"]
        UCProvider["UserContextProvider\n(signals from user context)"]
    end

    subgraph Patterns [Phase 2 - Composite Patterns]
        SP_Patterns["SP_COMPUTE_COMPOSITE_PATTERNS"]
        PatternTable["BKMNG_COMPOSITE_PATTERNS\n(15 pattern types)"]
        FocusQueue["Focus Queue: Situations section"]
    end

    subgraph Briefings [Phase 3 - Account Briefings]
        SP_Briefings["SP_COMPUTE_ACCOUNT_BRIEFINGS"]
        BriefingTable["BKMNG_ACCOUNT_BRIEFINGS"]
        BriefingCard["Account detail briefing card"]
    end

    subgraph MeetingPrep [Phase 4 - Meeting Prep]
        PrepAPI["GET /accounts/{id}/meeting-prep"]
        PrepTable["BKMNG_MEETING_PREPS"]
        PrepView["Meeting Prep full-page view"]
    end

    Paste --> ContextAPI --> ContextV2
    ContextV2 --> UCProvider --> PatternTable
    ContextV2 --> SP_Briefings
    PatternTable --> SP_Briefings --> BriefingTable --> BriefingCard
    BriefingCard --> PrepBtn
    PrepBtn --> PrepAPI --> PrepTable --> PrepView
    PrepView --> PostMeeting --> Paste
```

---

## Phase 1: Context Ingestion Engine

### Snowflake: `BKMNG_USER_CONTEXT_V2`

New table with all structured parsed fields from the doc (verbatim schema at doc line 92-119): `CONTEXT_ID`, `ACCOUNT_ID`, `RAW_CONTENT`, `SOURCE_TYPE`, `PARSED_SUMMARY`, `SENTIMENT`, `PEOPLE_MENTIONED`, `TOPICS_DISCUSSED`, `COMPETITORS_MENTIONED`, `ACTION_ITEMS`, `RISKS_IDENTIFIED`, `OPPORTUNITIES_IDENTIFIED`, `BLOCKERS_MENTIONED`, `CREATED_BY`, `CREATED_AT`, `PARSE_STATUS` (`pending` | `parsed` | `failed`).

### Backend: modified POST endpoint

`backend/app/routers/accounts.py`: the existing `POST /accounts/{id}/context` at line \~282 stores to `BKMNG_USER_CONTEXT`. Change it to write to `BKMNG_USER_CONTEXT_V2` with `PARSE_STATUS='pending'`, then synchronously call `CORTEX.COMPLETE('llama3.1-8b', parse_prompt)` with the structured extraction prompt (doc lines 143-165). On success, UPDATE the row with all parsed fields and `PARSE_STATUS='parsed'`. Return the `PARSED_SUMMARY` in the response so the frontend can show immediate feedback.

`backend/app/services/snowflake_service.py`: add `add_account_context_v2()` and `list_account_context_v2()` methods.

### Backend: `UserContextProvider` signal generation

New file `backend/app/signals/providers/user_context.py` — a `SignalProvider` subclass that reads newly parsed `BKMNG_USER_CONTEXT_V2` rows (since last signal refresh) and generates signals per the table at doc lines 171-178:

| Condition                                | Signal type                 | Priority |
| ---------------------------------------- | --------------------------- | -------- |
| `sentiment IN ('frustration','urgent')`  | `customer_frustration`      | high     |
| `risks` non-empty with `severity='high'` | `user_reported_risk`        | high     |
| `competitors_mentioned` non-empty        | `competitor_mentioned`      | medium   |
| `blockers` non-empty                     | `user_reported_blocker`     | high     |
| `opportunities` non-empty                | `user_reported_opportunity` | medium   |

Register in `backend/app/signals/__init__.py` and add new signal types to `_TYPE_TO_CATEGORY` in `backend/app/signals/providers/core.py`.

### Frontend: Quick Context input

`bkmng-next/app/accounts/[id]/page.tsx`: replace the existing "Resources & Notes" `+ Add info` panel (lines 957-1016) with the Quick Context input described in the doc (lines 184-209):

- Single `<textarea>` for paste (email, notes, Slack, obs)
- Optional use case dropdown (`None / {use case names}`)
- Submit → POST → show `parsed_summary` inline on success
- Recent context list showing last 5 entries with `SOURCE_TYPE` badge + `PARSED_SUMMARY`

Add `useContextV2(accountId)` and `useAddContextV2()` hooks to `bkmng-next/hooks/useApi.ts`.

---

## Phase 2: Composite Signal Patterns

### Snowflake: `BKMNG_COMPOSITE_PATTERNS` + `SP_COMPUTE_COMPOSITE_PATTERNS`

New table per doc schema (lines 246-259). New SP evaluates all 15 pattern definitions (doc lines 265-291) via SQL CASE logic:

- Reads from `BKMNG_ONT_ACCOUNT_SIGNALS`, `BKMNG_ONT_ACCOUNTS`, `BKMNG_ONT_USE_CASES`, `BKMNG_USER_CONTEXT_V2`
- TRUNCATE + INSERT pattern: drops prior patterns for each account, reinserts currently matching ones
- Pattern logic is pure SQL (no LLM) — deterministic

New Snowflake task `TASK_COMPUTE_COMPOSITE_PATTERNS` as a child of `TASK_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS` (runs immediately after signal refresh, hourly).

### Backend

New endpoint `GET /accounts/{id}/composite-patterns` in `backend/app/routers/accounts.py`.

New service method `list_composite_patterns(account_id)` in `backend/app/services/snowflake_service.py`.

New hook `useCompositePatterns(accountId)` in `bkmng-next/hooks/useApi.ts`.

Also: new endpoint `GET /nba/patterns` returning composite patterns for the current user's full book, for surfacing in the dashboard Focus Queue.

### Frontend: "Situations" section in Focus Queue

`bkmng-next/components/dashboard/ACEDashboard.tsx`: add a `SITUATIONS` section above the current `SIGNALS` section in the Focus Queue (doc lines 304-328):

- Pattern cards with severity color (red/amber), account name, situation description, recommended action
- `[Open]` navigates to account detail, `[Ack]` dismisses the pattern for 24h (stored in localStorage or a new `BKMNG_PATTERN_ACKS` table)

---

## Phase 3: Account Briefings

### Snowflake: `BKMNG_ACCOUNT_BRIEFINGS` + `SP_COMPUTE_ACCOUNT_BRIEFINGS`

New table per doc schema (lines 351-375): `BRIEFING_ID`, `SITUATION_SUMMARY`, `TOP_RISK`, `TOP_OPPORTUNITY`, `RECOMMENDED_ACTIONS` (JSON), `TALKING_POINTS` (JSON), `KEY_QUESTIONS` (JSON), plus transparency fields (`SIGNALS_USED`, `CONTEXT_USED`, `GONG_CALLS_USED`, `GENERATED_AT`, `MODEL_USED`).

New SP `SP_COMPUTE_ACCOUNT_BRIEFINGS` (replaces / supersedes `SP_COMPUTE_AI_ASSESSMENTS`):

1. For each account with ≥1 active signal or composite pattern, assemble the full context block (signals, composite patterns, last 3 Gong summaries, use case stages, contacts, user context, consumption, support tickets)
2. Call `CORTEX.COMPLETE('llama3.1-70b', briefing_prompt)` with the structured prompt at doc lines 393-437
3. Parse JSON response, MERGE INTO `BKMNG_ACCOUNT_BRIEFINGS`

Runs daily at 06:00 UTC (same slot as existing AI assessments). `TASK_COMPUTE_ACCOUNT_BRIEFINGS` replaces `TASK_COMPUTE_AI_ASSESSMENTS`.

### Backend

New endpoint `GET /accounts/{id}/briefing` in `backend/app/routers/accounts.py`.

New hook `useAccountBriefing(accountId)`.

### Frontend: Briefing card

`bkmng-next/app/accounts/[id]/page.tsx`: add the briefing card (doc lines 450-477) as the **first element** after the account header, above the tab bar:

- Situation summary paragraph
- Top Risk chip (red) + Top Opportunity chip (violet)
- Recommended actions list with urgency badges (`NOW` / `THIS WEEK` / `THIS MONTH`)
- Talking points collapsible
- "Prep for Meeting →" button (visible when `upcoming_meetings_5d > 0`)
- "Generated {N}h ago" timestamp

---

## Phase 4: Meeting Prep Flow

### Snowflake: `BKMNG_MEETING_PREPS`

New table per doc schema (lines 517-536): `PREP_ID`, `LAST_MEETING_RECAP`, `CHANGES_SINCE_LAST`, `OPEN_ACTION_ITEMS` (JSON), `SUGGESTED_AGENDA` (JSON), `QUESTIONS_TO_ASK` (JSON), `COMPETITIVE_CONTEXT`, `ACCOUNT_BRIEFING_SUMMARY`, `GENERATED_AT`, `GENERATED_FOR_MEETING_DATE`.

### Backend: on-demand generation

New endpoint `GET /accounts/{id}/meeting-prep` in `backend/app/routers/accounts.py`.

`get_meeting_prep_context()` in `backend/app/services/snowflake_service.py`:

1. Check `BKMNG_MEETING_PREPS` for a recent cached prep (generated <6h ago) — return it if found
2. Otherwise: gather data from `BKMNG_ACCOUNT_BRIEFINGS`, `BKMNG_MEETING_ACTIVITY`, last 3 Gong calls, `BKMNG_USER_CONTEXT_V2` action items, open TMRs, `BKMNG_ONT_ACCOUNT_SIGNALS` for competitor mentions
3. Call `CORTEX.COMPLETE('llama3.1-70b', prep_prompt)` to produce the structured prep card
4. INSERT into `BKMNG_MEETING_PREPS`, return result

### Frontend: Prep view + post-meeting loop

New page or slide-over component `bkmng-next/components/account-detail/MeetingPrepView.tsx` rendering the prep card (doc lines 543-583):

- Sections: Last Meeting, What's Changed, Open Items (checkboxes), Suggested Agenda, Questions to Ask, Competitive Context
- "Copy to Clipboard" button — plaintext summary for pasting into calendar invites
- "Add Post-Meeting Notes" button — opens the Quick Context input (Phase 1) pre-tagged with meeting date and account

Triggered from:

1. "Prep for Meeting →" in the briefing card (account detail)
2. The `upcoming_meetings` section in the dashboard (ACEDashboard)
3. Pattern #12 `pre_meeting_prep_available` in the Situations section

---

## Task Chain (updated)

```
02:30 UTC  TASK_REFRESH_BKMNG_GDOC_NOTES       (from previous plan, if implemented)
03:00 UTC  TASK_REFRESH_BKMNG_MEETING_ACTIVITY
04:00 UTC  TASK_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS
04:01 UTC    └─ TASK_REFRESH_BKMNG_USER_ALERTS (child)
04:02 UTC    └─ TASK_COMPUTE_COMPOSITE_PATTERNS (new child)
04:25 UTC  TASK_REFRESH_BKMNG_ONT_ACCOUNTS
06:00 UTC  TASK_COMPUTE_ACCOUNT_BRIEFINGS       (new, replaces AI assessments)
```

---

## Key Design Decisions from the Doc

- **LLM model split**: `llama3.1-8b` for context parsing (fast, low-cost, per-insert), `llama3.1-70b` for briefings and meeting prep (quality matters)
- **Sync parsing** in v1: POST handler calls CORTEX.COMPLETE synchronously, \~2-4s. Acceptable for an explicit user action
- **Patterns are deterministic**: No LLM in Phase 2 — pure SQL CASE logic. LLM only used in Phase 3 (briefings) and Phase 4 (prep cards)
- **Context privacy**: Phase 1 stores context per `CREATED_BY`. Visibility to ACEMs and across SEs on same account is left as an open question (the doc suggests yes for both, but a `visibility` field should be added)
- **Phase 5 (email forwarding / Glean)** is intentionally out of scope here — it's the v2/v3 path described in the doc and can follow as a separate effort once the v1 paste pipeline is validated
