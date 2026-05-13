Tech-lead morning ritual. Run this first thing every working session before any other work. It syncs main, surfaces stale state from yesterday, lists what needs your attention, and primes you for SnowBoard triage.

## Steps

1. **Sync main** — pull latest, prune stale remote refs:
   ```bash
   cd ~/projects/BookManager
   git checkout main
   git pull
   git fetch origin --prune
   ```

   **If `git pull` rejects with "fatal: refusing to merge unrelated histories" or shows divergent history**, the remote was force-pushed (e.g., a history rewrite for PII scrub). The local clone is contaminated with old history and must be re-cloned:

   ```bash
   # Detection: any local commits not reachable from origin/main means force-push happened
   UNREACHABLE=$(git log --oneline ^origin/main main 2>/dev/null | head -1)
   if [ -n "$UNREACHABLE" ]; then
     echo "WARNING: local main has commits not on origin/main."
     echo "Likely cause: origin was force-pushed (history rewrite)."
     echo ""
     echo "Recommended action: re-clone."
     echo "  cd ~/projects && rm -rf BookManager && git clone https://github.com/sfc-gh-jusdavis/BookManager.git"
     echo "  cd BookManager && cp ~/.snowflake/connections.toml /tmp/conn.bak  # preserve env if needed"
     echo ""
     echo "Or hard-reset to abandon local commits (destructive, only if you have nothing in flight):"
     echo "  git fetch origin && git reset --hard origin/main"
   fi
   ```

   Re-cloning preserves nothing in `backend/.env`, `bkmng-next/node_modules`, or any local stash. Restore those after re-clone (per-developer config, not source-controlled).

2. **Worktree hygiene** — list any worktrees still around from yesterday's parallel runs:
   ```bash
   git worktree list
   ```
   If any sibling worktrees show up beyond the main repo path, remind the user to `/finish-feature` them (or `git worktree remove --force <path>` if the branch already merged).

3. **My open PRs** — anything red, conflicting, or ready to merge:
   ```bash
   gh pr list --author @me --state open --json number,title,statusCheckRollup,mergeable,reviewDecision --jq '.[] | "#\(.number) \(.title) | mergeable=\(.mergeable) | review=\(.reviewDecision) | checks=\([.statusCheckRollup[]?.conclusion] | join(\",\"))"'
   ```
   Surface for the user:
   - PRs with failing CI (need fixes)
   - PRs with merge conflicts (need rebase)
   - PRs with `reviewDecision=APPROVED` (ready to merge — close the loop)

4. **PRs awaiting my review** — agents and teammates may have opened PRs needing your sign-off:
   ```bash
   gh pr list --search "review-requested:@me" --state open --json number,title,author --jq '.[] | "#\(.number) by \(.author.login): \(.title)"'
   ```

5. **What landed overnight** — recent merges to `main` since the last working day:
   ```bash
   git log --since="24 hours ago" --oneline origin/main
   ```
   Helps you understand what changed under you before kicking off new work.

6. **Backlog triage prompt** — remind the user:
   > Open SnowBoard. Skim `[High]` first, then `[Medium]`. Pick today's slate (2-4 parallel tickets max as a canary; expand once trust is built).

7. **Decision fork** — ask the user:
   - "**New feature work** today? → switch to plan mode, describe the feature, decompose into tickets via `/create-task`."
   - "**Working backlog** today? → pick 2-4 independent tickets and run `/start-feature` worktree mode in parallel CCD windows."

8. **Print final status block** — single summary so the user sees their day at a glance:
   ```
   Main: synced
   Worktrees stale: <N> (run /finish-feature on each)
   My PRs: <total> open (<red> red, <conflicts> conflicting, <approved> ready to merge)
   PRs awaiting my review: <N>
   Overnight merges: <N>
   Suggested action: <plan-mode for new feature OR /start-feature for top [High] ticket>
   ```

## Notes

- This command is read-only except for `git pull` and `git fetch`. It mutates nothing else.
- If `gh` is not authenticated (`gh auth status` fails), prompt the user to `gh auth login` and skip the PR-related steps.
- Pre-flight guards in `/start-feature` and `/create-task` will catch a stale main if you skip this command — but the morning briefing is more than just the pull, so prefer running this first.
