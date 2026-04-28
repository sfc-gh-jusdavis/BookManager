# BookManager — Agent Instructions

Read this file before planning or executing any task on this project.

## Architecture

- **Frontend**: Next.js 16 (App Router) — `bkmng-next/`, port 3001
- **Backend**: FastAPI (Python 3.11) — `backend/`, port 8000
- **Database**: Snowflake `TEMP.JUSDAVIS` via connection `SNOWHOUSE_AWS_US_WEST_2`
- **SPCS Service**: `BOOKMANAGER.DEMO.BKMNG_SERVICE` on JDAVIS_AWS1
- **URL**: https://ar7vvu-sfsenorthamerica-jdavis-aws1.snowflakecomputing.app

## Local Development

Local dev uses Docker Compose with hot-reload. No SPCS push is needed during development.

```bash
make up-detach       # start in background (hot-reload on both services)
make logs            # follow logs
make down            # stop
make clean           # full reset (wipes volumes — use if node_modules stale)
```

Frontend: http://localhost:3001 | Backend: http://localhost:8000

## SPCS Deployment

Only push to SPCS when a batch of changes is ready:

```bash
make test-spcs-build   # verify SPCS image builds locally (no push)
make deploy            # build + push + ALTER SERVICE (one command)
```

## Critical Rules

- **DO NOT overwrite `start.sh`** — it is the SPCS container entrypoint, not a local dev script. `dev-start.sh` is the local equivalent.
- **DO NOT delete `bkmng-next/.dockerignore`** — it prevents host macOS `node_modules` from entering the Linux container. Without it, lightningcss crashes.
- **DO NOT use Turbopack** — `bkmng-next/package.json` dev script must use `next dev --webpack`. Turbopack cannot resolve native `.node` binaries in PostCSS.
- **DO NOT use `X | None` type hints** — host Python is 3.9. Use `Optional[X]` or `from __future__ import annotations`.
- **DO NOT use SNOWADHOC warehouse** for DDL/DML — use `SE_XS_WH` or `SNOWHOUSE`.
- **DO NOT write to Snowhouse outside `TEMP.JUSDAVIS`** — all other schemas are read-only.
- **CORTEX.COMPLETE must use string format**: `SNOWFLAKE.CORTEX.COMPLETE('model', prompt_string)` — messages array format is NOT supported on this account.
- **Snowflake CONCAT_WS returns NULL if any arg is NULL** — use `ARRAY_TO_STRING(ARRAY_COMPACT(ARRAY_CONSTRUCT(...)))` instead.
- **SPs that access `SALES.RAVEN` views must use `EXECUTE AS CALLER`**.
- **All SPs use `$$` delimiter** (not `AS '...'`).

## Docker Troubleshooting

| Symptom | Fix |
|---------|-----|
| `sh: next: not found` (exit 127) | `make clean && make up` (stale volume) |
| `lightningcss.linux-arm64-musl.node` error | Ensure `.dockerignore` exists; use `--webpack` not Turbopack |
| `ECONNREFUSED ::1:8000` (no data) | Check `INTERNAL_API_URL=http://backend:8000` in compose |
| `externalbrowser` hang in Docker | `backend/.env` PAT auth must take precedence over root `.env` |
| `.env` changes not picked up | `docker compose up --force-recreate backend` |
| `Object does not exist` errors | Ensure `.env` has `SNOWFLAKE_DATABASE=TEMP` and `SNOWFLAKE_SCHEMA=JUSDAVIS` |

## Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Local dev services (backend + frontend with hot-reload) |
| `Dockerfile.spcs` | SPCS production multi-stage build |
| `bkmng-spec-demo.yaml` | SPCS service specification |
| `start.sh` | SPCS container CMD (DO NOT overwrite) |
| `dev-start.sh` | Local dev startup (opens Docker Desktop if needed) |
| `Makefile` | All dev/deploy commands |
| `backend/app/services/snowflake_service.py` | All Snowflake queries |
| `bkmng-next/hooks/useApi.ts` | All TanStack Query hooks + TypeScript types |
| `bkmng-next/next.config.ts` | API proxy rewrites |

## Snowflake Connection

- Connection: `SNOWHOUSE_AWS_US_WEST_2`
- Account: `sfcogsops-snowhouse-aws-us-west-2`
- User: `JUSDAVIS` / Role: `SALES_ENGINEER` / WH: `SE_XS_WH`
- DB: `TEMP` / Schema: `JUSDAVIS`
- Credentials: `~/.snowflake/connections.toml` (mounted read-only into backend container)

## Auth

