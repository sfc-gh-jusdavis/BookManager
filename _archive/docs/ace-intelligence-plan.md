# ACE Agent Intelligence Plan

> Ontology-driven architecture for making BookManager's ACE agent deeply context-aware across accounts, use cases, contacts, interactions, and engagement signals.

## Goal

Transform ACE from a flat data-lookup chatbot into an **ontology-powered intelligence agent** that understands the relationships between accounts, people, interactions, use cases, and consumption — enabling it to proactively surface insights and route complex requests to the right tool.

**Target user**: Account Engineers who need to know where to place their time and energy to affect maximal outcomes for their book of business. The agent should identify which accounts are engaged, have potential to close use cases, and consume credits at an increased rate.

---

## User Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BOOKMANAGER UI                               │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  ┌────────────┐ │
│  │  Dashboard   │  │  Account     │  │ Forecasts │  │   TMRs     │ │
│  │  (NBA cards) │  │  Detail      │  │           │  │            │ │
│  └──────┬──────┘  └──────┬───────┘  └───────────┘  └────────────┘ │
│         │                │                                          │
│         ▼                ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    💬 ACE Chat Panel                         │   │
│  │  "Which accounts need attention?"                           │   │
│  │  "Draft an email to Sarah about the POC timeline"           │   │
│  │  "How do I set up Private Link for Acme Corp?"              │   │
│  │  "What competitors came up in recent calls at BigCo?"       │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                                 │
│                                                                     │
│  POST /agent/chat                                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  1. ASSEMBLE SYSTEM PROMPT                                   │   │
│  │     ┌─────────────────────────────────────────────────────┐ │   │
│  │     │ Query BKMNG_ONT_ACCOUNTS → momentum distribution    │ │   │
│  │     │ Query BKMNG_ONT_ACCOUNT_SIGNALS → top 5 signals     │ │   │
│  │     │ If account_id:                                      │ │   │
│  │     │   → ONT_CONTACTS (key people + last call dates)     │ │   │
│  │     │   → ONT_INTERACTIONS (last 3 calls w/ summaries)    │ │   │
│  │     │   → ONT_ACCOUNT_TOPICS (trending topics)            │ │   │
│  │     │   → ONT_ACCOUNT_COMPETITORS (competitor mentions)   │ │   │
│  │     └─────────────────────────────────────────────────────┘ │   │
│  │                                                               │   │
│  │  2. PROXY TO CORTEX AGENTS API (SSE streaming)               │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SNOWFLAKE CORTEX AGENTS (claude-3-5-sonnet)            │
│                                                                     │
│  System prompt: rich ontology context + routing guidance             │
│                                                                     │
│  ┌─── Agent decides which tool(s) to call ───────────────────────┐ │
│  │                                                                │ │
│  │  "Which accounts need attention?"                              │ │
│  │   └──→ BookManager_Data_Assistant                              │ │
│  │         (queries BKMNG_ONT_ACCOUNT_SIGNALS)                    │ │
│  │                                                                │ │
│  │  "How do I set up Private Link?"                               │ │
│  │   └──→ Snowflake_Docs                                         │ │
│  │         (searches CKE_SNOWFLAKE_DOCS_SERVICE)                  │ │
│  │                                                                │ │
│  │  "What's our competitive angle vs Databricks for BigCo?"      │ │
│  │   └──→ BookManager_Data_Assistant (competitor mentions)        │ │
│  │   └──→ Raven Sales_Knowledge_Assistant (battle cards)          │ │
│  │                                                                │ │
│  │  "Draft email to Sarah about POC timeline"                     │ │
│  │   └──→ BookManager_Data_Assistant (contact + use case data)    │ │
│  │   └──→ Snowflake_Docs (verify technical details)              │ │
│  │   └──→ Composes email with full context                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
              ┌────────────┼────────────────────────┐
              │            │                        │
              ▼            ▼                        ▼
┌──────────────────┐ ┌──────────────┐ ┌─────────────────────────────┐
│ BookManager_Data │ │ Snowflake    │ │ Raven Sales Tools           │
│ _Assistant       │ │ _Docs        │ │                             │
│ (cortex_analyst) │ │ (cortex      │ │ Sales_Knowledge_Assistant   │
│                  │ │  _search)    │ │ Use_Case_Explorer           │
│ Semantic model:  │ │              │ │ Sales_Data_Assistant         │
│ 7 ontology       │ │ 48K chunks   │ │ Sales_Account_360_Data      │
│ tables           │ │ official     │ │                             │
│                  │ │ Snowflake    │ │ Seismic decks, competitive  │
│ Accounts         │ │ docs         │ │ intel, sales plays          │
│ Use Cases        │ │              │ │                             │
│ Contacts         │ │ Returns:     │ │                             │
│ Interactions     │ │ chunks +     │ │                             │
│ Signals          │ │ SOURCE_URLs  │ │                             │
│ Topics           │ │              │ │                             │
│ Opportunities    │ │              │ │                             │
└────────┬─────────┘ └──────────────┘ └─────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  ONTOLOGY LAYER (TEMP.JUSDAVIS)                     │
│                                                                     │
│  ┌─── Entity Tables ─────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  BKMNG_ONT_ACCOUNTS ──────┬──── BKMNG_ONT_CONTACTS           │ │
│  │  (health_score, momentum, │     (champion, last_call,         │ │
│  │   utilization, wow/mom)   │      gong_call_count_90d)         │ │
│  │         │                 │              │                     │ │
│  │         │                 ├──── BKMNG_ONT_INTERACTIONS        │ │
│  │         │                 │     (gong calls: summaries,       │ │
│  │         │                 │      topics, trackers, scores)    │ │
│  │         │                 │              │                     │ │
│  │         │                 ├──── BKMNG_ONT_USE_CASES           │ │
│  │         │                 │     (stage_velocity, risk,        │ │
│  │         │                 │      team_members, MEDDPICC)      │ │
│  │         │                 │                                    │ │
│  │         │                 └──── BKMNG_ONT_OPPORTUNITIES       │ │
│  │         │                       (SE/PS comments, competitors) │ │
│  │         │                                                      │ │
│  │         └──── BKMNG_ONT_FEATURE_ADOPTION                      │ │
│  │               (per-feature first-use dates, IS_NEW_30D/90D)   │ │
│  │                                                                │ │
│  └─────────┼──────────────────────────────────────────────────────┘ │
│            │                                                        │
│  ┌─── Aggregation Tables ────────────────────────────────────────┐ │
│  │         ├──── BKMNG_ONT_ACCOUNT_TOPICS                        │ │
│  │         │     (topic × account × mention_count_90d)           │ │
│  │         │                                                      │ │
│  │         └──── BKMNG_ONT_ACCOUNT_COMPETITORS                   │ │
│  │               (competitor × account × mention_count_90d)      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─── Intelligence Layer ────────────────────────────────────────┐ │
│  │  BKMNG_ONT_ACCOUNT_SIGNALS                                    │ │
│  │  16 signal types: blocker, at_risk, go_live, champion_silent, │ │
│  │  stage_stalled, competitor_mentioned, consumption_spike/dip,  │ │
│  │  capacity_warning, high_momentum, expansion_signal,           │ │
│  │  new_feature_adoption, ...                                    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Refreshed by Snowflake Tasks (1h–daily depending on table)         │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
              ┌────────────┼──────────────────┐
              │            │                  │
              ▼            ▼                  ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│ BKMNG_ACCOUNTS   │ │ GONG_GONG    │ │ FIVETRAN         │
│ BKMNG_USE_CASES  │ │ _CALL_C      │ │ .SALESFORCE      │
│ BKMNG_CONTRACT   │ │ (154K calls, │ │                  │
│ _REVENUE         │ │  JSON blobs) │ │ CONTACT          │
│ BKMNG_CONSUMPTION│ │              │ │ OPPORTUNITY      │
│ _TRENDS          │ │              │ │ USE_CASE_C       │
│                  │ │              │ │ USE_CASE_TEAM_C  │
│ (existing        │ │              │ │ USE_CASE_CONTACT │
│  snapshot        │ │              │ │ _ROLE_C          │
│  tables)         │ │              │ │ USE_CASE_HISTORY │
│                  │ │              │ │ _C               │
└──────────────────┘ └──────────────┘ └──────────────────┘
         ▲                  ▲                  ▲
         │                  │                  │
    Snowflake Tasks    Raw Fivetran        Raw Fivetran
    (existing, 4h)     (real-time sync)    (real-time sync)
