Scaffold a new feature branch following BookManager conventions.

Steps:

1. Confirm we're on main and synced (pre-flight stale-main guard):
   ```bash
   git fetch origin
   LOCAL=$(git rev-parse main 2>/dev/null || echo missing)
   REMOTE=$(git rev-parse origin/main)
   if [ "$LOCAL" != "$REMOTE" ]; then
     echo "Local main is behind origin/main — pulling..."
     git checkout main && git pull
   fi
   ```
   Always safe; no-op if already current. Catches the case where `/start-day` was skipped.

2. Ask the user for the branch prefix (`feat`, `fix`, `chore`, `refactor`, `docs`, or `revert`) and a short kebab-case name.

3. Verify the working tree is clean. If WIP exists, stash it:
   ```bash
   git stash push -u -m "wip-pre-<branch-name>"
   ```

4. Ask: **"Use a worktree (recommended for parallel execution) or same-tree branch?"**

   If invoked from a SnowBoard execution context (parallel agents), choose **worktree** without prompting.

   **Worktree mode** — isolates this branch in a sibling directory; safe for parallel agents:
   ```bash
   git worktree add ../BookManager-<short-name> -b <prefix>/<short-name>
   cd ../BookManager-<short-name>
   # Symlink backend/.env (per-developer config, not per-branch)
   if [ -f ~/projects/BookManager/backend/.env ] && [ ! -e backend/.env ]; then
     ln -s ~/projects/BookManager/backend/.env backend/.env
   fi
   ```
   Then remind:
   - "You're now in `../BookManager-<short-name>`. Subsequent commands run from here."
   - "Run `npm install` in `bkmng-next/` before any `make up-detach`."
   - "Only one worktree at a time can run Docker (port 8000/3001 conflict)."
   - "Use `/finish-feature` after PR merge to clean up the worktree."

   **Same-tree mode** — simpler; for solo sequential work:
   ```bash
   git checkout -b <prefix>/<short-name>
   ```

5. Remind the user of the conventions in [docs/dev-ops/workflow.md](../../docs/dev-ops/workflow.md):
   - Commit often, commit small (one focused change per commit)
   - Imperative-mood subjects, body explains why
   - `git add` with explicit paths only — never `git add .` or `git add -A`
   - Smoke test locally before pushing
   - Run self-review against the 4 Karpathy principles before requesting merge
   - CI must pass (Backend, Frontend, PII Scan) — branch protection enforces this

6. Suggest reading [docs/dev-ops/](../../docs/dev-ops/) for the full agent context if any process question comes up.