- Local dev: `X-Mock-User: <username>` header (always accepted)
- SPCS: PAT-based auth via `SNOWFLAKE_PAT` env var (secret: `BKMNG_SNOWHOUSE_PAT`)
- User table: `BKMNG_USERS` (19 users), read by `/auth/users` endpoint
- Default dev user: `jusdavis` (ACE role, admin)

## Data Pipeline Governance

### Health Check (MANDATORY)
Before AND after any pipeline change, run:
```sql
CALL TEMP.JUSDAVIS.SP_BKMNG_PIPELINE_HEALTH_CHECK();
```
Zero FAIL rows required. Any FAIL must be resolved before session ends.
Source: `backend/sql/sp_pipeline_health_check.sql`

### Task Registry
All tasks live in `TEMP.JUSDAVIS`. Warehouse: `SE_XS_WH`.

| Task | Schedule (UTC) | SP / Inline | Predecessors |
|------|---------------|-------------|--------------|
| TASK_REFRESH_BKMNG_ACCOUNTS | `0 */4 * * *` | inline | — |
| TASK_REFRESH_BKMNG_ACEM_TEAM | `2 */4 * * *` | inline | — |
| TASK_REFRESH_BKMNG_USE_CASES | `5 */4 * * *` | inline | — |
| TASK_PARSE_BKMNG_USE_CASE_NOTES | after predecessor | SP_PARSE_BKMNG_USE_CASE_NOTES | USE_CASES |
| TASK_COMPUTE_USE_CASE_BREAKDOWNS | after predecessor | SP_COMPUTE_USE_CASE_BREAKDOWNS | USE_CASES |
| TASK_REFRESH_BKMNG_UNIFIED_MEETINGS | `0 */2 * * *` | SP_REFRESH_BKMNG_UNIFIED_MEETINGS | — |
| TASK_REFRESH_BKMNG_TMRS | `30 * * * *` | inline | — |
| TASK_REFRESH_BKMNG_SUPPORT_TICKETS | `45 * * * *` | SP_REFRESH_BKMNG_SUPPORT_TICKETS | — |
| TASK_COMPUTE_SUPPORT_SIGNALS | `50 * * * *` | SP_COMPUTE_SUPPORT_SIGNALS | — |
| TASK_REFRESH_BKMNG_A360_CONTRACT | `0 4 * * *` | SP_REFRESH_BKMNG_A360_CONTRACT | — |
| TASK_REFRESH_BKMNG_A360_CONSUMPTION | `15 4 * * *` | SP_REFRESH_BKMNG_A360_CONSUMPTION | — |
| TASK_REFRESH_BKMNG_A360_PRODUCT_ADOPTION | `30 4 * * *` | SP_REFRESH_BKMNG_A360_PRODUCT_ADOPTION | — |
| TASK_REFRESH_BKMNG_EMAIL_ACTIVITY | `0 2 * * *` | SP_REFRESH_BKMNG_EMAIL_ACTIVITY | — |
| TASK_REFRESH_BKMNG_ONT_INTERACTIONS | `15 */2 * * *` | SP_REFRESH_BKMNG_ONT_INTERACTIONS | — |
| TASK_REFRESH_BKMNG_ONT_ACCOUNT_TOPICS | `20 */2 * * *` | SP_REFRESH_BKMNG_ONT_ACCOUNT_TOPICS | — |
| TASK_REFRESH_BKMNG_ONT_ACCOUNT_COMPETITORS | `20 */2 * * *` | SP_REFRESH_BKMNG_ONT_ACCOUNT_COMPETITORS | — |
| TASK_REFRESH_BKMNG_ONT_ACCOUNTS | `25 */4 * * *` | SP_REFRESH_BKMNG_ONT_ACCOUNTS | — |
| TASK_REFRESH_BKMNG_ONT_USE_CASES | `30 */4 * * *` | SP_REFRESH_BKMNG_ONT_USE_CASES | — |
| TASK_REFRESH_BKMNG_ONT_CONTACTS | `30 1 * * *` | SP_REFRESH_BKMNG_ONT_CONTACTS | — |
| TASK_REFRESH_BKMNG_ONT_OPPORTUNITIES | `45 1 * * *` | SP_REFRESH_BKMNG_ONT_OPPORTUNITIES | — |
| TASK_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS | `0 * * * *` | SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS | — |
| TASK_COMPUTE_COMPOSITE_PATTERNS | after predecessor | SP_COMPUTE_COMPOSITE_PATTERNS | ONT_ACCOUNT_SIGNALS |
| TASK_REFRESH_BKMNG_USER_ALERTS | after predecessor | SP_REFRESH_BKMNG_USER_ALERTS | ONT_ACCOUNT_SIGNALS |
| TASK_COMPUTE_AI_ASSESSMENTS | `0 6 * * *` | SP_COMPUTE_AI_ASSESSMENTS | — |
| TASK_COMPUTE_ACCOUNT_BRIEFINGS | `0 6 * * *` | SP_COMPUTE_ACCOUNT_BRIEFINGS | — |
| TASK_COMPUTE_MEETING_PREPS | `0 7 * * *` | SP_COMPUTE_MEETING_PREPS | after ACCOUNT_BRIEFINGS |
| TASK_CHECK_MEETING_REMINDERS | `0 * * * *` | SP_CHECK_MEETING_REMINDERS | — |
| TASK_CHECK_STALE_USE_CASES | `0 8 * * *` | SP_CHECK_STALE_USE_CASES | — |

