# BookManager — Agent Instructions

Read this file before planning or executing any task on this project.

## Privacy Rule (HIGH PRIORITY)

This repo must remain free of real PII in tracked source.

- Mock-user data lives in `BKMNG_USERS` (Snowflake table), not in code.
- Identity-specific config (default user, git author, etc.) lives in `backend/.env` (gitignored). The repo does not assume a specific contributor.
- The `pii-check` CI job blocks any PR that introduces internal company email domains (`snowflake.com`, `sfc.com`) outside the snowflake_service.py allowlist.
- Internal SQL schema names (`SALES.RAVEN.*`, `FIVETRAN.SALESFORCE.*`) are kept; they expose architecture but no data values.

## Working Conventions

This repo follows the conventions in [WORKFLOW.md](./WORKFLOW.md). Highlights:

- **No direct commits to main.** All changes go through a branch + PR.
- **Branch naming:** `feat/`, `fix/`, `chore/`, `refactor/`, `docs/`, `revert/` prefixes.
- **Commit messages:** imperative mood, present tense.
- **`git add`** with explicit paths only. Never `git add .` or `git add -A`.
- **Self-review** before merging. Read your own diff against Karpathy's 4 principles
  ([docs/dev-ops/coding-principles.md](docs/dev-ops/coding-principles.md)).
- **Parallel execution uses worktrees.** When running a SnowBoard ticket alongside other agents, use `$start-feature` in worktree mode (`../BookManager-<short-name>/`). Cleanup with `$finish-feature` after PR merge.
- **Agent context** is curated in [docs/dev-ops/](docs/dev-ops/) — single folder URL attached to every SnowBoard ticket as the one-line context source.

When in doubt, read [WORKFLOW.md](./WORKFLOW.md).

## Skill-Driven Workflow (AUTO-INVOKE)

Skills live at `~/.cortex/skills/` and contain project-specific processes. The agent MUST invoke the correct skill at each workflow phase — do NOT skip these even if the user doesn't explicitly mention them. Invoke with the `skill` tool using the skill name.

### Session start

**Always invoke `$start-day` first** when beginning a new working session. It syncs main, surfaces stale worktrees, lists PRs awaiting review, summarizes overnight merges, and primes SnowBoard triage.

### Planning phase

When the user describes work to be done (features, fixes, investigations):

1. Switch to plan mode and develop a concrete implementation plan.
2. If the plan results in **one focused change**: proceed to the Execution phase below.
3. If the plan results in **multiple independent changes**: decompose into SnowBoard tickets by invoking `$create-task` for each. Every ticket MUST use the `[Priority]` prefix and include the References footer. Then execute tickets in dependency order.

### Execution phase (per branch/PR)

For each unit of work (single ticket or single planned change):

1. **Invoke `$start-feature`** to scaffold the branch. Choose worktree mode if other agents are running in parallel.
2. Implement the change following [docs/dev-ops/coding-principles.md](docs/dev-ops/coding-principles.md) (Karpathy P1-P4).
3. Self-review against the 4 principles before pushing.
4. Push, open PR, wait for CI (5 gates: Backend ruff, Backend pytest, Frontend lint+tsc+build+vitest, PII Scan).
5. **For PRs >300 lines or auth/data-integrity changes**: invoke `$multi-review` before merging.
6. Merge via squash. Then invoke `$finish-feature` to clean up the worktree/branch.

### Ticket creation (anytime)

Whenever creating a SnowBoard ticket — whether decomposing a plan, logging tech debt found during implementation, or recording a follow-up — **always invoke `$create-task`**. This ensures the `[Priority]` prefix and References footer are applied consistently.

### Operational tasks

| Trigger | Skill to invoke |
|---|---|
| Starting local dev / Docker | `$local-dev` |
| Docker broken (lightningcss, stale volumes) | `$docker-reset` |
| Deploying to SPCS | `$deploy-spcs` |
| Checking pipeline health | `$pipeline-status` |
| Agent did something wrong / new convention | `$log-learning` |
| Cross-vendor review needed | `$cross-model-review` |

### Skill reference

All skills are installed at `~/.cortex/skills/`. Each has trigger words in its description for automatic activation, but the directives above take precedence — invoke proactively, don't wait for trigger-word matching.

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
- Default dev user: configured via `LOCAL_DEFAULT_USER_ID` env var (or first row in BKMNG_USERS)

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
- Git config: set your own; the repo does not assume a specific contributor
- Archived artifacts: `_archive/` — old `frontend/` (Vite), old `sql/`, `snowflake/analytics/`, `snowflake/views/`, old `bkmng-spec.yaml`, `nginx-spcs.conf`, and `docs/` plans live here. **Do not read or modify files under `_archive/`** — they are preserved for reference only and are excluded from Docker builds.

## Extended Context

For full operational details, known bugs, table schemas, SP details, and session history, see `/memories/bookmanager-ops.md` and `/memories/bookmanager_progress.md`.

## Continuous Improvement (Pattern 13)

When the agent does something the user finds wrong, useless, or surprising:

1. The user asks "why did you do that?"
2. The agent explains its reasoning
3. The user decides: was the reasoning wrong, or was the prompt missing context?
4. Update the relevant artifact:
   - **BookManager-specific quirk** → this file (AGENTS.md)
   - **Repeated behavior across many projects** → a skill in `~/.cortex/skills/`
   - **Common task that should be one keystroke** → `.cortex/commands/<name>.md`
   - **Daily-cadence rule** → [WORKFLOW.md](./WORKFLOW.md)
5. Verify on the next similar task: did the change land?

Examples that would trigger an AGENTS.md update:
- Agent uses `git add .` despite the explicit-paths convention → strengthen the Working Conventions reminder
- Agent skips a smoke test before opening a PR → add explicit reminder
- Agent reintroduces a hardcoded identity reference → already CI-enforced, but worth a note
- Agent splits a focused change into too many commits → update WORKFLOW.md commit-granularity guidance

The agent itself should suggest concrete edits when it notices it has been corrected on the same thing twice in a session.
