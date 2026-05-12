Run three parallel subagent reviewers on a PR (Pattern 11). Each reviewer focuses on a different lens; findings are consolidated into one structured PR review comment.

Use this for: large PRs (300+ lines), auth/data-integrity changes, or anything you're unsure about. For routine PRs, the regular self-review (per WORKFLOW.md) is sufficient.

Steps:

1. Ask the user which PR to review (PR number or URL).

2. Spawn three subagents in parallel via `runSubagent` with `run_in_background: true` and `subagent_type: generalPurpose`. Each gets the same PR diff but a different focus prompt.

   **Agent 1 — Correctness:**
   ```
   Review PR #<N> at https://github.com/sfc-gh-jusdavis/BookManager/pull/<N>.
   Focus: does each changed line do what the PR description claims? Are edge
   cases handled? Are there subtle bugs?

   Read docs/workflow/karpathy-coding-principles.md for the discipline this
   repo expects.

   Use `gh pr diff <N>` to see the diff and `gh pr view <N>` for context.

   Reply with a numbered list of issues (file:line + description) or
   "no issues found." Do not propose fixes; just identify problems.
   ```

   **Agent 2 — Simplicity (Karpathy P2):**
   ```
   Review PR #<N> at https://github.com/sfc-gh-jusdavis/BookManager/pull/<N>.
   Focus: is anything overcomplicated? Could 200 lines be 50? Speculative
   abstractions? Configuration that wasn't requested? Single-use code wrapped
   in a class hierarchy?

   Apply Karpathy Principle 2 from docs/workflow/karpathy-coding-principles.md.

   Use `gh pr diff <N>` and `gh pr view <N>`.

   Reply with a numbered list of overcomplication concerns (file:line +
   suggested simpler approach) or "no concerns."
   ```

   **Agent 3 — Surgical Changes (Karpathy P3):**
   ```
   Review PR #<N> at https://github.com/sfc-gh-jusdavis/BookManager/pull/<N>.
   Focus: does every changed line trace directly to the PR description's
   stated goals? Drive-by edits? Reformatting? Comment removal? Improving
   adjacent code that wasn't broken?

   Apply Karpathy Principle 3 from docs/workflow/karpathy-coding-principles.md.

   Use `gh pr diff <N>` and `gh pr view <N>`.

   Reply with a numbered list of out-of-scope changes (file:line + reason it
   doesn't trace to the PR description) or "scope clean."
   ```

3. Use `wait_agent` to collect all three results.

4. Consolidate findings into a single review comment with this structure:
   ```
   ## Multi-reviewer findings (Pattern 11)

   ### Correctness
   <Agent 1 findings>

   ### Simplicity (Karpathy P2)
   <Agent 2 findings>

   ### Surgical Changes (Karpathy P3)
   <Agent 3 findings>

   ### Recommendation
   <Address-before-merge / Acceptable-as-is / Needs-discussion>
   ```

5. Post via:
   ```bash
   gh pr review <N> --comment -b "<consolidated findings>"
   ```

6. Summarize the recommendation to the user. If "Address-before-merge", list the must-fix items.
