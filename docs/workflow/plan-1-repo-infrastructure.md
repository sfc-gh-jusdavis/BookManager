# Plan 1: Repo Infrastructure

> **Status:** Pending execution
> **Risk:** LOW (strictly additive)
> **Prerequisite:** None — this is the first plan to execute
> **Estimated time:** 1-2 hours
> **Reversible?** Yes — every step has a documented undo

---

## Goal

Establish CI, branch protection, and PR scaffolding on a clean `main` branch BEFORE triaging the ~2,000 lines of uncommitted work in BookManager. Strictly additive: no existing code is modified.

---

## Why This Plan Goes First

You currently have ~2,000 lines of uncommitted work piled on `main`. We must NOT let that work get entangled with infrastructure setup. Two reasons:

1. **Reviewability.** When we later split the WIP into ~8 feature PRs (Plan 2), each PR should be a clean, focused diff. If we commit infra files mixed with feature work, the diff is confusing and review value drops to zero.

2. **Validation.** CI must exist BEFORE the cleanup PRs are opened, so each cleanup PR gets validated automatically.

The trick: we will commit infra files to a fresh branch using **explicit path arguments** (`git add .github/ CONTRIBUTING.md`), not `git add .` or `git add -A`. The WIP stays in the working tree, untouched.

---

## Pre-flight Checklist

Before starting:

- [ ] Confirm you're on the correct machine and the BookManager repo is at `~/projects/BookManager`
- [ ] Confirm origin remote points to `github.com/sfc-gh-jusdavis/BookManager`
- [ ] Confirm `gh` CLI is installed and authenticated (`gh auth status`)
- [ ] Confirm Node 20 and Python 3.9 are available (matches what BookManager uses)
- [ ] Confirm GitHub Actions is enabled for the repo (Settings -> Actions -> General -> "Allow all actions")
- [ ] Take a mental snapshot: `git status` should show 32 modified + 15 untracked files

---

## Step 1: Safety Snapshot of WIP

The most important step. Preserves all current work to a remote branch before anything else happens.

```bash
cd ~/projects/BookManager

# Stash everything including untracked files
git stash push -u -m "wip-pre-infra-$(date +%Y%m%d)"

# Branch from clean main, re-apply stash, commit, push
git checkout -b wip-snapshot-2026-05-12
git stash apply
git add -A
git commit -m "WIP snapshot: preserve all uncommitted work before workflow adoption"
git push -u origin wip-snapshot-2026-05-12

# Return to main and restore WIP onto working tree
git checkout main
git stash pop
git stash list   # should be empty
git status       # should show original 32 modified + 15 untracked
```

### Verification

- `git branch -r` shows `origin/wip-snapshot-2026-05-12`
- `git status` on main shows the same files as before Step 1
- `git stash list` is empty

### If something goes wrong

If `git stash pop` fails with merge conflicts: don't panic. The WIP is safe on `origin/wip-snapshot-2026-05-12`. Run `git stash drop` to discard the local stash, then `git checkout wip-snapshot-2026-05-12 -- .` to restore files from the safety branch.

---

## Step 2: Create the Infrastructure Branch

The WIP is in the working tree. We branch off main with the WIP coming along — but we will NOT add it to commits.

```bash
git checkout -b chore/repo-infrastructure
```

---

## Step 3: Author `.github/workflows/ci.yml`

Smoke-test scope: backend lint + frontend type-check + frontend build. This catches the breakage that matters most without dragging in heavy test suites we don't yet have.

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  backend:
    name: Backend (Python)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.9'
          cache: 'pip'
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install ruff
      - name: Lint with ruff
        run: ruff check .

  frontend:
    name: Frontend (Next.js)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: bkmng-next
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: bkmng-next/package-lock.json
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Type check
        run: npx tsc --noEmit
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_API_BASE_URL: http://localhost:8000
```

Save to `~/projects/BookManager/.github/workflows/ci.yml`.

---

## Step 4: Author `.github/pull_request_template.md`

```markdown
## Description

<!-- What does this PR do? Link to plan or issue if applicable. -->

## Smoke Test Checklist

- [ ] `make up-detach` succeeds
- [ ] App loads at expected URL
- [ ] Touched feature(s) exercised manually
- [ ] No console errors in browser
- [ ] No errors in backend logs

## Other

- [ ] Screenshots attached if UI change
- [ ] No secrets, tokens, or PATs committed
- [ ] Linked plan or issue: <!-- e.g. docs/workflow/plan-2-repo-cleanup.md -->

## Notes for Reviewer

