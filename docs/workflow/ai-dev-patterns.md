# The XKCD-Inspired Guide to AI-Assisted Development

> "How to Stop Writing Code and Start Orchestrating Robots"
>
> Based on Lawrence's [AI-Assisted Development Patterns](https://docs.google.com/document/d/1Xy61AnBYLFpe_0QHXMQk99znZdp-yKvoQI6NXxwAEj8/edit?tab=t.0#heading=h.c08sz9glymns) and the Snowflake AI Council
>
> Source: [xkcd AI Dev Patterns.pptx](https://docs.google.com/presentation/d/1tHbg1pfC3C2ehD0xNkdwxk6UjpFmxdbK) by Sridhar Ramaswamy

---

## Table of Contents

- [The Gap](#the-gap)
- [Section 1: 4 Essential IC Patterns](#section-1-4-essential-ic-patterns-start-here)
- [Section 2: 5 Patterns to 10x Yourself](#section-2-5-patterns-to-10x-yourself-dont-start-here)
- [Section 3: 4 Patterns to Standardize On](#section-3-4-patterns-we-need-to-standardize-on-and-build)
- [Section 4: Per-Change Coding Discipline (Karpathy Principles)](#section-4-per-change-coding-discipline-karpathy-principles)
- [The Mindset Shift](#the-mindset-shift)

The 13 numbered patterns describe the **macro workflow** — how teams of agents and humans plan, branch, review, and ship. Section 4's four principles describe the **micro discipline** — how a single agent should behave on each individual change. Apply both.

---

## The Gap

The difference between "using AI" and "having figured out AI" is enormous. It's **13 patterns**.

---

## Section 1: 4 Essential IC Patterns (Start Here)

### Pattern 1: Write Skills

Your agent doesn't know the Snowflake way. It will use the wrong logger every. single. time. **Write skills.**

### Pattern 2: Spec-First / Plan-First Development

Don't start with code. Start with a plan. **English is faster to review than 10,000 lines of code.**

### Pattern 3: Test-First Development

Ask the agent to write tests **BEFORE** implementation. If the tests are wrong, you'll know in 5 minutes instead of 5 days.

### Pattern 4: Feedback Loops

An agent that never sees whether its code compiles will repeat the same mistakes forever.

---

## Section 2: 5 Patterns to 10x Yourself (Don't Start Here)

> The prior patterns are ones everyone needs to learn. The next set are only useful once you can actually get a mostly competent AI session to do the right thing at least some of the time. If not, they're not going to 10x your productivity — they're going to 10x your pain.

### Pattern 5: Parallel Agents via Git Worktrees / Cloud Workspaces

One agent = slow. Multiple agents, same repo = chaos. Multiple agents, Git worktrees / many Cloud Workspaces = **parallel universes.**

### Pattern 6: Task Graphs (Not Flat Plans)

Flat plans drift. **Task graphs with dependencies don't.**

### Pattern 7: Subagents

Tell one agent to spawn ten. They work in parallel. You sip coffee.

*Caveat: Subagents don't always think.*

### Pattern 8: Context Management

That 45k-token Confluence page you just loaded? Your agent's brain is now 90% meeting notes from 2023.

### Pattern 9: Multi-Model Teams

You are the tech lead. **Opus designs. Sonnet implements. Haiku researches.** You never block.

---

## Section 3: 4 Patterns We Need to Standardize On and Build

> These are patterns you can already use today, but we really need to build better Snowflake centralized skills and tooling around.

### Pattern 10: PR-Based Code Review with Agents

Leave comments on your own PR. The diff gives line-level context. Then tell the agent to fix them.

### Pattern 11: Multi-Reviewer Review

One reviewer misses things. **Three reviewers with different jobs catch everything.**

### Pattern 12: Cross-Model Review

Same model family. Same blind spots. **Cross-family review catches what one family misses.**

### Pattern 13: Continuous Improvement Loop

When the agent does something strange, ask, "Why did you do that strange thing?" Update skills, instructions, and tools. **Repeat forever.**

---

## Section 4: Per-Change Coding Discipline (Karpathy Principles)

The 13 patterns above describe **team-level workflow**. The four principles below describe **single-change discipline**. Apply both: the patterns at the macro level, the principles at every keystroke.

These are distilled from Andrej Karpathy's observations on LLM coding pitfalls (via [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills)). Full treatment with worked examples lives in `karpathy-coding-principles.md`.

### Principle A: Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

State assumptions explicitly. Present multiple interpretations when a request is ambiguous — don't pick silently. Push back when a simpler approach exists. Stop and ask when something is unclear.

> Pairs with Pattern 2 (Spec-First). The plan is where assumptions surface.

### Principle B: Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

No features beyond what was asked. No abstractions for single-use code. No "configurability" that wasn't requested. If 200 lines could be 50, rewrite it.

> Pairs with Pattern 11 (Multi-Reviewer Review). One reviewer's specific job is to ask: would a senior engineer call this overcomplicated?

### Principle C: Surgical Changes

**Touch only what you must. Clean up only your own mess.**

Don't "improve" adjacent code while making your change. Don't refactor things that aren't broken. Match existing style. The test: every changed line should trace directly to the user's request.

> Pairs with Pattern 10 (PR-Based Review). Diff size discipline is enforced at PR review time.

### Principle D: Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform "fix the bug" into "write a test that reproduces it, then make it pass." Strong success criteria let the agent loop independently. Weak criteria force constant clarification.

> Pairs with Pattern 3 (Test-First Development) and Pattern 4 (Feedback Loops).

> **Full treatment, worked examples, and an anti-pattern cheat sheet:** see `karpathy-coding-principles.md`.

---

## The Mindset Shift

You are not a coder anymore. You are a **Technical Lead of Agents**. The sooner you accept this, the sooner you 10x.

But being a good tech lead requires **two layers of discipline**:

- **Macro:** the 13 patterns — how you orchestrate work across agents, branches, and reviews.
- **Micro:** the 4 principles — how every individual change is reasoned through and shipped.

Skip either layer and you slow down. Master both and you compound.

---

## Closing

The gap between "using AI" and "figured out AI" is not talent. It's patterns. Now you have them.

**go/ai-dev-patterns**
