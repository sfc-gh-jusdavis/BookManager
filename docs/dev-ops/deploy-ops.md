# Deploy Operations

> Local development (Docker Compose) and SPCS production deployment. Read before any change touching Makefile, docker-compose.yml, Dockerfile.spcs, or bkmng-spec-demo.yaml.
> Canonical live rules: [AGENTS.md](../../AGENTS.md) "SPCS Deployment" + "Docker Troubleshooting" sections.

## Local Development

Local dev uses Docker Compose with hot-reload. **No SPCS push needed during dev.**

| Command | Purpose |
|---|---|
| `make up-detach` | Start backend + frontend in background. Hot-reload on both. Chains `sync-flags` (best-effort). |
| `make logs` | Follow logs from both services |
| `make logs-backend` / `make logs-frontend` | Per-service logs |
| `make shell-backend` / `make shell-frontend` | Exec into a container |
| `make down` | Stop services |
| `make clean` | Full reset; wipes volumes (use if `node_modules` stale) |

Frontend: http://localhost:3001
Backend: http://localhost:8000

### Critical local dev rules

- **DO NOT overwrite `start.sh`** — it is the SPCS container entrypoint, not a local script. `dev-start.sh` is the local equivalent.
- **DO NOT delete `bkmng-next/.dockerignore`** — it prevents host macOS `node_modules` from entering the Linux container. Without it, `lightningcss` crashes.
- **DO NOT use Turbopack** — `bkmng-next/package.json` dev script must use `next dev --webpack`. Turbopack cannot resolve native `.node` binaries in PostCSS.
- **DO NOT use `X | None` type hints** — host Python is 3.9. Use `Optional[X]` or `from __future__ import annotations`.

### Worktrees and Docker

Only one worktree at a time can run `make up-detach` (port 8000/3001 hardcoded in `docker-compose.yml`). SnowBoard parallel agents typically don't run Docker — they let CI verify the build. If you need Docker in a parallel worktree, stop the main one first.

## Docker Troubleshooting

| Symptom | Fix |
|---|---|
| `sh: next: not found` (exit 127) | `make clean && make up` (stale volume) |
| `lightningcss.linux-arm64-musl.node` error | Ensure `.dockerignore` exists; use `--webpack` not Turbopack |
| `ECONNREFUSED ::1:8000` (no data) | Check `INTERNAL_API_URL=http://backend:8000` in compose |
| `externalbrowser` hang in Docker | `backend/.env` PAT auth must take precedence over root `.env` |
| `.env` changes not picked up | `docker compose up --force-recreate backend` |
| `Object does not exist` errors | Ensure `.env` has `SNOWFLAKE_DATABASE=TEMP` and `SNOWFLAKE_SCHEMA=JUSDAVIS` |

## SPCS Production Deployment

Push to SPCS only when a batch of changes is ready.

| Command | Purpose |
|---|---|
| `make test-spcs-build` | Verify SPCS image builds locally (no push) |
| `make deploy` | Build + push + ALTER SERVICE (one command) |
| `make logs-spcs` | Tail last 200 lines from the bkmng container |
| `make restart-service` | SUSPEND + RESUME to roll containers (no image change) |

### SPCS service identifiers

| Field | Value |
|---|---|
| Service | `BOOKMANAGER.DEMO.BKMNG_SERVICE` |
| Account | `JDAVIS_AWS1` |
| URL | https://ar7vvu-sfsenorthamerica-jdavis-aws1.snowflakecomputing.app |
| Compute pool | `BKMNG_POOL` |
| Image registry | `sfsenorthamerica-jdavis-aws1.registry.snowflakecomputing.com/bookmanager/demo/bkmng_repo/bkmng:latest` |

### SPCS deploy auth (PAT, NOT OAuth)

Deploy uses a Programmatic Access Token. **Never use the OAuth `snow` connection for deploy** — it errors with "user differs from access token".

| Item | Value |
|---|---|
| Connection profile | `bkmng_deploy` in `~/.snowflake/connections.toml` |
| Token name | `JUSDAVIS.BKMNG_DEPLOY_PAT` (ROLE_RESTRICTION=ACCOUNTADMIN, 365-day expiry) |
| Stored in | `backend/.env` as `BKMNG_DEPLOY_PAT=<jwt>` (gitignored) |
| Auth policy | `BOOKMANAGER.DEMO.BKMNG_PAT_AUTH_POLICY` applied to JUSDAVIS — `NETWORK_POLICY_EVALUATION = NOT_ENFORCED` |

### Rotation

```sql
ALTER USER JUSDAVIS ROTATE PROGRAMMATIC ACCESS TOKEN BKMNG_DEPLOY_PAT;
-- then update BKMNG_DEPLOY_PAT in backend/.env with the new token_secret
```

If `make deploy` returns 401 / "token invalid": PAT expired or revoked → rotate.

## SPCS Network Rules

SPCS containers are network-isolated. The service has an External Access Integration:

| Item | Value |
|---|---|
| Network rule | `BOOKMANAGER.DEMO.BKMNG_SNOWHOUSE_RULE` (HOST_PORT EGRESS :443) |
| Allowed hosts | `sfcogsops-snowhouse-aws-us-west-2.snowflakecomputing.com:443`, `sfc-ds2-customer-stage.s3.us-west-2.amazonaws.com:443` |
| EAI | `BKMNG_SNOWHOUSE_EAI` |
| Attached via | `ALTER SERVICE ... SET EXTERNAL_ACCESS_INTEGRATIONS = (BKMNG_SNOWHOUSE_EAI);` |

After updating network rules: must SUSPEND + RESUME the service.

The S3 host is required for large query result sets (Snowflake fetches via presigned URL).

## Auth in Production

| Mode | Auth source |
|---|---|
| Local dev | `X-Mock-User: <username>` header (always accepted) |
| SPCS | PAT-based via `SNOWFLAKE_PAT` env var (secret: `BKMNG_SNOWHOUSE_PAT`) |

User table: `BKMNG_USERS` (19 users), read by `/auth/users` endpoint. Default dev user: configured via `LOCAL_DEFAULT_USER_ID` env var (set in `backend/.env`).

## Key Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Local dev services (backend + frontend with hot-reload) |
| `Dockerfile.spcs` | SPCS production multi-stage build |
| `bkmng-spec-demo.yaml` | SPCS service specification |
| `start.sh` | SPCS container CMD (DO NOT overwrite) |
| `dev-start.sh` | Local dev startup (opens Docker Desktop if needed) |
| `Makefile` | All dev/deploy commands |
| `backend/.env` | Per-developer config (gitignored): `LOCAL_DEFAULT_USER_ID`, `BKMNG_DEPLOY_PAT`, etc. |