<!-- Anything they should pay extra attention to. Karpathy Principle 3: every changed
line should trace to a goal in the description above. -->
```

Save to `~/projects/BookManager/.github/pull_request_template.md`.

---

## Step 5: Author `CONTRIBUTING.md`

```markdown
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

## Reporting Issues

Open a GitHub issue. Include reproduction steps and what you expected vs. observed.
```

Save to `~/projects/BookManager/CONTRIBUTING.md`.

---

## Step 6: Surgical Commit (Explicit Paths Only)

This is where most accidents happen. We commit ONLY the new infra files. The WIP stays untouched.

```bash
# CRITICAL: explicit paths only. Do NOT use `git add .` or `git add -A`.
git add .github/ CONTRIBUTING.md

# Verify staging is exactly what we expect
git status
# Should show:
#   Changes to be committed:
#     new file:   .github/pull_request_template.md
#     new file:   .github/workflows/ci.yml
#     new file:   CONTRIBUTING.md
#
#   Changes not staged for commit:
#     [the original 32 modified files]
#
#   Untracked files:
#     [the original 15 untracked files]

# Only proceed if the staged list is exactly 3 files.
git commit -m "chore: add CI, PR template, and CONTRIBUTING.md

- GitHub Actions runs ruff (backend) and lint/tsc/build (frontend) on every PR
- PR template enforces smoke-test checklist
- CONTRIBUTING.md documents branch naming and PR-required policy
- WIP working tree intentionally untouched - cleanup happens in plan-2"

git push -u origin chore/repo-infrastructure
```

---

## Step 7: Open and Merge the PR

```bash
gh pr create \
  --base main \
  --head chore/repo-infrastructure \
  --title "chore: add CI, PR template, and CONTRIBUTING.md" \
  --body "First PR establishing repo infrastructure. Strictly additive - no existing files modified.

Part of the workflow adoption series. See docs/workflow/plan-1-repo-infrastructure.md."

# Wait for CI
gh pr checks --watch

# When green, merge
gh pr merge --squash --delete-branch

# Sync local main
git checkout main
git pull
```

### What if CI fails?

If CI fails on this PR, that's a SIGNAL not a problem. It means main was already broken before any cleanup work. Likely culprits:

- Backend has a `ruff check` violation that nobody noticed
- Frontend has a TypeScript error
- `npm ci` fails because `package-lock.json` is out of sync

Fix in a follow-up PR (also from a branch, also through CI). Do NOT push fixes directly to main.

---

## Step 8: Configure Branch Protection on main

Use the `gh` CLI:

```bash
gh api -X PUT repos/sfc-gh-jusdavis/BookManager/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Backend (Python)", "Frontend (Next.js)"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

Settings explained:
- `required_status_checks`: CI must pass; branch must be up to date
- `enforce_admins: false`: you can override in a true emergency (use sparingly)
- `required_approving_review_count: 0`: solo dev — you self-approve. Plan 4 raises this when agent reviewers come online.
- `allow_force_pushes: false`: no rewriting history on main

Alternative: configure via GitHub UI at `Settings -> Branches -> Add rule -> Branch name pattern: main`.

---

## Step 9: Verify Branch Protection Works

```bash
git checkout main
echo "test" >> /tmp/test-file
cp /tmp/test-file ~/projects/BookManager/CONTRIBUTING.md.bak
echo "test" >> ~/projects/BookManager/CONTRIBUTING.md
git add CONTRIBUTING.md
git commit -m "test direct push (should fail)"
git push origin main
# EXPECTED: "remote: error: GH006: Protected branch update failed"

# Undo the test commit
git reset --hard HEAD~1
mv ~/projects/BookManager/CONTRIBUTING.md.bak ~/projects/BookManager/CONTRIBUTING.md
```

If the push succeeds, branch protection is NOT working — re-check Step 8 settings.

---

## Definition of Done

- [ ] `wip-snapshot-2026-05-12` branch exists on origin with all WIP committed
- [ ] `.github/workflows/ci.yml` lives on main
- [ ] `.github/pull_request_template.md` lives on main
- [ ] `CONTRIBUTING.md` lives on main
- [ ] Branch protection blocks direct pushes to main
- [ ] `git status` on main still shows the original 32 modified + 15 untracked files
- [ ] CI ran successfully on the chore/repo-infrastructure PR

---

## Hand-off to Plan 2

Once everything above is verified, you are ready for `plan-2-repo-cleanup.md`. That plan is the high-risk one — triaging 2,000 lines of WIP into ~8 PRs. The infrastructure built here will validate every one of those cleanup PRs automatically.
