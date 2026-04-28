# ACE Intelligence Ontology — Deployment Plan

## Overview

Transform ACE from a flat-data LLM completion into an ontology-powered intelligence agent with materialized Snowflake tables, SQL-computed signals, and a rich system prompt.

### Total New Tables: **9**

| # | Table | Type | Refresh |
|---|-------|------|---------|
| 1 | `BKMNG_USER_CONTEXT` | Ad-hoc extensibility store | User-written (no task) |
| 2 | `BKMNG_ONT_INTERACTIONS` | Entity — Gong calls | Every 2h |
| 3 | `BKMNG_ONT_ACCOUNT_TOPICS` | Relationship — Gong topic aggregates | Every 2h |
| 4 | `BKMNG_ONT_ACCOUNT_COMPETITORS` | Relationship — Gong tracker aggregates | Every 2h |
| 5 | `BKMNG_ONT_CONTACTS` | Entity — Contacts + call engagement | Daily |
| 6 | `BKMNG_ONT_OPPORTUNITIES` | Entity — Scoped opportunities | Daily |
| 7 | `BKMNG_ONT_ACCOUNTS` | Entity — Extended accounts with health score | Every 4h |
| 8 | `BKMNG_ONT_USE_CASES` | Entity — Extended use cases with velocity | Every 4h |
| 9 | `BKMNG_ONT_ACCOUNT_SIGNALS` | Layer 3 — SQL-computed signals | Every 1h |

---

## Activation Scope Gate

**`BKMNG_ACCOUNTS` is the single source of truth for scope.** This table already filters to SE-Activation accounts only. Every ONT table `INNER JOIN`s to `BKMNG_ACCOUNTS` — non-activation accounts are automatically excluded from all ontology tables, signals, and the ACE system prompt.

Raven tools (Sales_Knowledge_Assistant, Sales_Data_Assistant, Use_Case_Explorer) handle non-activation accounts and broader portfolio intelligence. ACE's ontology layer is intentionally scoped to the activation book of business.

```
         ┌────────────────────────────┐
         │     BKMNG_ACCOUNTS         │
         │  (SE-Activation only gate) │
         └────────────┬───────────────┘
                      │ INNER JOIN (all 8 ONT tables)
         ┌────────────▼───────────────┐
         │   All BKMNG_ONT_* tables   │
         │   All BKMNG_USER_CONTEXT   │
         └────────────────────────────┘
```

---

## Step 0: BKMNG_USER_CONTEXT — The Extensibility Table

This is the **single ingestion point for all future data sources** — manual notes, Glean imports, email summaries, meeting prep, custom signals.

### Schema

```sql
CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_USER_CONTEXT (
    CONTEXT_ID      VARCHAR(255)   DEFAULT UUID_STRING(),
    ACCOUNT_ID      VARCHAR(255),   -- NULL = portfolio-level context
    ACCOUNT_NAME    VARCHAR(255),
    CONTEXT_TYPE    VARCHAR(100),   -- 'note' | 'email' | 'action_item' | 'meeting_prep' | future
    CONTENT         TEXT,           -- the user-provided content, freeform
    SOURCE          VARCHAR(100),   -- 'manual' | 'glean' (future) | 'email_import' (future)
    CREATED_BY      VARCHAR(255),   -- user email
    CREATED_AT      TIMESTAMP_TZ   DEFAULT CURRENT_TIMESTAMP(),
    IS_ACTIVE       BOOLEAN        DEFAULT TRUE
);
```

### Why this design is scalable

- **New data sources** (Glean docs, email threads, SetSail, external notes) write to this same table by setting `SOURCE` to their type. No schema changes needed.
- **Portfolio-level context** (`ACCOUNT_ID = NULL`) allows global notes like "Databricks is heavily discounting in Q2 — mention this everywhere".
- `IS_ACTIVE = FALSE` soft-deletes stale context without losing history.
- The `CONTENT` field is freeform text — the LLM reads it directly in the system prompt.

### Backend wiring

- `POST /accounts/{id}/context` — write a note for an account
- `POST /context` — write a portfolio-level note
- `GET /accounts/{id}/context` — list active context for an account
- `get_bookmanager_context()` queries this table and appends to the system prompt:

