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
- **Privacy:** Did I introduce real names, emails, or account IDs? Move them to `BKMNG_USERS` or a synthetic placeholder. The `pii-check` CI job will reject the PR otherwise.

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
# Add a fixup commit (new commit, normal push)
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
gh pr review --approve            # approve someone else's PR
gh pr review --comment -b "..."   # comment on a PR
gh pr ready 42                    # mark draft PR as ready for review
gh issue list                     # all open issues
gh repo view --web                # open the repo in browser
```
