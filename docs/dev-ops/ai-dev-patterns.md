# AI-Dev Patterns (BookManager)

> The 13 patterns + how each is operationalized in this repo. From Lawrence's AI-Assisted Development Patterns.
> For full survey with examples: [docs/workflow/ai-dev-patterns.md](../workflow/ai-dev-patterns.md).

## Section 1: 4 Essential IC Patterns (Start Here)

| # | Pattern | What it gives you | BookManager mechanism |
|---|---|---|---|
| 1 | Write Skills | Codify repeated patterns so the agent doesn't re-discover | [AGENTS.md](../../AGENTS.md) auto-loaded; this dev-ops folder; `~/.cortex/skills/` (planned) |
| 2 | Spec-First / Plan-First | English is faster to review than 10k lines of code | Plan mode + `create_plan` tool; `.snowflake/cortex/plans/` |
| 3 | Test-First | Find wrong tests in 5 minutes, not 5 days | **Weak point** — manual smoke checklists today; pytest + Vitest infra is open ticket |
| 4 | Feedback Loops | An agent that never sees compile/test errors repeats them forever | CI (Backend ruff, Frontend lint+tsc+build, PII Scan) on every PR; `validate_flags` pre-commit |

## Section 2: 5 Patterns to 10x Yourself

> Only useful once Section 1 is in place. Don't start here.

| # | Pattern | BookManager mechanism |
|---|---|---|
| 5 | Parallel Agents via Worktrees | `/start-feature` worktree mode; `/finish-feature` cleanup |
| 6 | Task Graphs | Plan-mode tasks have explicit dependencies; not formal DAG tooling |
| 7 | Subagents | `runSubagent` with `run_in_background:true`; used by `/multi-review` |
| 8 | Context Management | AGENTS.md auto-load; memory tool; this dev-ops folder as ticket attachment |
| 9 | Multi-Model Teams | **Mocked** — CCD model is session-level. Use 2 windows on different models for true cross-vendor. |

## Section 3: 4 Patterns to Standardize and Build

| # | Pattern | BookManager mechanism |
|---|---|---|
| 10 | PR-Based Code Review with Agents | `gh pr view --json reviewComments` recipe in WORKFLOW.md; leave inline comments, feed to agent |
| 11 | Multi-Reviewer Review | `/multi-review` spawns 3 parallel subagents (Correctness, Simplicity P2, Surgical P3); proven to find real bugs (PR #10) |
| 12 | Cross-Model Review | `/cross-model-review` documents the manual 2-window recipe; CCD limitation prevents per-subagent model selection today |
| 13 | Continuous Improvement | When the agent does something off, update AGENTS.md or this folder; quarterly review |

## When to Invoke What

| Situation | Mechanism |
|---|---|
| Starting any new task | `/start-feature` (pick worktree mode if running in parallel with other agents) |
| PR is large (300+ lines) or touches auth/data integrity | `/multi-review` after CI goes green |
| You're unsure about a high-risk change | `/cross-model-review` (manual 2-window recipe) |
| Smoke testing locally | `make up-detach`; verify; `make down` |
| After PR merges (worktree mode) | `/finish-feature` |
| Agent did something weird | Update AGENTS.md or this folder; this is Pattern 13 in action |

## Section 4: Per-Change Discipline

The 13 patterns are macro workflow. Per-change discipline is in [coding-principles.md](coding-principles.md) — Karpathy's 4 principles. Apply both.

## The Mindset Shift

You are not a coder anymore. You are a **Technical Lead of Agents**. The sooner you accept this, the sooner you 10x. But being a good tech lead requires both layers:

- **Macro:** the 13 patterns — how you orchestrate work across agents, branches, and reviews.
- **Micro:** the 4 principles — how every individual change is reasoned through and shipped.

Skip either layer and you slow down. Master both and you compound.
