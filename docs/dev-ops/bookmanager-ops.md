# BookManager Operations

> Project-specific operational rules. Read before any change that touches Snowflake, auth, or pipeline.
> For canonical live rules: [AGENTS.md](../../AGENTS.md).

## Snowflake Connection

| Field | Value |
|---|---|
| Connection | `SNOWHOUSE_AWS_US_WEST_2` |
| Account | `sfcogsops-snowhouse-aws-us-west-2` |
| User | `JUSDAVIS` |
| Role | `SALES_ENGINEER` |
| Warehouse | `SE_XS_WH` |
| DB / Schema | `TEMP / JUSDAVIS` |
| Credentials | `~/.snowflake/connections.toml` (mounted read-only into containers) |

For SPCS deploy: separate `bkmng_deploy` connection profile (PAT auth).

## Warehouse Rules

| Warehouse | Allowed |
|---|---|
| `SE_XS_WH` or `SNOWHOUSE` | DDL/DML (CREATE, INSERT, UPDATE, DELETE, MERGE) |
| `SNOWADHOC` | SELECT/DQL only — never DDL/DML |

## Auth Architecture (post-PR #3)

- **Single source of truth: `BKMNG_USERS` table in `TEMP.JUSDAVIS`**
- Both local mode and SPCS mode query the table via `_fetch_user_from_table()`
- **Never reintroduce `MOCK_USERS` dict** in `dependencies.py`
- Default user is env-driven: set `LOCAL_DEFAULT_USER_ID` in `backend/.env`
- The repo does not assume a specific contributor

## Privacy Rule (HIGH PRIORITY)

- **No real PII in tracked source.** No real names, emails, account IDs in fixtures or mocks.
- Use synthetic placeholders (`alice@example.com`, `Bob Smith`).
- The `pii-check` CI job blocks any PR that introduces internal company email domains (`snowflake.com`, `sfc.com`) outside the snowflake_service.py allowlist.
- The single allowlisted line is a SQL filter excluding internal users from customer-facing query results.

## Critical Snowflake Quirks

| Rule | Reason |
|---|---|
| `SNOWFLAKE.CORTEX.COMPLETE('model', prompt_string)` — string format only | Messages array format is NOT supported on this account |
| Use `ARRAY_TO_STRING(ARRAY_COMPACT(ARRAY_CONSTRUCT(...)))` not `CONCAT_WS` | `CONCAT_WS` returns NULL if any arg is NULL |
| SPs that read `SALES.RAVEN.*` views need `EXECUTE AS CALLER` | Owner-rights would fail RBAC |
| All SPs use `$$ ... $$` body delimiter | Not `AS '...'` |
| `TASK_HISTORY()` must be called as `TEMP.INFORMATION_SCHEMA.TASK_HISTORY()` | Max 7-day lookback |
| `SNOWFLAKE.CORTEX.SUMMARIZE()` can fail on long text | SP_REFRESH_BKMNG_USE_CASES truncates to 8000 chars |

## Type Hint Rule

- Host Python is 3.9. **Do NOT use `X | None`** unless `from __future__ import annotations` is at the top.
- Default to `Optional[X]` from `typing`.

## Data Pipeline Governance

### Health check protocol (MANDATORY)

Before AND after any pipeline change:
```sql
CALL TEMP.JUSDAVIS.SP_BKMNG_PIPELINE_HEALTH_CHECK();
```
Zero FAIL rows required. Any FAIL must be resolved before session ends.

### Source DDL location

`backend/sql/sp_pipeline_health_check.sql` and `snowflake/procedures/*.sql`. Tasks live in `snowflake/tasks/`.

### Inventory

For full task inventory + DAG: [snowflake/PIPELINE.md](../../snowflake/PIPELINE.md).
Live status: `make pipeline-status` runs `SP_BKMNG_PIPELINE_HEALTH_CHECK` + `SP_BKMNG_PIPELINE_INVENTORY`.

### On-demand tables (NOT task-scheduled)

These are populated by API calls, not tasks. Don't create tasks for them:

`BKMNG_MEETING_PREPS`, `BKMNG_USER_PREFERENCES`, `BKMNG_USER_ALERT_PREFERENCES`, `BKMNG_USER_ACCOUNT_TRACKING`, `BKMNG_MANUAL_MEETINGS`, `BKMNG_USER_CONTEXT`, `BKMNG_USER_CONTEXT_V2`, `BKMNG_ALERT_MUTES`, `BKMNG_EVAL_FRAMEWORK`, `BKMNG_USE_CASE_UPDATES`.

### Mandatory rules for pipeline changes

1. Before any DDL on a `BKMNG_` table or task: run health check, note baseline.
2. After adding a column to a source table: check downstream SPs that use `SELECT *` or `SELECT alias.*`. If the SP does positional INSERT (no explicit column list), the target table must be recreated with matching column order — `ALTER TABLE ADD COLUMN` appends at the end and breaks positional inserts.
3. Task child ordering: to suspend a graph, suspend children FIRST then root. To resume, resume children first, then suspend root briefly, then resume root. Snowflake requires root to be suspended to modify child state.
4. Ghost-started tasks: state=started but zero executions in `TASK_HISTORY()` → SUSPEND then RESUME.
5. Never `CREATE OR REPLACE` a task that is currently `started` without first suspending it and its children.
6. After any change: re-run health check, confirm zero FAIL rows.

## Feature Flags

- Registry parity required: `bkmng-next/lib/flags.ts` and `backend/app/feature_flags/registry.py` must have identical keys.
- `validate_flags.py` pre-commit hook enforces parity + Karpathy P2 (newly-added flags must `default_enabled: false`).
- New `*.tsx` files under `app/**/page.tsx` or `components/**/*.tsx` (not `components/ui/`) need `useFeatureFlag(...)` call OR `// @flag-exempt: <reason>` comment.
- Sync registry → Snowflake: `make sync-flags` (calls `scripts/sync_feature_flags.py`).
- Tables: `BKMNG_FEATURE_FLAGS`, `BKMNG_FEATURE_FLAG_OVERRIDES`.

## Key Tables (read-frequently)

| Table | What |
|---|---|
| `BKMNG_USERS` | 19 users; auth source of truth |
| `BKMNG_ACCOUNTS` | 571 accounts; refreshed every 4h |
| `BKMNG_ONT_ACCOUNTS` | Enriched account view; 8h max age |
| `BKMNG_ACCOUNT_SETTINGS` | Per-account user-set fields (coverage, dates, primary ACE) |
| `BKMNG_USE_CASES` | 1700+ use cases; refreshed every 4h |
| `BKMNG_USE_CASE_UPDATES` | AI-generated weekly updates (on-demand) |
| `BKMNG_FEATURE_FLAGS` + `_OVERRIDES` | Flag definitions + per-user/role overrides |

## Backend Service Layer

`backend/app/services/snowflake_service.py` — `SnowflakeDataService` class.
- `_cursor()` always returns `DictCursor` (rows are dicts keyed by uppercase column name).
- All Snowflake interaction goes through this service. Routers should not bypass it.
- Existing helpers: `list_accounts`, `get_account`, `update_account_fields`, `list_use_cases`, etc.

## Pre-Commit Hook

```yaml
# .pre-commit-config.yaml
- id: validate-feature-flags
  entry: python3 scripts/validate_flags.py
```

If your commit is blocked unrelated to your change (existing flag debt): use `--no-verify` for the WIP commit, fix the root cause in a follow-up.
