# Plan 3: Daily Working Cadence

> **Status:** Pending execution
> **Risk:** LOW (pure documentation)
> **Prerequisite:** Plan 2 complete (repo is clean)
> **Estimated time:** 1-2 hours
> **Reversible?** Trivially

---

## Goal

Codify "what does a normal day look like" so the workflow established in Plans 1 and 2 stays in place. After this plan executes, the repo has a `WORKFLOW.md` at the root and the conventions are explicit enough that any agent (or new human contributor) can follow them.

---

## Why This Plan Exists

Plans 1 and 2 are one-time setup. Without explicit conventions documented, the repo will drift back to the "everything on main" anti-pattern within a week.

This plan does three things:

1. Author `WORKFLOW.md` (the daily playbook)
2. Update `AGENTS.md` and `.cortex/commands/` so Cortex Code Desktop applies the workflow automatically
3. Map every daily activity to the relevant ai-dev-patterns AND Karpathy principles

---

## What Gets Authored

### File: `~/projects/BookManager/WORKFLOW.md`

The daily playbook. Lives at repo root for visibility. Sections below.

### File update: `~/projects/BookManager/AGENTS.md`

Add a "Working Conventions" section that points agents to WORKFLOW.md.

### File update: `~/projects/BookManager/.cortex/commands/`

Optionally add a `/start-feature` slash command that scaffolds a new feature branch.

---

## WORKFLOW.md Content

What follows is the actual content for `WORKFLOW.md`. When this plan executes, write this verbatim to the file.

---

```markdown
# BookManager Daily Working Cadence

> The playbook for one day in BookManager development.
> Read this once. Refer to it when you're stuck.

## The 30-Second Version

```bash
# Morning
git checkout main && git pull

# Start a task
git checkout -b feat/<short-name>

# Work
# ...edit files...
git add <specific-paths>
git commit -m "imperative message"

# Stay current (do this once or twice a day)
git fetch origin
git rebase origin/main

# Ship
git push -u origin feat/<short-name>
gh pr create
gh pr checks --watch
gh pr merge --squash --delete-branch
git checkout main && git pull
```

That's it. The rest of this document explains why each step exists.

---

## Morning Routine

```bash
cd ~/projects/BookManager
git checkout main
git pull
gh pr list --author @me --state open
```

Why:
- `git pull` ensures you start from the latest known-good state
- `gh pr list` reminds you of any of your own PRs still in flight

If you have an open PR awaiting review, address that BEFORE starting new work. Stale PRs accumulate conflicts.

---

## Starting a New Task

### Branch Naming

| Prefix | When to use |
|--------|-------------|
| `feat/` | New user-facing feature |
| `fix/` | Bug fix |
| `chore/` | Dependency bump, CI tweak, build config |
| `refactor/` | Internal restructuring, no behavior change |
| `docs/` | Documentation only |
| `revert/` | Reverting a previous change |

Format: `<prefix>/<kebab-case-short-name>`. Examples:
- `feat/account-export-csv`
- `fix/null-pointer-on-empty-search`
- `chore/bump-next-to-15`

Avoid:
- Slashes beyond the first one (`feat/foo/bar` confuses tooling)
- Issue numbers in branch names (link via PR description instead)
- Personal initials (`feat/jd-foo`) — branches are already namespaced by the PR author

### Create the Branch

```bash
git checkout main
git pull
git checkout -b feat/account-export-csv
```

If you ever need to abandon the branch: `git checkout main && git branch -D feat/account-export-csv`.

---

## During Work

### Commit Often, Commit Small

A good commit is one focused, coherent change. Indicators:
- Subject can be written in one short imperative sentence
- Body fits in 5 bullet points
- Reverting it is meaningful (e.g., "revert the validation change" makes sense)

Bad indicators:
- Subject says "and" or "also"
- Diff spans 5+ unrelated files
- You can't explain it without "and then I noticed..."

If you find yourself writing such a commit, pause: split it into multiple commits using `git add -p` or `git restore --staged <path>` to unstage parts.

### Commit Message Format

```
<short imperative subject under 72 chars>

<body explaining why, not what>
- bullet 1
- bullet 2
```

Examples:

Good:
```
fix: handle empty email in user validation