```
ACCOUNT NOTES & CONTEXT:
  - [2026-04-05, manual] Champion Sarah Chen is on maternity leave until June
  - [2026-04-01, manual] Renewal conversation begins Q3 — AE loop-in required
```

Portfolio-level context appears in every prompt regardless of account.

---

## Architecture

```
FIVETRAN.SALESFORCE sources                    TEMP.JUSDAVIS base tables
  GONG_GONG_CALL_C ─────────────────────────► ONT_INTERACTIONS
  GONG_GONG_CALL_C ─────────────────────────► ONT_ACCOUNT_TOPICS
  GONG_GONG_CALL_C ─────────────────────────► ONT_ACCOUNT_COMPETITORS
  CONTACT + USE_CASE_CONTACT_ROLE_C ─────────► ONT_CONTACTS
  OPPORTUNITY ───────────────────────────────► ONT_OPPORTUNITIES
  USE_CASE_HISTORY_C + USE_CASE_TEAM_C ──────► ONT_USE_CASES

TEMP.JUSDAVIS base tables
  BKMNG_ACCOUNTS ─────────────────────────────► ONT_ACCOUNTS (with health score)
  BKMNG_CONTRACT_REVENUE ─────────────────────► ONT_ACCOUNTS
  BKMNG_CONSUMPTION_TRENDS ───────────────────► ONT_ACCOUNTS
  ONT_INTERACTIONS + BKMNG_USE_CASES ─────────► ONT_ACCOUNTS

All ONT tables ─────────────────────────────────► ONT_ACCOUNT_SIGNALS (15 CTEs)

USER_CONTEXT + ONT_ACCOUNTS + ONT_ACCOUNT_SIGNALS + ONT_CONTACTS + ONT_INTERACTIONS
  └──────────────────────────────────────────────► get_bookmanager_context()
                                                         └─► ACE System Prompt
```

---

## Phase 1: Layer 2 Relationship Tables + Interactions (Step 1)

### `BKMNG_ONT_INTERACTIONS`

Source: `FIVETRAN.SALESFORCE.GONG_GONG_CALL_C` INNER JOIN `BKMNG_ACCOUNTS` on `GONG_PRIMARY_ACCOUNT_C = ACCOUNT_ID`.

Fields over existing `BKMNG_GONG_CALLS`:
- `TOPICS` — `LATERAL FLATTEN(TRY_PARSE_JSON(GONG_RELATED_TOPICS_JSON_C))` → `ARRAY_AGG(DISTINCT value:Name::STRING)` → comma-sep string
- `TRACKERS` — same from `GONG_RELATED_TRACKERS_JSON_C`
- `CALL_SCORE` — `GONG_CALL_SCORE_C`
- `TALK_RATIO_US` / `TALK_RATIO_THEM` — `GONG_TALK_TIME_US_C` / `_THEM_C`
- HTML-stripped SUMMARY, KEY_POINTS, NEXT_STEPS via `REGEXP_REPLACE(field, '<[^>]+>', '')`

### `BKMNG_ONT_ACCOUNT_TOPICS`

Per-account topic aggregates over last 90 days:

```sql
SELECT g.GONG_PRIMARY_ACCOUNT_C AS ACCOUNT_ID, a.ACCOUNT_NAME,
       t.value:Name::STRING AS TOPIC,
       COUNT(*) AS MENTION_COUNT_90D,
       MAX(g.GONG_CALL_START_C::DATE) AS LAST_MENTIONED_DATE,
       AVG(t.value:Gong__Topic_Duration_Sec__c::FLOAT) AS AVG_DURATION_SEC
FROM FIVETRAN.SALESFORCE.GONG_GONG_CALL_C g
INNER JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS a ON a.ACCOUNT_ID = g.GONG_PRIMARY_ACCOUNT_C
JOIN LATERAL FLATTEN(input => TRY_PARSE_JSON(g.GONG_RELATED_TOPICS_JSON_C)) t
WHERE g.GONG_CALL_START_C >= DATEADD('day', -90, CURRENT_TIMESTAMP())
  AND g.IS_DELETED = FALSE AND t.value:Name IS NOT NULL
GROUP BY 1, 2, 3
```

