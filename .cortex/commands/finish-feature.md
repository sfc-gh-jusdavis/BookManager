Clean up after a merged feature branch. Use this when you started the work via `/start-feature` in worktree mode.

Steps:

1. Confirm the PR is merged:
   ```bash
   gh pr view <N> --json state --jq .state
   ```
   Should output `MERGED`. If not, stop — the cleanup happens after merge.

2. Determine if you're in a worktree:
   ```bash
   git worktree list
   ```
   You'll see one or more entries. The main worktree is `~/projects/BookManager`. Other entries are sibling directories like `../BookManager-<short-name>`.

3. **If you're inside a worktree** (the current pwd is NOT `~/projects/BookManager`):
   ```bash
   # Capture the worktree name before leaving it
   WORKTREE_PATH=$(pwd)
   cd ~/projects/BookManager
   git worktree remove "$WORKTREE_PATH"
   ```
   The branch reference is preserved (the merge already happened on origin); only the working folder is removed.

4. **If you're already on the main worktree** (or the work was same-tree):
   ```bash
   # Skip the worktree remove step
   :
   ```

5. Sync main:
   ```bash
   git checkout main
   git pull
   ```

6. Drop the local branch reference if it still exists:
   ```bash
   git branch -d <prefix>/<short-name> 2>/dev/null || true
   ```
   Squash-merge keeps the branch's content but the local ref points to a now-orphaned commit; safe to delete.

7. Confirm clean state:
   ```bash
   git status                    # should show nothing modified
   git worktree list             # should no longer show the removed worktree
   ```

## Edge cases

- **Worktree directory doesn't exist:** `git worktree remove` errors out. Run `git worktree prune` to clean up the metadata.
- **Branch wasn't merged:** Don't delete the branch yet. Re-run after the PR merges.
- **Forgot to use worktree mode:** No worktree to clean up. Just `git checkout main && git pull && git branch -d <branch>`.
- **Multiple worktrees stale:** `git worktree list` shows all of them; remove each individually.