Previously crashed with KeyError. Now treats empty/missing as
required-field violation, matching frontend behavior.
```

Bad:
```
updates
```

Bad:
```
Fixed bug and refactored validator and added type hints
```

### Use `git add` with Explicit Paths

NEVER use `git add .` or `git add -A` blindly. Always:

```bash
git status                  # see what's there
git add <specific-paths>    # stage only what you want
git diff --cached           # review what's about to be committed
git commit -m "..."
```

This prevents accidentally committing scratch files, secrets, or unrelated WIP.

---

## Staying Current with Main

Once or twice a day on long-running branches:

```bash
git fetch origin
git rebase origin/main
```

If you get conflicts:
1. `git status` shows which files conflict
2. Open each, look for `<<<<<<<`, `=======`, `>>>>>>>` markers
3. Edit to resolve, choosing what stays
4. `git add <resolved-files>`
5. `git rebase --continue`
6. Repeat until clean

If you panic: `git rebase --abort` returns you to where you started. No harm done.

Why rebase instead of merge? Merge creates a "back-merge" commit that clutters history. Rebase keeps your branch a clean, linear story.

Exception: NEVER rebase a branch that someone else has based their work on. Solo dev so far → not a concern. When the team grows, revisit.

---

## Shipping

### 1. Final local check

```bash
git status   # clean working tree expected
git log main..HEAD --oneline   # shows your branch's commits
```

### 2. Push

```bash
git push -u origin feat/account-export-csv
```

### 3. Smoke test locally

Per BookManager's smoke test policy:

```bash
make up-detach
# wait for services
# open http://localhost:3001
# exercise the feature you built
```

If the smoke test fails, fix on the branch BEFORE opening the PR.

### 4. Open the PR

```bash
gh pr create
```

The PR template auto-populates. Fill it out. Reference any related plan or issue.

### 5. Wait for CI

```bash
gh pr checks --watch
```

If CI fails:
- READ the failure carefully — line number and rule are usually clear
- Fix on the branch
- `git push` again — CI re-runs automatically

### 6. Self-review

This is where Karpathy's principles kick in. Read your own diff:

- **Principle 1:** Did I make any silent assumptions? Were they correct?
- **Principle 2:** Is anything overcomplicated? Could 100 lines be 50?
- **Principle 3:** Does every changed line trace to the PR description?
- **Principle 4:** Is each change verifiable (test? smoke check? manual check?)

If anything fails, fix it before merging. This is the cheapest moment to fix problems.

### 7. Merge

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull
```

Squash merge: combines all your branch commits into one clean commit on main. The "story" of your branch lives in the PR; main's history stays focused on shipped features.

---

## Special Cases

### Tiny Fix (Typo, One-Line Bug)

Karpathy's tradeoff note applies: trivial work doesn't need full rigor. Still:

1. Branch (yes, even for typos — `fix/typo-in-readme`)
2. Commit
3. Push
4. PR with one-line description
5. Merge

Branch protection forces this. Embrace it. The cost is 30 seconds; the benefit is a clean history forever.

### "I'm In the Middle of Something and Need to Switch Tasks"

```bash
# Stash current work
git stash push -u -m "wip on feat/A, switching to fix/B"

# Switch
git checkout main
git pull
git checkout -b fix/B-emergency-fix

# Do the urgent work, ship it

# Come back
git checkout feat/A
git stash pop
```

If `git stash pop` shows conflicts, the stash and branch have diverged. Resolve as you would a rebase conflict.

### "I Committed to the Wrong Branch"

```bash
# Move the last commit to a new branch
git branch <correct-branch>
git reset --hard HEAD~1
git checkout <correct-branch>
```

If you've already pushed to the wrong branch, do NOT force-push. Instead, open a PR from the wrong branch (with the right code) and just rename the branch with `gh`.

### "I Need to Undo Something Already Pushed"

NEVER `git push --force` to a branch with an open PR — it nukes review history. Instead:

```bash
# Add a fixup commit
git commit --amend   # or
git commit -m "fix: address review comment about X"
git push   # NOT --force
```

For undoing a merge to main, use `git revert` — see Plan 2's rollback procedure.

---

## Mapping to AI-Dev Patterns and Karpathy Principles

