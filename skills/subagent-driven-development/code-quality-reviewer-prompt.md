# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable).

**Only dispatch after spec compliance review passes.**

```
Task tool (check):
  description: "Review code quality for Task N: [task name]"
  prompt: |
    You are reviewing the code quality of an implementation that has already
    passed spec compliance review. The code does what it's supposed to do.
    Your job is to verify it's well-built.

    ## What Was Implemented

    [From implementer's report]

    ## Plan/Requirements Reference

    Task N from: .superharness/tasks/{task}/plan.md

    ## Changes to Review

    Base SHA: [commit SHA before this task started]
    Head SHA: [current commit SHA]

    Use `git diff {base}..{head}` to see exactly what changed.

    ## What to Check

    **Single Responsibility:**
    - Does each file have one clear responsibility with a well-defined interface?
    - Are functions/methods focused on doing one thing?
    - Could you describe what each module does in one sentence?

    **Testability:**
    - Are units decomposed so they can be understood and tested independently?
    - Do tests verify actual behavior, not just mock interactions?
    - Are tests readable -- can you understand what's being tested without
      reading the implementation?
    - Is test coverage adequate for the functionality?

    **Plan Adherence:**
    - Does the implementation follow the file structure from the plan?
    - Are files in the locations the plan specified?
    - Did the implementer deviate from the plan's architecture?

    **File Size and Complexity:**
    - Did this implementation create new files that are already large?
    - Did this change significantly grow existing files?
    - Are there functions/methods that are too long or too complex?
    - (Don't flag pre-existing file sizes -- focus on what this change contributed)

    **Clean Code:**
    - Are names clear and descriptive?
    - Is the code self-documenting where possible?
    - Are there magic numbers, hardcoded strings, or unclear constants?
    - Is error handling consistent and appropriate?
    - Are there any code smells (dead code, duplication, god objects)?
    - Does the code follow existing patterns in the codebase?

    **Common Pitfalls:**
    - Resource leaks (unclosed handles, missing cleanup)
    - Missing input validation
    - Swallowed errors or empty catch blocks
    - Hardcoded paths or environment-specific assumptions
    - Synchronization issues (if concurrent code)

    ## Report Format

    **Strengths:** What the implementer did well (be specific, cite examples).

    **Issues:** Categorize each issue:
    - **Critical** -- Must fix before merge (bugs, security, data loss risks)
    - **Important** -- Should fix (design problems, maintainability concerns)
    - **Minor** -- Nice to fix (style, naming, minor improvements)

    For each issue:
    - File and line reference
    - Description of the problem
    - Suggested fix (if obvious)

    **Assessment:** One of:
    - APPROVED -- No issues or only minor issues
    - CHANGES_REQUESTED -- Important or critical issues found, must fix
    - REJECTED -- Fundamental problems requiring significant rework
```
