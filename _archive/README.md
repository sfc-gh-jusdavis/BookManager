# _archive/

Historical artifacts from the BookManager project, moved here to keep the active
workspace clean for AI agents. **Do not read or modify files under this
directory as part of active development.** They are preserved for reference only.

Archived on: 2026-04-22

## Contents

| Path | Origin | Why archived |
|------|--------|--------------|
| `frontend/` | Root `frontend/` | Old Vite/React v0.0.1 app. Replaced by `bkmng-next/` (Next.js 16). Not referenced by `docker-compose.yml`, `Makefile`, or `Dockerfile.spcs`. |
| `snowflake-legacy/sql/` | Root `sql/` | Orphan `sp_refresh_signals.sql`. The canonical SP library is `snowflake/procedures/`. |
| `snowflake-legacy/analytics/` | `snowflake/analytics/` | Old ROI / on-demand exploratory queries from the Playground era. |
| `snowflake-legacy/views/` | `snowflake/views/` | Old `v_od_*` views. Not referenced by active backend. |
| `deploy-legacy/bkmng-spec.yaml` | Root `bkmng-spec.yaml` | Old SPCS spec with `MOCK_DATA="true"` and wrong registry path. Active spec is `bkmng-spec-demo.yaml`. |
| `deploy-legacy/nginx-spcs.conf` | Root `nginx-spcs.conf` | Old nginx config. The current SPCS container uses the Next.js standalone server via `start.sh`; nginx is not referenced in `Dockerfile.spcs`. |
| `docs/` | Root `docs/` | 48+ historical plan files from the Playground era plus stale design docs. |
| `bkmng-next-boilerplate/README.md` | `bkmng-next/README.md` | Generic `create-next-app` boilerplate, no project-specific content. |
| `bkmng-next-boilerplate/CLAUDE.md` | `bkmng-next/CLAUDE.md` | Legacy pointer file containing only `@AGENTS.md`. |

## Restoring an item

Everything here is still a plain file or directory. To restore, just `mv` it
back to the original location shown in the table above.

## What is still active (do not look here for these)

- `backend/` - FastAPI service
- `bkmng-next/` - Next.js 16 frontend
- `snowflake/procedures/`, `snowflake/tasks/`, `snowflake/tables/` - active pipeline SQL
- `bkmng-spec-demo.yaml` - active SPCS spec
- `bookmanager_assistant.yaml` - active Cortex Analyst semantic model
- `docker-compose.yml`, `Dockerfile.spcs`, `Makefile`, `start.sh`, `dev-start.sh` - active build/deploy
