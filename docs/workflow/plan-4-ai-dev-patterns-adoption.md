# Plan 4: AI-Dev Patterns Adoption

> **Status:** Pending execution
> **Risk:** LOW-MEDIUM (process changes, no breaking edits)
> **Prerequisite:** Plan 3 complete (WORKFLOW.md exists)
> **Estimated time:** 3-5 hours, can be split across sessions
> **Reversible?** Yes — patterns are habits + small config files

---

## Goal

Activate five of the thirteen patterns from `ai-dev-patterns.md` as concrete, repeatable practices in BookManager development with Cortex Code Desktop (CCD). Each pattern gets a runnable how-to, not just theory.

The five patterns being adopted (per your selection):

| # | Pattern | CCD support |
|---|---------|-------------|
| 5 | Git Worktrees for parallel agents | Full |
| 10 | PR-based code review with agents | Full |
| 11 | Multi-reviewer review | Full (via subagents) |
| 12 | Cross-model review | Partial (within Claude family) |
| 13 | Continuous improvement loop | Full (skills, AGENTS.md, memory) |

---

## Pre-flight

- Plans 1-3 are complete
- `gh` CLI authenticated
- Cortex Code Desktop installed and connected to JDAVIS_AWS1
- Familiarity with WORKFLOW.md from Plan 3

---

## Pattern 5: Git Worktrees

### What it gives you

Run TWO Cortex Code Desktop sessions in parallel, each in a different folder, each on a different branch — both backed by the same git history. The agents can't accidentally edit each other's work because they're in physically separate directories.

### Setup

```bash
cd ~/projects/BookManager

# Create a worktree for branch feat/big-feature in a sibling folder
git worktree add ../BookManager-feat-X feat/big-feature

# Create another for a hotfix
git worktree add ../BookManager-fix-Y fix/critical-bug
```

You now have:

```
~/projects/
  BookManager/              <- main worktree (branch: main)
  BookManager-feat-X/       <- worktree (branch: feat/big-feature)
  BookManager-fix-Y/        <- worktree (branch: fix/critical-bug)
```

Each is a full working copy. They share the same `.git` repo (via a `.git` file pointing to the main one).

### Using with Cortex Code Desktop

1. Open one CCD window in `~/projects/BookManager-feat-X/`
2. Open another CCD window in `~/projects/BookManager-fix-Y/`
3. Each window runs an independent agent session
4. Agents can't conflict — they're in different folders

### When to use

Worktrees shine when:
- You're working on a long-running feature AND need to ship a hotfix
- You want one agent doing exploration while another implements
- You have two independent features to develop in parallel

Don't bother for:
- Simple sequential work (just use one branch)
- Tasks that finish in under an hour

### Cleanup

```bash
# When done with a worktree
cd ~/projects/BookManager
git worktree remove ../BookManager-feat-X
```

The branch itself remains; only the working folder is removed.

### Authoring task

When this plan executes, append a "Worktrees" section to WORKFLOW.md with the recipe above.

---

## Pattern 10: PR-Based Code Review with Agents

### What it gives you

Use the diff in your own PR as line-level context for the agent. Leave comments on specific lines describing what should change, then ask the agent to address them.

### The workflow

1. Open your PR as normal (per WORKFLOW.md)
2. Open the PR in browser via `gh pr view --web` OR use `gh` CLI
3. Read your diff. On any line that needs changing, leave a review comment:
   ```
   "This loop allocates a new list every iteration. Refactor to reuse."
   ```
4. Repeat for every issue you spot
5. In Cortex Code Desktop, run:
   ```
   gh pr view <PR-number> --json reviewComments | jq '.reviewComments[] | {path, line, body}'
   ```
6. Tell the agent: "Address each of these review comments. After each fix, push and we'll see CI."

### Why this works

The agent sees BOTH the diff context AND your specific instructions tied to specific lines. It's much better signal than "the PR has issues, fix them."

### CCD-specific

Cortex Code Desktop's Bash tool can run `gh` commands directly. You don't need any special integration.

### Authoring task

Add a recipe to WORKFLOW.md called "Self-review with agents."

---

## Pattern 11: Multi-Reviewer Review

### What it gives you

Three independent agent reviewers, each with a different focus, catch what one reviewer misses.

### The three roles

Suggested roles for BookManager:

1. **Correctness reviewer.** "Does this code do what the PR description claims? Are there edge cases that aren't handled?"
2. **Simplicity reviewer (Karpathy Principle 2).** "Is anything overcomplicated? Could 200 lines be 50?"
3. **Surgical-changes reviewer (Karpathy Principle 3).** "Does every changed line trace to the PR description? Any drive-by edits?"

### The CCD recipe

Cortex Code Desktop's `runSubagent` tool spawns parallel subagents. Sample invocation:

```
Run three subagents in parallel:

Agent 1 (Correctness):
"Review PR #<N> at <URL>. Focus on correctness. Does each changed line do what
the PR description says? Are edge cases handled? Reply with a list of issues
or 'no issues found.'"

Agent 2 (Simplicity):
"Review PR #<N> at <URL>. Focus on simplicity. Apply Karpathy Principle 2
('Simplicity First' from docs/workflow/karpathy-coding-principles.md). Flag
overcomplication, speculative abstractions, or unnecessary configuration."

Agent 3 (Surgical Changes):
"Review PR #<N> at <URL>. Focus on surgical-changes discipline (Karpathy
Principle 3). Flag any line that does NOT trace directly to the PR
description's stated goals."

When all three complete, consolidate findings into one review."
```

