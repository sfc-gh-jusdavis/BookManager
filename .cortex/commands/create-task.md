Create a SnowBoard ticket for tech debt, follow-up work, or new feature requests.

## Steps

0. **Pre-flight: verify local main is current** (so file paths and line numbers in the ticket reference the latest code):
   ```bash
   git fetch origin
   LOCAL=$(git rev-parse main 2>/dev/null || echo missing)
   REMOTE=$(git rev-parse origin/main)
   if [ "$LOCAL" != "$REMOTE" ]; then
     echo "Local main is behind origin/main — pulling..."
     git checkout main && git pull
   fi
   ```
   No-op if already current.

1. Gather inputs from the user (or from context if obvious):
   - **Title** (short, action-oriented)
   - **Priority**: `high`, `medium`, or `low`
   - **Description** (what + why; reference source files/PRs/lines if applicable)
   - **Link** (optional but encouraged): GitHub PR, file URL, related ticket

2. **Format the title with a priority prefix** so the board UI surfaces priority at a glance:
   - `[High] <title>` for high priority
   - `[Medium] <title>` for medium priority
   - `[Low] <title>` for low priority

   Use exactly that capitalization (`[High]`, `[Medium]`, `[Low]`) — the bracket prefix is the convention; do NOT use other variants.

3. **Append the standard References footer** to the description so any agent picking up the ticket has one-line context:

   ```
   ## References

   Dev-Ops Docs: https://github.com/sfc-gh-jusdavis/BookManager/tree/main/docs/dev-ops
   Slash Commands: /start-feature (worktree mode for parallel), /multi-review, /finish-feature
   CI Gates: Backend (ruff), Frontend (lint + tsc + build), PII Scan
   Branch Protection: strict mode, no force-push, no deletion, PR required
   ```

4. Call `snowboard_create_task` with:
   - `title`: `[Priority] Title text`
   - `priority`: `high` | `medium` | `low`
   - `description`: user-provided body + blank line + References footer above
   - `link`: relevant URL (PR, file, issue) — omit if none
   - `tag`: `github` (default for code-tracked work)

5. Confirm to the user: ticket ID + final title + priority + link.

## Examples

User says: *"Create a high priority ticket to fix the auth bug in /use-case-updates"*

→ Title: `[High] Fix auth bug in /use-case-updates`
→ Priority: `high`
→ Description: user's narrative + standard References footer

User says: *"Add a low priority cleanup ticket for the dead helper in snowflake_service.py"*

→ Title: `[Low] Remove dead helper in snowflake_service.py`
→ Priority: `low`

## When NOT to use this command

- For PR-specific review findings: those usually flow from `/multi-review` straight into ticket creation; this command is for ad-hoc creation outside that flow.
- For brand-new feature work: prefer plan mode + a `feat/` branch instead of a ticket; tickets are for tracked debt/follow-up.
