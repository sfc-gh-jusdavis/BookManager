Cross-vendor PR review using two different model families. Currently a manual 2-window recipe; full automation is blocked on CCD adding per-subagent model selection (see "Limitations" below).

## Why cross-model

A single model family can have systematic blindspots — patterns it consistently overlooks because of training-data overlap. Running the same PR through two distinct model families (e.g., Anthropic Claude + OpenAI GPT) surfaces disagreement, which is the strongest signal that something deserves a closer look.

This is AI-Dev Pattern 12 (Cross-Model Review).

## Limitations (be honest about this)

CCD's `runSubagent` does NOT currently support per-subagent model selection. All subagents inherit the parent session's model. Therefore:

- `/multi-review` runs 3 (or 6) parallel agents, but they all use the same model family. That's still useful (different prompts catch different things), but it is NOT cross-vendor.
- True cross-model review today requires the user to manually switch the CCD session model between two windows.

When CCD adds per-subagent model selection, this command should be rewritten to spawn natively across vendors. Until then: manual 2-window recipe.

## The Manual 2-Window Recipe

### Setup

1. Open **CCD Window A**. Set session model to **Claude Opus** (or whichever Anthropic model is current).
2. Open **CCD Window B**. Set session model to **GPT** (or whichever OpenAI model is current).
3. Both windows must have repository context loaded.

### Run

In each window, paste:

```
Review PR #<N> at https://github.com/sfc-gh-jusdavis/BookManager/pull/<N>.

Apply Karpathy's 4 principles from docs/dev-ops/coding-principles.md:
- P1 Think: silent assumptions in the diff?
- P2 Simplicity: anything overcomplicated?
- P3 Surgical: every changed line traces to PR description?
- P4 Goal-Driven: changes verifiable?

Also surface:
- Security: authz gaps, SQL injection, secret exposure, PII
- Performance: N+1 queries, missing indexes, unnecessary re-renders
- Maintainability: naming, docstrings, coupling, error handling

Reply with a numbered list of findings (file:line + severity + concern + suggestion) or "no findings."
```

### Compare

1. Save Window A's findings to `/tmp/pr-<N>-windowA.md`.
2. Save Window B's findings to `/tmp/pr-<N>-windowB.md`.
3. Diff them mentally:
   - **Both flag X** -> high confidence; address before merge.
   - **Only one flags X** -> medium confidence; investigate.
   - **They disagree on X** -> highest signal; this is exactly what cross-model is for. Probably an architectural or stylistic judgment call worth a human decision.

### Optional consolidation

```bash
gh pr review <N> --comment -F /tmp/pr-<N>-cross-model-summary.md
```

Format:
```
## Cross-Model Review (Pattern 12, manual recipe)

### Both models flagged
<consensus findings>

### Anthropic only
<window A findings not in B>

### OpenAI only
<window B findings not in A>

### Disagreement
<things both flagged with different conclusions>

### Recommendation
<Address-before-merge / Acceptable-as-is / Needs-human-judgment-call>
```

## When to use

- High-risk changes (auth, data integrity, schema migrations, anything in `BKMNG_USERS` path)
- PRs where `/multi-review --full` finds zero issues but you have a nagging sense something is off
- Architectural decisions where systematic blindspots are likely (e.g., concurrency, caching invariants, security boundaries)

## When NOT to use

- Trivial PRs (typo fixes, doc-only edits)
- PRs you've already deeply reviewed yourself
- When the marginal benefit isn't worth the manual 2-window cost

## Future work (when CCD adds per-subagent model selection)

This command should evolve to:

1. Single invocation in the parent session
2. Spawns Window A subagent with `model: anthropic/claude-opus`
3. Spawns Window B subagent with `model: openai/gpt-5`
4. Both run the same review prompt in parallel
5. Parent consolidates findings automatically

Track this via the SnowBoard if/when the underlying capability lands. Update [docs/dev-ops/ai-dev-patterns.md](../../docs/dev-ops/ai-dev-patterns.md) Section 2 row for Pattern 9.
