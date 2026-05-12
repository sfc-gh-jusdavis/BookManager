# Karpathy Coding Principles for AI-Assisted Development

> Distilled from [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills), based on Andrej Karpathy's [observations on LLM coding pitfalls](https://x.com/karpathy/status/2015883857489522876).
>
> Source license: MIT

---

## Why These Exist

Andrej Karpathy noticed three common failure modes when LLMs write code:

1. **Wrong assumptions ran silently.** "The models make wrong assumptions on your behalf and just run along with them without checking. They don't manage their confusion, don't seek clarifications, don't surface inconsistencies, don't present tradeoffs, don't push back when they should."

2. **Overcomplication.** "They really like to overcomplicate code and APIs, bloat abstractions, don't clean up dead code... implement a bloated construction over 1000 lines when 100 would do."

3. **Drive-by edits.** "They still sometimes change/remove comments and code they don't sufficiently understand as side effects, even if orthogonal to the task."

The four principles below directly address each failure mode. They are micro-level coding discipline that complements the macro-level workflow patterns in `ai-dev-patterns.md`.

---

## The Four Principles

### Principle 1: Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing anything:

- **State assumptions explicitly.** If you are uncertain, ask rather than guess.
- **Present multiple interpretations.** When a request is ambiguous, surface the alternatives — don't pick silently.
- **Push back when warranted.** If a simpler approach exists, say so.
- **Stop when confused.** Name what is unclear and ask for clarification.

The behavior to avoid: silently choosing one interpretation of a vague request and writing 200 lines of code that solves the wrong problem.

---

### Principle 2: Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

The test: *Would a senior engineer say this is overcomplicated?* If yes, simplify.

The mindset: good code solves *today's* problem simply. It does not pre-solve tomorrow's hypothetical problem.

---

### Principle 3: Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that *your* changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: *Every changed line should trace directly to the user's request.*

---

### Principle 4: Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform imperative tasks into verifiable goals:

| Vague request | Verifiable goal |
|---|---|
| "Add validation" | "Write tests for invalid inputs, then make them pass" |
| "Fix the bug" | "Write a test that reproduces it, then make it pass" |
| "Refactor X" | "Ensure tests pass before and after" |

For multi-step tasks, state a brief plan with verification at each step:

```
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

Karpathy's key insight: *"LLMs are exceptionally good at looping until they meet specific goals. Don't tell it what to do, give it success criteria and watch it go."*

Strong success criteria let the agent loop independently. Weak criteria ("make it work") force the human into constant clarification.

---

## Worked Examples

### Example A: Hidden Assumptions (Principle 1)

**User request:** "Add a feature to export user data."

**What an undisciplined agent does:**

```python
def export_users(format='json'):
    users = User.query.all()
    if format == 'json':
        with open('users.json', 'w') as f:
            json.dump([u.to_dict() for u in users], f)
    # ...
```

Problems: assumed scope (all users), assumed file destination, assumed which fields, assumed format options.

**What a disciplined agent does:**

> Before implementing, I need to clarify:
> 1. Scope — all users or filtered? (privacy implications)
> 2. Format — file download? background job with email? API endpoint?
> 3. Fields — which? (some may be sensitive)
> 4. Volume — affects approach
>
> Simplest approach: API endpoint returning paginated JSON. Need more info for file-based exports. What's your preference?

---

### Example B: Over-abstraction (Principle 2)

**User request:** "Add a function to calculate discount."

**Undisciplined:** Strategy pattern, abstract base class, dataclass config, three concrete strategies, a calculator class. ~50 lines for a one-line problem.

**Disciplined:**

```python
def calculate_discount(amount: float, percent: float) -> float:
    """Calculate discount amount. percent should be 0-100."""
    return amount * (percent / 100)
```

When to add complexity: only when you actually need multiple discount types. If that requirement comes later, refactor then.

---

### Example C: Drive-by Refactoring (Principle 3)

**User request:** "Fix the bug where empty emails crash the validator."

**Undisciplined diff:** fixes the bug AND tightens email regex AND adds username length validation AND adds docstring AND changes quote style.

**Disciplined diff:** changes only the two lines that handle the empty-email case. Nothing else.

The mantra: *Every changed line should trace directly to the user's request.*

---

### Example D: Verifiable Goals (Principle 4)

**User request:** "The sorting breaks when there are duplicate scores."

**Undisciplined:** Immediately rewrites the sort function based on assumed cause.

**Disciplined:**

```python
# Step 1: Write a test that reproduces the bug
def test_sort_with_duplicate_scores():
    scores = [
        {'name': 'Alice', 'score': 100},
        {'name': 'Bob', 'score': 100},
        {'name': 'Charlie', 'score': 90},
    ]
    result = sort_scores(scores)
    assert result[0]['score'] == 100
    assert result[1]['score'] == 100
    assert result[2]['score'] == 90

# Run test -> fails (bug reproduced)

# Step 2: Fix with stable sort
def sort_scores(scores):
    return sorted(scores, key=lambda x: (-x['score'], x['name']))

# Run test -> passes (bug fixed, verifiable)
```

The reproducer becomes a regression test. Future changes can't silently re-break this.

---

## Anti-Pattern Cheat Sheet

| Principle | Anti-pattern | Fix |
|-----------|--------------|-----|
| Think Before Coding | Silently assumes file format, scope, fields | List assumptions explicitly, ask for clarification |
| Simplicity First | Strategy pattern for a single calculation | One function until complexity is actually needed |
| Surgical Changes | Reformats quotes, adds type hints while fixing a bug | Only change lines that fix the reported issue |
| Goal-Driven | "I'll review and improve the code" | "Write test for bug X, make it pass, verify no regressions" |

---

## When to Apply Full Rigor

These principles bias toward caution over speed. Use judgment:

| Task type | Apply rigor? |
|---|---|
| Typo fix, one-line bug, obvious rename | No — just do it |
| New feature, refactor, anything spanning multiple files | Yes |
| Anything you'd be uncomfortable explaining in a code review | Yes |
| Anything where "I think this is what they meant" appears in your reasoning | Yes — stop and clarify first |

The goal is reducing costly mistakes on non-trivial work, not slowing down trivial tasks.

---

## How to Know These Are Working

You should see:

- **Fewer unnecessary changes in diffs.** Only requested changes appear.
- **Fewer rewrites due to overcomplication.** Code is simple the first time.
- **Clarifying questions come before implementation.** Not after mistakes.
- **Clean, minimal PRs.** No drive-by refactoring or "improvements."

---

## Relationship to ai-dev-patterns.md

The 13 patterns in `ai-dev-patterns.md` describe the **macro workflow**: how teams of agents and humans plan, branch, review, and ship.

These four principles describe the **micro discipline**: how a single agent should behave on each individual change.

Apply both:

- Use the patterns to structure your day, your week, your codebase.
- Apply the principles every time you touch a line of code.

---

## Attribution

Source: [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) (MIT License)

Original observations: [Andrej Karpathy on X](https://x.com/karpathy/status/2015883857489522876)
