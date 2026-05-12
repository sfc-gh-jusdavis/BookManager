Scaffold a new feature branch following BookManager conventions.

Steps:

1. Confirm we're on main and synced:
   ```bash
   git checkout main && git pull
   ```

2. Ask the user for the branch prefix (`feat`, `fix`, `chore`, `refactor`, `docs`, or `revert`) and a short kebab-case name.

3. Verify the working tree is clean. If WIP exists, stash it:
   ```bash
   git stash push -u -m "wip-pre-<branch-name>"
   ```

4. Create and switch to the new branch:
   ```bash
   git checkout -b <prefix>/<short-name>
   ```

5. Remind the user of the conventions in [WORKFLOW.md](../../WORKFLOW.md):
   - Commit often, commit small (one focused change per commit)
   - Imperative-mood subjects, body explains why
   - `git add` with explicit paths only — never `git add .` or `git add -A`
   - Smoke test locally before pushing
   - Run self-review against the 4 Karpathy principles before requesting merge
   - CI must pass (Backend, Frontend, PII Scan) — branch protection enforces this

6. Suggest reading [WORKFLOW.md](../../WORKFLOW.md) for the full daily cadence if any process question comes up.