### CCD-specific

Set `run_in_background: true` on the subagent calls so all three run simultaneously. Use `wait_agent` to collect results.

### When to use

Reserve multi-reviewer for:
- Large PRs (300+ lines)
- High-risk changes (auth, billing, data integrity)
- Anything you're unsure about

Don't bother for:
- One-line typo fixes
- Documentation-only PRs

### Authoring task

Save the prompt template above as `~/projects/BookManager/.cortex/commands/multi-review.md`.

---

## Pattern 12: Cross-Model Review

### What it gives you

Two different models reviewing the same PR catch each other's blind spots. Same model family ⇒ same blind spots; cross-family ⇒ different perspectives.

### CCD support and limitation

CCD currently runs Claude. You can vary the model WITHIN the Claude family:

- Claude Opus 4 — deep reasoning, slower
- Claude Sonnet — balanced
- Claude Haiku — fast, lighter analysis

True cross-vendor (Claude + GPT, Claude + Gemini) is not supported in CCD as of this writing. For BookManager, we approximate by:

1. Running a "deep" review with Opus (use a CCD subagent with the Opus model)
2. Running a "fast" review with Sonnet
3. Comparing the outputs

### The recipe

```
Subagent 1 (Opus, deep review):
"You are using Claude Opus. Perform a careful, multi-pass review of PR #<N>.
Look for subtle bugs, edge cases, and performance issues. Take your time."

Subagent 2 (Sonnet, broad review):
"You are using Claude Sonnet. Quickly scan PR #<N> for obvious issues:
style violations, simple bugs, missing tests."
```

If they disagree, the disagreement itself is signal — investigate.

### Authoring task

Note this limitation in `.cortex/commands/cross-model-review.md` and document a path for adding GPT review when CCD adds support.

### Future enhancement

When CCD or your wider tooling supports multi-vendor models, expand this pattern. Until then, treat cross-Claude-model as the closest available approximation.

---

## Pattern 13: Continuous Improvement Loop

### What it gives you

Every time the agent does something weird or wrong, you turn that observation into a permanent improvement to the agent's behavior — via skills, AGENTS.md, or `.cortex/commands/`.

### The mechanic

1. You notice the agent doing something undesired.
2. You ask: "Why did you do that?"
3. The agent explains its reasoning.
4. You decide: was the reasoning wrong, or was the prompt missing context?
5. Update the relevant artifact:
   - **Project-specific quirk** -> AGENTS.md
   - **Repeated behavior across many projects** -> a skill in `~/.cortex/skills/`
   - **Common task that should be one command** -> `.cortex/commands/<name>.md`
6. Verify on the next similar task: did the change land?

### Examples for BookManager

You might notice:
- "Agent keeps using `git add .` even though our convention is explicit paths"  ⇒ add a stronger reminder to AGENTS.md
- "Agent keeps writing tests in the wrong test framework"  ⇒ add a "Testing in BookManager" section to AGENTS.md
- "Agent keeps using SNOWADHOC for DDL despite the global rule"  ⇒ already covered in your global ctx rules; verify rule fires

### Where things live

| Scope | Location | Format |
|-------|----------|--------|
| BookManager-specific | `~/projects/BookManager/AGENTS.md` | Markdown sections |
| Global to your CCD | `~/.cortex/skills/<name>/SKILL.md` | Skill markdown |
| Reusable command | `~/projects/BookManager/.cortex/commands/<name>.md` | Slash command markdown |
| Cross-session memory | `/memories/<topic>.md` (via memory tool) | Free-form notes |

### Authoring task

When this plan executes, add a "Continuous Improvement" section to AGENTS.md that explicitly invites the agent to suggest edits when it does something the user finds weird.

---

## Implementation Steps (when this plan is executed)

1. Create branch: `git checkout -b chore/ai-dev-patterns-adoption`
2. Append "Worktrees" recipe section to WORKFLOW.md
3. Append "Self-review with agents" section to WORKFLOW.md
4. Author `.cortex/commands/multi-review.md` (template from Pattern 11)
5. Author `.cortex/commands/cross-model-review.md` (template from Pattern 12, with limitation note)
6. Add "Continuous Improvement" section to AGENTS.md
7. `git add WORKFLOW.md AGENTS.md .cortex/`
8. `git commit -m "chore: adopt ai-dev patterns 5, 10, 11, 12, 13"`
9. Push, open PR, smoke-test by reading the new docs and running multi-review on the PR itself
10. Merge

---

## Definition of Done

- [ ] WORKFLOW.md has Worktrees + Self-review sections
- [ ] `.cortex/commands/multi-review.md` exists
- [ ] `.cortex/commands/cross-model-review.md` exists with the model-availability caveat
- [ ] AGENTS.md has a Continuous Improvement section
- [ ] You have run multi-review on at least one real PR successfully
- [ ] You have created and used at least one worktree

---

## Long-Term Maintenance

These patterns are not "set and forget." Quarterly:

- Re-read your AGENTS.md. Is it accurate? Out of date entries?
- Review `.cortex/commands/`. Are commands still relevant? Any new ones to add?
- Audit recent PRs. Are reviewers catching issues? Are simplicity / surgical-changes principles being applied?
- Update `docs/workflow/` plans if your process has evolved

This is Pattern 13 in action: the workflow itself is subject to continuous improvement.