```

### Example: "What should I focus on today?"

```
User types: "What should I focus on today?"
  │
  ▼
Backend assembles system prompt with:
  ├── Book health: 422 accounts, 12 accelerating, 380 steady, 20 decelerating, 10 stalled
  ├── Top 5 signals:
  │   [HIGH] Champion silent: Sarah Chen @ Acme Corp (28d no call)
  │   [HIGH] Consumption spike: BigCo (+45% WoW)
  │   [MED]  Stage stalled: "Data Vault" @ TechFirm (42d in Scoping)
  │   [MED]  Competitor: Databricks mentioned 3x @ MegaCorp
  │   [MED]  Go-live in 12d: "Real-Time Analytics" @ Acme Corp
  │
  ▼
Cortex Agent receives rich context + user question
  │
  ▼
Agent calls BookManager_Data_Assistant:
  "SELECT * FROM BKMNG_ONT_ACCOUNT_SIGNALS
   WHERE PRIORITY IN ('high','medium') ORDER BY ..."
  │
  ▼
Agent synthesizes response:
  "You have 5 items needing attention today:

   1. Re-engage Sarah Chen at Acme Corp — she's your champion
      but hasn't been on a call in 28 days. Their go-live for
      Real-Time Analytics is in 12 days. Schedule a check-in.

   2. BigCo consumption spiked +45% WoW — they're at 82% of
      contract capacity. Verify the workload and discuss expansion.

   3. TechFirm's Data Vault Migration has been in Scoping for 42 days
      (avg is 18d). The last call flagged data access blockers —
      follow up on RBAC setup.
   ..."
```

---

## Current State

### ACE Agent (`backend/app/routers/agent.py`)
- Proxies to Snowflake Cortex Agents API (claude-3-5-sonnet)
- 5 tools: 4 Raven (Sales_Knowledge_Assistant, Use_Case_Explorer, Sales_Data_Assistant, Sales_Account_360_Data) + 1 BookManager (BookManager_Data_Assistant)
- System prompt (`get_bookmanager_context`): flat summary — account counts, use case counts, upcoming go-lives, optionally a single account's details

### Snowflake Documentation Access
- **Available but not yet wired**: Cortex Knowledge Extension (CKE) for Snowflake Documentation
  - Database: `CORTEX_KNOWLEDGE_EXTENSION_SNOWFLAKE_DOCUMENTATION`
  - Cortex Search Service: `SHARED.CKE_SNOWFLAKE_DOCS_SERVICE`
  - **48,140 chunks** of official Snowflake documentation
  - Embedding model: `snowflake-arctic-embed-m-v1.5`
  - Columns: `CHUNK`, `DOCUMENT_TITLE`, `SOURCE_URL`, `CHUNK_ID`
  - Refresh: hourly, ACTIVE
  - Origin: First-party CKE imported from `SF1PCONTENT.SNOWFLAKE_APPS.SNOWFLAKE_DOCS_CKE_SNOWFLAKE_SHARE`
  - This enables ACE to answer product/feature questions like "how do I set up Private Link?" or "what's the syntax for Dynamic Tables?" directly from official docs

### Semantic Model (`bookmanager_assistant.yaml`)
- Only covers `BKMNG_ACCOUNTS` and `BKMNG_USE_CASES`
- No Gong, no consumption trends, no contract data, no contacts, no relationships

### NBA Signals (`list_nba_items` in `snowflake_service.py:922`)
- 7 signal types computed in Python at request time
- Loads ALL accounts, use cases, TMRs, Gong calls, revenue summaries into memory
- Calls `SNOWFLAKE.CORTEX.COMPLETE('mistral-7b')` for AI summaries
- No persistence — recomputed every API call

### What's Missing
The agent has **no relational understanding**. It sees flat tables. It cannot reason about:
- "This account has 3 use cases in implementation, the champion contact attended 2 Gong calls last month, consumption is spiking — this is a high-momentum account"
- "This account has stalled — no calls in 3 weeks, use cases stuck in scoping, the primary contact hasn't been on a call since January"
- "Who are the key people at this account and what's their engagement pattern?"

---

## Data Sources Available

| Source | Table | Location | Rows | Key Fields |
|--------|-------|----------|------|-----------|
| Accounts | `BKMNG_ACCOUNTS` | TEMP.JUSDAVIS | 422 | engagement_status, ACV, consumption_YTD, credits_allocated |
| Use Cases | `BKMNG_USE_CASES` | TEMP.JUSDAVIS | 1,320 | MEDDPICC scores (7 components + overall), stage, status, go-live dates, PS notes, specialist/implementation comments |
| Contract Revenue | `BKMNG_CONTRACT_REVENUE` | TEMP.JUSDAVIS | 422 | capacity, consumed, remaining, predicted_overage_date |
| Consumption Trends | `BKMNG_CONSUMPTION_TRENDS` | TEMP.JUSDAVIS | 16,329 | weekly/monthly credits, WoW/MoM pct_change, rolling 4-period avg |
| Gong Calls | `GONG_GONG_CALL_C` | FIVETRAN.SALESFORCE | ~154K | AI briefs, key points, next steps, topics JSON, trackers JSON (competitors), stats JSON (talk ratios), participant emails, call score, account/opp FKs |
| Contacts | `CONTACT` | FIVETRAN.SALESFORCE | large | name, email, title, department, account_id |
| Opportunities | `OPPORTUNITY` | FIVETRAN.SALESFORCE | large | SE comments, PS&T comments, decision criteria, pain points, competitors, lead SE |
| Use Case Teams | `USE_CASE_TEAM_C` | FIVETRAN.SALESFORCE | 360K | user → use case role assignments (Solution Engineer, Use Case Owner, etc.) |
| Use Case Contacts | `USE_CASE_CONTACT_ROLE_C` | FIVETRAN.SALESFORCE | 19K | contact → use case with role, is_primary flag |
| Use Case History | `USE_CASE_HISTORY_C` | FIVETRAN.SALESFORCE | 1.6M | field-level change history (stage transitions, score changes) |
| Account Teams | `ACCOUNT_TEAM_MEMBER` | FIVETRAN.SALESFORCE | 9.6M | user → account with role (SE, AE, CSM) |
| Feature Usage | `USAGE_TRACKING_SUMMARY` | SNOWHOUSE.PRODUCT | large | feature/event level telemetry per account (numeric ACCOUNT_ID — needs crosswalk) |
| Compute Services | `COMPUTE_SERVICE_ACCOUNT_USAGE` | SNOWHOUSE.PRODUCT | large | SERVICE_TYPE level billed credits per account (numeric ACCOUNT_ID) |
| Account ID Crosswalk | `RELEVANT_SUBSCRIPTION_DAILY_RECORDS` | SNOWHOUSE.PRODUCT | large | Maps SALESFORCE_ACCOUNT_ID ↔ SNOWFLAKE_ACCOUNT_ID (numeric) |
| Adoption Signals | `BKMNG_ADOPTION_SIGNALS` | TEMP.JUSDAVIS | ~109 | 8 category flags + profile/missing_categories (capacity accounts only; see `platform-adoption-signals-plan.md`) |
| Feature First Use | `BKMNG_ADOPTION_FEATURE_FIRST_USE` | TEMP.JUSDAVIS | ~1,683 | Per-account first-use dates for 25 curated features (see `platform-adoption-signals-plan.md`) |
| ACEM Team | `BKMNG_ACEM_TEAM` | TEMP.JUSDAVIS | 29 | manager → ACE email mapping |

---

## Architecture: Three-Layer Ontology

### Layer 1: Entity Tables (materialized in `TEMP.JUSDAVIS`)

These are the "nouns" of the ontology.

#### `BKMNG_ONT_ACCOUNTS` (extends BKMNG_ACCOUNTS)

All existing fields PLUS computed intelligence:

| New Field | Type | Source | Description |
|-----------|------|--------|-------------|
| `HEALTH_SCORE` | NUMBER | Computed | Weighted composite: consumption trend (25%), use case velocity (25%), interaction recency (25%), MEDDPICC avg (25%) |
| `MOMENTUM` | VARCHAR | Computed | `accelerating` / `steady` / `decelerating` / `stalled` — based on health_score trend over 4 weeks |
| `LAST_EXTERNAL_INTERACTION_DATE` | DATE | Gong | MAX(call_date) for this account |
| `DAYS_SINCE_LAST_INTERACTION` | NUMBER | Computed | DATEDIFF from last interaction |
| `ACTIVE_USE_CASE_COUNT` | NUMBER | Use Cases | COUNT where status IN ('In Pursuit', 'Implementation') |
| `IMPL_USE_CASE_COUNT` | NUMBER | Use Cases | COUNT where status = 'Implementation' |
| `BLOCKED_USE_CASE_COUNT` | NUMBER | Use Cases | COUNT where status = 'Blocked' |
| `AVG_MEDDPICC_SCORE` | NUMBER | Use Cases | AVG(MEDDPICC_OVERALL_SCORE) |
| `TOTAL_GONG_CALLS_90D` | NUMBER | Gong | COUNT calls in last 90 days |
| `AVG_GONG_SCORE_90D` | NUMBER | Gong | AVG(call_score) in last 90 days |
| `CONTRACT_UTILIZATION_PCT` | NUMBER | Contract Revenue | consumed / capacity * 100 |
| `WOW_CREDITS_CHANGE` | NUMBER | Consumption Trends | Latest WoW pct_change |
| `MOM_CREDITS_CHANGE` | NUMBER | Consumption Trends | Latest MoM pct_change |
| `SIG_PIPELINE` | NUMBER(1,0) | BKMNG_ADOPTION_SIGNALS | Platform area active: Pipeline (Snowpipe, COPY, tasks) |
| `SIG_TRANSFORMS` | NUMBER(1,0) | BKMNG_ADOPTION_SIGNALS | Platform area active: Transforms (Dynamic Tables, MVs) |
| `SIG_BI` | NUMBER(1,0) | BKMNG_ADOPTION_SIGNALS | Platform area active: BI/Analytics (Streamlit) |
| `SIG_COST` | NUMBER(1,0) | BKMNG_ADOPTION_SIGNALS | Platform area active: Cost Governance (budgets, metering) |
| `SIG_COLLAB` | NUMBER(1,0) | BKMNG_ADOPTION_SIGNALS | Platform area active: Collaboration (shares, listings, replication) |
| `SIG_OBS` | NUMBER(1,0) | BKMNG_ADOPTION_SIGNALS | Platform area active: Observability (DMFs, clustering) |
| `SIG_AIML` | NUMBER(1,0) | BKMNG_ADOPTION_SIGNALS | Platform area active: AI/ML (Cortex, Search Optimization) |
| `SIG_SPCS` | NUMBER(1,0) | BKMNG_ADOPTION_SIGNALS | Platform area active: SPCS (containers, Iceberg) |
| `ADOPTION_SIGNAL_COUNT` | NUMBER | BKMNG_ADOPTION_SIGNALS | Sum of 8 signal flags (0-8) |
| `ADOPTION_PROFILE` | VARCHAR | BKMNG_ADOPTION_SIGNALS | Comma-separated active categories |
| `MISSING_CATEGORIES` | VARCHAR | BKMNG_ADOPTION_SIGNALS | Comma-separated inactive categories |
| `NEW_ADOPTION_30D` | VARCHAR | BKMNG_ADOPTION_FEATURE_FIRST_USE | Comma-separated features first used in last 30d |

**Refresh**: Task, every 4 hours (CRON `0 */4 * * *` UTC)

**Source SQL pattern**:
```sql
SELECT
    a.*,
    cr.CONTRACT_UTILIZATION_PCT,
    cr.PREDICTED_OVERAGE_DATE,
    uc_agg.ACTIVE_USE_CASE_COUNT,
    uc_agg.IMPL_USE_CASE_COUNT,
    uc_agg.AVG_MEDDPICC_SCORE,
    gong_agg.TOTAL_GONG_CALLS_90D,
    gong_agg.AVG_GONG_SCORE_90D,
    gong_agg.LAST_EXTERNAL_INTERACTION_DATE,
    ct.WOW_CREDITS_CHANGE,
    ct.MOM_CREDITS_CHANGE,
    -- Health score: weighted composite
    ROUND(
        COALESCE(ct_health, 50) * 0.25 +           -- consumption health
        COALESCE(uc_agg.velocity_health, 50) * 0.25 + -- use case velocity
        COALESCE(gong_agg.recency_health, 50) * 0.25 + -- interaction recency
        COALESCE(uc_agg.AVG_MEDDPICC_SCORE, 50) * 0.25  -- MEDDPICC
    , 1) AS HEALTH_SCORE
