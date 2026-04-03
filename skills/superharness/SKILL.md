---
name: superharness
description: "Main entry point: end-to-end workflow for building features. Use /superharness 'requirement' to start. Orchestrates brainstorm → plan → TDD implementation → review → QA."
---

# Superharness Workflow

End-to-end workflow engine: brainstorm → plan → worktree → TDD implementation → dual review → QA.

## Recovery Check (ALWAYS FIRST)

Before starting anything, check for unfinished work:

```bash
cat .superharness/tasks/.current-task 2>/dev/null
```

If `.current-task` exists and points to a task with `status != "completed"`:

1. Read `task.json` in the task directory → get task name, status, phase, sprint progress
2. Read `git diff` in the worktree → what code has changed
3. Read the last 50 lines of the most recent `.superharness/workspace/*/journal-*.md`
4. Read `contract.md` in the task directory → current sprint's Done Definition

Present a recovery summary to the user:

```
Detected unfinished task: {task-name}
  Sprint progress: {current}/{total}
  Current task: {task-name} ({phase} phase)
  Worktree: {worktree_path}
  Code changes: {N} files modified ({file list})
  Last session: {summary from journal}

Continue current task or start fresh?
```

If user says "continue" → switch to worktree → resume from current phase.
If user says "start fresh" → proceed with normal flow below.

## Normal Flow

### Step 1: Brainstorm

Invoke `superharness:brainstorm` skill to clarify requirements and produce a design spec.

Write trace event:
```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","phase":"brainstorm","event":"start","detail":"User input: {requirement}"}' >> .superharness/tasks/{task}/trace.jsonl
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
