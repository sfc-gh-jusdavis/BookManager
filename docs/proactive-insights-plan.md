# BookManager — Proactive Insights Architecture Plan

> Transforming BookManager from a data hub with descriptive signals into a system that generates actionable, proactive insights for Activation SEs.

---

## Problem Statement

BookManager has a strong data foundation — ~20 Snowflake tables refreshed on 2-4h cycles, 25+ deterministic signal types, LLM-powered assessments, and an AI chat assistant. But the app struggles to deliver truly **proactive insights** because:

1. **Signals are descriptive, not prescriptive.** They tell an SE *what happened* ("no interaction in 14d", "consumption dip") but not *what to do about it* or *why it matters in context*.

2. **Insights require manual synthesis.** An SE must mentally combine 5-8 signal cards, the timeline, contacts, Gong topics, and consumption data to form a picture of an account. The app doesn't do this for them.

3. **The richest qualitative data is missing.** Emails, informal notes, and customer conversations outside of Gong are invisible to the system. The `BKMNG_USER_CONTEXT` table exists but stores unstructured text blobs with no parsing, no signal extraction, and no feedback into the insight pipeline.

4. **No virtuous loop.** There's no mechanism where SE engagement with the app (adding context, prepping for meetings) makes the system smarter over time.

---

## Design Principles

- **Minimize SE effort, maximize signal value.** Every interaction should take <30 seconds and produce outsized insight.
- **Deterministic first, LLM second.** Use rule-based composite patterns for reliability; use LLMs to synthesize and explain, not to detect.
- **Closed-loop.** Context the SE adds feeds back into signal generation, briefings, and meeting prep.
- **Incremental delivery.** Each component below is independently valuable and can ship without the others.

---

## Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │         SE INTERACTIONS          │
                    │                                  │
                    │  Quick Context  │  Meeting Prep  │
                    │  (paste email,  │  (pre-meeting   │
                    │   notes, obs)   │   briefing)     │
                    │       │         │       ▲         │
                    └───────┼─────────┼───────┼─────────┘
                            │         │       │
                            ▼         │       │
                    ┌───────────────┐  │  ┌────────────────┐
                    │ Context       │  │  │ Account        │
                    │ Ingestion     │  │  │ Briefing       │
                    │ Engine        │  │  │ Generator      │
                    │ (LLM parse)   │  │  │ (LLM synth)    │
                    └───────┬───────┘  │  └────────▲───────┘
                            │         │            │
                            ▼         │            │
                    ┌───────────────┐  │  ┌────────────────┐
                    │ BKMNG_USER    │  │  │ Composite      │
                    │ _CONTEXT_V2   │  │  │ Signal         │
                    │ (structured)  │  │  │ Patterns       │
                    └───────┬───────┘  │  └────────▲───────┘
                            │         │            │
                            ▼         ▼            │
                    ┌──────────────────────────────────────┐
                    │     EXISTING SIGNAL + DATA LAYER     │
                    │                                      │
                    │  BKMNG_ONT_ACCOUNT_SIGNALS (25+ types)│
                    │  BKMNG_ONT_ACCOUNTS / USE_CASES      │
                    │  BKMNG_ONT_INTERACTIONS (Gong)        │
                    │  BKMNG_ONT_CONTACTS                  │
                    │  BKMNG_A360_* (consumption/contract)  │
                    │  BKMNG_SUPPORT_TICKETS               │
                    └──────────────────────────────────────┘