FROM BKMNG_ACCOUNTS a
LEFT JOIN contract_cte cr ON ...
LEFT JOIN use_case_agg_cte uc_agg ON ...
LEFT JOIN gong_agg_cte gong_agg ON ...
LEFT JOIN consumption_health_cte ct ON ...
```

#### `BKMNG_ONT_CONTACTS` (new)

| Field | Type | Source |
|-------|------|--------|
| `CONTACT_ID` | VARCHAR | CONTACT.ID |
| `ACCOUNT_ID` | VARCHAR | CONTACT.ACCOUNT_ID |
| `ACCOUNT_NAME` | VARCHAR | BKMNG_ACCOUNTS join |
| `NAME` | VARCHAR | CONTACT.NAME |
| `EMAIL` | VARCHAR | CONTACT.EMAIL |
| `TITLE` | VARCHAR | CONTACT.TITLE |
| `DEPARTMENT` | VARCHAR | CONTACT.DEPARTMENT |
| `ROLE_ON_ACCOUNT` | VARCHAR | Derived: champion / evaluator / sponsor / end-user from USE_CASE_CONTACT_ROLE_C roles |
| `IS_CHAMPION` | BOOLEAN | Derived from MEDDPICC_CHAMPION_C text matching or contact role |
| `IS_PRIMARY_ON_USE_CASE` | BOOLEAN | USE_CASE_CONTACT_ROLE_C.IS_PRIMARY_C |
| `USE_CASE_ROLES` | VARCHAR | ARRAY_TO_STRING of roles across use cases |
| `LAST_GONG_CALL_DATE` | DATE | MAX call date where this email in participant list |
| `GONG_CALL_COUNT_90D` | NUMBER | COUNT calls in 90d where this email in participant list |
| `DAYS_SINCE_LAST_CALL` | NUMBER | Computed |

**Refresh**: Daily (CRON `30 1 * * *` UTC)

**Scoping**: Only contacts belonging to accounts in BKMNG_ACCOUNTS

**Gong participant matching**: Parse `GONG_PARTICIPANTS_EMAILS_C` (comma-separated) and match to contact emails

#### `BKMNG_ONT_INTERACTIONS` (new — replaces live Gong queries)

| Field | Type | Source |
|-------|------|--------|
| `INTERACTION_ID` | VARCHAR | GONG_GONG_CALL_C.ID |
| `ACCOUNT_ID` | VARCHAR | GONG_PRIMARY_ACCOUNT_C |
| `ACCOUNT_NAME` | VARCHAR | BKMNG_ACCOUNTS join |
| `INTERACTION_TYPE` | VARCHAR | 'gong_call' (extensible to email/meeting later) |
| `INTERACTION_DATE` | TIMESTAMP | GONG_CALL_START_C |
| `TITLE` | VARCHAR | GONG_TITLE_C |
| `SUMMARY` | VARCHAR | GONG_CALL_BRIEF_C (HTML stripped) |
| `KEY_POINTS` | VARCHAR | GONG_CALL_KEY_POINTS_C (HTML stripped) |
| `NEXT_STEPS` | VARCHAR | GONG_CALL_HIGHLIGHTS_NEXT_STEPS_C (HTML stripped) |
| `TOPICS` | VARCHAR | Parsed from GONG_RELATED_TOPICS_JSON_C — comma-separated topic names |
| `TOPICS_JSON` | VARIANT | Full parsed JSON for detailed querying |
| `TRACKERS` | VARCHAR | Parsed from GONG_RELATED_TRACKERS_JSON_C — competitor/keyword names |
| `PARTICIPANT_EMAILS` | VARCHAR | GONG_PARTICIPANTS_EMAILS_C |
| `DURATION_SEC` | NUMBER | GONG_CALL_DURATION_SEC_C |
| `TALK_RATIO_US` | NUMBER | GONG_TALK_TIME_US_C |
| `TALK_RATIO_THEM` | NUMBER | GONG_TALK_TIME_THEM_C |
| `CALL_SCORE` | NUMBER | GONG_CALL_SCORE_C |
| `RECORDING_URL` | VARCHAR | GONG_VIEW_CALL_C |

**Refresh**: Every 2 hours (CRON `15 */2 * * *` UTC)

**Scoping**: Only calls where `GONG_PRIMARY_ACCOUNT_C` IN (SELECT ACCOUNT_ID FROM BKMNG_ACCOUNTS) AND `IS_DELETED = FALSE`

**HTML stripping**: Use `REGEXP_REPLACE(field, '<[^>]+>', '')` for briefs/key_points/next_steps

#### `BKMNG_ONT_USE_CASES` (extends BKMNG_USE_CASES)

All existing fields PLUS:

| New Field | Type | Source |
|-----------|------|--------|
| `DAYS_IN_CURRENT_STAGE` | NUMBER | Latest stage change from USE_CASE_HISTORY_C where FIELD_C = 'Stage_c' |
| `STAGE_VELOCITY` | VARCHAR | `fast` / `normal` / `slow` — compared to portfolio median days-per-stage |
| `TEAM_MEMBERS` | VARCHAR | ARRAY_TO_STRING of names+roles from USE_CASE_TEAM_C |
| `PRIMARY_CONTACT_NAME` | VARCHAR | USE_CASE_CONTACT_ROLE_C WHERE IS_PRIMARY_C = TRUE |
| `PRIMARY_CONTACT_EMAIL` | VARCHAR | Same join |
| `RELATED_GONG_CALLS_30D` | NUMBER | COUNT interactions for this account in last 30d |
| `ALL_COMMENTS` | VARCHAR | Concatenated: use_case_comments + specialist_comments + implementation_comments |
| `RISK_LEVEL` | VARCHAR | USE_CASE_C.USE_CASE_RISK_LEVEL_C |
| `RISK_DESCRIPTION` | VARCHAR | USE_CASE_C.RISK_DESCRIPTION_AND_MITIGATION_STEPS_C |
| `NEXT_STEPS` | VARCHAR | USE_CASE_C.NEXT_STEPS_C |

**Refresh**: Every 4 hours (CRON `5 */4 * * *` UTC, aligned with existing)

#### `BKMNG_ONT_OPPORTUNITIES` (new)

| Field | Type | Source |
|-------|------|--------|
| `OPP_ID` | VARCHAR | OPPORTUNITY.ID |
| `ACCOUNT_ID` | VARCHAR | OPPORTUNITY.ACCOUNT_ID |
| `ACCOUNT_NAME` | VARCHAR | BKMNG_ACCOUNTS join |
| `OPP_NAME` | VARCHAR | OPPORTUNITY.NAME |
| `STAGE` | VARCHAR | OPPORTUNITY.STAGE_NAME |
| `CLOSE_DATE` | DATE | OPPORTUNITY.CLOSE_DATE |
| `AMOUNT` | NUMBER | OPPORTUNITY.AMOUNT |
| `SE_COMMENTS` | VARCHAR | OPPORTUNITY.SE_COMMENTS_C |
| `PS_COMMENTS` | VARCHAR | OPPORTUNITY.PS_T_COMMENTS_C |
| `DECISION_CRITERIA` | VARCHAR | OPPORTUNITY.DECISION_CRITERIA_C |
| `IDENTIFY_PAIN` | VARCHAR | OPPORTUNITY.IDENTIFY_PAIN_C |
| `COMPETITORS` | VARCHAR | From USE_CASE_C.COMPETITORS_C or OPPORTUNITY fields |
| `USE_CASES_TEXT` | VARCHAR | OPPORTUNITY.USE_CASES_C |
| `LEAD_SE` | VARCHAR | OPPORTUNITY.LEAD_SALES_ENGINEER_C |

**Refresh**: Daily (CRON `45 1 * * *` UTC)

**Scoping**: INNER JOIN BKMNG_ACCOUNTS on ACCOUNT_ID, WHERE IS_DELETED = FALSE

> Platform adoption signals (broad categories, adoption profiles, feature first-use detection)
> are defined in the standalone plan: `platform-adoption-signals-plan.md`

#### `BKMNG_ADOPTION_FEATURE_FIRST_USE` (see `platform-adoption-signals-plan.md`)

Tracks per-account, per-feature first-use dates for 25 curated Snowflake features. Built from
`USAGE_TRACKING_SUMMARY` and `COMPUTE_SERVICE_ACCOUNT_USAGE` via `MIN(DS)` per account per feature.
Account ID crosswalk via `RELEVANT_SUBSCRIPTION_DAILY_RECORDS`.

> Full schema, stored procedure, and implementation details: `platform-adoption-signals-plan.md`

| Field | Type | Source |
|-------|------|--------|
| `ACCOUNT_ID` | VARCHAR | Salesforce account ID |
| `ACCOUNT_NAME` | VARCHAR | BKMNG_ACCOUNTS join |
| `FEATURE_NAME` | VARCHAR | Human-readable name (e.g. "Dynamic Tables", "Cortex Search") |
| `FEATURE_RAW` | VARCHAR | Raw system feature name or signal category |
| `FEATURE_SOURCE` | VARCHAR | `category` (T_OD broad) or `feature` (granular USAGE_TRACKING) or `service` (COMPUTE_SERVICE) |
| `FIRST_USE_DATE` | DATE | MIN(DS) for the account+feature combination |
| `DAYS_SINCE_FIRST_USE` | NUMBER | DATEDIFF(day, FIRST_USE_DATE, CURRENT_DATE()) |
| `IS_NEW_30D` | BOOLEAN | FIRST_USE_DATE >= DATEADD('day', -30, CURRENT_DATE()) |
| `IS_NEW_90D` | BOOLEAN | FIRST_USE_DATE >= DATEADD('day', -90, CURRENT_DATE()) |

**Curated feature list** (mapped from raw system names):

| Raw Feature / Service | Display Name | Source Table |
|---|---|---|
| `DYNAMIC_TABLES` | Dynamic Tables | USAGE_TRACKING_SUMMARY |
| `CORTEX_SEARCH_REFRESH` | Cortex Search | USAGE_TRACKING_SUMMARY |
| `SYSTEM$CORTEX_MODEL_ACCESSIBLE` | Cortex LLM Functions | USAGE_TRACKING_SUMMARY |
| `SYSTEM$SHOW_STREAMLITS_IN_ACCOUNT` | Streamlit Apps | USAGE_TRACKING_SUMMARY |
| `SYSTEM$SHOW_NOTEBOOKS_IN_ACCOUNT` | Snowflake Notebooks | USAGE_TRACKING_SUMMARY |
| `SYSTEM$GET_METRIC_IDS_FOR_DATA_QUALITY_MONITORING_RESULT` | Data Quality Monitoring (DMFs) | USAGE_TRACKING_SUMMARY |
| `SYSTEM$ALERT_MAKE_SUBSEQUENT_QUERIES_HIDDEN` | Alerts | USAGE_TRACKING_SUMMARY |
| `SYSTEM$BULK_GET_LISTINGS` | Marketplace Listings | USAGE_TRACKING_SUMMARY |
| `EXTERNAL_FUNCTIONS` | External Functions | USAGE_TRACKING_SUMMARY |
| `ICEBERG_STORAGE_OPTIMIZATION` | Iceberg Tables | COMPUTE_SERVICE_ACCOUNT_USAGE |
| `QUERY_ACCELERATION` | Query Acceleration Service | COMPUTE_SERVICE_ACCOUNT_USAGE |
| `SEARCH_INDEX_REFRESH` | Search Optimization Service | COMPUTE_SERVICE_ACCOUNT_USAGE |
| `Pipeline` | Pipeline (broad category) | T_OD_SIGNAL_FIRST_DATES |
| `Transforms` | Transforms (broad category) | T_OD_SIGNAL_FIRST_DATES |
| `BI` | BI & Analytics (broad category) | T_OD_SIGNAL_FIRST_DATES |
| `Cost Gov` | Cost Governance (broad category) | T_OD_SIGNAL_FIRST_DATES |
| `Collab` | Collaboration (broad category) | T_OD_SIGNAL_FIRST_DATES |
| `Observability` | Observability (broad category) | T_OD_SIGNAL_FIRST_DATES |
| `AI/ML` | AI/ML (broad category) | T_OD_SIGNAL_FIRST_DATES |
| `SPCS` | SPCS (broad category) | T_OD_SIGNAL_FIRST_DATES |

**Source SQL pattern**:
```sql
WITH acct_map AS (
    -- Crosswalk: Salesforce ID → numeric Snowflake account ID
    SELECT DISTINCT
        r.SALESFORCE_ACCOUNT_ID,
        r.SNOWFLAKE_ACCOUNT_ID::INT AS SNOWFLAKE_ACCOUNT_ID
    FROM SNOWHOUSE.PRODUCT.RELEVANT_SUBSCRIPTION_DAILY_RECORDS r
    JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = r.SALESFORCE_ACCOUNT_ID
),
-- Layer 1: Broad categories from T_OD_SIGNAL_FIRST_DATES
category_adoption AS (
    SELECT
        fd.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
        fd.SIGNAL_NAME AS FEATURE_RAW,
        fd.SIGNAL_NAME || ' (broad category)' AS FEATURE_NAME,
        'category' AS FEATURE_SOURCE,
        fd.FIRST_SIGNAL_DATE AS FIRST_USE_DATE
    FROM TEMP.JUSDAVIS.T_OD_SIGNAL_FIRST_DATES fd
    JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = fd.SALESFORCE_ACCOUNT_ID
),
-- Layer 2: Granular features from USAGE_TRACKING_SUMMARY
feature_adoption AS (
    SELECT
        m.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
        u.FEATURE AS FEATURE_RAW,
        CASE u.FEATURE
            WHEN 'DYNAMIC_TABLES' THEN 'Dynamic Tables'
            WHEN 'CORTEX_SEARCH_REFRESH' THEN 'Cortex Search'
            WHEN 'SYSTEM$CORTEX_MODEL_ACCESSIBLE' THEN 'Cortex LLM Functions'
            WHEN 'SYSTEM$SHOW_STREAMLITS_IN_ACCOUNT' THEN 'Streamlit Apps'
            WHEN 'SYSTEM$SHOW_NOTEBOOKS_IN_ACCOUNT' THEN 'Snowflake Notebooks'
            WHEN 'SYSTEM$GET_METRIC_IDS_FOR_DATA_QUALITY_MONITORING_RESULT' THEN 'Data Quality Monitoring (DMFs)'
            WHEN 'SYSTEM$ALERT_MAKE_SUBSEQUENT_QUERIES_HIDDEN' THEN 'Alerts'
            WHEN 'SYSTEM$BULK_GET_LISTINGS' THEN 'Marketplace Listings'
            WHEN 'EXTERNAL_FUNCTIONS' THEN 'External Functions'
            ELSE u.FEATURE
        END AS FEATURE_NAME,
        'feature' AS FEATURE_SOURCE,
        MIN(u.DS) AS FIRST_USE_DATE
    FROM SNOWHOUSE.PRODUCT.USAGE_TRACKING_SUMMARY u
    JOIN acct_map m ON m.SNOWFLAKE_ACCOUNT_ID = u.ACCOUNT_ID
    WHERE u.FEATURE IN (
        'DYNAMIC_TABLES', 'CORTEX_SEARCH_REFRESH', 'SYSTEM$CORTEX_MODEL_ACCESSIBLE',
        'SYSTEM$SHOW_STREAMLITS_IN_ACCOUNT', 'SYSTEM$SHOW_NOTEBOOKS_IN_ACCOUNT',
        'SYSTEM$GET_METRIC_IDS_FOR_DATA_QUALITY_MONITORING_RESULT',
        'SYSTEM$ALERT_MAKE_SUBSEQUENT_QUERIES_HIDDEN', 'SYSTEM$BULK_GET_LISTINGS',
        'EXTERNAL_FUNCTIONS'
    )
    GROUP BY m.SALESFORCE_ACCOUNT_ID, u.FEATURE
),
-- Layer 3: Service-type features from COMPUTE_SERVICE_ACCOUNT_USAGE
service_adoption AS (
    SELECT
        m.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
        c.SERVICE_TYPE AS FEATURE_RAW,
        CASE c.SERVICE_TYPE
            WHEN 'ICEBERG_STORAGE_OPTIMIZATION' THEN 'Iceberg Tables'
            WHEN 'QUERY_ACCELERATION' THEN 'Query Acceleration Service'
            WHEN 'SEARCH_INDEX_REFRESH' THEN 'Search Optimization Service'
            ELSE INITCAP(REPLACE(c.SERVICE_TYPE, '_', ' '))
        END AS FEATURE_NAME,
        'service' AS FEATURE_SOURCE,
        MIN(c.DS) AS FIRST_USE_DATE
    FROM SNOWHOUSE.PRODUCT.COMPUTE_SERVICE_ACCOUNT_USAGE c
    JOIN acct_map m ON m.SNOWFLAKE_ACCOUNT_ID = c.ACCOUNT_ID
    WHERE c.SERVICE_TYPE IN (
        'ICEBERG_STORAGE_OPTIMIZATION', 'QUERY_ACCELERATION', 'SEARCH_INDEX_REFRESH'
    )
    GROUP BY m.SALESFORCE_ACCOUNT_ID, c.SERVICE_TYPE
),
combined AS (
    SELECT * FROM category_adoption
    UNION ALL
    SELECT * FROM feature_adoption
    UNION ALL
    SELECT * FROM service_adoption
)
SELECT
    c.ACCOUNT_ID,
    b.ACCOUNT_NAME,
    c.FEATURE_NAME,
    c.FEATURE_RAW,
    c.FEATURE_SOURCE,
    c.FIRST_USE_DATE,
    DATEDIFF('day', c.FIRST_USE_DATE, CURRENT_DATE()) AS DAYS_SINCE_FIRST_USE,
    c.FIRST_USE_DATE >= DATEADD('day', -30, CURRENT_DATE()) AS IS_NEW_30D,
    c.FIRST_USE_DATE >= DATEADD('day', -90, CURRENT_DATE()) AS IS_NEW_90D