| Daily Activity | AI-Dev Pattern | Karpathy Principle |
|----------------|----------------|--------------------|
| Morning `git pull` | (foundational) | (foundational) |
| Branch from main | Pattern 5 (Worktrees) — single-flow version | — |
| Plan before coding | Pattern 2 (Spec-First) | Principle 1 (Think Before Coding) |
| Test before implementing | Pattern 3 (Test-First) | Principle 4 (Goal-Driven) |
| CI on every push | Pattern 4 (Feedback Loops) | — |
| `git add` with explicit paths | — | Principle 3 (Surgical Changes) |
| Self-review diff before merge | Pattern 10 (PR-Based Review) | Principles 2 + 3 |
| Squash merge | — | Principle 3 (clean history) |
| Update skills/AGENTS when agent does something weird | Pattern 13 (Continuous Improvement) | — |

---

## Common Failure Modes (and Fixes)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "I have 30 modified files and don't know what each one does" | Worked too long on one branch | Plan 2's bucketing recipe scales: split by feature into multiple branches |
| "My branch has 200 conflicts with main" | Didn't rebase frequently | Rebase daily next time. For now: `git rebase --abort`, branch from current main, cherry-pick your work over |
| "I committed a `.env` file" | `git add .` instead of explicit paths | Add to `.gitignore`. If pushed: rotate the secret. Never just `git rm` and assume it's gone |
| "CI passed but feature is broken" | Smoke test was skipped | Add it to your habit. Karpathy Principle 4 — verify, don't trust |
| "I keep getting `git push` rejected" | Branch protection working | Open a PR. That's the point |

---

## Useful gh commands

```bash
gh pr list                        # all open PRs in repo
gh pr list --author @me           # mine
gh pr view 42                     # show PR #42 details
gh pr checkout 42                 # check out a coworker's PR locally
gh pr review --approve           # approve someone else's PR
gh pr review --comment -b "..."  # comment on a PR
gh pr ready 42                    # mark draft PR as ready for review
gh issue list                     # all open issues
gh repo view --web               # open the repo in browser
```
```

---

## AGENTS.md Update

When this plan executes, prepend this section to `AGENTS.md` (or insert near the top, after any existing intro):

```markdown
## Working Conventions

This repo follows the conventions in [WORKFLOW.md](./WORKFLOW.md). Highlights:

- **No direct commits to main.** All changes go through a branch + PR.
- **Branch naming:** `feat/`, `fix/`, `chore/`, `refactor/`, `docs/`, `revert/` prefixes.
- **Commit messages:** imperative mood, present tense.
- **`git add`** with explicit paths only. Never `git add .` or `git add -A`.
- **Self-review** before merging. Read your own diff against Karpathy's 4 principles
  ([docs/workflow/karpathy-coding-principles.md](docs/workflow/karpathy-coding-principles.md)).

When in doubt, read [WORKFLOW.md](./WORKFLOW.md).
```

---

## Optional: `/start-feature` Slash Command

If `.cortex/commands/` exists in the repo, add a `start-feature.md` file with content:

```markdown
---
name: start-feature
description: Scaffold a new feature branch following BookManager conventions
---

The user wants to start a new feature. Follow this exact sequence:

1. Confirm we're on main and synced: `git checkout main && git pull`
2. Ask the user for the feature short-name (kebab-case)
3. Create branch: `git checkout -b feat/<short-name>`
4. Confirm working tree is clean
5. Remind the user of the workflow: small commits, smoke test before PR, self-review
   against Karpathy principles
6. Suggest reading docs/workflow/WORKFLOW.md if they have any process questions
```

---

## Implementation Steps (when this plan is executed)

1. Create branch: `git checkout -b docs/workflow-cadence`
2. Author `WORKFLOW.md` at repo root with content above
3. Update `AGENTS.md` (insert "Working Conventions" section)
4. Optionally add `.cortex/commands/start-feature.md`
5. `git add WORKFLOW.md AGENTS.md .cortex/`
6. `git commit -m "docs: add WORKFLOW.md daily cadence guide"`
7. Push, open PR, smoke-test by READING the docs (no code change to validate)
8. Merge

---

## Definition of Done

- [ ] `WORKFLOW.md` exists at repo root
- [ ] `AGENTS.md` references WORKFLOW.md
- [ ] PR was opened, reviewed (by self), and merged
- [ ] You've read the doc end-to-end yourself
- [ ] You feel comfortable explaining the morning routine in 30 seconds

---

## Hand-off to Plan 4

After Plan 3, the daily mechanics are documented. Plan 4 layers the AI-dev patterns (worktrees, multi-reviewer, etc.) on top of this foundation.
