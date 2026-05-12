Run two subagents reviewing the same PR with different model behaviors to catch each other's blind spots (Pattern 12).

**Caveat — model availability:** Cortex Code Desktop currently runs the Claude family. True cross-vendor review (Claude + GPT, Claude + Gemini) is NOT supported. We approximate by varying within the Claude family or by running two passes with different focal lengths. When/if multi-vendor support arrives, expand this command.

Steps:

1. Ask which PR (number or URL).

2. Spawn two subagents in parallel via `runSubagent` with `run_in_background: true`:

   **Agent A — Deep / careful pass:**
   ```
   Perform a careful, multi-pass review of PR #<N> at
   https://github.com/sfc-gh-jusdavis/BookManager/pull/<N>.

   Focus: subtle bugs, edge cases, performance issues. Take your time.
   Read the diff slowly. Trace data flow.

   Read docs/workflow/karpathy-coding-principles.md.

   Use `gh pr diff <N>` and `gh pr view <N>`.

   Reply with detailed findings: each issue with file:line, severity,
   reasoning, suggested fix.
   ```

   **Agent B — Fast / broad pass:**
   ```
   Quickly scan PR #<N> at
   https://github.com/sfc-gh-jusdavis/BookManager/pull/<N> for:
   - Style violations
   - Simple bugs (typos, off-by-one, null deref)
   - Missing tests
   - Obvious naming issues

   Use `gh pr diff <N>`.

   Reply tersely: bullet list of concerns, no narrative.
   ```

3. Use `wait_agent` to collect both.

4. Compare results:
   - **Agreed issues** → high-confidence; surface to user
   - **Disagreement** → notable signal; investigate the disagreement itself

5. Post a consolidated review comment via:
   ```bash
   gh pr review <N> --comment -b "<comparison + recommendations>"
   ```

6. Summarize to user with explicit note about the model-availability limitation.

## Future enhancement

When CCD or wider tooling supports multi-vendor models, replace one of the agents with a non-Claude model. The disagreement signal is dramatically stronger across model families than within one.
