---
name: go
description: "Main entry point: end-to-end workflow for building features. Use /superharness:go 'requirement' to start. Orchestrates brainstorm → plan → TDD implementation → review → QA."
---

# Superharness Workflow

End-to-end workflow engine: brainstorm → plan → worktree → TDD implementation → dual review → QA.

## Note on Recovery

Unfinished task detection is handled by the **session-start hook**, not by this skill. When a session starts, the hook checks `.superharness/tasks/.current-task` and injects task status into the session context. The AI will automatically ask the user whether to continue the unfinished task before any skill is invoked.

If the user chooses to continue an unfinished task, the AI resumes from the current phase without invoking `/superharness:go`. If the user chooses to start fresh, they invoke `/superharness:go "new requirement"` which proceeds with the normal flow below.

## Normal Flow

### Step 1: Brainstorm

Invoke `superharness:brainstorm` skill to clarify requirements and produce a design spec.

Write trace event:
```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","phase":"brainstorm","event":"start","detail":"用户输入: {requirement}"}' >> .superharness/tasks/{task}/trace.jsonl
```

### Step 2: Plan

Invoke `superharness:writing-plans` skill to create implementation plan with task breakdown.

The plan creates:
- `.superharness/tasks/{MM}-{DD}-{name}/` directory
- `task.json` with status, phase, sprint progress
- `prd.md` with requirements
- `contract.md` with Sprint Contract / Done Definition
- `.current-task` pointer

### Step 3: Worktree

Invoke `superharness:using-git-worktrees` skill to create an isolated development environment.

### Step 4: Implement

Invoke `superharness:subagent-driven-development` skill to execute the plan:
- One fresh subagent per task
- TDD (Red-Green-Refactor) for each task
- Dual review: spec compliance → code quality
- Update task.json phase as work progresses

### Step 5: Complete

Invoke `superharness:finishing-a-development-branch` skill:
- Verify all tests pass
- Generate trace-summary.md from trace.jsonl
- Present merge/PR/keep/discard options
- Clean up worktree if merging

### Step 6: QA (Optional)

If the user wants QA evaluation:
- Run `/superharness:qa` to trigger external QA services
- If issues found: run `/superharness:fix` to address them

## Task State Management

Throughout the workflow, keep task.json updated:

```json
{
  "name": "task-name",
  "title": "Human-readable title",
  "status": "planning | in_progress | review | completed",
  "phase": "brainstorm | plan | implement | check | complete",
  "worktree_path": "/path/to/worktree",
  "sprint": {
    "current": 1,
    "total": 5
  },
  "created_at": "ISO date",
  "updated_at": "ISO date"
}
```

Update `.current-task` to point to the active task directory (relative path from project root):
```bash
echo ".superharness/tasks/{MM}-{DD}-{name}" > .superharness/tasks/.current-task
```

## Trace Logging

At each major transition, append to `trace.jsonl`:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","phase":"{phase}","event":"{event}","detail":"{detail}"}' >> .superharness/tasks/{task}/trace.jsonl
```

Key events to log:
- `brainstorm:start`, `brainstorm:spec_confirmed`
- `plan:tasks_created`, `plan:worktree_created`
- `implement:task_start`, `implement:tdd_red`, `implement:tdd_green`, `implement:task_complete`
- `check:spec_review`, `check:code_review`
- `qa:qa_start`, `qa:qa_result`
- `fix:fix_start`, `fix:fix_complete`

## Red Flags

- **Never** skip brainstorm phase, even for "simple" tasks
- **Never** start implementation without a plan
- **Never** work on main/master without creating a worktree first
- **Never** skip the dual review (spec + quality)
- **Never** declare completion without running tests
