# BookManager — Alerts Catalog & Data Refresh Plan

## Part 1: Alerts Catalog

Alerts surface in two places:
1. **NBA (Next Best Action) widget** — dashboard, max 8 items, AI-summarized
2. **Account detail banner / badge** — persistent on the account page until dismissed

---

### Alert Categories

| # | Alert ID | Category | Trigger Condition | Priority | ACE | ACEM | Surface |
|---|----------|----------|-------------------|----------|-----|------|---------|
| 1 | `activation_review` | Activation | Open TMR + no Gong call AND no UC update in 7+ days | High | ✅ | ✅ | Banner + NBA |
| 2 | `capacity_warning` | Consumption | Credits consumed ≥ 80% of `TOTAL_CREDITS_ALLOCATED` | High | ✅ | ✅ | NBA + account badge |
| 3 | `predicted_overage` | Consumption | `PREDICTED_OVERAGE_DATE` within 30 days | High | ✅ | ✅ | NBA + account badge |
| 4 | `consumption_spike` | Consumption | WoW credits ≥ +30% | High | ✅ | ✅ | NBA _(already live)_ |
| 5 | `consumption_dip` | Consumption | WoW credits ≤ -20% | Medium | ✅ | ✅ | NBA _(already live)_ |
| 6 | `go_live_upcoming` | Go-Live | Go-live date within 30 days | Medium | ✅ | ✅ | NBA _(already live)_ |
| 7 | `go_live_overdue` | Go-Live | Go-live date has passed, use case not `Complete` | High | ✅ | ✅ | NBA + use case badge |
| 8 | `go_live_at_risk` | Go-Live | Go-live within 45 days AND (stage ≤ "3 - Technical Validation" OR MEDDPICC overall < 4) | High | ✅ | ✅ | NBA + use case badge |
| 9 | `blocker` | Use Case | Use case status = `Blocked` | High | ✅ | ✅ | NBA _(already live)_ |
| 10 | `stalled_implementation` | Use Case | Stage = "5 - Implementation In Progress" + no UC update in 30 days | Medium | ✅ | ✅ | NBA + use case badge |
| 11 | `meddpicc_weak` | Use Case | MEDDPICC overall score < 3 on an active, in-pursuit use case | Medium | ✅ | ✅ | Use case badge |
| 12 | `use_case_lost` | Use Case | Stage changed to "8 - Use Case Lost" (within last 7 days) | Low | ✅ | ✅ | NBA (awareness) |
| 13 | `at_risk_account` | Account Health | Account `status = 'At Risk'` | Medium | ✅ | ✅ | NBA _(already live)_ |
| 14 | `no_call` | Engagement | No Gong call in 7 days on active account | Medium | ✅ | ✅ | NBA _(already live)_ |
| 15 | `open_tmr` | TMR | TMR with open status assigned to user | Medium | ✅ | ✅ | NBA _(already live)_ |
| 16 | `tmr_pending_review` | TMR | TMR in `Pending Manager Review` or `Pending Specialist Manager Review` | High | ❌ | ✅ | ACEM dashboard widget |
| 17 | `tmr_new_assigned` | TMR | New TMR (`status = 'New'`) where user is `ASSIGNED_RESOURCE_ID` | High | ✅ | ❌ | NBA |
| 18 | `team_no_call` | Team (ACEM) | Any ACE on team has an account with no call in 14 days | Low | ❌ | ✅ | ACEM dashboard widget |
| 19 | `team_stalled_uc` | Team (ACEM) | ≥ 2 stalled implementations (`stalled_implementation`) across team | Medium | ❌ | ✅ | ACEM dashboard widget |
| 20 | `gong_action` | Engagement | Gong call has next-step action items that are > 3 days old | Medium | ✅ | ✅ | NBA |

---

### Alert Detail Specs

#### `activation_review` _(pending plan execution)_
```
Trigger: has_open_tmr = TRUE
         AND last_gong_call > 7 days ago (or never)
         AND last_uc_modified > 7 days ago
         AND not dismissed in BKMNG_ACTIVATION_REVIEWS
User action: Mark as Active / Paused / Complete
Dismissal: Stored in BKMNG_ACTIVATION_REVIEWS; re-triggers on next inactivity window
Data needed: BKMNG_ACTIVATION_REVIEWS (new table — in pending plan)
```

