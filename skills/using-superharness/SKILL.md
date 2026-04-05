---
name: using-superharness
description: "Session start guide: explains how to use superharness skills and conventions. Injected by SessionStart hook."
---

# Using Superharness

This guide is injected at the start of each AI session to establish how superharness skills work.

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
| `superharness:mindmap` | Start visualization server for interactive mindmaps |

## Skill Execution Protocol

When invoking any skill:

1. **Announce**: "I'm using [skill name] to [purpose]."
2. **Check for checklist**: If the skill has a numbered checklist or ordered steps, create a visible task list with one entry per step before starting work. Mark each item as you complete it — this gives the user a clear progress indicator.
3. **Follow the skill exactly**: Execute its instructions in order. Do not skip steps or reorder.

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
