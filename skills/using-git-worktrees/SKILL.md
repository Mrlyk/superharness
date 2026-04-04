---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - creates isolated git worktrees with smart directory selection and safety verification
---

# Using Git Worktrees

## Overview

Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching.

**Core principle:** Config-driven setup + safety verification = reliable isolation.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

## Configuration

Read `.superharness/worktree.yaml` for project-specific worktree settings:

```bash
cat .superharness/worktree.yaml 2>/dev/null
```

Expected config format:

```yaml
worktree_dir: .worktrees          # Where to create worktrees
copy:                              # Files/dirs to copy into new worktree
  - .superharness/
post_create: []                    # Commands to run after creation
verify:                            # Commands to verify worktree is healthy
  - npm test
  - npx tsc --noEmit
```

If no config file exists, fall back to the directory selection process below.

## Directory Selection Process

Follow this priority order:

### 1. Check worktree.yaml Config

```bash
cat .superharness/worktree.yaml 2>/dev/null | grep worktree_dir
```

**If config exists:** Use the configured `worktree_dir`. Skip to Safety Verification.

### 2. Check Existing Directories

```bash
# Check in priority order
ls -d .worktrees 2>/dev/null     # Preferred (hidden, matches default config)
ls -d worktrees 2>/dev/null      # Alternative
```

**If found:** Use that directory. If both exist, `.worktrees` wins.

### 3. Check CLAUDE.md

```bash
grep -i "worktree.*director" CLAUDE.md 2>/dev/null
```

**If preference specified:** Use it without asking.

### 4. Ask User

If no directory exists and no configuration found:

```
No worktree directory found. Where should I create worktrees?

1. .worktrees/ (project-local, hidden - recommended)
2. Custom path

Which would you prefer?
```

## Safety Verification

### For Project-Local Directories (.worktrees or worktrees)

**MUST verify directory is ignored before creating worktree:**

```bash
# Check if directory is ignored (respects local, global, and system gitignore)
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**If NOT ignored:**

Fix immediately:
1. Add appropriate line to .gitignore
2. Commit the change
3. Proceed with worktree creation

**Why critical:** Prevents accidentally committing worktree contents to repository.

## Creation Steps

### 1. Detect Project Name

```bash
project=$(basename "$(git rev-parse --show-toplevel)")
```

### 2. Create Branch and Worktree

Branch naming convention: `superharness/{feature-name}`

```bash
# Determine full path from config or fallback
worktree_dir=$(grep worktree_dir .superharness/worktree.yaml 2>/dev/null | awk '{print $2}')
worktree_dir=${worktree_dir:-.worktrees}

branch_name="superharness/$FEATURE_NAME"
path="$worktree_dir/$FEATURE_NAME"

# Create worktree with new branch
git worktree add "$path" -b "$branch_name"
```

### 3. Copy Minimal .superharness/ to Worktree

Copy only the files the worktree needs — NOT the entire `.superharness/` directory. This avoids duplicate task state and workspace logs that would confuse the user about which copy is authoritative.

```bash
# Create minimal .superharness/ structure in worktree
mkdir -p "$path/.superharness/tasks"

# 1. Copy spec (needed for coding conventions)
cp -r .superharness/spec/ "$path/.superharness/spec/"

# 2. Copy config and workflow
cp .superharness/config.yaml "$path/.superharness/config.yaml"
cp .superharness/workflow.md "$path/.superharness/workflow.md"
cp .superharness/worktree.yaml "$path/.superharness/worktree.yaml"

# 3. Copy ONLY the current task directory (not all tasks)
current_task=$(cat .superharness/tasks/.current-task 2>/dev/null)
if [ -n "$current_task" ] && [ -d "$current_task" ]; then
  cp -r "$current_task" "$path/$current_task"
fi

# 4. Create worktree's own .current-task pointer
if [ -n "$current_task" ]; then
  echo "$current_task" > "$path/.superharness/tasks/.current-task"