#### `capacity_warning`
```
Trigger: BKMNG_CONTRACT_REVENUE.TOTAL_CONSUMED_CREDITS / TOTAL_CREDITS_ALLOCATED >= 0.8
         (only when TOTAL_CREDITS_ALLOCATED IS NOT NULL)
Priority escalation: >= 0.95 → high; >= 0.80 → medium
Data needed: BKMNG_CONTRACT_REVENUE (currently suspended — needs fix)
```

#### `predicted_overage`
```
Trigger: BKMNG_CONTRACT_REVENUE.PREDICTED_OVERAGE_DATE IS NOT NULL
         AND PREDICTED_OVERAGE_DATE <= DATEADD('day', 30, CURRENT_DATE())
Data needed: BKMNG_CONTRACT_REVENUE (currently suspended — needs fix)
```

#### `go_live_overdue`
```
Trigger: USE_CASE.go_live_date < CURRENT_DATE() AND status NOT IN ('Complete', 'Not In Pursuit')
Priority: High
```

#### `go_live_at_risk`
```
Trigger: days_to_go_live BETWEEN 0 AND 45
         AND (stage IN ('2 - Scoping', '3 - Technical / Business Validation')
              OR meddpicc_overall_score < 4)
Priority: High
```

#### `stalled_implementation`
```
Trigger: stage = '5 - Implementation In Progress'
         AND LAST_MODIFIED_DATE < DATEADD('day', -30, CURRENT_DATE())
Data: BKMNG_USE_CASES.LAST_MODIFIED_DATE (100% coverage, reliable proxy)
```

#### `meddpicc_weak`
```
Trigger: status = 'In Pursuit'
         AND meddpicc_overall_score IS NOT NULL
         AND meddpicc_overall_score < 3
Surface: Small red dot on use case card; not in NBA (too noisy)
```

#### `tmr_pending_review` _(ACEM only)_
```
Trigger: TMR.status IN ('Pending Manager Review', 'Pending Specialist Manager Review')
         AND TMR account scoped to ACEM's team
Surface: Dedicated "Pending Approvals" section in ACEM dashboard (separate from NBA)
Count: Show count badge on TMRs nav link
```

#### `tmr_new_assigned` _(ACE only)_
```
Trigger: TMR.status = 'New'
         AND ASSIGNED_RESOURCE_ID matches user's Salesforce User ID
         AND created within last 3 days
Priority: High
```

#### `gong_action`
```
Trigger: Gong call has next_steps items AND call_date < DATEADD('day', -3, CURRENT_DATE())
Priority: Medium
Data: BKMNG_GONG_CALLS (materialized — see refresh plan below)
```

#### `team_no_call` _(ACEM only)_
```
Trigger: Any ACE on team has >= 1 active account with no Gong call in 14 days
Surface: "Coverage Gaps" section in ACEM dashboard; not in NBA
```

---

### NBA Signal Priority & Cap

Current cap: 8 items. Suggested priority ordering:

```
1. go_live_overdue       (high)
2. activation_review     (high)
3. predicted_overage     (high)
4. capacity_warning      (high)
5. consumption_spike     (high)
6. go_live_at_risk       (high)
7. tmr_new_assigned      (high)
8. blocker               (high)
9. at_risk_account       (medium)
10. stalled_implementation (medium)
11. go_live_upcoming     (medium)
12. open_tmr             (medium)
13. consumption_dip      (medium)
14. no_call              (medium)
15. gong_action          (medium)
16. use_case_lost        (low)
```

Increase cap to **10** for ACEM (broader book view). For ACE keep at 8.

---

## Part 2: Data Refresh Plan

### Current State

