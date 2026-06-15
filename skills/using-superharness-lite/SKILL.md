---
name: using-superharness-lite
description: "Session start guide: explains how to use superharness skills and conventions. Injected by SessionStart hook."
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you MUST invoke the skill.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

# Using Skills

## Instruction Priority

These skills override default system prompt behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (CLAUDE.md, project settings, direct requests) — highest priority
2. **Skills** — override default system behavior where they conflict
3. **Default system prompt** — lowest priority

## Available Skills

These skills auto-trigger by their description — invoke them via the Skill tool when the situation matches.

| Skill | When to Use |
|-------|-------------|
| `clarify` | Starting a non-trivial dev task whose requirements leave open questions (scope, data shape, UX, compatibility) that would change the implementation — resolve them BEFORE coding. |
| `discover` | The project lacks AGENTS.md/CLAUDE.md, or the spec is stale — scan the codebase from real evidence and write the project spec. |
| `learn` | Persist durable learnings (user corrections, pitfalls and fixes, decisions not visible in code) into the project knowledge wiki. |
| `test` | After ALL development on a task is complete — one terminal pass: Spec Review → Code Review → test suite. Not per change. |

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means you should invoke it to check. If an invoked skill turns out wrong for the situation, you don't need to use it.

## Skill Priority

When multiple skills could apply, use this order:

1. **Up front** — `clarify` resolves undecided requirements before any code is written.
2. **Project understanding** — `discover` establishes the spec when the project has none or it has drifted.
3. **On completion** — `test` is the terminal gate after all development is done.
4. **End of session** — `learn` captures anything durable worth remembering.

"Let's build X" → clarify undecided requirements first, then implement.
"Fix this bug" → investigate root cause first, then fix, then the terminal test pass.

## Skill Types

**Rigid** (test, verification): Follow exactly. Don't adapt away discipline.

**Flexible** (clarify, discover): Adapt principles to context.

The skill itself tells you which.

## Red Flags

These thoughts mean STOP — you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I'll clarify after I start coding" | Clarification comes BEFORE implementation, not after. |
| "Tests can wait" | Finishing a task means a clean terminal review-and-test pass. |
| "Nothing worth learning here" | Maybe — but let `learn` decide; don't skip the check. |
| "I already know this skill" | Skills evolve. Read the current version. |

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip the workflow.

## Project Conventions

Project-specific conventions live as a spec, with AGENTS.md + CLAUDE.md as the thin always-loaded entry and detail under `.superharness/spec/` (read on demand). The `discover` skill generates and refreshes them from real evidence in the codebase.

Read the relevant spec files before starting work on any task.

## Durable Knowledge

Learnings accumulate in `.superharness/learnings/`, organized as a topic wiki. `INDEX.md` is the catalog and the only file loaded into future sessions. Read a linked learning file before relying on it; persist new ones with the `learn` skill.