```

---

## Component 1: Context Ingestion Engine

### Goal

Turn the existing `BKMNG_USER_CONTEXT` from a dead-end text blob into a structured context system that feeds signals, briefings, and meeting prep.

### Current State

- `BKMNG_USER_CONTEXT` accepts `(ACCOUNT_ID, CONTEXT_TYPE, CONTENT, SOURCE, CREATED_BY)`
- The `CONTENT` field is unstructured free text
- User context is included in ACE chat prompts (last 10 notes, truncated to 300 chars each)
- No parsing, no entity extraction, no signal generation from user-added context

### Proposed Design

#### Data Model: `BKMNG_USER_CONTEXT_V2`

Extend the existing table (or create a V2 alongside it) with parsed fields:

```sql
CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2 (
    CONTEXT_ID        NUMBER AUTOINCREMENT PRIMARY KEY,
    ACCOUNT_ID        VARCHAR,
    ACCOUNT_NAME      VARCHAR,
    USE_CASE_ID       VARCHAR,           -- optional: link to specific use case
    
    -- Raw input
    RAW_CONTENT       VARCHAR(16000),    -- original pasted text
    SOURCE_TYPE       VARCHAR(50),       -- 'email' | 'meeting_note' | 'slack' | 'observation' | 'auto'
    
    -- LLM-parsed structured fields
    PARSED_SUMMARY    VARCHAR(500),      -- 1-2 sentence summary of the content
    SENTIMENT         VARCHAR(20),       -- 'positive' | 'neutral' | 'concern' | 'frustration' | 'urgent'
    PEOPLE_MENTIONED  VARCHAR(2000),     -- JSON array: [{name, role_if_known}]
    TOPICS_DISCUSSED  VARCHAR(2000),     -- JSON array: ["topic1", "topic2"]
    COMPETITORS_MENTIONED VARCHAR(1000), -- JSON array: ["Databricks", "BigQuery"]
    ACTION_ITEMS      VARCHAR(2000),     -- JSON array: [{item, owner_if_known, due_if_known}]
    RISKS_IDENTIFIED  VARCHAR(2000),     -- JSON array: [{risk, severity}]
    OPPORTUNITIES_IDENTIFIED VARCHAR(2000), -- JSON array: [{opportunity, context}]
    BLOCKERS_MENTIONED VARCHAR(1000),    -- JSON array: ["blocker1"]
    
    -- Metadata
    CREATED_BY        VARCHAR,
    CREATED_AT        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    IS_ACTIVE         BOOLEAN DEFAULT TRUE,
    PARSE_STATUS      VARCHAR(20) DEFAULT 'pending'  -- 'pending' | 'parsed' | 'failed'
);
```

#### Ingestion Flow

```
SE pastes text ──► POST /accounts/{id}/context
                       │
                       ├── 1. Store raw content immediately (PARSE_STATUS='pending')
                       │      Return 201 to user (no waiting)
                       │
                       └── 2. Async: LLM parse via CORTEX.COMPLETE
                              │
                              ├── Detect source type from content structure
                              │   (email headers → 'email', bullet points → 'meeting_note', etc.)
                              │
                              ├── Extract structured fields
                              │   (summary, sentiment, people, topics, action items,
                              │    risks, opportunities, blockers, competitors)
                              │
                              └── UPDATE row SET parsed fields, PARSE_STATUS='parsed'
```

#### LLM Parse Prompt (for `CORTEX.COMPLETE`)

```
You are analyzing text pasted by a Sales Engineer about a customer account.
Extract the following as JSON:

{
  "source_type": "email|meeting_note|slack|observation",
  "summary": "1-2 sentence summary",
  "sentiment": "positive|neutral|concern|frustration|urgent",
  "people_mentioned": [{"name": "...", "role": "..."}],
  "topics_discussed": ["topic1", "topic2"],
  "competitors_mentioned": ["name1"],
  "action_items": [{"item": "...", "owner": "...", "due": "..."}],
  "risks": [{"risk": "...", "severity": "high|medium|low"}],
  "opportunities": [{"opportunity": "...", "context": "..."}],
  "blockers": ["blocker1"]
}

Only include fields where you find relevant information. Use null for fields with no data.
Do not fabricate information not present in the text.