| Table | Task | Schedule | Status |
|-------|------|----------|--------|
| `BKMNG_ACCOUNTS` | `TASK_REFRESH_BKMNG_ACCOUNTS` | `CRON 0 */4` (every 4h) | ✅ Running |
| `BKMNG_USE_CASES` | `TASK_REFRESH_BKMNG_USE_CASES` | `CRON 5 */4` (every 4h) | ✅ Running |
| `BKMNG_ACEM_TEAM` | `TASK_REFRESH_BKMNG_ACEM_TEAM` | `CRON 2 */4` (every 4h) | ✅ Running |
| `BKMNG_CONTRACT_REVENUE` | `TASK_REFRESH_BKMNG_CONTRACT_REVENUE` | `CRON 10 */4` (every 4h) | ⚠️ **SUSPENDED** |
| `BKMNG_CONSUMPTION_TRENDS` | `TASK_REFRESH_BKMNG_CONSUMPTION_TRENDS` | `CRON 15 */4` (every 4h) | ⚠️ **SUSPENDED** |
| Gong calls | _live query_ | Real-time | N/A — expensive |
| TMR data | _live query_ | Real-time | N/A — expensive |
| NBA signals | _computed on request_ | Per API call | Expensive (Cortex COMPLETE) |

**Immediate fix needed**: Both contract revenue and consumption trends tasks are suspended due to errors and need to be diagnosed and re-started.

---

### Recommended Refresh Schedule

| Table | New Schedule | Rationale | Priority |
|-------|-------------|-----------|----------|
| `BKMNG_ACCOUNTS` | `CRON 0 * * * *` **(hourly)** | Account status, engagement, ACV changes are user-facing and drive alerts | Medium |
| `BKMNG_USE_CASES` | `CRON 5 * * * *` **(hourly)** | PS notes, MEDDPICC scores, stage changes are core to all signals | **High** |
| `BKMNG_ACEM_TEAM` | `CRON 0 6 * * *` **(daily 6am UTC)** | Manager relationships change infrequently | Low |
| `BKMNG_CONTRACT_REVENUE` | `CRON 0 2 * * *` **(daily 2am UTC)** | Billing-cycle data; doesn't change hour-to-hour | Medium (fix first) |
| `BKMNG_CONSUMPTION_TRENDS` | `CRON 30 2 * * *` **(daily 2:30am UTC)** | Weekly/monthly trend data; daily refresh is sufficient | Medium (fix first) |
| `BKMNG_GONG_CALLS` _(new)_ | `CRON 0 */2 * * *` **(every 2h)** | Materialize from `FIVETRAN.SALESFORCE.GONG_GONG_CALL_C`; removes live query overhead | **High** |
| `BKMNG_TMRS` _(materialize)_ | `CRON 30 * * * *` **(every 30min)** | TMR status changes are time-sensitive for ACE alerts | **High** |
| `BKMNG_NBA_CACHE` _(new)_ | `CRON 10 * * * *` **(hourly, after UC refresh)** | Pre-compute NBA signals + Cortex COMPLETE summaries per user | Medium |

---

### New Tables to Materialize

#### `BKMNG_GONG_CALLS`
Currently a live query on every account detail load. Fields:
```sql
CREATE TABLE IF NOT EXISTS TEMP.JUSDAVIS.BKMNG_GONG_CALLS (
  CALL_ID        VARCHAR,
  ACCOUNT_ID     VARCHAR,
  ACCOUNT_NAME   VARCHAR,
  TITLE          VARCHAR,
  CALL_DATE      TIMESTAMP_NTZ,
  DURATION_MINS  NUMBER,
  TOPICS         VARCHAR,
  NEXT_STEPS     VARCHAR,
  RECORDING_URL  VARCHAR,
  PARTICIPANTS   VARCHAR,
  REFRESHED_AT   TIMESTAMP_NTZ
);
```