### `BKMNG_ONT_ACCOUNT_COMPETITORS`

Same pattern from `GONG_RELATED_TRACKERS_JSON_C` (all named trackers included — no hard filter):

```sql
FIELD: t.value:Gong__Tracker_Occurrences__c::FLOAT AS OCCURRENCE_COUNT
```

---

## Phase 2: Contacts + Opportunities (Step 2)

### `BKMNG_ONT_CONTACTS`

Joins:
- `FIVETRAN.SALESFORCE.CONTACT` — ID, ACCOUNT_ID, NAME, EMAIL, TITLE, DEPARTMENT
- `FIVETRAN.SALESFORCE.USE_CASE_CONTACT_ROLE_C` — ROLE_C, IS_PRIMARY_C, USE_CASE_C (confirmed: 19,821 rows)
- `BKMNG_GONG_CALLS` — participant email matching for call counts

Confirmed columns in USE_CASE_CONTACT_ROLE_C: `ROLE_C`, `CONTACT_C`, `IS_PRIMARY_C`, `USE_CASE_C`.

```sql
-- IS_CHAMPION derived:
(ucr.IS_PRIMARY_C = TRUE OR ucr.ROLE_C ILIKE '%champion%') AS IS_CHAMPION

-- ROLE_ON_ACCOUNT (across all use cases):
ARRAY_TO_STRING(ARRAY_AGG(DISTINCT ucr.ROLE_C), ', ') AS ROLE_ON_ACCOUNT

-- Gong participation (via BKMNG_GONG_CALLS):
COUNTIF(CONTAINS(LOWER(g.PARTICIPANTS), LOWER(c.EMAIL))) AS GONG_CALL_COUNT_90D
```

Scoped: `CONTACT.ACCOUNT_ID IN (SELECT ACCOUNT_ID FROM BKMNG_ACCOUNTS)`.

### `BKMNG_ONT_OPPORTUNITIES`

Source: `FIVETRAN.SALESFORCE.OPPORTUNITY` INNER JOIN `BKMNG_ACCOUNTS`. Confirmed 3,762 rows.

Fields: `OPP_ID, ACCOUNT_ID, ACCOUNT_NAME, NAME, STAGE_NAME, CLOSE_DATE, AMOUNT, SE_COMMENTS_C, PS_T_COMMENTS_C, DECISION_CRITERIA_C, IS_DELETED=FALSE`.

---

## Phase 3: Extended Accounts + Use Cases (Step 3)

### `BKMNG_ONT_ACCOUNTS`

CTE chain:
1. `contract_cte` — from `BKMNG_CONTRACT_REVENUE`: `TOTAL_CONSUMED_CREDITS / NULLIF(CONTRACT_CAPACITY, 0) * 100 AS CONTRACT_UTILIZATION_PCT`
2. `consumption_cte` — from `BKMNG_CONSUMPTION_TRENDS` (latest PERIOD_TYPE='WEEK'): `WOW_PCT_CHANGE, MOM_PCT_CHANGE`
3. `interaction_agg` — from `BKMNG_ONT_INTERACTIONS`: `COUNT 90d, MAX date, DATEDIFF`
4. `uc_agg` — from `BKMNG_USE_CASES`: `ACTIVE_USE_CASE_COUNT, IMPL_USE_CASE_COUNT, AVG_MEDDPICC`

**Health Score** (0–100):
```sql
ROUND(
  LEAST(100, GREATEST(0, COALESCE(WOW_PCT_CHANGE + 50, 50))) * 0.25 +  -- consumption
  COALESCE(IMPL_USE_CASE_COUNT * 20, 50)                        * 0.25 +  -- UC velocity (cap 5)
  CASE WHEN DAYS_SINCE_LAST_INTERACTION < 7  THEN 100           -- recency
       WHEN DAYS_SINCE_LAST_INTERACTION < 14 THEN 75
       WHEN DAYS_SINCE_LAST_INTERACTION < 30 THEN 40
       ELSE 10 END                                               * 0.25 +
  COALESCE(AVG_MEDDPICC * 10, 50)                               * 0.25   -- MEDDPICC
, 1) AS HEALTH_SCORE
```

