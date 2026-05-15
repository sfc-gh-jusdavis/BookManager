# BookManager Learnings Log

## 2026-05-15 | Always branch before making changes, even for simple flag toggles

**Severity:** medium

**Situation:** User asked to disable the TMR page feature flag. Agent edited both registries and updated Snowflake directly on main without creating a branch or PR.

**Expected:** Agent should have invoked `$start-feature` first, created a branch, made the changes, committed, pushed, and opened a PR before merging — as required by AGENTS.md and WORKFLOW.md.

**Actual:** Agent edited files on main, updated Snowflake directly, and only created the branch/PR after the user called it out.

**Corrective rule:** Every code change, no matter how small, must go through the branch+PR workflow. Invoke `$start-feature` BEFORE making any file edits.

**Action taken:** AGENTS.md not yet updated (rule already exists but was not followed); learning logged for reinforcement.

---