### On-Demand Tables (NOT task-scheduled)
These are populated by API calls, not tasks. Do not create tasks for them:
`BKMNG_ACCOUNT_BRIEFINGS`, `BKMNG_MEETING_PREPS`, `BKMNG_USER_PREFERENCES`,
`BKMNG_USER_ALERT_PREFERENCES`, `BKMNG_USER_ACCOUNT_TRACKING`, `BKMNG_MANUAL_MEETINGS`,
`BKMNG_USER_CONTEXT`, `BKMNG_USER_CONTEXT_V2`, `BKMNG_ALERT_MUTES`, `BKMNG_EVAL_FRAMEWORK`.

### Mandatory Rules for Pipeline Changes
1. **Before any DDL** on a BKMNG_ table or task: run health check, note baseline.
2. **After adding a column** to a source table: check all downstream SPs that use `SELECT *` or `SELECT alias.*`. If the SP does positional INSERT (no explicit column list), the target table must be recreated with matching column order — ALTER TABLE ADD COLUMN appends at the end and breaks positional inserts.
3. **Task child ordering**: To suspend a task graph, suspend children FIRST, then root. To resume, resume children first, then suspend root briefly, then resume root. Snowflake requires root to be suspended to modify child state.
4. **Ghost-started tasks**: If a task shows `state = started` but has zero executions in `TASK_HISTORY()`, it is ghost-started. Fix: SUSPEND then RESUME.
5. **Never CREATE OR REPLACE a task** that is currently `started` without first suspending it and its children.
6. **After any change**: run health check again, confirm zero FAIL rows.

### Known Gotchas
- `TASK_HISTORY()` must be called as `TEMP.INFORMATION_SCHEMA.TASK_HISTORY()` — max 7-day lookback.
- `CORTEX.COMPLETE` only supports string format on this account (no messages array).
- SPs accessing `SALES.RAVEN` views require `EXECUTE AS CALLER`.
- `SNOWFLAKE.CORTEX.SUMMARIZE()` can fail on very long text — SP_REFRESH_BKMNG_USE_CASES truncates to 8000 chars.
- Snowflake `CONCAT_WS` returns NULL if any arg is NULL — use `ARRAY_TO_STRING(ARRAY_COMPACT(ARRAY_CONSTRUCT(...)))` instead.

## SPCS Network Rules

SPCS containers are network-isolated. The service has an External Access Integration:

- Network Rule: `BOOKMANAGER.DEMO.BKMNG_SNOWHOUSE_RULE` (HOST_PORT EGRESS :443)
- Hosts: `sfcogsops-snowhouse-aws-us-west-2.snowflakecomputing.com:443`, `sfc-ds2-customer-stage.s3.us-west-2.amazonaws.com:443`
- EAI: `BKMNG_SNOWHOUSE_EAI` — attached via `ALTER SERVICE ... SET EXTERNAL_ACCESS_INTEGRATIONS = (BKMNG_SNOWHOUSE_EAI);`
- After updating network rules: must SUSPEND + RESUME the service
- The S3 host is required for large query result sets (fetched via presigned URL)

## GitHub Repository

- Remote: `https://github.com/sfc-gh-jusdavis/BookManager` (private)
- Branch strategy: trunk-based, `main` is always deployable
- Git config: `redacted@example.com` / `Justin Davis`
- Archived artifacts: `_archive/` — old `frontend/` (Vite), old `sql/`, `snowflake/analytics/`, `snowflake/views/`, old `bkmng-spec.yaml`, `nginx-spcs.conf`, and `docs/` plans live here. **Do not read or modify files under `_archive/`** — they are preserved for reference only and are excluded from Docker builds.

## Extended Context

For full operational details, known bugs, table schemas, SP details, and session history, see `/memories/bookmanager-ops.md` and `/memories/bookmanager_progress.md`.