**Momentum** (threshold-based):
```sql
CASE WHEN HEALTH_SCORE >= 70 THEN 'accelerating'
     WHEN HEALTH_SCORE >= 45 THEN 'steady'
     WHEN HEALTH_SCORE >= 25 THEN 'decelerating'
     ELSE 'stalled' END AS MOMENTUM
```

### `BKMNG_ONT_USE_CASES`

Extends `BKMNG_USE_CASES` with:
- `DAYS_IN_CURRENT_STAGE` — from `USE_CASE_HISTORY_C WHERE FIELD_C = 'Stage__c'`, DATEDIFF from latest change to today
- `STAGE_VELOCITY` — vs portfolio median: `CASE WHEN days > median*1.5 THEN 'slow' WHEN days < median*0.5 THEN 'fast' ELSE 'normal' END`
- `TEAM_MEMBERS` — `ARRAY_TO_STRING(ARRAY_AGG(DISTINCT email), ', ')` from `USE_CASE_TEAM_C`
- `PRIMARY_CONTACT_NAME/EMAIL` — from `BKMNG_ONT_CONTACTS WHERE IS_CHAMPION AND ACCOUNT_ID` matches

---

## Phase 4: Account Signals (Step 4)

### `SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS`

`EXECUTE AS CALLER`. TRUNCATE → INSERT from 15 CTE blocks.

| Signal | Priority | Trigger | Source Table |
|--------|----------|---------|-------------|
| `blocker` | high | UC status = 'Blocked' | ONT_USE_CASES |
| `at_risk` | medium | Account engagement_status = 'At Risk' | ONT_ACCOUNTS |
| `go_live_approaching` | medium | UC go-live ≤ 30d | ONT_USE_CASES |
| `open_tmr` | medium | TMR not closed | BKMNG_TMRS |
| `no_interaction_7d` | medium | No call in 7d | ONT_ACCOUNTS |
| `no_interaction_14d` | high | No call in 14d | ONT_ACCOUNTS |
| `consumption_spike` | high | WoW ≥ +30% | ONT_ACCOUNTS |
| `consumption_dip` | medium | WoW ≤ -20% | ONT_ACCOUNTS |
| `champion_silent` | high | Champion contact no call in 30d | ONT_CONTACTS |
| `stage_stalled` | medium | UC in stage > median * 1.5 days | ONT_USE_CASES |
| `competitor_mentioned` | medium | Tracker in call within 14d | ONT_ACCOUNT_COMPETITORS |
| `high_momentum` | low | Health ≥ 70 | ONT_ACCOUNTS |
| `capacity_warning` | high | Utilization > 80% | ONT_ACCOUNTS |
| `new_stakeholder` | low | New email not prev. seen | ONT_INTERACTIONS |
| `expansion_signal` | medium | New UC in 30d + consumption rising | ONT_USE_CASES + ONT_ACCOUNTS |

Signal schema: `SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT`.

---

## Phase 5: Refresh Tasks (Step 5)

All SPs created with `EXECUTE AS CALLER`. Staggered CRONs (UTC):

| Table | CRON |
|-------|------|
| `ONT_INTERACTIONS` | `15 */2 * * *` |
| `ONT_ACCOUNT_TOPICS` | `20 */2 * * *` |
| `ONT_ACCOUNT_COMPETITORS` | `20 */2 * * *` |
| `ONT_CONTACTS` | `30 1 * * *` |
| `ONT_OPPORTUNITIES` | `45 1 * * *` |
| `ONT_ACCOUNTS` | `25 */4 * * *` |
| `ONT_USE_CASES` | `30 */4 * * *` |
| `ONT_ACCOUNT_SIGNALS` | `0 * * * *` |

`BKMNG_USER_CONTEXT` has no refresh task — it is append-only, written by users and future integrations.

---

## Phase 6: Enhanced Agent Context (Step 6)