FROM combined c
JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = c.ACCOUNT_ID
```

**Refresh**: Daily (CRON `0 2 * * *` UTC) — feature first-use dates don't change, only new ones appear

**Data validated against BKMNG accounts**:
- 285 accounts have broad category signal data
- Dynamic Tables: 54 accounts total, 11 first used in last 30d
- Cortex Search: 33 accounts, 4 new in last 30d
- Iceberg Storage: 10 accounts, 1 new in last 30d

---

### Layer 2: Relationship / Aggregation Tables

#### `BKMNG_ONT_ACCOUNT_TOPICS` (new)

| Field | Type | Description |
|-------|------|-------------|
| `ACCOUNT_ID` | VARCHAR | |
| `ACCOUNT_NAME` | VARCHAR | |
| `TOPIC` | VARCHAR | Topic name from Gong |
| `MENTION_COUNT_90D` | NUMBER | Times this topic appeared in calls in last 90 days |
| `LAST_MENTIONED_DATE` | DATE | Most recent call where topic appeared |
| `AVG_DURATION_SEC` | NUMBER | Average time spent on this topic per call |

**Source**: Explode `GONG_RELATED_TOPICS_JSON_C` via `LATERAL FLATTEN(PARSE_JSON(topics))`, group by account + topic name, filter to last 90 days.

**Refresh**: Every 2 hours (with interactions)

#### `BKMNG_ONT_ACCOUNT_COMPETITORS` (new)

| Field | Type | Description |
|-------|------|-------------|
| `ACCOUNT_ID` | VARCHAR | |
| `ACCOUNT_NAME` | VARCHAR | |
| `COMPETITOR_NAME` | VARCHAR | Tracker keyword (Databricks, AWS, Azure, etc.) |
| `MENTION_COUNT_90D` | NUMBER | Times mentioned in last 90 days |
| `LAST_MENTIONED_DATE` | DATE | Most recent mention |

**Source**: Explode `GONG_RELATED_TRACKERS_JSON_C` via `LATERAL FLATTEN`, filter to competitor-type trackers, group by account.

**Refresh**: Every 2 hours (with interactions)

---

### Layer 3: Computed Intelligence — Signals

#### `BKMNG_ONT_ACCOUNT_SIGNALS` (replaces Python NBA computation)

| Field | Type | Description |
|-------|------|-------------|
| `SIGNAL_ID` | VARCHAR | Deterministic: `{signal_type}-{entity_id}` |
| `ACCOUNT_ID` | VARCHAR | |
| `ACCOUNT_NAME` | VARCHAR | |
| `SIGNAL_TYPE` | VARCHAR | See signal catalog below |
| `PRIORITY` | VARCHAR | `high` / `medium` / `low` |
| `SIGNAL_TEXT` | VARCHAR | Human-readable 1-liner |
| `CONTEXT` | VARCHAR | 2-3 sentence context for LLM summarization |
| `ENTITY_TYPE` | VARCHAR | `account` / `use_case` / `contact` / `interaction` |
| `ENTITY_ID` | VARCHAR | FK to the relevant entity |
| `CREATED_AT` | TIMESTAMP | When signal was computed |

**Signal Catalog** (expanded from 7 to 16):

| Signal Type | Priority | Trigger | Context Includes |
|-------------|----------|---------|-----------------|
| `blocker` | high | Use case status = Blocked | Last Gong call context, PS notes |
| `at_risk` | medium | Account engagement_status = At Risk | Last call, use case status |
| `go_live_approaching` | medium | Use case go-live within 30 days | Days remaining, stage, MEDDPICC score |
| `open_tmr` | medium | TMR not closed | Activity requested, reason |
| `no_interaction_7d` | medium | No Gong call in 7 days | Last call date and title |
| `no_interaction_14d` | high | No Gong call in 14 days | Last call, account momentum |
| `consumption_spike` | high | WoW credits change >= +30% | WoW %, contract headroom |
| `consumption_dip` | medium | WoW credits change <= -20% | WoW %, MoM trend |
| `champion_silent` | high | **NEW** — Primary contact not on calls in 30d | Contact name/title, last call date, use case status |
| `stage_stalled` | medium | **NEW** — Use case in same stage >30d beyond portfolio median | Days in stage, median days, stage name |
| `competitor_mentioned` | medium | **NEW** — Competitor tracker fired in call within 14d | Competitor name, call title, mention count |
| `high_momentum` | low (positive) | **NEW** — Account has: rising consumption + active use cases + recent calls | Health score, WoW change, call count |
| `capacity_warning` | high | **NEW** — Contract utilization > 80% | Utilization %, remaining credits, predicted overage |
| `new_stakeholder` | low | **NEW** — New email on Gong call not previously seen | Person info, call context |
| `expansion_signal` | medium | **NEW** — New use case created in last 30d + consumption rising | Use case name, consumption trend |
| `new_feature_adoption` | low (positive) | **NEW** — Account used a specific Snowflake feature for the first time in last 30d | Feature name, first-use date, current adoption profile, adoption count |

**Refresh**: Hourly (CRON `0 * * * *` UTC) via stored procedure

**Implementation**: Single SQL stored procedure `SP_REFRESH_BKMNG_ONT_SIGNALS` that:
1. Truncates BKMNG_ONT_ACCOUNT_SIGNALS
2. Inserts signals from a series of CTEs, one per signal type
3. Each CTE joins the relevant ontology tables

---

## Enhanced Semantic Model

Expand `bookmanager_assistant.yaml` from 2 tables to 7:

```yaml
tables:
  - name: accounts           # BKMNG_ONT_ACCOUNTS
    # dimensions: account_id, account_name, industry, region, ace_assigned,
    #   engagement_status, status, momentum
    # facts: health_score, total_credits_allocated, acv, consumption_ytd,
    #   contract_utilization_pct, wow_credits_change, mom_credits_change,
    #   active_use_case_count, total_gong_calls_90d, avg_gong_score_90d,
    #   avg_meddpicc_score, days_since_last_interaction
    # time_dimensions: activation_start_date, last_external_interaction_date

  - name: use_cases          # BKMNG_ONT_USE_CASES
    # dimensions: use_case_id, account_id, account_name, use_case_name,
    #   status, stage, complexity, lead_se, ace_assigned, stage_velocity,
    #   risk_level, primary_contact_name, team_members
    # facts: meddpicc_overall_score (+ 7 components), days_in_current_stage,
    #   related_gong_calls_30d
    # time_dimensions: go_live_date, target_go_live_date, created_date

  - name: interactions       # BKMNG_ONT_INTERACTIONS
    # dimensions: interaction_id, account_id, account_name, interaction_type,
    #   title, summary, key_points, next_steps, topics, trackers,
    #   participant_emails
    # facts: duration_sec, talk_ratio_us, talk_ratio_them, call_score
    # time_dimensions: interaction_date

  - name: contacts           # BKMNG_ONT_CONTACTS
    # dimensions: contact_id, account_id, account_name, name, email, title,
    #   department, role_on_account, is_champion, use_case_roles
    # facts: gong_call_count_90d, days_since_last_call
    # time_dimensions: last_gong_call_date

  - name: opportunities      # BKMNG_ONT_OPPORTUNITIES
    # dimensions: opp_id, account_id, account_name, opp_name, stage,
    #   se_comments, ps_comments, decision_criteria, identify_pain,
    #   competitors, lead_se
    # facts: amount
    # time_dimensions: close_date

  - name: account_topics     # BKMNG_ONT_ACCOUNT_TOPICS
    # dimensions: account_id, account_name, topic
    # facts: mention_count_90d, avg_duration_sec
    # time_dimensions: last_mentioned_date

  - name: account_signals    # BKMNG_ONT_ACCOUNT_SIGNALS
    # dimensions: signal_id, account_id, account_name, signal_type, priority,
    #   signal_text, context, entity_type, entity_id
    # time_dimensions: created_at

  - name: adoption_signals   # BKMNG_ADOPTION_SIGNALS (see platform-adoption-signals-plan.md)
    # dimensions: account_id, account_name, adoption_profile, missing_categories
    # facts: sig_pipeline..sig_spcs, signal_count, total_billed_credits_90d

  - name: feature_first_use  # BKMNG_ADOPTION_FEATURE_FIRST_USE (see platform-adoption-signals-plan.md)
    # dimensions: account_id, account_name, feature_name, feature_raw,
    #   feature_source, category, is_new_30d, is_new_90d
    # facts: days_since_first_use
    # time_dimensions: first_use_date