TEXT:
{raw_content}
```

#### Signal Generation from User Context

After parsing, check for signal-worthy conditions and insert into `BKMNG_ONT_ACCOUNT_SIGNALS`:

| Parsed Field | Signal Generated | Priority |
|---|---|---|
| `sentiment = 'frustration'` or `'urgent'` | `customer_frustration` | high |
| `risks` array is non-empty with severity='high' | `user_reported_risk` | high |
| `competitors_mentioned` is non-empty | `competitor_mentioned` (enrich existing) | medium |
| `blockers` is non-empty | `user_reported_blocker` | high |
| `opportunities` is non-empty | `user_reported_opportunity` | medium |
| `action_items` with past due dates | `overdue_action_item` | medium |

These are a new signal SOURCE='user_context' in the existing signal framework, with a new `UserContextProvider` in `backend/app/signals/providers/`.

#### Frontend: Quick Context Input

On the account detail page, add a collapsible "Add Context" panel:

```
┌─────────────────────────────────────────────────────┐
│  📋 Add Context for {Account Name}                  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ Paste an email, meeting notes, or quick obs   │  │
│  │ here...                                       │  │
│  │                                               │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Link to use case: [ None (account-level) ▼ ]       │
│                                                     │
│  [ Submit ]                                         │
│                                                     │
│  Recent context:                                    │
│  • 2h ago — Email: Customer concerned about         │
│    migration timeline, mentioned Databricks eval    │
│  • 1d ago — Observation: Champion promoted to VP,   │
│    new technical lead is skeptical                   │
└─────────────────────────────────────────────────────┘
```

The input is intentionally minimal — one text area, an optional use case link, and submit. The LLM does all the structuring. Recent context entries show the `PARSED_SUMMARY` so the SE sees what the system extracted.

#### Implementation Notes

- **Sync vs Async parsing**: For v1, parse synchronously in the POST handler using `CORTEX.COMPLETE`. Latency will be ~2-4 seconds. If this is too slow, switch to async (store pending, parse via a Snowflake Task running every 5 minutes on new pending rows).
- **Signal insertion**: Run signal generation as part of the hourly `TASK_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS` SP, adding a section that reads parsed context from the last refresh window.
- **Migration**: Existing `BKMNG_USER_CONTEXT` rows can be backfill-parsed with a one-time SP run.

---

## Component 2: Composite Signal Patterns

### Goal

Move from independent signals to **multi-signal patterns** that represent recognizable account situations with specific recommended actions.

### Current State

- 25+ signal types computed independently
- Signals are displayed as a flat list in the Focus Queue, sorted by priority
- The AI assessment SP produces a generic priority score, not situation-aware recommendations
- SEs must mentally synthesize multiple signals into a picture

### Proposed Design

#### Pattern Definitions

Define composite patterns as combinations of signals + data conditions. Each pattern has:
- A **name** and **category** (risk, opportunity, action-needed)
- **Trigger conditions**: which signals/data must be present
- **Priority**: derived from component severity
- **Recommended action**: specific, actionable text
- **Talking points**: for when this pattern feeds meeting prep

```sql
-- Patterns are defined in code (not a table) but produce rows in a new table:

CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_COMPOSITE_PATTERNS (
    PATTERN_ID        VARCHAR PRIMARY KEY,    -- e.g., 'going_dark'
    ACCOUNT_ID        VARCHAR,
    ACCOUNT_NAME      VARCHAR,
    PATTERN_NAME      VARCHAR,                -- e.g., 'Account Going Dark'
    CATEGORY          VARCHAR,                -- 'risk' | 'opportunity' | 'action_needed'
    SEVERITY          VARCHAR,                -- 'critical' | 'high' | 'medium'
    DESCRIPTION       VARCHAR(1000),          -- human-readable situation description
    RECOMMENDED_ACTION VARCHAR(1000),         -- specific next step
    TALKING_POINTS    VARCHAR(2000),          -- JSON array for meeting prep
    COMPONENT_SIGNALS VARCHAR(2000),          -- JSON array of signal_types that triggered this
    CREATED_AT        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
```

#### Initial Pattern Catalog (15 patterns)

**Risk Patterns:**

| # | Pattern | Trigger Conditions | Severity | Recommended Action |
|---|---------|-------------------|----------|-------------------|
| 1 | **Account Going Dark** | `no_interaction_14d` + (`email_silence` OR `email_declining`) + no upcoming meeting | critical | "Schedule a touchpoint immediately. Consider reaching out to a secondary contact — your primary may have changed roles or priorities." |
| 2 | **Go-Live at Risk** | `go_live_approaching` (≤14d) + (`open_tmr` OR `blocker`) | critical | "Escalate blockers now. Pull in the TMR owner and your manager. Go-live date may need to slip — communicate early." |
| 3 | **Champion Disengaged** | `champion_silent` + account has active use cases in Implementation | high | "Your champion hasn't been on a call in 28+ days during active implementation. Reach out directly — check if priorities shifted or if there's a new decision-maker." |
| 4 | **Renewal Risk** | `contract_ending` (≤90d) + (`consumption_dip` OR utilization < 50%) | critical | "Contract renewing soon with declining usage. Build a value narrative: document wins, quantify ROI, and schedule an executive review." |
| 5 | **Silent Churn Signal** | `consumption_dip` (>20% MoM) + `no_interaction_14d` + no user context in 30d | high | "Usage is declining and you have no recent contact. This may indicate a shift to a competitor or internal priority change. Get a meeting on the books." |
| 6 | **Support Escalation During Implementation** | (`open_sev1_ticket` OR `escalated_ticket`) + active use cases in Implementation | critical | "Sev-1/escalated support issue during implementation. Join the support thread, understand the impact, and communicate timeline to the customer." |
| 7 | **Stalled Pipeline** | `stage_stalled` on 2+ use cases for same account | high | "Multiple use cases stalled at this account. This suggests a systemic blocker — organizational, technical, or priority. Schedule a strategy session with the AE." |

**Opportunity Patterns:**

| # | Pattern | Trigger Conditions | Severity | Recommended Action |
|---|---------|-------------------|----------|-------------------|
| 8 | **Expansion Ready** | `expansion_signal` + `consumption_spike` + utilization > 80% | high | "Account is consuming aggressively and approaching capacity. Proactively discuss expansion before they hit limits. Frame as success enablement, not upsell." |
| 9 | **New Platform Adoption** | `new_feature_adoption` + feature in a category where `SIG_{category} = 0` | medium | "Customer just adopted a new platform area. This is a land-and-expand moment. Offer a best-practices session to ensure success and deepen the relationship." |
| 10 | **Momentum Building** | 3+ Gong calls in 14d + use case stage advanced in 30d + positive consumption trend | medium | "Strong momentum — high engagement, use case progressing, consumption growing. Keep the cadence. Consider introducing additional use cases or features." |
| 11 | **Champion Promotion** | user_context with `people_mentioned` showing title change to VP/Director/Head + `sentiment = 'positive'` | medium | "Your champion got promoted. This is an expansion opportunity — they now have broader influence. Schedule a strategic conversation about scaling." |

**Action-Needed Patterns:**

| # | Pattern | Trigger Conditions | Severity | Recommended Action |
|---|---------|-------------------|----------|-------------------|
| 12 | **Pre-Meeting Prep Available** | `upcoming_meeting` (≤3d) + account has recent signals or context | medium | "You have a meeting in ≤3 days. A prep briefing is available with recent signals, Gong summaries, and recommended talking points." |
| 13 | **Post-Meeting Follow-Up Due** | Gong call recorded ≤2d ago + no user context added since call | medium | "You had a call 1-2 days ago but haven't logged any notes. Add quick context to keep the system current and improve your next prep." |
| 14 | **Missing Dates on Active Use Cases** | `use_case_no_dates` on use cases in Implementation status | medium | "Implementation use cases without target dates can't generate go-live signals. Update the dates in Salesforce to enable proactive tracking." |
| 15 | **Data Gap — No Recent Context** | Account has high signal count but no user context in 60d and no Gong calls in 30d | medium | "This account has multiple signals but the system has limited context. Add a quick observation to improve insight quality." |

#### Implementation

Composite patterns are computed by a new stored procedure `SP_COMPUTE_COMPOSITE_PATTERNS` that:

1. Reads from `BKMNG_ONT_ACCOUNT_SIGNALS`, `BKMNG_ONT_ACCOUNTS`, `BKMNG_ONT_USE_CASES`, `BKMNG_USER_CONTEXT_V2`
2. Evaluates each pattern's trigger conditions via SQL CASE logic
3. Inserts matching patterns into `BKMNG_COMPOSITE_PATTERNS`
4. Runs as a child task after `TASK_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS` (hourly)

Patterns are surfaced in the Focus Queue **above** individual signals, as a distinct "Situations" section:

```
┌─ Focus Queue ──────────────────────────────────────────┐
│                                                        │
│  SITUATIONS (2)                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🔴 Account Going Dark — Acme Corp               │  │
│  │ No interaction in 18 days, emails declining,     │  │
│  │ no meeting scheduled.                            │  │
│  │ → Schedule a touchpoint. Consider reaching       │  │
│  │   out to Sarah Chen (VP Eng, last call: Mar 2).  │  │
│  │                                     [Open] [Ack] │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🟡 Expansion Ready — BigCo                      │  │
│  │ Consumption +45% WoW, at 87% contract capacity,  │  │
│  │ new feature adoption (Dynamic Tables).            │  │
│  │ → Discuss expansion proactively. Frame as         │  │
│  │   success enablement.                             │  │
│  │                                     [Open] [Ack] │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  SIGNALS (12)                                          │
│  ... existing signal list ...                          │
└────────────────────────────────────────────────────────┘
```

---

## Component 3: Account Briefings

### Goal

Replace the generic AI assessment (priority score + rationale) with a structured, actionable account briefing that synthesizes all available data.

### Current State

- `SP_COMPUTE_AI_ASSESSMENTS` runs daily, produces:
  - `BKMNG_AI_ACCOUNT_ASSESSMENTS`: priority_score (1-10), rationale, recommended_actions
  - `BKMNG_AI_USE_CASE_ASSESSMENTS`: ai_tier, confidence, risk_level, opportunity_score
- The output is generic and not tied to specific situations or actions
- Briefings are not surfaced prominently in the UI

### Proposed Design

#### Data Model: `BKMNG_ACCOUNT_BRIEFINGS`

```sql
CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_ACCOUNT_BRIEFINGS (
    BRIEFING_ID       NUMBER AUTOINCREMENT PRIMARY KEY,
    ACCOUNT_ID        VARCHAR,
    ACCOUNT_NAME      VARCHAR,
    ACE_EMAIL         VARCHAR,
    
    -- Structured briefing sections
    SITUATION_SUMMARY VARCHAR(2000),     -- 2-3 sentence current state
    TOP_RISK          VARCHAR(1000),     -- highest-priority risk with context
    TOP_OPPORTUNITY   VARCHAR(1000),     -- highest-priority opportunity
    RECOMMENDED_ACTIONS VARCHAR(2000),   -- JSON array: [{action, rationale, urgency}]
    TALKING_POINTS    VARCHAR(2000),     -- JSON array for meeting prep
    KEY_QUESTIONS     VARCHAR(1000),     -- questions the SE should be asking
    
    -- Inputs snapshot (for debugging/transparency)
    SIGNALS_USED      VARCHAR(2000),     -- JSON: signal types active at generation time
    CONTEXT_USED      BOOLEAN,           -- whether user context was included
    GONG_CALLS_USED   NUMBER,            -- how many recent calls informed the briefing
    
    -- Metadata
    GENERATED_AT      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    MODEL_USED        VARCHAR(50),       -- e.g., 'llama3.1-70b'
    GENERATION_COST_TOKENS NUMBER        -- for monitoring
);
```

#### Generation Approach

Modify `SP_COMPUTE_AI_ASSESSMENTS` (or create a new `SP_COMPUTE_ACCOUNT_BRIEFINGS`) that, for each account:

1. **Gathers deterministic context** (no LLM needed):
   - Active composite patterns for this account
   - Individual signals
   - Last 3 Gong call summaries + key points + next steps
   - Use case stages and velocity
   - Consumption trajectory (WoW, MoM, utilization %)
   - Contact engagement (champions, last call dates)
   - User-added context (last 5 parsed entries from `BKMNG_USER_CONTEXT_V2`)
   - Support ticket status

2. **Passes to LLM** with a structured prompt:

```
You are an AI assistant for a Snowflake Activation Sales Engineer.
Given the following data about an account, produce a structured briefing.

ACCOUNT: {account_name}
INDUSTRY: {industry} | REGION: {region}
CONTRACT: {credits_consumed}/{capacity} ({util_pct}% utilized), WoW: {wow}%, MoM: {mom}%

ACTIVE SITUATIONS:
{composite_patterns as bullet list}

SIGNALS:
{individual signals as bullet list}

RECENT GONG CALLS:
{last 3 calls: date, title, summary, key points, next steps}

USE CASES:
{use cases: name, stage, days_in_stage, velocity, risk_level}

KEY CONTACTS:
{champions and primary contacts: name, title, last call date, call count}

SE NOTES & CONTEXT:
{last 5 user context entries: date, source_type, parsed_summary}

SUPPORT:
{open tickets: severity, age, subject}

Respond with ONLY this JSON structure:
{
  "situation_summary": "2-3 sentences: what is happening at this account right now",
  "top_risk": "the single biggest risk, with specific context from the data above",
  "top_opportunity": "the single biggest opportunity, with specific context",
  "recommended_actions": [
    {"action": "specific action", "rationale": "why", "urgency": "now|this_week|this_month"}
  ],
  "talking_points": ["point for next conversation"],
  "key_questions": ["question the SE should investigate"]
}

Be specific. Reference actual people, dates, and numbers from the data.
Do not be generic. If data is insufficient, say so rather than fabricating.
```

3. **Stores the result** in `BKMNG_ACCOUNT_BRIEFINGS`

#### Refresh Cadence

- **Daily at 06:00 UTC** (same slot as current AI assessments, replacing them)
- Only generate briefings for accounts with at least one active signal or composite pattern (skip quiet accounts to save LLM cost)
- Estimated volume: ~150-200 accounts per run (those with signals)

#### Frontend: Briefing Card

On the account detail page, show the briefing as the first thing the SE sees:

```
┌─ Account Briefing (generated 6h ago) ──────────────────┐
│                                                        │
│  Acme Corp is in a critical phase — their Real-Time    │
│  Analytics use case goes live in 12 days but has an    │
│  open TMR blocking the deployment. Champion Sarah Chen │
│  hasn't been on a call in 28 days. Consumption is      │
│  steady at 67% utilization.                            │
│                                                        │
│  ⚠ Top Risk: Go-live at risk due to unresolved TMR    │
│    (#4521) and champion disengagement.                  │
│                                                        │
│  ✦ Top Opportunity: Account is evaluating Dynamic       │
│    Tables — first usage detected 5 days ago.            │
│                                                        │
│  Recommended:                                          │
│  1. [NOW] Escalate TMR #4521 — go-live in 12 days     │
│  2. [NOW] Reach out to Sarah Chen directly             │
│  3. [This week] Offer DT best-practices session        │
│                                                        │
│  💬 Talking points for next meeting:                   │
│  • TMR status and go-live readiness                    │
│  • Dynamic Tables adoption — offer guidance             │
│  • Contract review (67% util, 4 months remaining)       │
│                                                        │
│                              [Prep for Meeting →]       │
└────────────────────────────────────────────────────────┘
```

---

## Component 4: Meeting Prep Flow

### Goal

Create a dedicated meeting prep experience that leverages all available data and user context, producing a printable/shareable prep card.

### Current State

- Upcoming meetings are surfaced in the dashboard (from `BKMNG_MEETING_ACTIVITY`)
- The `upcoming_meeting` signal exists
- No dedicated prep flow — an SE can ask ACE chat, but it requires a manual prompt and returns unstructured text

### Proposed Design

#### Prep Card Generation

When an SE clicks "Prep for Meeting" (from the briefing card, the dashboard upcoming meetings section, or a new dedicated prep button):

1. **Pull the account briefing** (from Component 3)
2. **Pull recent Gong calls** (last 3, with full summaries and action items)
3. **Pull unresolved action items** from:
   - Gong call next_steps (from `BKMNG_ONT_INTERACTIONS`)
   - User context action_items (from `BKMNG_USER_CONTEXT_V2`)
   - Open TMRs
4. **Pull contact context** for meeting attendees (if available from calendar/Gong data)
5. **Generate a prep card** via LLM that includes:
   - **Last meeting recap**: what was discussed, what was promised
   - **What's changed since**: new signals, consumption changes, use case stage changes
   - **Open items**: action items from last meeting, their status
   - **Suggested agenda**: topics to cover based on current situation
   - **Questions to ask**: based on risks, gaps, and opportunities
   - **Competitive context**: if competitors have been mentioned recently

#### Data Model: `BKMNG_MEETING_PREPS`

```sql
CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_MEETING_PREPS (
    PREP_ID           NUMBER AUTOINCREMENT PRIMARY KEY,
    ACCOUNT_ID        VARCHAR,
    ACCOUNT_NAME      VARCHAR,
    ACE_EMAIL         VARCHAR,
    
    -- Prep content
    LAST_MEETING_RECAP VARCHAR(2000),
    CHANGES_SINCE_LAST VARCHAR(2000),   -- what's different since last interaction
    OPEN_ACTION_ITEMS  VARCHAR(2000),   -- JSON array
    SUGGESTED_AGENDA   VARCHAR(2000),   -- JSON array of topics
    QUESTIONS_TO_ASK   VARCHAR(1000),   -- JSON array
    COMPETITIVE_CONTEXT VARCHAR(1000),
    ACCOUNT_BRIEFING_SUMMARY VARCHAR(1000), -- abbreviated version of briefing
    
    -- Metadata
    GENERATED_AT      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    GENERATED_FOR_MEETING_DATE DATE     -- the meeting this prep is for
);
```

#### Frontend: Prep View

The prep view is a full-page or modal experience, optimized for quick scanning before a meeting:

```
┌─ Meeting Prep: Acme Corp ─────────────── Apr 10, 2026 ┐
│                                                        │
│  LAST MEETING (Mar 28)                                 │
│  Weekly sync with Sarah Chen, Mike Ross.               │
│  Discussed: migration timeline, RBAC setup blockers,   │
│  Dynamic Tables interest.                              │
│  You promised: share DT quickstart guide, follow up    │
│  on TMR #4521.                                         │
│                                                        │
│  WHAT'S CHANGED                                        │
│  • TMR #4521 still open (12 days, was 2 days)          │
│  • Sarah Chen hasn't responded to last 2 emails        │
│  • Dynamic Tables: first queries detected Apr 5        │
│  • Consumption steady (+2% WoW)                        │
│                                                        │
│  OPEN ITEMS                                            │
│  ☐ Share DT quickstart guide (from Mar 28 call)        │
│  ☐ TMR #4521 — RBAC integration (open 12d)             │
│  ☐ Schedule exec review before go-live (from Mar 15)   │
│                                                        │
│  SUGGESTED AGENDA                                      │
│  1. TMR #4521 status — critical path for go-live       │
│  2. Dynamic Tables adoption — offer best practices     │
│  3. Go-live readiness check (12 days out)              │
│  4. Contract review if time (67% utilized)             │
│                                                        │
│  QUESTIONS TO ASK                                      │
│  • "Is the RBAC blocker the only thing between us      │
│     and go-live, or are there other concerns?"         │
│  • "I saw you started using Dynamic Tables — what's    │
│     the use case? Can I help optimize the setup?"      │
│  • "Any changes to the team? Want to make sure we      │
│     have the right people in our syncs."               │
│                                                        │
│  COMPETITIVE CONTEXT                                   │
│  Databricks mentioned 3x in last 90d calls (Feb, Mar). │
│  Last mention: "evaluating for streaming workloads"     │
│                                                        │
│            [Copy to Clipboard]  [Add Post-Meeting Notes]│
└────────────────────────────────────────────────────────┘
```

#### Post-Meeting Loop

The "Add Post-Meeting Notes" button opens the Context Ingestion input (Component 1), pre-tagged with the meeting date and account. This closes the loop:

```
Meeting Prep → Meeting → Post-Meeting Notes → Context Ingestion → 
    → Better Signals → Better Briefing → Better Next Prep
```

#### Generation Strategy

Meeting prep can be generated two ways:

1. **On-demand** (v1): When the SE clicks "Prep for Meeting", generate in real-time via `CORTEX.COMPLETE`. Takes ~5-8 seconds. Cache the result in `BKMNG_MEETING_PREPS` so it's instant on reload.

2. **Pre-computed** (v2): For accounts with upcoming meetings in ≤3 days, generate preps in the daily assessment batch. Surface the `pre_meeting_prep_available` composite pattern (Pattern #12) to notify the SE.

---

## Component 5: Email & Notes — Long-Term Integration Path

### Goal

Progressively reduce the friction of getting email and note content into BookManager, from manual paste (v1) to semi-automated (v2) to fully automated (v3).

### v1: Copy-Paste with Smart Parsing (Components 1-4 above)

- SE pastes email/notes into the Quick Context input
- LLM parses and structures automatically
- Effort: ~30 seconds per entry
- Value: high — structured context feeds everything

### v2: Email Forwarding Endpoint

Add a dedicated email ingestion endpoint:

- SE forwards emails to `bookmanager+{account_slug}@snowflake.com` (or similar)
- A lightweight service (could be a Snowflake Task + external function, or a simple Lambda) receives the email, extracts body text, and calls the Context Ingestion API
- The `+{account_slug}` suffix auto-links to the correct account
- Reduces effort to: forward email, done

**Implementation sketch:**
- Create an external function in Snowflake that receives webhook POSTs from an email service (SendGrid inbound parse, AWS SES, etc.)
- The function inserts raw email body into a staging table
- A Snowflake Task runs every 5 minutes, picks up new rows, calls `CORTEX.COMPLETE` for parsing, and inserts into `BKMNG_USER_CONTEXT_V2`

### v3: Glean Integration (already on roadmap)

- Wire Glean as a tool_resource for the ACE agent
- ACE can search across Gmail, Slack, Google Drive for account context
- This doesn't replace the context ingestion system — it complements it. Glean provides broad search; user context provides curated, SE-validated signal.

### v4: Browser Extension / Sidebar

- "Send to BookManager" button in Gmail, Slack, or any web page
- Captures selected text + source URL
- Sends to Context Ingestion API with auto-detected account
- Reduces effort to: highlight, click, done

Each version builds on the same data model (`BKMNG_USER_CONTEXT_V2`) and parsing pipeline. The only thing that changes is how content gets into the system.

---

## Implementation Sequence

These components are ordered by **value-to-effort ratio**. Each is independently deployable.

### Phase 1: Context Ingestion Engine
- New table `BKMNG_USER_CONTEXT_V2`
- Modified POST endpoint with LLM parsing
- `UserContextProvider` signal provider
- Frontend Quick Context input on account detail page
- **Depends on**: nothing new — extends existing infrastructure

### Phase 2: Composite Signal Patterns
- New table `BKMNG_COMPOSITE_PATTERNS`
- New SP `SP_COMPUTE_COMPOSITE_PATTERNS`
- New Snowflake Task (child of signal refresh)
- Frontend "Situations" section in Focus Queue
- **Depends on**: Phase 1 for patterns #11, #13, #15 (user context signals), but 12 of 15 patterns work without it

### Phase 3: Account Briefings
- New table `BKMNG_ACCOUNT_BRIEFINGS`
- Modified or new SP replacing `SP_COMPUTE_AI_ASSESSMENTS`
- Frontend briefing card on account detail
- **Depends on**: Phase 1 (user context enriches briefings), Phase 2 (composite patterns feed into briefings). Can ship a basic version without either.

### Phase 4: Meeting Prep Flow
- New table `BKMNG_MEETING_PREPS`
- New API endpoint `GET /accounts/{id}/meeting-prep`
- Frontend prep view (full page or modal)
- Post-meeting notes integration with Context Ingestion
- **Depends on**: Phase 1 (post-meeting notes loop), Phase 3 (briefing data). Core prep works without Phase 2.

### Phase 5: Email Forwarding (v2 ingestion)
- External function + email service integration
- Staging table + parsing task
- **Depends on**: Phase 1 (same parsing pipeline and data model)

---

## Cost & Performance Considerations

### LLM Usage

| Component | Model | Calls/Day | Est. Tokens/Call | Notes |
|-----------|-------|-----------|-----------------|-------|
| Context parsing | llama3.1-8b | ~50 (user-driven) | ~2K | Low volume, fast model sufficient |
| Account briefings | llama3.1-70b | ~200 | ~4K | Daily batch, higher quality needed |
| Meeting prep | llama3.1-70b | ~20 (on-demand) | ~6K | Cached after generation |
| AI assessments (existing) | llama3.1-70b | ~450 | ~3K | Can be replaced by briefings |

Total incremental: ~270 calls/day at 70b, ~50 calls/day at 8b. Well within Cortex credit budgets for an internal tool.

### Query Performance

- Composite pattern computation is pure SQL (CASE statements over existing indexed tables) — should complete in <30 seconds for ~465 accounts
- Context parsing is per-insert, not batch — no query performance concern
- Briefing generation is batch but embarrassingly parallel — can be chunked

### Storage

- `BKMNG_USER_CONTEXT_V2`: negligible (~500 rows/month estimated)
- `BKMNG_COMPOSITE_PATTERNS`: ~500 rows, truncate-and-reload hourly
- `BKMNG_ACCOUNT_BRIEFINGS`: ~200 rows, truncate-and-reload daily
- `BKMNG_MEETING_PREPS`: ~100 rows, rolling 7-day retention

---

## Success Metrics

How to measure whether proactive insights are working:

| Metric | Source | Target |
|--------|--------|--------|
| Context entries added per SE per week | `BKMNG_USER_CONTEXT_V2` count | ≥3 |
| Meeting prep views before meetings | `BKMNG_MEETING_PREPS` + click tracking | ≥50% of upcoming meetings |
| Time from signal to SE action | Signal created_at vs first context entry or Gong call | <48 hours for critical patterns |
| Composite patterns acknowledged | Focus Queue ack rate | ≥70% within 24 hours |
| SE-reported usefulness | Survey / feedback | Net positive |
| Reduction in "I didn't know about X" moments | Qualitative | Anecdotal improvement |

---

## Open Questions

1. **Context privacy**: Should user-added context be visible to the ACEM (manager)? Default recommendation: yes for account context, no for personal observations. Needs a `visibility` field.

2. **Context sharing**: If multiple SEs work the same account, should they see each other's context? Recommendation: yes — it's account context, not personal notes.

3. **Briefing freshness**: Daily generation means briefings can be up to 24h stale. Is this acceptable, or should critical-signal accounts get intraday refreshes?

4. **Pattern tuning**: The initial 15 patterns are hypotheses. Plan to instrument which patterns lead to SE action and which are ignored, then adjust thresholds and retire low-value patterns.

5. **Email forwarding identity**: How to authenticate that a forwarded email is from a legitimate SE? Options: verify sender email against `BKMNG_USERS`, or use a per-SE unique forwarding address.