Rewrite `get_bookmanager_context()` in `backend/app/services/snowflake_service.py` to query the ONT tables. The new system prompt template:

```
BOOK OF BUSINESS HEALTH
  Accounts: {total} | Accelerating: {n} | Steady: {n} | Decelerating: {n} | Stalled: {n}
  Active Signals: {signal_count} ({high_count} high priority)
  Use Cases: {total} ({impl} impl, {pursuit} pursuit)
  Upcoming Go-Lives (30d): {n}

TOP SIGNALS — ACT ON THESE
  1. [HIGH] {signal_text} — {context}
  ... (up to 8)

{IF account_id}
CURRENT ACCOUNT: {name}
  Industry: {industry} | Region: {region} | Momentum: {momentum} | Health: {score}/100
  Credits: {consumed}/{allocated} ({pct}%) | WoW: {wow}% | MoM: {mom}%
  KEY CONTACTS: {name} ({title}) — last call {date} ({n}d ago)
  RECENT TOPICS: {topic1} ({n}x), {topic2} ({n}x)
  COMPETITORS MENTIONED: {competitor} ({n}x, last {date})
  LAST 3 INTERACTIONS: {date}: "{title}" — {summary_excerpt}
  ACTIVE SIGNALS: [{priority}] {signal_text}
{/IF}

{IF user_context_rows}
ACCOUNT NOTES & CONTEXT:
  - [{date}, {source}] {content}
{/IF}
```

System prompt contains **no tool references** (inference:complete has no tool calling).

---

## Phase 7: Backend Refactoring (Step 7)

1. **`list_nba_items()`** (~380 Python lines) → single SQL query against `BKMNG_ONT_ACCOUNT_SIGNALS` JOIN `BKMNG_ONT_ACCOUNTS`. Eliminates per-request `CORTEX.COMPLETE` batch call.
2. **`list_gong_calls()`** → reads from `BKMNG_ONT_INTERACTIONS` (richer: topics, call score, talk ratios).
3. **New endpoints**:
   - `POST /accounts/{id}/context` — write to `BKMNG_USER_CONTEXT`
   - `GET /accounts/{id}/context` — list active notes for account
   - `GET /accounts/{id}/contacts` — from `BKMNG_ONT_CONTACTS`
   - `GET /accounts/{id}/topics` — from `BKMNG_ONT_ACCOUNT_TOPICS`

---

## Phase 8: Semantic Model Expansion (Step 8)

Expand `bookmanager_assistant.yaml` to 7 tables (all ONT entity tables). **Deferred value** — `BookManager_Data_Assistant` Cortex Analyst tool is defined in `agent.py` but not wired since `agents:run` is unavailable. Doing this now prepares the YAML for when that changes.

After editing, upload: `PUT file:///.../bookmanager_assistant.yaml @TEMP.JUSDAVIS.BKMNG_STAGE/ AUTO_COMPRESS=FALSE OVERWRITE=TRUE`

---

## Phase 9: Verification (Step 9)

1. Row count checks — all 9 tables > 0 rows
2. Signal parity — compare `ONT_ACCOUNT_SIGNALS` vs. current Python NBA for 3 sample accounts
3. ACE chat test — "which of my accounts has highest consumption risk?" verifies named account responses with health/momentum data
4. User context test — add a note via `POST /accounts/{id}/context`, confirm it appears in ACE system prompt
5. API endpoint smoke tests — `/contacts`, `/topics`, `/context` all return data
6. Task run check — manually trigger all 8 TASK_ entries, confirm completion < 5 min each

---

## What Is Not in This Plan

- **Snowflake Docs CKE tool** — requires `cortex/agents:run` (not available on this account)
- **Frontend UI changes** for contacts/topics widgets — endpoints added (Step 7) but no React wiring
- **Glean integration** — future; will write to `BKMNG_USER_CONTEXT` with `SOURCE = 'glean'`
- **SetSail / email data** — future; same pattern into `BKMNG_USER_CONTEXT` or `ONT_INTERACTIONS`
- **Feature usage ontology** (`SNOWHOUSE.PRODUCT.USAGE_TRACKING_SUMMARY`) — future