```

### Verified Queries (add 10-15)

```yaml
verified_queries:
  - name: highest_momentum_accounts
    question: Which of my accounts have the highest momentum?
    sql: >
      SELECT ACCOUNT_NAME, MOMENTUM, HEALTH_SCORE, WOW_CREDITS_CHANGE,
             ACTIVE_USE_CASE_COUNT, DAYS_SINCE_LAST_INTERACTION
      FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS
      ORDER BY HEALTH_SCORE DESC
      LIMIT 10

  - name: accounts_needing_attention
    question: What accounts need attention this week?
    sql: >
      SELECT ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT
      FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
      WHERE PRIORITY IN ('high', 'medium')
      ORDER BY CASE PRIORITY WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
               CREATED_AT DESC

  - name: account_competitors
    question: What competitors are being discussed at this account?
    sql: >
      SELECT ACCOUNT_NAME, COMPETITOR_NAME, MENTION_COUNT_90D, LAST_MENTIONED_DATE
      FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_COMPETITORS
      ORDER BY MENTION_COUNT_90D DESC

  - name: champion_engagement
    question: Who is the champion at this account and when did they last attend a call?
    sql: >
      SELECT c.NAME, c.TITLE, c.EMAIL, c.ROLE_ON_ACCOUNT,
             c.LAST_GONG_CALL_DATE, c.GONG_CALL_COUNT_90D, c.DAYS_SINCE_LAST_CALL
      FROM TEMP.JUSDAVIS.BKMNG_ONT_CONTACTS c
      WHERE c.IS_CHAMPION = TRUE
      ORDER BY c.DAYS_SINCE_LAST_CALL ASC

  - name: stalled_use_cases
    question: Which use cases are stalled?
    sql: >
      SELECT USE_CASE_NAME, ACCOUNT_NAME, STAGE, DAYS_IN_CURRENT_STAGE,
             STAGE_VELOCITY, MEDDPICC_OVERALL_SCORE, PRIMARY_CONTACT_NAME
      FROM TEMP.JUSDAVIS.BKMNG_ONT_USE_CASES
      WHERE STAGE_VELOCITY = 'slow'
      ORDER BY DAYS_IN_CURRENT_STAGE DESC

  - name: interaction_timeline
    question: Show me the interaction timeline for this account
    sql: >
      SELECT INTERACTION_DATE, TITLE, SUMMARY, TOPICS, CALL_SCORE,
             PARTICIPANT_EMAILS, DURATION_SEC
      FROM TEMP.JUSDAVIS.BKMNG_ONT_INTERACTIONS
      ORDER BY INTERACTION_DATE DESC
      LIMIT 20

  - name: capacity_at_risk
    question: Which accounts are approaching contract capacity?
    sql: >
      SELECT ACCOUNT_NAME, CONTRACT_UTILIZATION_PCT, TOTAL_CREDITS_ALLOCATED,
             CONSUMPTION_YTD, WOW_CREDITS_CHANGE, MOM_CREDITS_CHANGE
      FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS
      WHERE CONTRACT_UTILIZATION_PCT > 70
      ORDER BY CONTRACT_UTILIZATION_PCT DESC

  - name: topic_trends
    question: What topics are trending across my accounts?
    sql: >
      SELECT TOPIC, SUM(MENTION_COUNT_90D) AS total_mentions,
             COUNT(DISTINCT ACCOUNT_ID) AS account_count,
             MAX(LAST_MENTIONED_DATE) AS most_recent
      FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_TOPICS
      GROUP BY TOPIC
      ORDER BY total_mentions DESC
      LIMIT 15

  - name: silent_champions
    question: Which champions have gone silent?
    sql: >
      SELECT c.NAME, c.TITLE, c.ACCOUNT_NAME, c.DAYS_SINCE_LAST_CALL,
             c.LAST_GONG_CALL_DATE
      FROM TEMP.JUSDAVIS.BKMNG_ONT_CONTACTS c
      WHERE c.IS_CHAMPION = TRUE
        AND c.DAYS_SINCE_LAST_CALL > 30
      ORDER BY c.DAYS_SINCE_LAST_CALL DESC

  - name: expansion_candidates
    question: Which accounts show expansion signals?
    sql: >
      SELECT a.ACCOUNT_NAME, a.MOMENTUM, a.HEALTH_SCORE,
             a.WOW_CREDITS_CHANGE, a.ACTIVE_USE_CASE_COUNT,
             a.CONTRACT_UTILIZATION_PCT
      FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
      WHERE a.MOMENTUM IN ('accelerating', 'steady')
        AND a.WOW_CREDITS_CHANGE > 10
        AND a.ACTIVE_USE_CASE_COUNT >= 2
      ORDER BY a.HEALTH_SCORE DESC

  # Adoption verified queries — see platform-adoption-signals-plan.md for
  # recent_feature_adoptions, account_adoption_profile, accounts_missing_aiml,
  # feature_adoption_timeline (all 4 added to bookmanager_assistant.yaml)
