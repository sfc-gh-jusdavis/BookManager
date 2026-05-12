# Contributing to BookManager

This is a brief stub. The full daily working guide lives in
[docs/workflow/plan-3-daily-cadence.md](docs/workflow/plan-3-daily-cadence.md).

## The Rules

1. **No direct commits to `main`.** Always work on a branch and open a PR.
2. **Branch naming:** `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`, `docs/<short-name>`.
3. **Commit style:** imperative mood, present tense ("add X" not "added X").
4. **PR template:** fill out the smoke-test checklist before requesting review.
5. **CI must pass.** Backend lint + frontend lint/type-check/build are required.

## Reading Order for New Contributors

1. `docs/workflow/karpathy-coding-principles.md` — how to behave on each change
2. `docs/workflow/ai-dev-patterns.md` — how the team-of-agents workflow operates
3. `docs/workflow/00-README.md` — index of the four operational plans

## Privacy Rules

This repo is structured to remain safely shareable. Treat it that way regardless of current visibility.

- **No real PII in tracked source.** No real names, emails, account IDs in fixtures, mocks, or comments.
- **Users live in the database.** The `BKMNG_USERS` Snowflake table is the single source of truth for all auth modes (local, SPCS). Do not reintroduce a `MOCK_USERS` dict.
- **CI enforces this.** The `pii-check` job fails any PR that introduces internal company email domains (`snowflake.com`, `sfc.com`) outside the allowlist (one functional SQL filter in `backend/app/services/snowflake_service.py`).
- **Identity defaults are env-driven.** Set `LOCAL_DEFAULT_USER_ID` in your `backend/.env` to your own BKMNG_USERS username. The repo does not assume a specific contributor.
- **Internal SQL schema names** (`SALES.RAVEN.*`, `FIVETRAN.SALESFORCE.*`) are acceptable — they expose architecture but no data values.

## Reporting Issues

Open a GitHub issue. Include reproduction steps and what you expected vs. observed.
