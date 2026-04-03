---
name: qa
description: "Wrapper skill that invokes the superharness qa CLI command from within the AI tool session."
---

# QA Evaluation

Trigger external QA evaluation by calling the `superharness qa` CLI command.

This skill is a thin wrapper — it runs the CLI and reports results. The actual QA logic lives in the CLI.

## Process

### Step 1: Run QA

```bash
superharness qa --task .superharness/tasks/{task}
```

This will:
- Call configured external QA services (managed HTTP / autonomous command)
- Write `qa-report.md` (human-readable) to the task directory
- Write `qa-issues.json` (machine-readable) to the task directory

### Step 2: Report Results

Read and summarize `qa-report.md` for the user:
- Total checks run
- Passed / Failed counts
- List of issues by severity

### Step 3: Suggest Next Action

If issues were found:
> "QA found {N} issues ({critical} critical, {major} major). Run `/superharness:fix` to address them."

If all passed:
> "QA passed. Ready to finalize with `superharness:finishing-a-development-branch`."

If no external QA services configured:
> "No external QA services configured. Feedback layer checks (test/lint/typecheck) already ran during implementation. To add QA services, configure them in `.superharness/config.yaml` under `qa.services`."