```

---

## Enhanced Agent System Prompt

Replace `get_bookmanager_context()` with ontology-aware context assembly.

### Template

```
You are ACE, the AI assistant for BookManager — Snowflake's field engineering
engagement tracker.

USER: {email}
ROLE: {role} (Account Cloud Engineer / ACE Manager)

═══════════════════════════════════════════
BOOK OF BUSINESS HEALTH
═══════════════════════════════════════════
Accounts: {total} total
  Accelerating: {n}  |  Steady: {n}  |  Decelerating: {n}  |  Stalled: {n}
Active Signals: {signal_count} ({high_count} high priority)
Use Cases: {total_ucs} ({impl} implementation, {pursuit} in pursuit)
Upcoming Go-Lives (30d): {upcoming}

═══════════════════════════════════════════
TOP SIGNALS — ACT ON THESE
═══════════════════════════════════════════
1. [HIGH] Champion silent: Sarah Chen at Acme Corp hasn't been on a call in 28d.
   Use case "Real-Time Analytics" is in implementation, go-live Apr 30.
2. [HIGH] Consumption spike: BigCo +45% WoW. Contract at 82% utilization.
3. [MED] Stage stalled: "Data Vault Migration" at TechFirm — 42d in Scoping
   (portfolio median: 18d). Last call discussed data access blockers.
