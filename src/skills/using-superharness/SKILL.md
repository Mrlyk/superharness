---
name: using-superharness
description: "Session start guide: explains how to use superharness skills and conventions. Injected by SessionStart hook."
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you MUST invoke the skill.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

# Using Superharness

## Instruction Priority

Superharness skills override default system prompt behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (CLAUDE.md, project settings, direct requests) — highest priority
2. **Superharness skills** — override default system behavior where they conflict
3. **Default system prompt** — lowest priority

## Available Skills

| Skill | When to Use |
|-------|-------------|
| `superharness:go` | Main entry: `/superharness:go "requirement"` for end-to-end workflow |
| `superharness:brainstorm` | Before any creative work — explore ideas, clarify requirements |
| `superharness:writing-plans` | After brainstorm — create detailed implementation plans |
| `superharness:subagent-driven-development` | Execute plans with fresh subagent per task + dual review |
| `superharness:test-driven-development` | TDD Iron Law: no production code without failing test first |
| `superharness:verification-before-completion` | No completion claims without fresh verification evidence |
| `superharness:systematic-debugging` | Root cause investigation before any fix attempt |
| `superharness:using-git-worktrees` | Isolated development environments |
| `superharness:finishing-a-development-branch` | Complete work: merge/PR/keep/discard |
| `superharness:sh-fix` | Fix QA issues from qa-issues.json |
| `superharness:sh-qa` | Trigger external QA evaluation |
| `superharness:spec-discover` | Scan codebase, discover conventions, update .superharness/spec/ |
| `superharness:spec-update` | Save user-stated conventions to .superharness/spec/ |
| `superharness:mindmap` | Start visualization server for interactive mindmaps |

# Using Skills

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

```dot
digraph skill_flow {
    "User message received" [shape=doublecircle];
    "About to EnterPlanMode?" [shape=doublecircle];
    "Already brainstormed?" [shape=diamond];
    "Invoke brainstorming skill" [shape=box];
    "Might any skill apply?" [shape=diamond];
    "Invoke Skill tool" [shape=box];
    "Announce: 'Using [skill] to [purpose]'" [shape=box];
    "Has checklist?" [shape=diamond];
    "Create visible task list per item" [shape=box];
    "Follow skill exactly" [shape=box];
    "Respond (including clarifications)" [shape=doublecircle];

    "About to EnterPlanMode?" -> "Already brainstormed?";
    "Already brainstormed?" -> "Invoke brainstorming skill" [label="no"];
    "Already brainstormed?" -> "Might any skill apply?" [label="yes"];
    "Invoke brainstorming skill" -> "Might any skill apply?";

    "User message received" -> "Might any skill apply?";
    "Might any skill apply?" -> "Invoke Skill tool" [label="yes, even 1%"];
    "Might any skill apply?" -> "Respond (including clarifications)" [label="definitely not"];
    "Invoke Skill tool" -> "Announce: 'Using [skill] to [purpose]'";
    "Announce: 'Using [skill] to [purpose]'" -> "Has checklist?";
    "Has checklist?" -> "Create visible task list per item" [label="yes"];
    "Has checklist?" -> "Follow skill exactly" [label="no"];
    "Create visible task list per item" -> "Follow skill exactly";
}
```

## Red Flags

These thoughts mean STOP — you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "I can handle this without a skill" | If a skill exists for this, use it. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "This doesn't need a formal skill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "I already know this skill" | Skills evolve. Read current version. |

## Skill Priority

When multiple skills could apply, use this order:

1. **Process skills first** (brainstorm, debugging) — these determine HOW to approach the task
2. **Implementation skills second** (writing-plans, subagent-driven-development) — these guide execution

"Let's build X" → brainstorm first, then implementation skills.
"Fix this bug" → debugging first, then domain-specific skills.

## Skill Types

**Rigid** (TDD, verification, debugging): Follow exactly. Don't adapt away discipline.

**Flexible** (brainstorm, writing-plans): Adapt principles to context.

The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.

## Iron Laws (Non-Negotiable)

1. **TDD**: No production code without a failing test first
2. **Verification**: No completion claims without fresh verification evidence
3. **Debugging**: No fixes without root cause investigation first

## Project Conventions

Project-specific conventions are defined in `.superharness/spec/`. Each `index.md` contains:
- **Pre-Dev Checklist**: Files to read before coding
- **Quality Check**: Items to verify after coding

Read the relevant spec files before starting work on any task.

## Task State

Current task state is tracked in `.superharness/tasks/`. Check `.superharness/tasks/.current-task` to find the active task.

## Trace Logging

Log key events to `.superharness/tasks/{task}/trace.jsonl` at major transitions. This enables post-mortem analysis of the development process.
