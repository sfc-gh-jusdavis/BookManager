Capture a Pattern 13 (Continuous Improvement) learning. Use when an agent did something off, when you discovered a new convention, or when you found a recurring pitfall worth codifying.

## Steps

1. **Gather inputs from the user**:
   - **Situation** — what was the agent trying to do? (1-2 sentences)
   - **Expected behavior** — what should have happened?
   - **Actual behavior** — what did happen?
   - **Corrective rule** — what convention or guard would have prevented this? (one actionable sentence)
   - **Severity** — `low` (annoying), `medium` (cost time), `high` (introduced bug or security gap)

2. **Append to the learnings log**:
   ```bash
   cd ~/projects/BookManager
   mkdir -p docs/workflow
   touch docs/workflow/learnings.md
   ```

   Append entry in this exact format:
   ```markdown
   ## YYYY-MM-DD | <one-line title>

   **Severity:** <low|medium|high>

   **Situation:** <what was the agent doing>

   **Expected:** <what should have happened>

   **Actual:** <what did happen>

   **Corrective rule:** <one-sentence convention to add>

   **Action taken:** <one of: AGENTS.md updated | dev-ops doc updated | new pre-commit guard | CI check added | new SnowBoard ticket #N | none yet>

   ---
   ```

3. **Decide where the corrective rule lives**:
   - Touches every session -> add to [AGENTS.md](AGENTS.md) Working Conventions
   - Project-specific operational rule -> add to [docs/dev-ops/bookmanager-ops.md](docs/dev-ops/bookmanager-ops.md) or [docs/dev-ops/deploy-ops.md](docs/dev-ops/deploy-ops.md)
   - Coding-style or per-change discipline -> add to [docs/dev-ops/coding-principles.md](docs/dev-ops/coding-principles.md)
   - Workflow-level rule -> add to [WORKFLOW.md](WORKFLOW.md) or [docs/dev-ops/workflow.md](docs/dev-ops/workflow.md)
   - Mechanically enforceable -> open a `[Medium]` SnowBoard ticket via `/create-task` for a hook or CI gate
   - Skill-shaped (auto-loaded by trigger words) -> update `~/.cortex/skills/bookmanager-ops/SKILL.md`

4. **Optionally create a follow-up ticket**:
   Ask the user: "Open a SnowBoard ticket to act on this?" If yes, invoke `/create-task` with the corrective rule as the body.

5. **Commit the learning** (atomic, dedicated commit):
   ```bash
   git add docs/workflow/learnings.md
   git commit -m "docs: log learning — <title>"
   ```
   Skip a separate PR for trivial entries; bundle into the next PR you push. For high-severity entries that change AGENTS.md, ship as a standalone PR so reviewers see the convention update in isolation.

## When NOT to use this command

- The "learning" is just a one-time mistake with no generalizable rule. Don't pollute the log with noise.
- The fix is already in flight as a code change — that PR's description IS the learning record.

## Notes

- Pattern 13 is not "log every annoyance". Capture only what would generalize to future sessions.
- Quarterly: review `learnings.md`, retire entries whose corrective rule is now codified, escalate unaddressed entries to tickets.