4. [MED] Competitor mentioned: Databricks came up 3x at MegaCorp in last 14d.
5. [MED] No call in 14d: StartupCo — last call was "Q4 Planning" on Mar 20.

{ACCOUNT_CONTEXT if viewing specific account}

═══════════════════════════════════════════
TOOLS & ROUTING
═══════════════════════════════════════════
• BookManager_Data_Assistant — Query your ontology: accounts, use cases,
  contacts, interactions, signals, topics, competitors. Use this for any
  question about YOUR data.
• Snowflake_Docs — Cortex Search over official Snowflake documentation
  (48K+ chunks). Use for product features, SQL syntax, setup guides,
  best practices, architecture questions.
• Raven Sales Tools — Internal sales knowledge, competitive positioning,
  pricing, sales plays. Use for go-to-market and competitive questions.
• [Future] Glean — Google Drive, Slack, Confluence search for account docs.

ROUTING GUIDANCE:
• Account data, use cases, MEDDPICC, contacts, interactions → BookManager
• "How do I configure X in Snowflake?" / product features / SQL syntax → Snowflake_Docs
• Competitive positioning, sales plays, pricing, internal knowledge → Raven
• Technical demo/build requests → suggest opening a Cortex Code session
  with the account context pre-loaded
• Email drafts → compose inline with full account + interaction context
  (use Snowflake_Docs to verify technical details before sending)
• Status updates → summarize from signals + recent interactions
```

### Account-Specific Context (when account_id is set)

```
═══════════════════════════════════════════
CURRENT ACCOUNT: {name}
═══════════════════════════════════════════
Industry: {industry}  |  Region: {region}  |  Momentum: {momentum}
Health Score: {health_score}/100  |  Engagement: {engagement_status}

CONTRACT & CONSUMPTION:
  Credits: {consumed}/{allocated} ({utilization}% utilized)
  WoW: {wow}%  |  MoM: {mom}%
  {predicted_overage if applicable}

KEY CONTACTS:
  - {name} ({title}, {role}) — last call: {date} ({days}d ago), {call_count} calls in 90d
  - {name} ({title}, {role}) — last call: {date} ({days}d ago), {call_count} calls in 90d

USE CASES ({count}):
  - {name} [{status}/{stage}] MEDDPICC:{score} — {velocity}
    Go-live: {date} ({days}d) | Lead: {lead_se}
    {risk if applicable}
  - ...

RECENT TOPICS: {topic1} ({n}x), {topic2} ({n}x), {competitor_name} mentioned ({n}x)

PLATFORM ADOPTION ({adoption_signal_count}/8 categories):
  Active: {adoption_profile}
  Missing: {missing_categories}
  {if new_adoption_30d: "NEW: Started using {feature_name} on {first_use_date}"}
  Recent feature adoptions (30d):
  {for each new feature: "- {feature_name} (first used: {date})"}

LAST 3 INTERACTIONS:
  - {date}: "{title}" — {summary_excerpt}
  - {date}: "{title}" — {summary_excerpt}
  - {date}: "{title}" — {summary_excerpt}

ACTIVE SIGNALS:
  - [{priority}] {signal_text}
  - ...
