# Daily Workflow (30-Second Version)

> Condensed for agent reference. Full canonical playbook: [WORKFLOW.md](../../WORKFLOW.md) at repo root.

## The Loop

```bash
# Morning (tech lead)
/start-day                        # syncs main, triages PRs, surfaces stale worktrees, primes board review
                                  # fallback if slash unavailable: git checkout main && git pull

# Start a task
/start-feature                    # picks worktree mode for parallel execution

# Work
# ...edit files...
git add <specific-paths>          # NEVER git add . or git add -A
git commit -m "imperative subject

body explaining why, not what"

# Stay current (long-running branches only)
git fetch origin && git rebase origin/main

# Ship
git push -u origin <branch>
gh pr create
gh pr checks --watch              # CI must be green
/multi-review                     # only for PRs >300 lines or auth/data integrity
gh pr merge --squash --delete-branch
/finish-feature                   # if you used worktree mode
git checkout main && git pull
```

## Branch Naming

| Prefix | When |
|---|---|
| `feat/` | New user-facing feature |
| `fix/` | Bug fix |
| `chore/` | Dependency, CI, build config |
| `refactor/` | Internal restructuring, no behavior change |
| `docs/` | Documentation only |
| `revert/` | Reverting a previous change |

Format: `<prefix>/<kebab-case-short-name>`. Avoid: slashes beyond the first, issue numbers, personal initials.

## Commit Rules

- Imperative subject under 72 chars, no period.
- Body explains WHY, not what (the diff shows what).
- One focused change per commit. If subject says "and" or "also", split.
- Explicit `git add` paths only. `git add .` is forbidden.

## Self-Review Before Merge

- **P1:** Silent assumptions?
- **P2:** Overcomplicated?
- **P3:** Every line traces to PR description?
- **P4:** Verifiable?
- **Privacy:** Real names/emails/account IDs introduced?

See [coding-principles.md](coding-principles.md) for the full Karpathy treatment.

## CI Gates (cannot merge red)

- **Backend (Python ruff)** — lint clean
- **Frontend (Next.js)** — `npm run lint` + `npx tsc --noEmit` + `npm run build`
- **PII Scan** — no internal company email domains outside snowflake_service.py allowlist

## Branch Protection

- Strict mode (branch must be up-to-date with main before merge)
- No force-push, no deletion
- PR required (no direct push to main)

## Special Cases

| Situation | Action |
|---|---|
| Tiny fix (typo, one-line) | Branch + commit + PR + merge anyway. 30 seconds. |
| Mid-task, switch to hotfix | `git stash push -u -m "wip"`; switch; come back; `git stash pop` |
| Committed to wrong branch | `git branch <correct>; git reset --hard HEAD~1; git checkout <correct>` |
| Need to undo pushed work | `git revert <sha>` via PR. Never `git push --force` to a branch with an open PR. |
| Long-running branch needs latest main | `git fetch origin && git rebase origin/main`; resolve conflicts; `git rebase --continue` |
| Panicking | `git rebase --abort` returns to start |

## Worktrees (Parallel Execution)

If running alongside other agents, use worktree mode:

```bash
/start-feature                       # choose "worktree"
# you're now in ../BookManager-<short-name>/
# run npm install in bkmng-next/ before any make up-detach
```

After PR merges:

```bash
/finish-feature                      # cleanup
```

Caveats:
- Only one worktree at a time can run Docker (port 8000/3001 hardcoded)
- `backend/.env` symlinked from main worktree (per-developer, not per-branch)
- `node_modules` is per-worktree (run `npm install`)
- `.git/hooks` shared (pre-commit propagates automatically)

## Useful gh Commands

```bash
gh pr list --author @me           # my open PRs
gh pr view 42                     # show PR details
gh pr diff 42                     # show diff
gh pr checks 42 --watch           # tail CI status
gh pr review --comment -F file    # post a review comment from file
gh pr merge 42 --squash --delete-branch
```
