# BookManager Coding Principles

> Apply to every code change. Distilled from Andrej Karpathy's observations on LLM coding pitfalls.
> For full treatment with worked examples: [docs/workflow/karpathy-coding-principles.md](../workflow/karpathy-coding-principles.md).

## The Four Principles

### P1: Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly. If uncertain, ask.
- Present multiple interpretations when a request is ambiguous — don't pick silently.
- Push back when a simpler approach exists.
- Stop when confused. Name what is unclear and ask for clarification.

### P2: Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### P3: Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Every changed line must trace directly to the user's request or the PR description.
- If you notice unrelated dead code, mention it — don't delete it.

### P4: Goal-Driven Execution

**Define success criteria. Loop until verified.**

| Vague request | Verifiable goal |
|---|---|
| "Add validation" | "Write tests for invalid inputs, then make them pass" |
| "Fix the bug" | "Write a test that reproduces it, then make it pass" |
| "Refactor X" | "Ensure tests pass before and after" |

Strong success criteria let the agent loop independently. Weak criteria force constant clarification.

## Self-Review Checklist (before every PR)

- **P1:** Did I make any silent assumptions? Were they correct?
- **P2:** Is anything overcomplicated? Could 100 lines be 50?
- **P3:** Does every changed line trace to the PR description?
- **P4:** Is each change verifiable (test? smoke check? manual check?)
- **Privacy:** Did I introduce real names, emails, or account IDs? Move to BKMNG_USERS or use synthetic placeholder. The `pii-check` CI job will reject the PR otherwise.

## Anti-Pattern Cheat Sheet

| Anti-pattern | Fix |
|---|---|
| Silently assumes file format, scope, fields | List assumptions explicitly, ask for clarification |
| Strategy pattern for a single calculation | One function until complexity is actually needed |
| Reformats quotes, adds type hints while fixing a bug | Only change lines that fix the reported issue |
| "I'll review and improve the code" | "Write test for bug X, make it pass, verify no regressions" |
| Adds 5 unrelated cleanups in a "fix typo" PR | One PR per logical change; split via `git add -p` |

## When to Apply Full Rigor

| Task type | Apply rigor? |
|---|---|
| Typo fix, one-line bug, obvious rename | No — just do it |
| New feature, refactor, anything spanning multiple files | Yes |
| Anything you'd be uncomfortable explaining in a code review | Yes |
| Anything where "I think this is what they meant" appears in your reasoning | Yes — stop and clarify first |

## Multi-Reviewer Mapping

When `/multi-review` runs on a PR, each subagent applies one of:

- **Correctness reviewer** (P4): does the code do what the PR says?
- **Simplicity reviewer** (P2): is it overcomplicated?
- **Surgical-changes reviewer** (P3): does every changed line trace to the description?
