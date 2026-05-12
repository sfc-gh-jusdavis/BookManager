# BookManager Workflow Documentation

This folder is the operating manual for BookManager development. It tells you (and any agent) how work happens here.

## What's In Here

| File | Purpose |
|------|---------|
| `00-README.md` | This file — entry point and reading order |
| `karpathy-coding-principles.md` | The four principles for HOW each individual change should be made |
| `ai-dev-patterns.md` | The 13 patterns for HOW the team-of-agents workflow operates |
| `plan-1-repo-infrastructure.md` | One-time setup: CI, branch protection, PR template |
| `plan-2-repo-cleanup.md` | One-time triage: split ~2,000 lines of WIP into focused PRs |
| `plan-3-daily-cadence.md` | The daily playbook (becomes WORKFLOW.md at repo root) |
| `plan-4-ai-dev-patterns-adoption.md` | Activate worktrees, multi-reviewer review, etc. |

## The Two Layers

The discipline of AI-assisted development has two layers:

```
Macro (team-of-agents workflow)        --> ai-dev-patterns.md (13 patterns)
Micro (each individual change)          --> karpathy-coding-principles.md (4 principles)
```

Both must be applied. Neither alone is sufficient.

## Reading Order for New Contributors

If you are new to BookManager (or new to development entirely), read in this order:

1. **`karpathy-coding-principles.md`** — start here. Four short principles that shape how every line of code is written. ~10 minute read.
2. **`ai-dev-patterns.md`** — the macro patterns. The full 13-pattern survey. ~15 minute read.
3. **`plan-3-daily-cadence.md`** — what does a normal day look like. ~10 minute read.
4. **`plan-1-repo-infrastructure.md`** — only if you need to understand the repo's setup history.
5. **`plan-2-repo-cleanup.md`** — only if you need to understand the May 2026 cleanup.
6. **`plan-4-ai-dev-patterns-adoption.md`** — when you're ready for parallel agents and multi-reviewer review.

After reading, look at `WORKFLOW.md` at the repo root for the day-to-day reference card.

## Status Tracker

Update this table as plans are executed.

| Plan | Status | PR | Date executed |
|------|--------|-----|---------------|
| Plan 1: Repo Infrastructure | Not started | — | — |
| Plan 2: Repo Cleanup (8 PRs) | Not started | — | — |
| Plan 3: Daily Cadence | Not started | — | — |
| Plan 4: AI-Dev Patterns Adoption | Not started | — | — |

## Topic Lookup

Where do I look up...?

| Question | Where |
|----------|-------|
| How do I name a branch? | plan-3 ("Branch Naming") or WORKFLOW.md |
| What's the commit message format? | plan-3 ("Commit Message Format") |
| What does "surgical changes" mean? | karpathy-coding-principles.md (Principle 3) |
| How do I run multiple agents in parallel? | plan-4 (Pattern 5: Worktrees) |
| How do I get an agent to review my PR? | plan-4 (Pattern 10) |
| Why do we have CI? | ai-dev-patterns.md (Pattern 4: Feedback Loops) and plan-1 |
| Branch protection blocked my push — what do I do? | Open a PR. plan-3 explains why this is the right thing |
| I committed to the wrong branch — help! | plan-3 ("Special Cases") |
| Conflict during rebase — what now? | plan-3 ("Staying Current with Main") |
| How do I add a new dev user? | INSERT into `BKMNG_USERS` table; no code change |
| Why no MOCK_USERS dict? | CONTRIBUTING.md ("Privacy Rules") |

## Updating This Folder

These docs are living. When the workflow evolves:

1. Update the relevant plan-N or WORKFLOW.md
2. Update this README's tables
3. Open a PR labeled `docs/workflow-update`
4. Self-review for clarity (apply Karpathy Principle 1: don't assume readers know the context)
5. Merge

This is Pattern 13 (Continuous Improvement) applied to the workflow itself.

## Attribution

- **AI-dev patterns:** Lawrence's [AI-Assisted Development Patterns](https://docs.google.com/document/d/1Xy61AnBYLFpe_0QHXMQk99znZdp-yKvoQI6NXxwAEj8/) and Sridhar Ramaswamy's xkcd presentation
- **Karpathy principles:** distilled from [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) (MIT), based on Andrej Karpathy's [post on LLM coding pitfalls](https://x.com/karpathy/status/2015883857489522876)

Both sources used and adapted with respect to their original licenses.
