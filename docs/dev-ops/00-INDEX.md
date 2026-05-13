# BookManager Dev-Ops

> Curated agent context for BookManager development. Every SnowBoard ticket attaches this folder URL as its single context source.
>
> For the canonical, auto-loaded conventions see [AGENTS.md](../../AGENTS.md) and [WORKFLOW.md](../../WORKFLOW.md) at repo root. This folder is the condensed reading list.

## Files in this folder

| File | Purpose |
|------|---------|
| [coding-principles.md](coding-principles.md) | Karpathy 4 principles + anti-pattern cheat sheet + self-review checklist. Apply to every code change. |
| [ai-dev-patterns.md](ai-dev-patterns.md) | The 13 AI-dev patterns + the BookManager mechanism that implements each (e.g., Pattern 11 = `/multi-review`). |
| [bookmanager-ops.md](bookmanager-ops.md) | Project-specific operational rules: pipeline health, BKMNG_USERS auth, PII allowlist, CORTEX.COMPLETE format, key tables, warehouse rules. |
| [deploy-ops.md](deploy-ops.md) | Local dev (Docker Compose), SPCS deploy (PAT auth), network rules, Docker troubleshooting. |
| [workflow.md](workflow.md) | 30-second daily cadence summary + pointer to canonical [WORKFLOW.md](../../WORKFLOW.md). |

## Reading order

For an agent picking up a ticket:

1. **`coding-principles.md`** — how to behave on every change (~5 min)
2. **`workflow.md`** — daily cadence; what a normal task flow looks like (~3 min)
3. **`bookmanager-ops.md`** — project-specific rules to avoid (~5 min)
4. **`ai-dev-patterns.md`** — only if you're going to spawn subagents or use multi-review (~5 min)
5. **`deploy-ops.md`** — only if the ticket touches Docker, Makefile, or SPCS (~5 min)

## Slash commands

- `/start-feature` — scaffold a branch (worktree mode for parallel execution)
- `/multi-review` — 3 parallel subagent reviewers on a PR diff
- `/cross-model-review` — 2-window manual recipe for cross-vendor review
- `/finish-feature` — clean up worktree after PR merge

## CI gates (cannot merge red)

- Backend (Python ruff)
- Frontend (Next.js lint + tsc + build)
- PII Scan (no internal company email domains outside allowlist)

## Branch protection

Strict mode, no force-push, no deletion, PR required.