#### `BKMNG_TMRS` (upgrade from 0-row stub)
Currently live query every page load. Materialize:
```sql
CREATE TABLE IF NOT EXISTS TEMP.JUSDAVIS.BKMNG_TMRS (
  TMR_ID                     VARCHAR,
  ACCOUNT_ID                 VARCHAR,
  ACCOUNT_NAME               VARCHAR,
  STATUS                     VARCHAR,
  SPECIALIST_TYPE            VARCHAR,
  ACTIVITY_REQUESTED         VARCHAR,
  ENGAGEMENT_TYPE            VARCHAR,
  REQUESTOR                  VARCHAR,
  REQUESTED_DATE             TIMESTAMP_NTZ,
  ASSIGNED_RESOURCE_ID       VARCHAR,
  ASSIGNED_RESOURCE_EMAIL    VARCHAR,  -- resolved via USER join
  SECONDARY_MEMBER_ID        VARCHAR,
  SECONDARY_MEMBER_EMAIL     VARCHAR,  -- resolved via USER join
  SPECIALIST_COMMENTS        VARCHAR,
  REQUEST_REASON             VARCHAR,
  REFRESHED_AT               TIMESTAMP_NTZ
);
```

#### `BKMNG_ACTIVATION_REVIEWS` _(pending plan execution)_
```sql
CREATE TABLE IF NOT EXISTS TEMP.JUSDAVIS.BKMNG_ACTIVATION_REVIEWS (
  ACCOUNT_ID   VARCHAR NOT NULL,
  USER_EMAIL   VARCHAR NOT NULL,
  STATUS       VARCHAR NOT NULL,  -- 'active' | 'paused' | 'complete'
  UPDATED_AT   TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (ACCOUNT_ID, USER_EMAIL)
);
```

---

### Task Dependency Chain (Updated)

```
:00  TASK_REFRESH_BKMNG_ACCOUNTS        (hourly)
:05  TASK_REFRESH_BKMNG_USE_CASES       (hourly, after accounts)
:10  TASK_REFRESH_BKMNG_NBA_CACHE       (hourly, after use cases)
:30  TASK_REFRESH_BKMNG_TMRS            (every 30min)

:00  TASK_REFRESH_BKMNG_GONG_CALLS      (every 2h)

:00  06:00 UTC  TASK_REFRESH_BKMNG_ACEM_TEAM       (daily)
:00  02:00 UTC  TASK_REFRESH_BKMNG_CONTRACT_REVENUE (daily — fix suspended task)
:30  02:30 UTC  TASK_REFRESH_BKMNG_CONSUMPTION_TRENDS (daily — fix suspended task)
```

---

### Immediate Action Items

1. **Fix suspended tasks** — Diagnose and resume `TASK_REFRESH_BKMNG_CONTRACT_REVENUE` and `TASK_REFRESH_BKMNG_CONSUMPTION_TRENDS`; these are blocking `capacity_warning` and `predicted_overage` alerts
2. **Materialize Gong** — Create `BKMNG_GONG_CALLS` table + refresh task; this unblocks `gong_action` alert and improves account detail load time
3. **Materialize TMRs** — Upgrade `BKMNG_TMRS` from stub to real data; this enables reliable `tmr_new_assigned` and `tmr_pending_review` alerts
4. **Change accounts + use cases to hourly** — Higher resolution = faster alert surface; use cases drive most signals
5. **BKMNG_ACTIVATION_REVIEWS** — Create table (part of pending TMR/activation plan)

---

### Signal → Data Dependency Map

| Alert | Data Sources Required |
|-------|-----------------------|
| `activation_review` | BKMNG_USE_CASES, BKMNG_GONG_CALLS, BKMNG_TMRS, BKMNG_ACTIVATION_REVIEWS |
| `capacity_warning` | BKMNG_CONTRACT_REVENUE ⚠️ suspended |
| `predicted_overage` | BKMNG_CONTRACT_REVENUE ⚠️ suspended |
| `consumption_spike` / `dip` | BKMNG_CONSUMPTION_TRENDS ⚠️ suspended |
| `go_live_overdue` / `at_risk` | BKMNG_USE_CASES |
| `stalled_implementation` | BKMNG_USE_CASES |
| `meddpicc_weak` | BKMNG_USE_CASES |
| `tmr_pending_review` | BKMNG_TMRS (needs materialization) |
| `tmr_new_assigned` | BKMNG_TMRS (needs materialization) |
| `gong_action` | BKMNG_GONG_CALLS (needs materialization) |
| `team_no_call` | BKMNG_GONG_CALLS + BKMNG_ACCOUNTS + BKMNG_ACEM_TEAM |