```

---

## Implementation Steps

### Phase 1: Ontology Entity Tables
> All tables created in TEMP.JUSDAVIS using SE_XS_WH or SNOWHOUSE warehouse

1. **Create `BKMNG_ONT_INTERACTIONS`** — Parse Gong JSON blobs, strip HTML, join to BKMNG_ACCOUNTS
2. **Create `BKMNG_ONT_CONTACTS`** — Join Contact + Use Case Contact Roles + Gong participant email matching
3. **Create `BKMNG_ONT_ACCOUNT_TOPICS`** — LATERAL FLATTEN on Gong topics JSON, aggregate by account
4. **Create `BKMNG_ONT_ACCOUNT_COMPETITORS`** — LATERAL FLATTEN on Gong trackers JSON, filter competitors
5. **Create `BKMNG_ONT_OPPORTUNITIES`** — Scoped opportunities with SE/PS comments
6. **Create `BKMNG_ONT_FEATURE_ADOPTION`** — Crosswalk Salesforce→Snowflake account IDs via `RELEVANT_SUBSCRIPTION_DAILY_RECORDS`, then `MIN(DS)` from `USAGE_TRACKING_SUMMARY` per account per curated feature. Combine with broad categories from `T_OD_SIGNAL_FIRST_DATES` and service types from `COMPUTE_SERVICE_ACCOUNT_USAGE`.
7. **Create `BKMNG_ONT_ACCOUNTS`** — Extended accounts with health_score, momentum, aggregated metrics. Join `T_OD_ACCOUNT_SIGNALS` for adoption flags (`SIG_PIPELINE` through `SIG_SPCS`), compute `ADOPTION_SIGNAL_COUNT`, `ADOPTION_PROFILE`, and `NEW_ADOPTION_30D` from `T_OD_SIGNAL_FIRST_DATES`.
8. **Create `BKMNG_ONT_USE_CASES`** — Extended use cases with stage velocity, team members, primary contact
9. **Create `BKMNG_ONT_ACCOUNT_SIGNALS`** — SQL-based signal computation via stored procedure (includes `new_feature_adoption` signal from `BKMNG_ONT_FEATURE_ADOPTION WHERE IS_NEW_30D = TRUE`)

### Phase 2: Refresh Tasks
10. **Create refresh stored procedures** for each ontology table (EXECUTE AS CALLER)
11. **Create Snowflake Tasks** with staggered CRON schedules:
    - ONT_INTERACTIONS + ONT_ACCOUNT_TOPICS + ONT_ACCOUNT_COMPETITORS: every 2h
    - ONT_ACCOUNTS: every 4h
    - ONT_USE_CASES: every 4h
    - ONT_CONTACTS + ONT_OPPORTUNITIES + ONT_FEATURE_ADOPTION: daily
    - ONT_ACCOUNT_SIGNALS: hourly
12. **Verify all tasks execute successfully** with sample data checks

### Phase 3: Enhanced Semantic Model
13. **Expand `bookmanager_assistant.yaml`** to include all 8 ontology tables (including `feature_adoption`) with full dimension/fact/time_dimension definitions
14. **Add 14+ verified queries** covering ontological traversals + adoption queries (see list above)
15. **Upload to stage**: `PUT file:///path/to/bookmanager_assistant.yaml @TEMP.JUSDAVIS.BKMNG_STAGE/ AUTO_COMPRESS=FALSE OVERWRITE=TRUE`

### Phase 4: Enhanced Agent Context
16. **Wire Snowflake Docs CKE as a Cortex Agent tool** in `agent.py`:
    - Add to `_RAVEN_TOOLS` list:
      ```python
      {"tool_spec": {"name": "Snowflake_Docs", "type": "cortex_search"}}
      ```
    - Add to `_RAVEN_TOOL_RESOURCES`:
      ```python
      "Snowflake_Docs": {
          "name": "CORTEX_KNOWLEDGE_EXTENSION_SNOWFLAKE_DOCUMENTATION.SHARED.CKE_SNOWFLAKE_DOCS_SERVICE",
          "id_column": "SOURCE_URL",
      }
      ```
    - This gives ACE the ability to search official Snowflake documentation to answer product/feature/syntax questions
17. **Rewrite `get_bookmanager_context()`** in `snowflake_service.py` to:
    - Query `BKMNG_ONT_ACCOUNTS` for momentum distribution + adoption profiles
    - Query `BKMNG_ONT_ACCOUNT_SIGNALS` for top signals with full context (including `new_feature_adoption`)
    - When account_id is set: query contacts, topics, competitors, recent interactions, and `BKMNG_ONT_FEATURE_ADOPTION` for adoption timeline + recent first-uses
    - Build the rich system prompt template above (including PLATFORM ADOPTION section)
18. **Update `agent.py`** tool routing guidance in system prompt

### Phase 5: Backend Refactoring
19. **Refactor `list_nba_items()`** to read from `BKMNG_ONT_ACCOUNT_SIGNALS` instead of computing in Python
20. **Refactor `list_gong_calls()`** to read from `BKMNG_ONT_INTERACTIONS`
21. **Add new API endpoints**: `/accounts/{id}/contacts`, `/accounts/{id}/topics`, `/accounts/{id}/timeline`, `/accounts/{id}/adoption`
22. **Update frontend** to use new endpoints (contacts sidebar, topics pills, timeline view, adoption profile card)

### Phase 6: Verification
23. **Signal parity check**: Compare old Python NBA signals vs. new SQL signals for 5 sample accounts
24. **Semantic model validation**: Run 14+ natural language queries through Cortex Analyst and verify SQL correctness
25. **Agent context check**: Generate system prompts for 3 sample accounts and verify contacts, topics, signals, adoption profiles are correct
26. **Verify Snowflake Docs tool**: Ask ACE "how do I set up a network policy?" and confirm it retrieves docs with SOURCE_URLs
27. **Verify adoption detection**: Confirm `BKMNG_ONT_FEATURE_ADOPTION` correctly identifies recent first-use dates for Dynamic Tables, Cortex Search, etc. across BKMNG accounts
28. **Refresh performance**: Verify all tasks complete within 5 minutes

---

## Task/Refresh Schedule Summary

| Table | Refresh | CRON (UTC) | Dependencies |
|-------|---------|------------|-------------|
| BKMNG_ACCOUNTS | 4h | `0 */4 * * *` | (existing) |
| BKMNG_USE_CASES | 4h | `5 */4 * * *` | (existing) |
| BKMNG_CONTRACT_REVENUE | 4h | `10 */4 * * *` | (existing) |
| BKMNG_CONSUMPTION_TRENDS | 4h | `15 */4 * * *` | (existing) |
| BKMNG_ONT_INTERACTIONS | 2h | `15 */2 * * *` | BKMNG_ACCOUNTS |
| BKMNG_ONT_ACCOUNT_TOPICS | 2h | `20 */2 * * *` | ONT_INTERACTIONS |
| BKMNG_ONT_ACCOUNT_COMPETITORS | 2h | `20 */2 * * *` | ONT_INTERACTIONS |
| BKMNG_ONT_CONTACTS | daily | `30 1 * * *` | BKMNG_ACCOUNTS |
| BKMNG_ONT_OPPORTUNITIES | daily | `45 1 * * *` | BKMNG_ACCOUNTS |
| BKMNG_ONT_FEATURE_ADOPTION | daily | `0 2 * * *` | BKMNG_ACCOUNTS, T_OD_SIGNAL_FIRST_DATES |
| BKMNG_ONT_ACCOUNTS | 4h | `25 */4 * * *` | All base tables, T_OD_ACCOUNT_SIGNALS |
| BKMNG_ONT_USE_CASES | 4h | `30 */4 * * *` | BKMNG_USE_CASES, ONT_CONTACTS |
| BKMNG_ONT_ACCOUNT_SIGNALS | 1h | `0 * * * *` | All ONT tables |

---

## Future Extensions (not in this iteration)

- **Glean integration**: Add as tool_resource to Cortex Agent for Google Drive / Slack / Confluence search
- **Cortex Code handoff**: When user requests a demo/build, dump account context to a session init file and open Cortex Code with it
- **SetSail data**: Once production email/meeting data is available, add to ONT_INTERACTIONS as additional interaction_types
- **Support cases**: Join `SNOWHOUSE.SUPPORT.CASES_DAILY` (47.9M rows) for support case signals — "account filed 3 P1 cases in last month" as a risk signal
- **Propensity scores**: Join `SALES.APS_ACCOUNT_PREDICTION_DAILY` for ML-based expansion propensity scoring
- **Maturity model**: Join `SALES.MATURITY_SCORE_PRED_ACCOUNT_LOG` (55-feature ML model) for close probability on opportunities
- **Expand curated feature list**: Add more features to `BKMNG_ONT_FEATURE_ADOPTION` as new Snowflake capabilities launch (e.g., Cortex Agents, Document AI, Hybrid Tables)
- **Cross-account patterns**: "Accounts like X that succeeded did Y" — requires portfolio-wide similarity scoring
- **Competitive knowledge base**: Wire `SALES.DEV.POC_SEARCH_SERVICE` (3,929 chunks of competitive intelligence) as an additional Cortex Search tool for battle card / competitive positioning questions