fi
```

**What is NOT copied:**
- Other task directories (only the active task is relevant)
- `workspace/` journals (session-specific, not needed in worktree)

**Task state updates happen in the worktree.** When the worktree is merged back, the updated task.json in the worktree is the authoritative version.

### 4. Run Post-Create Commands

If `post_create` commands are defined in worktree.yaml, run them:

```bash
cd "$path"
# Run each command from post_create list
```

### 5. Run Project Setup

Auto-detect and run appropriate setup:

```bash
cd "$path"

# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

### 6. Verify Clean Baseline

Run verification commands from worktree.yaml, or auto-detect:

```bash
# If verify commands exist in config, run them:
# e.g., npm test && npx tsc --noEmit

# Otherwise, auto-detect:
# npm test / cargo test / pytest / go test ./...
```

**If tests fail:** Report failures, ask whether to proceed or investigate.

**If tests pass:** Report ready.

### 7. Log Trace Event

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","phase":"plan","event":"worktree_created","detail":"Worktree 已创建: '"$path"' 分支: '"$branch_name"'"}' >> .superharness/tasks/{task}/trace.jsonl
```

### 8. Report Location

```
Worktree ready at <full-path>
Branch: superharness/<feature-name>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| worktree.yaml exists | Use configured `worktree_dir` |
| `.worktrees/` exists | Use it (verify ignored) |
| `worktrees/` exists | Use it (verify ignored) |
| Both exist | Use `.worktrees/` |
| Neither exists, no config | Check CLAUDE.md, then ask user |
| Directory not ignored | Add to .gitignore + commit |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |
| `copy` defined in config | Copy files into new worktree |
| `post_create` defined | Run commands after worktree creation |

## Common Mistakes

### Skipping ignore verification

- **Problem:** Worktree contents get tracked, pollute git status
- **Fix:** Always use `git check-ignore` before creating project-local worktree

### Ignoring worktree.yaml config

- **Problem:** Creates worktree with wrong settings, misses required file copies
- **Fix:** Always read `.superharness/worktree.yaml` first

### Assuming directory location

- **Problem:** Creates inconsistency, violates project conventions
- **Fix:** Follow priority: config > existing > CLAUDE.md > ask

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

### Hardcoding setup commands

- **Problem:** Breaks on projects using different tools
- **Fix:** Use verify commands from config, or auto-detect from project files

### Wrong branch naming

- **Problem:** Inconsistent branch names across the team
- **Fix:** Always use `superharness/{feature-name}` prefix

## Example Workflow

```
You: I'm using the using-git-worktrees skill to set up an isolated workspace.

[Read .superharness/worktree.yaml - worktree_dir: .worktrees, copy: [.superharness/]]
[Check .worktrees/ - exists]
[Verify ignored - git check-ignore confirms .worktrees/ is ignored]
[Create worktree: git worktree add .worktrees/auth -b superharness/auth]
[Copy .superharness/ to .worktrees/auth/.superharness/]
[Run npm install]
[Run verify commands: npm test && npx tsc --noEmit - 47 passing, no type errors]
[Log trace: plan:worktree_created]

Worktree ready at /Users/dev/myproject/.worktrees/auth
Branch: superharness/auth
Tests passing (47 tests, 0 failures)
Ready to implement auth feature
```

## Red Flags

**Never:**
- Create worktree without verifying it's ignored (project-local)
- Skip baseline test verification
- Proceed with failing tests without asking
- Assume directory location when ambiguous
- Skip worktree.yaml config check
- Use branch names without `superharness/` prefix
- Skip copying files listed in worktree.yaml `copy`

**Always:**
- Read `.superharness/worktree.yaml` first
- Follow directory priority: config > existing > CLAUDE.md > ask
- Verify directory is ignored for project-local
- Use `superharness/{feature-name}` branch naming
- Auto-detect and run project setup
- Verify clean test baseline
- Log `plan:worktree_created` trace event

## Integration

**Called by:**
- **superharness:brainstorm** - When design is approved and implementation follows
- **superharness:subagent-driven-development** - REQUIRED before executing any tasks
- Any skill needing isolated workspace

**Pairs with:**
- **superharness:finishing-a-development-branch** - REQUIRED for cleanup after work complete
