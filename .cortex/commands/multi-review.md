Run multiple parallel subagent reviewers on a PR (Pattern 11). Each reviewer applies a domain-specific rubric; findings are consolidated into a structured PR review comment.

## Modes

| Mode | Reviewers | When |
|---|---|---|
| `--quick` (default for PRs <300 lines) | 3: Correctness, Simplicity, Surgical | Routine PRs; matches the original 3-agent pattern |
| `--full` (default for PRs >=300 lines or auth/data integrity) | 6: + Security, Performance, Maintainability | Large PRs, security-sensitive areas, anything you're unsure about |

User can override the default with an explicit `--quick` or `--full` flag.

## Steps

1. Ask the user which PR to review (PR number or URL). Determine PR size:
   ```bash
   gh pr view <N> --json additions,deletions --jq '.additions + .deletions'
   ```
   Pick mode: `--full` if size >= 300 OR PR title/files touch `auth`, `routers/`, `dependencies.py`, `BKMNG_USERS`, or any SP. Else `--quick`. Honor an explicit user flag.

2. Spawn the chosen number of subagents in parallel via `runSubagent` with `run_in_background: true` and `subagent_type: generalPurpose`. Each gets the same PR diff and the project conventions, but a different focus prompt.

### Always-on (the original 3)

**Agent 1 — Correctness (Karpathy P4):**
```
Review PR #<N> at https://github.com/sfc-gh-jusdavis/BookManager/pull/<N>.

Focus: does each changed line do what the PR description claims?
- Are edge cases handled? (empty inputs, NULL DB rows, missing config)
- Are there subtle off-by-one errors, wrong column references, dropped clauses?
- Does the test (if any) actually exercise the code path it claims to?
- Cite docs/dev-ops/coding-principles.md P4.

Use `gh pr diff <N>` and `gh pr view <N>`.

Reply with a numbered list of issues (file:line + description) or
"no issues found." Do not propose fixes; just identify problems.
```

**Agent 2 — Simplicity (Karpathy P2):**
```
Review PR #<N> at https://github.com/sfc-gh-jusdavis/BookManager/pull/<N>.

Focus: is anything overcomplicated?
- Could 200 lines be 50?
- Speculative abstractions, configurability, "flexibility" not requested?
- Single-use code wrapped in a class hierarchy?
- Defensive code for impossible scenarios?
- Apply docs/dev-ops/coding-principles.md P2.

Use `gh pr diff <N>` and `gh pr view <N>`.

Reply with a numbered list of overcomplication concerns (file:line +
suggested simpler approach) or "no concerns."
```

**Agent 3 — Surgical Changes (Karpathy P3):**
```
Review PR #<N> at https://github.com/sfc-gh-jusdavis/BookManager/pull/<N>.

Focus: does every changed line trace to the PR description?
- Drive-by reformatting, comment cleanup, "improving" adjacent code?
- Type-hint additions on lines that didn't need editing?
- Unrelated dead-code removal?
- Apply docs/dev-ops/coding-principles.md P3.

Use `gh pr diff <N>` and `gh pr view <N>`.

Reply with a numbered list of out-of-scope changes (file:line + reason
it doesn't trace to the PR description) or "scope clean."
```

### --full mode adds

**Agent 4 — Security:**
```
Review PR #<N> at https://github.com/sfc-gh-jusdavis/BookManager/pull/<N>.

Apply this rubric:
- Authz: do any new endpoints lack account/user scoping? Cite the
  router and the missing scope check. (See PR #10 multi-review which
  caught the /use-case-updates/{id} authz gap.)
- SQL injection: any string-formatted SQL with user input? F-strings,
  .format(), raw concatenation? Cursor params should always be
  parameterized.
- Secret exposure: any new logs, error messages, or response bodies
  that could leak PAT, password, account ID, or other credentials?
- PII: any internal company email domains introduced outside the
  snowflake_service.py allowlist? (CI's pii-check job would block this,
  but flag it explicitly so the reviewer sees it.)
- RBAC drift: new SPs that should EXECUTE AS CALLER but use OWNER?
  Routers bypassing SnowflakeDataService?
- Reference docs/dev-ops/bookmanager-ops.md.

Use `gh pr diff <N>` and `gh pr view <N>`.

Reply with a numbered list of security findings (file:line + severity:
critical/high/medium/low + recommendation) or "no security findings."
```

**Agent 5 — Performance:**
```
Review PR #<N> at https://github.com/sfc-gh-jusdavis/BookManager/pull/<N>.

Apply this rubric:
- Backend: N+1 queries (loop calling _cursor() per item), missing
  WHERE clauses returning entire tables, JOINs without indexed
  predicates, RUN-THEN-FILTER vs FILTER-THEN-RUN.
- Snowflake quirks: CONCAT_WS instead of ARRAY_TO_STRING/ARRAY_COMPACT;
  CORTEX.COMPLETE called in a row loop instead of AI_AGG; missing
  warehouse hints.
- Frontend: unnecessary re-renders (missing memoization, prop drilling
  triggering tree updates), waterfall fetches that should be parallel,
  large bundle additions, sync work in render path.
- Cache opportunities not taken (e.g., useApi result not memoized
  across remounts).

Use `gh pr diff <N>` and `gh pr view <N>`.

Reply with a numbered list of performance findings (file:line +
estimated impact + suggestion) or "no performance findings."
```

**Agent 6 — Maintainability:**
```
Review PR #<N> at https://github.com/sfc-gh-jusdavis/BookManager/pull/<N>.

Apply this rubric:
- Naming: does the function/variable name match what it does? Are
  there ambiguous abbreviations? Misleading names ("get" that mutates)?
- Documentation: public-API additions (new router endpoints, new
  service methods) without docstring? Magic numbers without explanation?
- Test coverage: new code paths without any test? (Note: pre-Wave-1
  the project had no test infra; treat tests as "nice to have" until
  /multi-review on a PR that lands pytest/Vitest.)
- Coupling: did a router gain direct knowledge of Snowflake SQL?
  Should it go through SnowflakeDataService? Did a frontend
  component start fetching directly instead of via useApi?
- Error handling: silent excepts? bare except: ? errors swallowed
  without log? errors logged but not surfaced?

Use `gh pr diff <N>` and `gh pr view <N>`.

Reply with a numbered list of maintainability findings (file:line +
concern + suggestion) or "no maintainability findings."
```

3. Use `wait_agent` to collect results from all spawned agents.

4. Consolidate findings into a single review comment:
   ```
   ## Multi-reviewer findings (Pattern 11, --<mode>)

   ### Correctness (P4)
   <Agent 1 findings>

   ### Simplicity (P2)
   <Agent 2 findings>

   ### Surgical (P3)
   <Agent 3 findings>

   <If --full:>
   ### Security
   <Agent 4 findings>

   ### Performance
   <Agent 5 findings>

   ### Maintainability
   <Agent 6 findings>
   <end --full>

   ### Recommendation
   <Address-before-merge / Acceptable-as-is / Needs-discussion>
   ```

5. Post via:
   ```bash
   gh pr review <N> --comment -F /tmp/multi-review-<N>.md
   ```

6. Summarize the recommendation to the user. If "Address-before-merge", list must-fix items by severity.

## Notes

- All subagents inherit the session model. CCD does not currently allow per-subagent model selection. For true cross-vendor review, see `/cross-model-review` (manual 2-window recipe).
- Subagents are ephemeral; they do not remember prior PRs. Each invocation is independent.
- The default mode-picker logic uses PR size + path heuristics; the user's explicit flag always wins.
- For PRs that touch only docs/markdown: skip multi-review entirely. Self-review is enough.
