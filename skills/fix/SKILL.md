---
name: fix
description: "Fix QA issues: reads qa-issues.json written by superharness qa, fixes each issue using TDD, then re-runs QA to verify."
---

# Fix QA Issues

Read `qa-issues.json` and fix pending issues using TDD, then re-run QA to verify fixes.

## Prerequisites

`superharness qa` (CLI or `/superharness:qa` skill) must have already run and written `qa-issues.json` to the current task directory.

## Process

### Step 1: Load Issues

```bash
cat .superharness/tasks/{task}/qa-issues.json
```

Filter for `status: "pending"` issues. Sort by severity: critical → major → minor → suggestion.

If no pending issues, report "No pending QA issues" and stop.

### Step 2: Fix Each Issue (TDD)

For each pending issue, in severity order:

1. **Read the issue**: file, line, message, fix_hint, category
2. **Write a failing test** that reproduces the issue (RED phase)
3. **Fix the code** to make the test pass (GREEN phase)
4. **Verify**: run the test suite to confirm fix doesn't break anything
5. **Update issue status** in qa-issues.json to `"fixed"` and increment `fix_round`
6. **Commit** the fix with a descriptive message

Log trace events:
```bash
echo '{"ts":"...","phase":"fix","event":"fix_start","detail":"修复中: {issue.id}"}' >> .superharness/tasks/{task}/trace.jsonl
echo '{"ts":"...","phase":"fix","event":"fix_complete","detail":"已修复: {issue.id}"}' >> .superharness/tasks/{task}/trace.jsonl
```

### Step 3: Re-run QA

After fixing all critical and major issues, re-run QA:

```bash
superharness qa --task .superharness/tasks/{task}
```

This performs incremental verification:
- Re-runs all deterministic checks
- Only re-evaluates rubric dimensions related to fixed issues

### Step 4: Check Convergence

If new issues appear or regressions are detected:
- Regression issues (previously fixed, now failing again) get severity bumped one level
- If `fix_round` exceeds `max_fix_rounds` (default 3), mark remaining issues as `"escalated"`
- Report escalated issues to user for manual intervention

## Anti-Oscillation Rules

- **Max 3 fix rounds** per issue (configurable in config.yaml)
- **Regression detection**: same issue id reappearing after fix → severity bumped
- **Two consecutive regressions** → auto-escalate to human
- **Never** fix suggestion-level issues automatically (only if user requests)

## Red Flags

- **Never** skip the failing test step — even for "obvious" fixes
- **Never** mark an issue as fixed without running the test suite
- **Never** exceed max_fix_rounds without escalating
- **Never** fix issues in a different order than severity (critical first)
